import { PaymentMethod, PaymentOption, PaymentStatus, RecommendationContext, ServiceRequestType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/async-handler";
import { paramAsString } from "../utils/http-param";
import { broadcastOrderUpdate, getOrderWithDetails } from "../services/order-events";
import { orderDetailsInclude } from "../services/order-view";
import { buildRecommendations, markRecommendationAccepted } from "../services/recommendations";
import { buildReceiptUrl } from "../services/receipts";
import { enqueueJob } from "../services/jobs";
import { config } from "../config";
import { createRazorpayOrder, verifyRazorpayPayment } from "../services/razorpay";

const router = Router();
const prismaAny = prisma as any;

const createOrderSchema = z.object({
  tableToken: z.string().optional(),
  customerName: z.string().min(2).max(60).optional(),
  customerPhone: z.string().min(8).max(20).optional(),
  customerEmail: z.string().email().optional(),
  preferredLanguage: z.string().min(2).max(8).default("en"),
  specialNotes: z.string().max(500).optional(),
  promotionCode: z.string().max(40).optional(),
  paymentOption: z.nativeEnum(PaymentOption).default(PaymentOption.PAY_AT_COUNTER),
  splitGroupCode: z.string().max(50).optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().positive().max(20),
        specialNotes: z.string().max(300).optional(),
        customizations: z.record(z.string(), z.any()).optional(),
      }),
    )
    .min(1),
});

const paymentSchema = z.object({
  method: z.nativeEnum(PaymentMethod),
  paidAtCounter: z.boolean().default(false),
});

const paymentIntentSchema = z.object({
  method: z.enum(["CARD", "UPI", "APPLE_PAY"]),
});

const paymentVerificationSchema = z.object({
  razorpayOrderId: z.string().min(3),
  razorpayPaymentId: z.string().min(3),
  razorpaySignature: z.string().min(3),
});

const serviceRequestSchema = z.object({
  tableToken: z.string().optional(),
  orderId: z.string().uuid().optional(),
  type: z.nativeEnum(ServiceRequestType),
  message: z.string().max(240).optional(),
});

router.get(
  "/restaurants/:slug/menu",
  asyncHandler(async (req, res) => {
    const slug = paramAsString(req.params.slug).toLowerCase();
    const tableToken = typeof req.query.tableToken === "string" ? req.query.tableToken : undefined;
    const language = typeof req.query.lang === "string" ? req.query.lang : "en";

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        currency: true,
        primaryColor: true,
        logoUrl: true,
        heroImageUrl: true,
        whatsappNumber: true,
      },
    });

    if (!restaurant) {
      res.status(404).json({ message: "Restaurant not found" });
      return;
    }

    const [table, categories, promotions, trending, recommendations] = await Promise.all([
      tableToken
        ? prisma.table.findFirst({
            where: {
              restaurantId: restaurant.id,
              qrToken: tableToken,
            },
            select: {
              id: true,
              tableNumber: true,
              label: true,
              zone: true,
              seats: true,
            },
          })
        : Promise.resolve(null),
      prisma.menuCategory.findMany({
        where: { restaurantId: restaurant.id },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          menuItems: {
            where: { isAvailable: true },
            orderBy: [{ featuredScore: "desc" }, { name: "asc" }],
            include: {
              modifierGroups: {
                orderBy: { sortOrder: "asc" },
                include: {
                  options: true,
                },
              },
            },
          },
        },
      }),
      prisma.promotion.findMany({
        where: {
          restaurantId: restaurant.id,
          active: true,
          startAt: { lte: new Date() },
          endAt: { gte: new Date() },
        },
        take: 3,
        orderBy: { startAt: "asc" },
      }),
      prisma.menuItem.findMany({
        where: { restaurantId: restaurant.id, isAvailable: true },
        orderBy: [{ featuredScore: "desc" }, { updatedAt: "desc" }],
        take: 6,
      }),
      buildRecommendations({
        restaurantId: restaurant.id,
        context: RecommendationContext.CART,
      }),
    ]);

    res.json({
      restaurant,
      table,
      language,
      categories,
      promotions,
      trending,
      recommendations,
      experience: {
        supportsSplitBill: true,
        supportsVoiceAssistant: true,
        supportsArPreview: true,
        supportsSocialSharing: true,
        supportsTablePayment: true,
        supportsCounterPayment: true,
      },
    });
  }),
);

