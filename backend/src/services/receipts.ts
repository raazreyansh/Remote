import twilio from "twilio";

import { config } from "../config";

type SendReceiptInput = {
  restaurantName: string;
  orderId: string;
  phone?: string | null;
  amountCents: number;
  currency: string;
  receiptUrl: string;
};

type SendMessageInput = {
  phone?: string | null;
  body: string;
};

const getTwilioClient = () => {
  if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioWhatsappFrom) {
    return null;
  }

  return twilio(config.twilioAccountSid, config.twilioAuthToken);
};

export const buildReceiptUrl = (restaurantSlug: string, orderId: string) =>
  `${config.frontendUrl}/r/${restaurantSlug}/order/${orderId}?receipt=1`;

export const sendWhatsappReceipt = async ({
  restaurantName,
  orderId,
  phone,
  amountCents,
  currency,
  receiptUrl,
}: SendReceiptInput) => {
  if (!phone) {
    return {
      delivered: false,
      reason: "Customer phone missing",
      providerRef: undefined,
    };
  }

  const twilioClient = getTwilioClient();
  if (twilioClient && config.twilioWhatsappFrom) {
    try {
      const message = await twilioClient.messages.create({
        from: config.twilioWhatsappFrom,
        to: phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`,
        body: `${restaurantName}: payment received for order ${orderId}. Amount ${amountCents / 100} ${currency}. Receipt: ${receiptUrl}`,
      });

      return {
        delivered: true,
        reason: "sent-via-twilio",
        providerRef: message.sid,
      };
    } catch (error) {
      return {
        delivered: false,
        reason: error instanceof Error ? error.message : "Twilio send failed",
        providerRef: undefined,
      };
    }
  }

  if (!config.whatsappWebhookUrl) {
    return {
      delivered: false,
      reason: "WhatsApp provider not configured",
      providerRef: undefined,
    };
  }

  const response = await fetch(config.whatsappWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.whatsappApiKey ? { Authorization: `Bearer ${config.whatsappApiKey}` } : {}),
    },
    body: JSON.stringify({
      channel: "whatsapp",
      to: phone,
      template: "receipt",
      payload: {
        restaurantName,
        orderId,
        amountCents,
        currency,
        receiptUrl,
      },
    }),
  }).catch(() => null);

  return {
    delivered: Boolean(response?.ok),
    reason: response?.ok ? "queued-via-webhook" : "Webhook request failed",
    providerRef: undefined,
  };
};

export const sendWhatsappMessage = async ({ phone, body }: SendMessageInput) => {
  if (!phone) {
    return {
      delivered: false,
      reason: "Customer phone missing",
      providerRef: undefined,
    };
  }

  const twilioClient = getTwilioClient();
  if (twilioClient && config.twilioWhatsappFrom) {
    try {
      const message = await twilioClient.messages.create({
        from: config.twilioWhatsappFrom,
        to: phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`,
        body,
      });

      return {
        delivered: true,
        reason: "sent-via-twilio",
        providerRef: message.sid,
      };
    } catch (error) {
      return {
        delivered: false,
        reason: error instanceof Error ? error.message : "Twilio send failed",
        providerRef: undefined,
      };
    }
  }

  return {
    delivered: false,
    reason: "WhatsApp provider not configured",
    providerRef: undefined,
  };
};
