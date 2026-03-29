import type { Prisma } from "@prisma/client";

export const orderDetailsInclude = {
  table: {
    select: {
      id: true,
      tableNumber: true,
      label: true,
      zone: true,
    },
  },
  customer: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      preferredLanguage: true,
    },
  },
  items: {
    orderBy: {
      createdAt: "asc",
    },
    include: {
      modifiers: true,
    },
  },
  payments: {
    orderBy: {
      createdAt: "desc",
    },
  },
  promotion: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
} satisfies Prisma.OrderInclude;
