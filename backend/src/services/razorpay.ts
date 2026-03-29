import { createHmac } from "node:crypto";

import Razorpay from "razorpay";

import { config } from "../config";

let razorpayClient: Razorpay | null = null;

export const getRazorpay = () => {
  if (!config.razorpayKeyId || !config.razorpayKeySecret) {
    return null;
  }

  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: config.razorpayKeyId,
      key_secret: config.razorpayKeySecret,
    });
  }

  return razorpayClient;
};

export const createRazorpayOrder = async (input: {
  amountCents: number;
  currency: string;
  orderId: string;
  restaurantName: string;
}) => {
  const razorpay = getRazorpay();
  if (!razorpay) {
    return null;
  }

  return razorpay.orders.create({
    amount: input.amountCents,
    currency: input.currency,
    receipt: input.orderId,
    notes: {
      orderId: input.orderId,
      restaurantName: input.restaurantName,
    },
  });
};

export const verifyRazorpayPayment = (input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) => {
  if (!config.razorpayKeySecret) {
    return false;
  }

  const signature = createHmac("sha256", config.razorpayKeySecret)
    .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
    .digest("hex");

  return signature === input.razorpaySignature;
};
