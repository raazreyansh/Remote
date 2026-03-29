import { OrderItemStatus, OrderStatus } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { emitRestaurantEvent } from "../lib/socket";
import { orderDetailsInclude } from "./order-view";

export const getOrderWithDetails = async (orderId: string) =>
  prisma.order.findUnique({
    where: { id: orderId },
    include: {
      ...orderDetailsInclude,
      restaurant: {
        select: {
          id: true,
          name: true,
          slug: true,
          currency: true,
        },
      },
    },
  });

export const broadcastOrderUpdate = async (orderId: string, event: "order:new" | "order:updated") => {
  const order = await getOrderWithDetails(orderId);
  if (!order) {
    return;
  }

  emitRestaurantEvent(order.restaurantId, event, order);
};

export const deriveOrderStatusFromItems = (itemStatuses: OrderItemStatus[]): OrderStatus | null => {
  if (itemStatuses.length === 0) {
    return null;
  }

  if (itemStatuses.every((status) => status === OrderItemStatus.SERVED)) {
    return OrderStatus.SERVED;
  }

  if (itemStatuses.every((status) => status === OrderItemStatus.READY || status === OrderItemStatus.SERVED)) {
    return OrderStatus.READY;
  }

  if (itemStatuses.some((status) => status === OrderItemStatus.PREPARING)) {
    return OrderStatus.PREPARING;
  }

  if (itemStatuses.every((status) => status === OrderItemStatus.PENDING)) {
    return OrderStatus.ACCEPTED;
  }

  return null;
};

export const syncOrderStatusFromItems = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      items: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!order) {
    return;
  }

  const nextStatus = deriveOrderStatusFromItems(order.items.map((item) => item.status));
  if (!nextStatus || nextStatus === order.status) {
    return;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: nextStatus },
  });
};