router.get(
  "/restaurants/:slug/recommendations",
  asyncHandler(async (req, res) => {
    const slug = paramAsString(req.params.slug).toLowerCase();
    const menuItemId = typeof req.query.menuItemId === "string" ? req.query.menuItemId : undefined;
    const cartMenuItemIds =
      typeof req.query.cartMenuItemIds === "string" ? req.query.cartMenuItemIds.split(",").filter(Boolean) : [];

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!restaurant) {
      res.status(404).json({ message: "Restaurant not found" });
      return;
    }

    const recommendations = await buildRecommendations({
      restaurantId: restaurant.id,
      menuItemId,
      cartMenuItemIds,
      context: RecommendationContext.CART,
    });

    res.json(recommendations);
  }),
);

router.post(
  "/restaurants/:slug/orders",
  asyncHandler(async (req, res) => {
    const slug = paramAsString(req.params.slug).toLowerCase();
    const payload = createOrderSchema.parse(req.body);

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        currency: true,
      },
    });

    if (!restaurant) {
      res.status(404).json({ message: "Restaurant not found" });
      return;
    }

    let tableId: string | undefined;
    if (payload.tableToken) {
      const table = await prisma.table.findFirst({
        where: {
          restaurantId: restaurant.id,
          qrToken: payload.tableToken,
        },
        select: { id: true },
      });

      if (!table) {
        res.status(400).json({ message: "Invalid table token" });
        return;
      }

      tableId = table.id;
    }

    const uniqueIds = [...new Set(payload.items.map((item) => item.menuItemId))];
    const menuItems = await prisma.menuItem.findMany({
      where: {
        restaurantId: restaurant.id,
        id: { in: uniqueIds },
        isAvailable: true,
      },
      select: {
        id: true,
        name: true,
        priceCents: true,
      },
    });

    const menuItemMap = new Map<string, (typeof menuItems)[number]>(menuItems.map((item) => [item.id, item]));
    for (const orderItem of payload.items) {
      if (!menuItemMap.has(orderItem.menuItemId)) {
        res.status(400).json({
          message: `Item ${orderItem.menuItemId} is unavailable`,
        });
        return;
      }
    }

    const promotion = payload.promotionCode
      ? await prisma.promotion.findFirst({
          where: {
            restaurantId: restaurant.id,
            active: true,
            code: payload.promotionCode,
            startAt: { lte: new Date() },
            endAt: { gte: new Date() },
          },
        })
      : null;

    const subtotalCents = payload.items.reduce((sum, item) => {
      const menuItem = menuItemMap.get(item.menuItemId)!;
      return sum + menuItem.priceCents * item.quantity;
    }, 0);

    const discountCents = promotion
      ? promotion.discountType === "PERCENTAGE"
        ? Math.round((subtotalCents * promotion.discountValue) / 100)
        : Math.min(subtotalCents, promotion.discountValue)
      : 0;
    const taxCents = Math.round((subtotalCents - discountCents) * 0.05);
    const serviceChargeCents = payload.paymentOption === PaymentOption.PAY_AT_TABLE ? Math.round(subtotalCents * 0.03) : 0;
    const totalCents = subtotalCents - discountCents + taxCents + serviceChargeCents;

    const order = await prisma.$transaction(async (tx) => {
      let customerId: string | undefined;
      if (payload.customerPhone) {
        const customer = await tx.customer.upsert({
          where: {
            restaurantId_phone: {
              restaurantId: restaurant.id,
              phone: payload.customerPhone,
            },
          },
          update: {
            fullName: payload.customerName,
            email: payload.customerEmail,
            preferredLanguage: payload.preferredLanguage,
            visitCount: { increment: 1 },
            totalSpentCents: { increment: totalCents },
            lastVisitedAt: new Date(),
          },
          create: {
            restaurantId: restaurant.id,
            fullName: payload.customerName,
            phone: payload.customerPhone,
            email: payload.customerEmail,
            preferredLanguage: payload.preferredLanguage,
            visitCount: 1,
            totalSpentCents: totalCents,
            lastVisitedAt: new Date(),
          },
        });

        customerId = customer.id;
        await tx.loyaltyAccount.upsert({
          where: { customerId: customer.id },
          update: {
            pointsBalance: { increment: Math.floor(totalCents / 100) },
          },
          create: {
            restaurantId: restaurant.id,
            customerId: customer.id,
            pointsBalance: Math.floor(totalCents / 100),
          },
        });
      }

      const latestOrder = await tx.order.findFirst({
        where: { restaurantId: restaurant.id },
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
      });

      const created = await tx.order.create({
        data: {
          restaurantId: restaurant.id,
          customerId,
          tableId,
          orderNumber: (latestOrder?.orderNumber ?? 0) + 1,
          customerName: payload.customerName,
          customerPhone: payload.customerPhone,
          specialNotes: payload.specialNotes,
          paymentOption: payload.paymentOption,
          splitGroupCode: payload.splitGroupCode,
          languageCode: payload.preferredLanguage,
          subtotalCents,
          taxCents,
          serviceChargeCents,
          discountCents,
          totalCents,
          promotionId: promotion?.id,
          aiUpsellAccepted: payload.items.some((item) => item.menuItemId !== payload.items[0]?.menuItemId),
          items: {
            create: payload.items.map((item) => {
              const menuItem = menuItemMap.get(item.menuItemId)!;
              return {
                menuItem: {
                  connect: {
                    id: menuItem.id,
                  },
                },
                itemName: menuItem.name,
                itemPriceCents: menuItem.priceCents,
                quantity: item.quantity,
                lineTotalCents: item.quantity * menuItem.priceCents,
                specialNotes: item.specialNotes,
                customizationJson: item.customizations,
              };
            }),
          },
        },
        select: { id: true, customerId: true },
      });

      if (created.customerId) {
        const loyaltyAccount = await tx.loyaltyAccount.findUnique({
          where: { customerId: created.customerId },
          select: { id: true },
        });
        if (loyaltyAccount) {
          await tx.loyaltyLedger.create({
            data: {
              loyaltyAccountId: loyaltyAccount.id,
              orderId: created.id,
              type: "EARN",
              points: Math.floor(totalCents / 100),
              note: "Order reward",
            },
          });
        }
      }

      return created;
    });

    await Promise.all(
      payload.items.map((item) => markRecommendationAccepted(restaurant.id, item.menuItemId)),
    );

    await broadcastOrderUpdate(order.id, "order:new");

    const created = await getOrderWithDetails(order.id);
    res.status(201).json(created);
  }),
);

