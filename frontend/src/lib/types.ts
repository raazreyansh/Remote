export type AuthSession = {
  token: string;
  admin: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
  restaurant: {
    id: string;
    name: string;
    slug: string;
    currency?: string;
    timezone?: string;
    onboardingCompleted?: boolean;
    referralCode?: string;
  };
};

export type ModifierOption = {
  id: string;
  name: string;
  priceDeltaCents: number;
};

export type ModifierGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  options: ModifierOption[];
};

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  compareAtCents?: number | null;
  imageUrl: string | null;
  isAvailable: boolean;
  prepTimeMins: number;
  ingredients: string[];
  dietaryTags: string[];
  spiceLevel?: number;
  calories?: number | null;
  upsellTargets?: string[];
  modifierGroups?: ModifierGroup[];
};

export type MenuCategory = {
  id: string;
  name: string;
  description: string | null;
  imageUrl?: string | null;
  sortOrder: number;
  menuItems: MenuItem[];
};

export type Table = {
  id: string;
  tableNumber: number;
  label: string | null;
  qrToken: string;
  zone?: string | null;
  seats?: number;
};

export type OrderItemModifier = {
  id: string;
  name: string;
  priceDeltaCents: number;
};

export type OrderItem = {
  id: string;
  menuItemId: string;
  itemName: string;
  itemPriceCents: number;
  quantity: number;
  lineTotalCents?: number;
  specialNotes: string | null;
  status: "PENDING" | "PREPARING" | "READY" | "SERVED";
  modifiers?: OrderItemModifier[];
};

export type Order = {
  id: string;
  restaurantId: string;
  orderNumber?: number;
  tableId: string | null;
  status: "PENDING" | "ACCEPTED" | "PREPARING" | "READY" | "SERVED" | "COMPLETED" | "CANCELLED";
  paymentOption: "PAY_AT_TABLE" | "PAY_AT_COUNTER" | "PAY_NOW";
  paymentStatus?: "PENDING" | "AUTHORIZED" | "PAID" | "FAILED" | "REFUNDED";
  paymentMethod?: "CASH" | "CARD" | "STRIPE" | "UPI" | "APPLE_PAY" | null;
  specialNotes: string | null;
  customerName: string | null;
  customerPhone?: string | null;
  totalCents: number;
  subtotalCents?: number;
  taxCents?: number;
  serviceChargeCents?: number;
  discountCents?: number;
  whatsappReceiptUrl?: string | null;
  receiptNumber?: string | null;
  createdAt: string;
  updatedAt: string;
  table: {
    id: string;
    tableNumber: number;
    label: string | null;
    zone?: string | null;
  } | null;
  customer?: {
    id: string;
    fullName: string | null;
    phone: string | null;
    preferredLanguage: string;
  } | null;
  items: OrderItem[];
  payments?: Array<{
    id: string;
    amountCents: number;
    method: string;
    status: string;
    receiptUrl: string | null;
  }>;
  loyalty?: {
    pointsBalance: number;
    tierName: string;
  } | null;
  liveTracking?: {
    showEta: boolean;
    etaMinutes: number;
  };
};
