import { OrderItemStatus, OrderStatus, PaymentMethod, ServiceRequestStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { Router } from "express";
import QRCode from "qrcode";
import { z } from "zod";

import { config } from "../config";
import { prisma } from "../lib/prisma";
import { requireAdminAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";
import { paramAsString } from "../utils/http-param";
import { broadcastOrderUpdate, syncOrderStatusFromItems } from "../services/order-events";
import { orderDetailsInclude } from "../services/order-view";
import { createUploadUrl } from "../services/storage";
import { enqueueJob } from "../services/jobs";
import { createStripeSubscriptionCheckout } from "../services/stripe";

const router = Router();
const prismaAny = prisma as any;

router.use(requireAdminAuth);

const categorySchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(250).optional(),
  imageUrl: z.string().url().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

const menuItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  priceCents: z.number().int().positive(),
  compareAtCents: z.number().int().positive().optional(),
  imageUrl: z.string().url().optional(),
  prepTimeMins: z.number().int().min(1).max(120).default(15),
  ingredients: z.array(z.string().min(1)).default([]),
  dietaryTags: z.array(z.string().min(1)).default([]),
  spiceLevel: z.number().int().min(0).max(5).default(0),
  calories: z.number().int().positive().optional(),
  isAvailable: z.boolean().default(true),
  featuredScore: z.number().min(0).max(100).default(0),
  upsellTargets: z.array(z.string().uuid()).default([]),
});

const tableSchema = z.object({
  tableNumber: z.number().int().positive(),
  label: z.string().max(80).optional(),
  zone: z.string().max(80).optional(),
  seats: z.number().int().min(1).max(20).default(4),
});

const analyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const promotionSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().max(40).optional(),
  description: z.string().max(240).optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_ITEM"]),
  discountValue: z.number().int().positive(),
  minSpendCents: z.number().int().positive().optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  autoApply: z.boolean().default(false),
  targetAudience: z.string().max(120).optional(),
});

const campaignSchema = z.object({
  name: z.string().min(2).max(120),
  channel: z.enum(["WHATSAPP", "PUSH", "EMAIL", "SMS"]),
  messageTemplate: z.string().min(5).max(1000),
  audienceRule: z.string().max(240).optional(),
  scheduledFor: z.coerce.date().optional(),
  promotionId: z.string().uuid().optional(),
});

const activeOrderStatuses: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
];

router.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const [restaurant, subscription, orderCount, activeOrders, revenue, serviceRequests] = await Promise.all([
      prismaAny.restaurant.findUnique({
        where: { id: restaurantId },
        select: {
          id: true,
          name: true,
          slug: true,
          currency: true,
          timezone: true,
          onboardingCompleted: true,
          contactPhone: true,
          whatsappNumber: true,
          referralCode: true,
        },
      }),
      prisma.restaurantSubscription.findFirst({
        where: { restaurantId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.count({ where: { restaurantId } }),
      prisma.order.count({
        where: {
          restaurantId,
          status: { in: [OrderStatus.PENDING, OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY] },
        },
      }),
      prisma.order.aggregate({
        where: {
          restaurantId,
          paymentStatus: "PAID",
        },
        _sum: { totalCents: true },
      }),
      prisma.serviceRequest.count({
        where: {
          restaurantId,
          status: ServiceRequestStatus.OPEN,
        },
      }),
    ]);

    res.json({
      restaurant,
      subscription,
      metrics: {
        orderCount,
        activeOrders,
        paidRevenueCents: revenue._sum.totalCents ?? 0,
        openServiceRequests: serviceRequests,
      },
      gameChangers: [
        {
          title: "AI service pulse",
          description: "Cluster service requests and kitchen delay patterns to automatically predict tables at risk.",
        },
        {
          title: "Autonomous revenue flows",
          description: "Trigger WhatsApp reactivation campaigns from churn signals and low visit frequency.",
        },
      ],
    });
  }),
);

