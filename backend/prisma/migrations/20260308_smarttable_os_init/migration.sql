-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('PENDING', 'PREPARING', 'READY', 'SERVED');

-- CreateEnum
CREATE TYPE "PaymentOption" AS ENUM ('PAY_AT_TABLE', 'PAY_AT_COUNTER', 'PAY_NOW');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'STRIPE', 'UPI', 'APPLE_PAY');

-- CreateEnum
CREATE TYPE "FulfillmentMode" AS ENUM ('DINE_IN', 'PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('QR', 'WAITER', 'COUNTER', 'APP');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('STARTER', 'GROWTH', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_ITEM');

-- CreateEnum
CREATE TYPE "CampaignChannel" AS ENUM ('WHATSAPP', 'PUSH', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "LoyaltyEventType" AS ENUM ('EARN', 'REDEEM', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ServiceRequestType" AS ENUM ('CALL_WAITER', 'WATER', 'BILL', 'CLEAN_TABLE', 'HELP');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RecommendationMode" AS ENUM ('RULES_ONLY', 'RULES_PLUS_SIGNALS', 'ML_ASSISTED');

-- CreateEnum
CREATE TYPE "RecommendationContext" AS ENUM ('CART', 'CHECKOUT', 'POST_PURCHASE');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('SEND_WHATSAPP_RECEIPT', 'SEND_CAMPAIGN_MESSAGE', 'AGGREGATE_ANALYTICS');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brandName" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "countryCode" TEXT NOT NULL DEFAULT 'US',
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "whatsappNumber" TEXT,
    "logoUrl" TEXT,
    "heroImageUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#F97316',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStep" INTEGER NOT NULL DEFAULT 1,
    "aiMode" "RecommendationMode" NOT NULL DEFAULT 'RULES_PLUS_SIGNALS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantSubscription" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "planCode" "SubscriptionPlan" NOT NULL DEFAULT 'GROWTH',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEnds" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripePriceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantAdmin" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Table" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tableNumber" INTEGER NOT NULL,
    "label" TEXT,
    "zone" TEXT,
    "seats" INTEGER NOT NULL DEFAULT 4,
    "qrToken" TEXT NOT NULL,
    "nfcToken" TEXT,
    "activeSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "compareAtCents" INTEGER,
    "imageUrl" TEXT,
    "prepTimeMins" INTEGER NOT NULL DEFAULT 15,
    "ingredients" TEXT[],
    "dietaryTags" TEXT[],
    "spiceLevel" INTEGER NOT NULL DEFAULT 0,
    "calories" INTEGER,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "featuredScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "translations" JSONB,
    "upsellTargets" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItemModifierGroup" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER NOT NULL DEFAULT 1,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MenuItemModifierGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModifierOption" (
    "id" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDeltaCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ModifierOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "fullName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "totalSpentCents" INTEGER NOT NULL DEFAULT 0,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "lastVisitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyAccount" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "pointsBalance" INTEGER NOT NULL DEFAULT 0,
    "tierName" TEXT NOT NULL DEFAULT 'Core',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyLedger" (
    "id" TEXT NOT NULL,
    "loyaltyAccountId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "LoyaltyEventType" NOT NULL,
    "points" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "minSpendCents" INTEGER,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "autoApply" BOOLEAN NOT NULL DEFAULT false,
    "targetAudience" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "promotionId" TEXT,
    "name" TEXT NOT NULL,
    "channel" "CampaignChannel" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "audienceRule" TEXT,
    "messageTemplate" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "customerId" TEXT,
    "tableId" TEXT,
    "orderNumber" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "channel" "OrderChannel" NOT NULL DEFAULT 'QR',
    "paymentOption" "PaymentOption" NOT NULL DEFAULT 'PAY_AT_COUNTER',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod",
    "fulfillmentMode" "FulfillmentMode" NOT NULL DEFAULT 'DINE_IN',
    "languageCode" TEXT NOT NULL DEFAULT 'en',
    "splitGroupCode" TEXT,
    "specialNotes" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "subtotalCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "serviceChargeCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "aiUpsellAccepted" BOOLEAN NOT NULL DEFAULT false,
    "whatsappReceiptUrl" TEXT,
    "receiptNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "promotionId" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemPriceCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotalCents" INTEGER NOT NULL,
    "specialNotes" TEXT,
    "status" "OrderItemStatus" NOT NULL DEFAULT 'PENDING',
    "customizationJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemModifier" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "modifierOptionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDeltaCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderItemModifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "receiptUrl" TEXT,
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationJob" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tableId" TEXT,
    "orderId" TEXT,
    "type" "ServiceRequestType" NOT NULL,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'OPEN',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationEvent" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "orderId" TEXT,
    "menuItemId" TEXT,
    "recommendedItemIds" TEXT[],
    "context" "RecommendationContext" NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- CreateIndex
CREATE INDEX "Restaurant_slug_createdAt_idx" ON "Restaurant"("slug", "createdAt");

-- CreateIndex
CREATE INDEX "RestaurantSubscription_restaurantId_status_idx" ON "RestaurantSubscription"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "RestaurantAdmin_restaurantId_role_idx" ON "RestaurantAdmin"("restaurantId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantAdmin_restaurantId_email_key" ON "RestaurantAdmin"("restaurantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Table_qrToken_key" ON "Table"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "Table_nfcToken_key" ON "Table"("nfcToken");

-- CreateIndex
CREATE INDEX "Table_restaurantId_zone_idx" ON "Table"("restaurantId", "zone");

-- CreateIndex
CREATE UNIQUE INDEX "Table_restaurantId_tableNumber_key" ON "Table"("restaurantId", "tableNumber");

-- CreateIndex
CREATE INDEX "MenuCategory_restaurantId_sortOrder_idx" ON "MenuCategory"("restaurantId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MenuCategory_restaurantId_name_key" ON "MenuCategory"("restaurantId", "name");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_categoryId_idx" ON "MenuItem"("restaurantId", "categoryId");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_featuredScore_idx" ON "MenuItem"("restaurantId", "featuredScore");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_restaurantId_name_key" ON "MenuItem"("restaurantId", "name");

-- CreateIndex
CREATE INDEX "MenuItemModifierGroup_menuItemId_sortOrder_idx" ON "MenuItemModifierGroup"("menuItemId", "sortOrder");

-- CreateIndex
CREATE INDEX "ModifierOption_modifierGroupId_idx" ON "ModifierOption"("modifierGroupId");

-- CreateIndex
CREATE INDEX "Customer_restaurantId_lastVisitedAt_idx" ON "Customer"("restaurantId", "lastVisitedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_restaurantId_phone_key" ON "Customer"("restaurantId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_customerId_key" ON "LoyaltyAccount"("customerId");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_restaurantId_tierName_idx" ON "LoyaltyAccount"("restaurantId", "tierName");

-- CreateIndex
CREATE INDEX "LoyaltyLedger_loyaltyAccountId_createdAt_idx" ON "LoyaltyLedger"("loyaltyAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "Promotion_restaurantId_active_startAt_endAt_idx" ON "Promotion"("restaurantId", "active", "startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_restaurantId_code_key" ON "Promotion"("restaurantId", "code");

-- CreateIndex
CREATE INDEX "MarketingCampaign_restaurantId_status_scheduledFor_idx" ON "MarketingCampaign"("restaurantId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "Order_restaurantId_status_createdAt_idx" ON "Order"("restaurantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_tableId_status_idx" ON "Order"("tableId", "status");

-- CreateIndex
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_restaurantId_orderNumber_key" ON "Order"("restaurantId", "orderNumber");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_status_idx" ON "OrderItem"("orderId", "status");

-- CreateIndex
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");

-- CreateIndex
CREATE INDEX "OrderItemModifier_orderItemId_idx" ON "OrderItemModifier"("orderItemId");

-- CreateIndex
CREATE INDEX "Payment_orderId_status_idx" ON "Payment"("orderId", "status");

-- CreateIndex
CREATE INDEX "Payment_provider_providerRef_idx" ON "Payment"("provider", "providerRef");

-- CreateIndex
CREATE INDEX "IntegrationJob_status_runAt_idx" ON "IntegrationJob"("status", "runAt");

-- CreateIndex
CREATE INDEX "IntegrationJob_restaurantId_type_idx" ON "IntegrationJob"("restaurantId", "type");

-- CreateIndex
CREATE INDEX "ServiceRequest_restaurantId_status_createdAt_idx" ON "ServiceRequest"("restaurantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_tableId_status_idx" ON "ServiceRequest"("tableId", "status");

-- CreateIndex
CREATE INDEX "RecommendationEvent_restaurantId_context_createdAt_idx" ON "RecommendationEvent"("restaurantId", "context", "createdAt");

-- AddForeignKey
ALTER TABLE "RestaurantSubscription" ADD CONSTRAINT "RestaurantSubscription_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantAdmin" ADD CONSTRAINT "RestaurantAdmin_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModifierOption" ADD CONSTRAINT "ModifierOption_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "MenuItemModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedger" ADD CONSTRAINT "LoyaltyLedger_loyaltyAccountId_fkey" FOREIGN KEY ("loyaltyAccountId") REFERENCES "LoyaltyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedger" ADD CONSTRAINT "LoyaltyLedger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemModifier" ADD CONSTRAINT "OrderItemModifier_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemModifier" ADD CONSTRAINT "OrderItemModifier_modifierOptionId_fkey" FOREIGN KEY ("modifierOptionId") REFERENCES "ModifierOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationJob" ADD CONSTRAINT "IntegrationJob_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

