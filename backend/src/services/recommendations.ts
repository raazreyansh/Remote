import { RecommendationContext } from "@prisma/client";

import { prisma } from "../lib/prisma";

type RecommendationInput = {
  restaurantId: string;
  menuItemId?: string;
  cartMenuItemIds?: string[];
  context?: RecommendationContext;
};

type RecommendationResult = {
  reason: string;
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    priceCents: number;
    prepTimeMins: number;
    dietaryTags: string[];
  }>;
};

const timeOfDayCategory = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 11) {
    return "breakfast";
  }
  if (hour < 17) {
    return "lunch";
  }
  return "dinner";
};

export const buildRecommendations = async ({
  restaurantId,
  menuItemId,
  cartMenuItemIds = [],
  context = RecommendationContext.CART,
}: RecommendationInput): Promise<RecommendationResult> => {
  const anchorIds = [menuItemId, ...cartMenuItemIds].filter(Boolean) as string[];
  const anchorItems = anchorIds.length
    ? await prisma.menuItem.findMany({
        where: {
          restaurantId,
          id: { in: anchorIds },
        },
        select: {
          id: true,
          name: true,
          upsellTargets: true,
          dietaryTags: true,
        },
      })
    : [];

  const explicitUpsells = [...new Set(anchorItems.flatMap((item) => item.upsellTargets))];

  const coOrderedPairs = anchorIds.length
    ? await prisma.orderItem.findMany({
        where: {
          order: {
            restaurantId,
            status: {
              in: ["READY", "SERVED", "COMPLETED"],
            },
          },
          menuItemId: { in: anchorIds },
        },
        select: {
          orderId: true,
        },
        take: 100,
      })
    : [];

  const relatedOrderIds = [...new Set(coOrderedPairs.map((item) => item.orderId))];
  const collaborativeCounts = new Map<string, number>();

  if (relatedOrderIds.length > 0) {
    const siblings = await prisma.orderItem.findMany({
      where: {
        orderId: { in: relatedOrderIds },
        NOT: {
          menuItemId: { in: anchorIds },
        },
      },
      select: {
        menuItemId: true,
        quantity: true,
      },
    });

    for (const sibling of siblings) {
      collaborativeCounts.set(
        sibling.menuItemId,
        (collaborativeCounts.get(sibling.menuItemId) ?? 0) + sibling.quantity,
      );
    }
  }

  const trending = await prisma.menuItem.findMany({
    where: {
      restaurantId,
      isAvailable: true,
      ...(timeOfDayCategory() === "dinner"
        ? { dietaryTags: { hasSome: ["shareable", "dessert", "beverage"] } }
        : {}),
    },
    orderBy: [{ featuredScore: "desc" }, { updatedAt: "desc" }],
    take: 12,
    select: {
      id: true,
      name: true,
      description: true,
      imageUrl: true,
      priceCents: true,
      prepTimeMins: true,
      dietaryTags: true,
    },
  });

  const selectedIds = new Set<string>();
  const rankedIds = [
    ...explicitUpsells,
    ...[...collaborativeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id),
    ...trending.map((item) => item.id),
  ].filter((id) => !selectedIds.has(id) && selectedIds.add(id));

  const itemsById = new Map(trending.map((item) => [item.id, item]));
  if (rankedIds.some((id) => !itemsById.has(id))) {
    const missing = await prisma.menuItem.findMany({
      where: {
        restaurantId,
        id: { in: rankedIds.filter((id) => !itemsById.has(id)) },
        isAvailable: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        priceCents: true,
        prepTimeMins: true,
        dietaryTags: true,
      },
    });
    for (const item of missing) {
      itemsById.set(item.id, item);
    }
  }

  const items = rankedIds
    .map((id) => itemsById.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 4);

  await prisma.recommendationEvent.create({
    data: {
      restaurantId,
      menuItemId,
      recommendedItemIds: items.map((item) => item.id),
      context,
    },
  });

  return {
    reason:
      explicitUpsells.length > 0
        ? "Based on restaurant-defined combos and live trends"
        : "Based on trending combinations and time-of-day demand",
    items,
  };
};

export const markRecommendationAccepted = async (restaurantId: string, menuItemId: string) => {
  await prisma.recommendationEvent.updateMany({
    where: {
      restaurantId,
      recommendedItemIds: { has: menuItemId },
      accepted: false,
    },
    data: {
      accepted: true,
    },
  });
};