router.get(
  "/integrations/status",
  asyncHandler(async (_req, res) => {
    res.json({
      stripe: {
        configured: Boolean(config.stripeSecretKey && config.stripeWebhookSecret),
        publishableKeyPresent: Boolean(config.stripePublishableKey),
      },
      whatsapp: {
        configured: Boolean(
          (config.twilioAccountSid && config.twilioAuthToken && config.twilioWhatsappFrom) || config.whatsappWebhookUrl,
        ),
      },
      storage: {
        configured: Boolean(
          config.awsRegion && config.awsBucket && config.awsAccessKeyId && config.awsSecretAccessKey,
        ),
        bucket: config.awsBucket ?? null,
      },
      upi: {
        configured: Boolean(config.upiVpa),
        vpa: config.upiVpa ?? null,
      },
    });
  }),
);

router.post(
  "/uploads/presign",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const payload = z
      .object({
        filename: z.string().min(3),
        contentType: z.string().min(3),
      })
      .parse(req.body);

    const signed = await createUploadUrl({
      restaurantId,
      filename: payload.filename,
      contentType: payload.contentType,
    });

    if (!signed) {
      res.status(503).json({ message: "Object storage is not configured" });
      return;
    }

    res.json(signed);
  }),
);

router.patch(
  "/restaurant",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const payload = z
      .object({
        name: z.string().min(2).optional(),
        brandName: z.string().min(2).optional(),
        timezone: z.string().min(2).optional(),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().min(8).optional(),
        whatsappNumber: z.string().min(8).optional(),
        logoUrl: z.string().url().optional(),
        heroImageUrl: z.string().url().optional(),
        primaryColor: z.string().min(4).max(10).optional(),
        onboardingCompleted: z.boolean().optional(),
        onboardingStep: z.number().int().min(1).max(10).optional(),
      })
      .parse(req.body);

    const restaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: payload,
    });

    res.json(restaurant);
  }),
);

router.post(
  "/billing/checkout-session",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const adminId = req.auth!.adminId;

    const [restaurant, admin] = await Promise.all([
      prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, name: true },
      }),
      prisma.restaurantAdmin.findUnique({
        where: { id: adminId },
        select: { email: true },
      }),
    ]);

    if (!restaurant || !admin) {
      res.status(404).json({ message: "Restaurant not found" });
      return;
    }

    const session = await createStripeSubscriptionCheckout({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      customerEmail: admin.email,
      successUrl: `${config.frontendUrl}/admin/dashboard?billing=success`,
      cancelUrl: `${config.frontendUrl}/admin/dashboard?billing=cancelled`,
    });

    if (!session?.url) {
      res.status(503).json({ message: "Stripe billing is not configured" });
      return;
    }

    res.json({
      url: session.url,
    });
  }),
);

router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
    });

    res.json(categories);
  }),
);

router.post(
  "/categories",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const payload = categorySchema.parse(req.body);

    const category = await prisma.menuCategory.create({
      data: {
        restaurantId,
        ...payload,
      },
    });

    res.status(201).json(category);
  }),
);

router.put(
  "/categories/:categoryId",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const payload = categorySchema.partial().parse(req.body);
    const categoryId = paramAsString(req.params.categoryId);

    const category = await prisma.menuCategory.findFirst({
      where: { id: categoryId, restaurantId },
      select: { id: true },
    });

    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const updated = await prisma.menuCategory.update({
      where: { id: category.id },
      data: payload,
    });

    res.json(updated);
  }),
);

router.delete(
  "/categories/:categoryId",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const categoryId = paramAsString(req.params.categoryId);
    const category = await prisma.menuCategory.findFirst({
      where: { id: categoryId, restaurantId },
      include: { _count: { select: { menuItems: true } } },
    });

    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    if (category._count.menuItems > 0) {
      res.status(400).json({ message: "Delete menu items first" });
      return;
    }

    await prisma.menuCategory.delete({
      where: { id: category.id },
    });

    res.status(204).send();
  }),
);

router.get(
  "/menu-items",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const items = await prisma.menuItem.findMany({
      where: { restaurantId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    });

    res.json(items);
  }),
);

