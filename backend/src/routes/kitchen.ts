import { OrderItemStatus, OrderStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireAdminAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";
import { paramAsString } from "../utils/http-param";
import { broadcastOrderUpdate, syncOrderStatusFromItems } from "../services/order-events";
import { orderDetailsInclude } from "../services/order-view";

const router = Router();

router.use(requireAdminAuth);

router.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const onlyActive = req.query.active !== "false";

    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        ...(onlyActive
          ? {
              status: {
                in: [OrderStatus.PENDING, OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY],
              },
            }
          : {}),
      },
      include: orderDetailsInclude,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: 200,
    });

    res.json(orders);
  }),
);

router.patch(
  "/orders/:orderId/status",
  asyncHandler(async (req, res) => {
    const restaurantId = req.auth!.restaurantId;
    const payload = z
      .object({
        status: z.enum([
          OrderStatus.ACCEPTED,
          OrderStatus.PREPARING,
          OrderStatus.READY,
          OrderStatus.SERVED,
          OrderStatus.COMPLETED,
        ]),
      })
      .parse(req.body);
    const orderId = paramAsString(req.params.orderId);

    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId },
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
    const payload = z
      .object({
        status: z.enum([OrderItemStatus.PREPARING, OrderItemStatus.READY, OrderItemStatus.SERVED]),
      })
      .parse(req.body);
    const orderId = paramAsString(req.params.orderId);
    const itemId = paramAsString(req.params.itemId);

    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      select: { id: true },
    });

    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    const item = await prisma.orderItem.findFirst({
      where: {
        id: itemId,
        orderId,
      },
      select: { id: true },
    });

    if (!item) {
      res.status(404).json({ message: "Order item not found" });
      return;
    }

    await prisma.orderItem.update({
      where: { id: item.id },
      data: { status: payload.status },
    });

    await syncOrderStatusFromItems(orderId);
    await broadcastOrderUpdate(orderId, "order:updated");

    res.status(204).send();
  }),
);

export default router;