router.get(
  "/restaurants/:slug/orders/:orderId",
  asyncHandler(async (req, res) => {
    const slug = paramAsString(req.params.slug).toLowerCase();
    const orderId = paramAsString(req.params.orderId);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        ...orderDetailsInclude,
        restaurant: {
          select: {
            id: true,
            slug: true,
            name: true,
            currency: true,
            whatsappNumber: true,
          },
        },
      },
    });

    if (!order || order.restaurant.slug !== slug) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    const loyalty =
      order.customerId &&
      (await prisma.loyaltyAccount.findUnique({
        where: { customerId: order.customerId },
        select: {
          pointsBalance: true,
          tierName: true,
        },
      }));

    res.json({
      ...order,
      loyalty,
      liveTracking: {
        showEta: true,
        etaMinutes: order.status === "READY" || order.status === "SERVED" ? 0 : 12,
      },
    });
  }),
);

router.patch(
  "/restaurants/:slug/orders/:orderId/payment-intent",
  asyncHandler(async (req, res) => {
    const slug = paramAsString(req.params.slug).toLowerCase();
    const orderId = paramAsString(req.params.orderId);
    const payload = paymentIntentSchema.parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: {
          select: {
            id: true,
            slug: true,
            name: true,
            currency: true,
          },
        },
      },
    });

    if (!order || order.restaurant.slug !== slug) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    const razorpayOrder = await createRazorpayOrder({
      amountCents: order.totalCents,
      currency: order.restaurant.currency,
      orderId: order.id,
      restaurantName: order.restaurant.name,
    });

    if (!razorpayOrder || !config.razorpayKeyId) {
      res.status(503).json({ message: "Razorpay is not configured" });
      return;
    }

    const payment = await prismaAny.payment.create({
      data: {
        orderId: order.id,
        amountCents: order.totalCents,
        currency: order.restaurant.currency,
        method:
          payload.method === "UPI"
            ? PaymentMethod.UPI
            : payload.method === "APPLE_PAY"
              ? PaymentMethod.APPLE_PAY
              : PaymentMethod.CARD,
        status: PaymentStatus.PENDING,
        provider: "razorpay",
        providerRef: razorpayOrder.id,
        metadata: {
          razorpayOrderId: razorpayOrder.id,
        },
      },
    });

    res.json({
      provider: "razorpay",
      paymentId: payment.id,
      keyId: config.razorpayKeyId,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      name: order.restaurant.name,
      description: `Order #${order.orderNumber}`,
      prefill: {
        name: order.customerName ?? "",
        contact: order.customerPhone ?? "",
      },
      method: payload.method,
    });
  }),
);