router.post(
  "/menu-items",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const payload = menuItemSchema.parse(req.body);

    const category = await prisma.menuCategory.findFirst({
      where: { id: payload.categoryId, restaurantId },
      select: { id: true },
    });

    if (!category) {
      res.status(400).json({ message: "Invalid category" });
      return;
    }

    const item = await prisma.menuItem.create({
      data: {
        restaurantId,
        ...payload,
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json(item);
  }),
);

router.put(
  "/menu-items/:itemId",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const payload = menuItemSchema.partial().parse(req.body);
    const itemId = paramAsString(req.params.itemId);

    const existing = await prisma.menuItem.findFirst({
      where: { id: itemId, restaurantId },
      select: { id: true },
    });

    if (!existing) {
      res.status(404).json({ message: "Menu item not found" });
      return;
    }

    if (payload.categoryId) {
      const category = await prisma.menuCategory.findFirst({
        where: { id: payload.categoryId, restaurantId },
        select: { id: true },
      });
      if (!category) {
        res.status(400).json({ message: "Invalid category" });
        return;
      }
    }

    const updated = await prisma.menuItem.update({
      where: { id: itemId },
      data: payload,
      include: { category: { select: { id: true, name: true } } },
    });

    res.json(updated);
  }),
);

router.delete(
  "/menu-items/:itemId",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const itemId = paramAsString(req.params.itemId);
    const existing = await prisma.menuItem.findFirst({
      where: { id: itemId, restaurantId },
      select: { id: true },
    });

    if (!existing) {
      res.status(404).json({ message: "Menu item not found" });
      return;
    }

    await prisma.menuItem.delete({ where: { id: existing.id } });
    res.status(204).send();
  }),
);

router.get(
  "/tables",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const tables = await prisma.table.findMany({
      where: { restaurantId },
      orderBy: { tableNumber: "asc" },
      include: {
        _count: {
          select: { orders: true, serviceRequests: true },
        },
      },
    });

    res.json(tables);
  }),
);

router.post(
  "/tables",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const payload = tableSchema.parse(req.body);

    const table = await prisma.table.create({
      data: {
        restaurantId,
        ...payload,
        qrToken: randomBytes(18).toString("hex"),
        nfcToken: randomBytes(12).toString("hex"),
      },
    });

    res.status(201).json(table);
  }),
);

router.post(
  "/tables/bulk-generate",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const payload = z.object({ start: z.number().int().positive(), end: z.number().int().positive() }).parse(req.body);

    const created = [];
    for (let tableNumber = payload.start; tableNumber <= payload.end; tableNumber += 1) {
      const table = await prisma.table.upsert({
        where: {
          restaurantId_tableNumber: { restaurantId, tableNumber },
        },
        update: {},
        create: {
          restaurantId,
          tableNumber,
          label: `Table ${tableNumber}`,
          qrToken: randomBytes(18).toString("hex"),
          nfcToken: randomBytes(12).toString("hex"),
        },
      });
      created.push(table);
    }

    res.status(201).json(created);
  }),
);

router.put(
  "/tables/:tableId",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const payload = tableSchema.partial().parse(req.body);
    const tableId = paramAsString(req.params.tableId);

    const existing = await prisma.table.findFirst({
      where: { id: tableId, restaurantId },
      select: { id: true },
    });

    if (!existing) {
      res.status(404).json({ message: "Table not found" });
      return;
    }

    const table = await prisma.table.update({
      where: { id: tableId },
      data: payload,
    });

    res.json(table);
  }),
);

router.delete(
  "/tables/:tableId",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const tableId = paramAsString(req.params.tableId);

    const existing = await prisma.table.findFirst({
      where: { id: tableId, restaurantId },
      select: { id: true },
    });

    if (!existing) {
      res.status(404).json({ message: "Table not found" });
      return;
    }

    await prisma.table.delete({ where: { id: tableId } });
    res.status(204).send();
  }),
);

