import { PaymentStatus } from "@prisma/client";
import { Router } from "express";

import { prisma } from "../lib/prisma";
import { constructStripeEvent } from "../services/stripe";
import { asyncHandler } from "../utils/async-handler";
import { broadcastOrderUpdate } from "../services/order-events";

const router = Router();
const prismaAny = prisma as any;

router.post(
  "/stripe/webhook",
  asyncHandler(async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
      res.status(400).json({ message: "Missing Stripe signature" });
      return;
    }

    const event = constructStripeEvent(req.body as Buffer, signature);

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata.orderId;
      if (orderId) {
        const payment = await prisma.payment.findFirst({
          where: {
            orderId,
            providerRef: paymentIntent.id,
          },
          select: { id: true },
        });

        if (payment) {
          await prismaAny.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.PAID,
              paidAt: new Date(),
              metadata: paymentIntent as unknown as object,
            },
          });
        }

        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: PaymentStatus.PAID,
            paymentMethod: "STRIPE",
          },
        });

        await broadcastOrderUpdate(orderId, "order:updated");
      }
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const restaurantId = session.metadata?.restaurantId;
      if (restaurantId) {
        await prisma.restaurantSubscription.updateMany({
          where: { restaurantId },
          data: {
            status: "ACTIVE",
            stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
            currentPeriodEnds: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const restaurantId = invoice.lines.data[0]?.metadata?.restaurantId;
      if (restaurantId) {
        await prisma.restaurantSubscription.updateMany({
          where: { restaurantId },
          data: {
            status: "PAST_DUE",
          },
        });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const restaurantId = subscription.metadata?.restaurantId;
      if (restaurantId) {
        await prisma.restaurantSubscription.updateMany({
          where: { restaurantId },
          data: {
            status: "CANCELED",
          },
        });
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata.orderId;
      if (orderId) {
        await prismaAny.payment.updateMany({
          where: {
            orderId,
            providerRef: paymentIntent.id,
          },
          data: {
            status: PaymentStatus.FAILED,
            metadata: paymentIntent as unknown as object,
          },
        });
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: PaymentStatus.FAILED,
          },
        });
        await broadcastOrderUpdate(orderId, "order:updated");
      }
    }

    res.json({ received: true });
  }),
);

export default router;