router.post(
  "/restaurants/:slug/orders/:orderId/payment/verify",
  asyncHandler(async (req, res) => {
    const slug = paramAsString(req.params.slug).toLowerCase();
    const orderId = paramAsString(req.params.orderId);
    const payload = paymentVerificationSchema.parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: {
          select: {
            id: true,
            slug: true,
            name: true,
            currency: true,
          },
        },
      },
    });

    if (!order || order.restaurant.slug !== slug) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    const verified = verifyRazorpayPayment(payload);
    if (!verified) {
      res.status(400).json({ message: "Payment verification failed" });
      return;
    }

    const receiptUrl = buildReceiptUrl(order.restaurant.slug, order.id);
    const payment = await prismaAny.payment.updateMany({
      where: {
        orderId: order.id,
        provider: "razorpay",
        providerRef: payload.razorpayOrderId,
      },
      data: {
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        receiptUrl,
        metadata: payload,
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.UPI,
        whatsappReceiptUrl: receiptUrl,
        receiptNumber: `ST-${order.orderNumber.toString().padStart(5, "0")}`,
      },
    });

    await enqueueJob({
      restaurantId: order.restaurant.id,
      type: "SEND_WHATSAPP_RECEIPT",
      payload: {
        restaurantName: order.restaurant.name,
        orderId: order.id,
        phone: order.customerPhone,
        amountCents: order.totalCents,
        currency: order.restaurant.currency,
        receiptUrl,
      },
    });

    await broadcastOrderUpdate(order.id, "order:updated");

    res.json({
      success: true,
      receiptUrl,
      updatedPayments: payment.count,
    });
  }),
);

router.patch(
  "/restaurants/:slug/orders/:orderId/payment",
  asyncHandler(async (req, res) => {
    const slug = paramAsString(req.params.slug).toLowerCase();
    const orderId = paramAsString(req.params.orderId);
    const payload = paymentSchema.parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: {
          select: {
            id: true,
            slug: true,
            name: true,
            currency: true,
          },
        },
      },
    });

    if (!order || order.restaurant.slug !== slug) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    const receiptUrl = buildReceiptUrl(order.restaurant.slug, order.id);
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        amountCents: order.totalCents,
        currency: order.restaurant.currency,
        method: payload.method,
        status: PaymentStatus.PAID,
        provider: payload.method === PaymentMethod.UPI ? "upi" : payload.method === PaymentMethod.STRIPE ? "stripe" : "manual",
        providerRef: `${payload.method}-${Date.now()}`,
        paidAt: new Date(),
        receiptUrl,
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: payload.method,
        whatsappReceiptUrl: receiptUrl,
        receiptNumber: `ST-${order.orderNumber.toString().padStart(5, "0")}`,
      },
    });

    await enqueueJob({
      restaurantId: order.restaurant.id,
      type: "SEND_WHATSAPP_RECEIPT",
      payload: {
        restaurantName: order.restaurant.name,
        orderId: order.id,
        phone: order.customerPhone,
        amountCents: order.totalCents,
        currency: order.restaurant.currency,
        receiptUrl,
        paymentId: payment.id,
      },
    });

    await broadcastOrderUpdate(order.id, "order:updated");

    res.json({
      success: true,
      payment,
      receiptUrl,
      whatsapp: {
        delivered: false,
        reason: "queued",
      },
    });
  }),
);

router.post(
  "/restaurants/:slug/service-requests",
  asyncHandler(async (req, res) => {
    const slug = paramAsString(req.params.slug).toLowerCase();
    const payload = serviceRequestSchema.parse(req.body);

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!restaurant) {
      res.status(404).json({ message: "Restaurant not found" });
      return;
    }

    const table = payload.tableToken
      ? await prisma.table.findFirst({
          where: {
            restaurantId: restaurant.id,
            qrToken: payload.tableToken,
          },
          select: { id: true },
        })
      : null;

    const request = await prisma.serviceRequest.create({
      data: {
        restaurantId: restaurant.id,
        tableId: table?.id,
        orderId: payload.orderId,
        type: payload.type,
        message: payload.message,
      },
    });

    res.status(201).json(request);
  }),
);

export default router;