router.get(
  "/tables/:tableId/qr",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const tableId = paramAsString(req.params.tableId);

    const [restaurant, table] = await Promise.all([
      prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { slug: true, name: true },
      }),
      prisma.table.findFirst({
        where: { id: tableId, restaurantId },
        select: { id: true, tableNumber: true, label: true, qrToken: true, nfcToken: true },
      }),
    ]);

    if (!restaurant || !table) {
      res.status(404).json({ message: "Table not found" });
      return;
    }

    const menuUrl = `${config.frontendUrl}/r/${restaurant.slug}/menu?tableToken=${table.qrToken}`;
    const qrCodeDataUrl = await QRCode.toDataURL(menuUrl, {
      width: 360,
      margin: 1,
    });

    res.json({
      table,
      menuUrl,
      nfcUrl: `${config.frontendUrl}/nfc/${table.nfcToken}`,
      qrCodeDataUrl,
      printableText: `${restaurant.name} | Table ${table.tableNumber}`,
    });
  }),
);

router.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;

    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        ...(status ? { status: status as OrderStatus } : {}),
      },
      include: orderDetailsInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    res.json(orders);
  }),
);

router.patch(
  "/orders/:orderId/status",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const payload = z.object({ status: z.nativeEnum(OrderStatus) }).parse(req.body);
    const orderId = paramAsString(req.params.orderId);

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        restaurantId,
      },
      select: { id: true },
    });

    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { status: payload.status },
    });

    await broadcastOrderUpdate(order.id, "order:updated");
    res.status(204).send();
  }),
);

router.patch(
  "/orders/:orderId/items/:itemId/status",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const payload = z.object({ status: z.nativeEnum(OrderItemStatus) }).parse(req.body);
    const orderId = paramAsString(req.params.orderId);
    const itemId = paramAsString(req.params.itemId);

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        restaurantId,
      },
      select: { id: true },
    });

    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    const orderItem = await prisma.orderItem.findFirst({
      where: {
        id: itemId,
        orderId,
      },
      select: { id: true },
    });

    if (!orderItem) {
      res.status(404).json({ message: "Order item not found" });
      return;
    }

    await prisma.orderItem.update({
      where: { id: orderItem.id },
      data: { status: payload.status },
    });
    await syncOrderStatusFromItems(orderId);

    await broadcastOrderUpdate(orderId, "order:updated");
    res.status(204).send();
  }),
);

router.get(
  "/customers",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const customers = await prisma.customer.findMany({
      where: { restaurantId },
      include: {
        loyaltyAccount: true,
      },
      orderBy: { lastVisitedAt: "desc" },
      take: 200,
    });

    res.json(customers);
  }),
);

router.get(
  "/promotions",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const promotions = await prisma.promotion.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
    });
    res.json(promotions);
  }),
);

router.post(
  "/promotions",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const payload = promotionSchema.parse(req.body);
    const promotion = await prisma.promotion.create({
      data: {
        restaurantId,
        ...payload,
      },
    });
    res.status(201).json(promotion);
  }),
);

