import bcrypt from "bcryptjs";
import { Router } from "express";
import { SubscriptionPlan } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { signAdminToken } from "../lib/token";
import { requireAdminAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";

const router = Router();
const prismaAny = prisma as any;

const registerSchema = z.object({
  restaurantName: z.string().min(2),
  restaurantSlug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/),
  currency: z.string().length(3).default("USD"),
  timezone: z.string().min(2).default("Asia/Kolkata"),
  countryCode: z.string().min(2).max(3).default("IN"),
  contactPhone: z.string().min(8).optional(),
  whatsappNumber: z.string().min(8).optional(),
  couponCode: z.string().max(40).optional(),
  referralCode: z.string().max(60).optional(),
  adminName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  planCode: z.nativeEnum(SubscriptionPlan).default(SubscriptionPlan.GROWTH),
});

const loginSchema = z.object({
  restaurantSlug: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

router.post(
  "/admin/register",
  asyncHandler(async (req, res) => {
    const payload = registerSchema.parse(req.body);
    const email = payload.email.toLowerCase();
    const passwordHash = await bcrypt.hash(payload.password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const existingLaunchCount =
        payload.couponCode === "LAUNCH500" ? await tx.restaurant.count() : 0;
      const trialDays = payload.couponCode === "LAUNCH500" && existingLaunchCount < 500 ? 60 : 14;
      const referrer = payload.referralCode
        ? await (tx as any).restaurant.findUnique({
            where: { referralCode: payload.referralCode },
            select: { id: true, referralCount: true },
          })
        : null;

      const restaurant = await tx.restaurant.create({
        data: {
          name: payload.restaurantName,
          slug: payload.restaurantSlug.toLowerCase(),
          currency: payload.currency.toUpperCase(),
          timezone: payload.timezone,
          countryCode: payload.countryCode.toUpperCase(),
          contactPhone: payload.contactPhone,
          whatsappNumber: payload.whatsappNumber,
          onboardingCompleted: false,
        },
      });

      const admin = await tx.restaurantAdmin.create({
        data: {
          restaurantId: restaurant.id,
          fullName: payload.adminName,
          email,
          passwordHash,
          role: "OWNER",
        },
      });

      await tx.restaurantSubscription.create({
        data: {
          restaurantId: restaurant.id,
          planCode: payload.planCode,
          status: "TRIALING",
          billingCycle: "MONTHLY",
          trialEndsAt: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000),
        },
      });

      if (referrer) {
        const updatedReferrer = await (tx as any).restaurant.update({
          where: { id: referrer.id },
          data: {
            referralCount: {
              increment: 1,
            },
          },
          select: {
            id: true,
            referralCount: true,
          },
        });

        if (updatedReferrer.referralCount % 3 === 0) {
          const referrerSubscription = await tx.restaurantSubscription.findFirst({
            where: { restaurantId: referrer.id },
            orderBy: { createdAt: "desc" },
          });

          if (referrerSubscription) {
            const baseDate = referrerSubscription.currentPeriodEnds ?? referrerSubscription.trialEndsAt ?? new Date();
            await tx.restaurantSubscription.update({
              where: { id: referrerSubscription.id },
              data: {
                currentPeriodEnds: new Date(baseDate.getTime() + 90 * 24 * 60 * 60 * 1000),
              },
            });
          }
        }
      }

      return { restaurant, admin };
    });

    const token = signAdminToken({
      adminId: result.admin.id,
      restaurantId: result.restaurant.id,
      email: result.admin.email,
    });

    res.status(201).json({
      token,
      admin: {
        id: result.admin.id,
        fullName: result.admin.fullName,
        email: result.admin.email,
        role: result.admin.role,
      },
      restaurant: {
        id: result.restaurant.id,
        name: result.restaurant.name,
        slug: result.restaurant.slug,
        currency: result.restaurant.currency,
        timezone: result.restaurant.timezone,
        onboardingCompleted: result.restaurant.onboardingCompleted,
        referralCode: result.restaurant.referralCode,
      },
    });
  }),
);

router.post(
  "/admin/login",
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const email = payload.email.toLowerCase();

      const restaurant = await prismaAny.restaurant.findUnique({
        where: { slug: payload.restaurantSlug.toLowerCase() },
      select: {
        id: true,
        name: true,
        slug: true,
        currency: true,
        timezone: true,
        onboardingCompleted: true,
        referralCode: true,
      },
    });

    if (!restaurant) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const admin = await prisma.restaurantAdmin.findFirst({
      where: {
        restaurantId: restaurant.id,
        email,
      },
    });

    if (!admin) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const validPassword = await bcrypt.compare(payload.password, admin.passwordHash);
    if (!validPassword) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const token = signAdminToken({
      adminId: admin.id,
      restaurantId: restaurant.id,
      email: admin.email,
    });

    res.json({
      token,
      admin: {
        id: admin.id,
        fullName: admin.fullName,
        email: admin.email,
        role: admin.role,
      },
      restaurant,
    });
  }),
);

router.get(
  "/admin/me",
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const [admin, restaurant, subscription] = await Promise.all([
      prisma.restaurantAdmin.findUnique({
        where: { id: auth.adminId },
        select: { id: true, fullName: true, email: true, role: true },
      }),
      prismaAny.restaurant.findUnique({
        where: { id: auth.restaurantId },
        select: {
          id: true,
          name: true,
          slug: true,
          currency: true,
          timezone: true,
          onboardingCompleted: true,
          referralCode: true,
        },
      }),
      prisma.restaurantSubscription.findFirst({
        where: { restaurantId: auth.restaurantId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (!admin || !restaurant) {
      res.status(404).json({ message: "Session no longer valid" });
      return;
    }

    res.json({ admin, restaurant, subscription });
  }),
);

export default router;
