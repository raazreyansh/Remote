import Stripe from "stripe";

import { config } from "../config";

let stripeClient: Stripe | null = null;

export const getStripe = () => {
  if (!config.stripeSecretKey) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(config.stripeSecretKey);
  }

  return stripeClient;
};

export const createStripePaymentIntent = async (input: {
  orderId: string;
  restaurantId: string;
  amountCents: number;
  currency: string;
  customerName?: string | null;
}) => {
  const stripe = getStripe();
  if (!stripe) {
    return null;
  }

  return stripe.paymentIntents.create({
    amount: input.amountCents,
    currency: input.currency.toLowerCase(),
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      customerName: input.customerName ?? "",
    },
  });
};

export const createStripeSubscriptionCheckout = async (input: {
  restaurantId: string;
  restaurantName: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}) => {
  const stripe = getStripe();
  if (!stripe) {
    return null;
  }

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: input.customerEmail,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: {
      restaurantId: input.restaurantId,
      restaurantName: input.restaurantName,
    },
    line_items: [
      {
        price_data: {
          currency: "inr",
          recurring: {
            interval: "month",
          },
          unit_amount: 99900,
          product_data: {
            name: "SmartTable Pro",
            description: "SmartTable OS restaurant subscription",
          },
        },
        quantity: 1,
      },
    ],
  });
};

export const constructStripeEvent = (payload: Buffer, signature: string) => {
  const stripe = getStripe();
  if (!stripe || !config.stripeWebhookSecret) {
    throw new Error("Stripe webhook is not configured");
  }

  return stripe.webhooks.constructEvent(payload, signature, config.stripeWebhookSecret);
};