router.get(
  "/campaigns",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const campaigns = await prisma.marketingCampaign.findMany({
      where: { restaurantId },
      include: {
        promotion: {
          select: { name: true, code: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(campaigns);
  }),
);

router.post(
  "/campaigns",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const payload = campaignSchema.parse(req.body);
    const campaign = await prisma.marketingCampaign.create({
      data: {
        restaurantId,
        ...payload,
        status: payload.scheduledFor ? "SCHEDULED" : "DRAFT",
      },
    });

    if (!payload.scheduledFor) {
      const customers = await prisma.customer.findMany({
        where: {
          restaurantId,
          phone: {
            not: null,
          },
          marketingOptIn: true,
        },
        select: {
          phone: true,
        },
        take: 100,
      });

      await Promise.all(
        customers
          .filter((customer) => customer.phone)
          .map((customer) =>
            enqueueJob({
              restaurantId,
              type: "SEND_CAMPAIGN_MESSAGE",
              payload: {
                campaignId: campaign.id,
                customerPhone: customer.phone!,
                message: payload.messageTemplate,
              },
            }),
          ),
      );
    }
    res.status(201).json(campaign);
  }),
);

router.get(
  "/analytics/summary",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const { days } = analyticsQuerySchema.parse(req.query);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [orders, customers, openRequests, acceptedUpsells] = await Promise.all([
      prisma.order.findMany({
        where: {
          restaurantId,
          createdAt: {
            gte: startDate,
          },
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalCents: true,
          aiUpsellAccepted: true,
          paymentMethod: true,
          createdAt: true,
          tableId: true,
          table: {
            select: {
              tableNumber: true,
            },
          },
          customerId: true,
          items: {
            select: {
              itemName: true,
              quantity: true,
              itemPriceCents: true,
            },
          },
        },
      }),
      prisma.customer.findMany({
        where: {
          restaurantId,
          lastVisitedAt: { gte: startDate },
        },
        select: {
          id: true,
          visitCount: true,
        },
      }),
      prisma.serviceRequest.count({
        where: {
          restaurantId,
          createdAt: { gte: startDate },
          status: ServiceRequestStatus.OPEN,
        },
      }),
      prisma.recommendationEvent.count({
        where: {
          restaurantId,
          createdAt: { gte: startDate },
          accepted: true,
        },
      }),
    ]);

    const orderCount = orders.length;
    const completedRevenueCents = orders
      .filter((order) => order.status !== OrderStatus.CANCELLED)
      .reduce((sum, order) => sum + order.totalCents, 0);
    const averageOrderValueCents = orderCount > 0 ? Math.round(completedRevenueCents / orderCount) : 0;

    const ordersByStatus = orders.reduce<Record<string, number>>((acc, order) => {
      acc[order.status] = (acc[order.status] ?? 0) + 1;
      return acc;
    }, {});

    const itemStats = new Map<string, { quantity: number; salesCents: number }>();
    const hourStats = new Map<string, number>();
    const paymentMix = new Map<string, number>();
    const tableRevenue = new Map<string, number>();

    for (const order of orders) {
      const hour = new Date(order.createdAt).getHours().toString().padStart(2, "0");
      hourStats.set(hour, (hourStats.get(hour) ?? 0) + 1);
      paymentMix.set(order.paymentMethod ?? PaymentMethod.CASH, (paymentMix.get(order.paymentMethod ?? PaymentMethod.CASH) ?? 0) + 1);
      const tableKey = order.table?.tableNumber ? `Table ${order.table.tableNumber}` : "Counter";
      tableRevenue.set(tableKey, (tableRevenue.get(tableKey) ?? 0) + order.totalCents);

      for (const item of order.items) {
        const existing = itemStats.get(item.itemName) ?? { quantity: 0, salesCents: 0 };
        existing.quantity += item.quantity;
        existing.salesCents += item.quantity * item.itemPriceCents;
        itemStats.set(item.itemName, existing);
      }
    }

    const repeatCustomers = customers.filter((customer) => customer.visitCount > 1).length;

    res.json({
      days,
      from: startDate,
      to: new Date(),
      orderCount,
      activeOrders: orders.filter((order) => activeOrderStatuses.includes(order.status)).length,
      completedRevenueCents,
      averageOrderValueCents,
      repeatCustomers,
      openServiceRequests: openRequests,
      upsellSuccessRate: orderCount > 0 ? Number(((acceptedUpsells / orderCount) * 100).toFixed(1)) : 0,
      ordersByStatus,
      topItems: [...itemStats.entries()]
        .map(([name, stats]) => ({
          name,
          quantity: stats.quantity,
          salesCents: stats.salesCents,
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10),
      peakHours: [...hourStats.entries()]
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour.localeCompare(b.hour)),
      revenuePerTable: [...tableRevenue.entries()]
        .map(([table, revenueCents]) => ({ table, revenueCents }))
        .sort((a, b) => b.revenueCents - a.revenueCents),
      paymentMix: [...paymentMix.entries()].map(([method, count]) => ({ method, count })),
    });
  }),
);

router.get(
  "/analytics/export",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const orders = await prisma.order.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        table: {
          select: { tableNumber: true },
        },
      },
    });

    const csv = [
      "orderNumber,status,totalCents,paymentStatus,paymentMethod,table,createdAt",
      ...orders.map((order) =>
        [
          order.orderNumber,
          order.status,
          order.totalCents,
          order.paymentStatus,
          order.paymentMethod ?? "",
          order.table?.tableNumber ?? "",
          order.createdAt.toISOString(),
        ].join(","),
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="smarttable-report.csv"');
    res.send(csv);
  }),
);

export default router;
