import type { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { sendWhatsappMessage, sendWhatsappReceipt } from "./receipts";

type JobType = "SEND_WHATSAPP_RECEIPT" | "SEND_CAMPAIGN_MESSAGE" | "AGGREGATE_ANALYTICS";
type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

type ReceiptJobPayload = {
  restaurantName: string;
  orderId: string;
  phone?: string | null;
  amountCents: number;
  currency: string;
  receiptUrl: string;
  paymentId?: string;
};

type CampaignJobPayload = {
  campaignId: string;
  customerPhone: string;
  message: string;
};

type AnalyticsJobPayload = {
  restaurantId: string;
};

const prismaAny = prisma as any;

export const enqueueJob = async (input: {
  restaurantId?: string;
  type: JobType;
  payload: ReceiptJobPayload | CampaignJobPayload | AnalyticsJobPayload;
  runAt?: Date;
}) =>
  prismaAny.integrationJob.create({
    data: {
      restaurantId: input.restaurantId,
      type: input.type,
      payload: input.payload as Prisma.JsonObject,
      runAt: input.runAt ?? new Date(),
    },
  });

const processJob = async (job: {
  id: string;
  type: JobType;
  payload: Prisma.JsonValue;
}) => {
  switch (job.type) {
    case "SEND_WHATSAPP_RECEIPT": {
      const payload = job.payload as unknown as ReceiptJobPayload;
      const result = await sendWhatsappReceipt(payload);

      if (payload.paymentId && result.providerRef) {
        await prismaAny.payment.update({
          where: { id: payload.paymentId },
          data: {
            providerRef: result.providerRef,
          },
        });
      }

      if (!result.delivered) {
        throw new Error(result.reason);
      }
      return;
    }
    case "SEND_CAMPAIGN_MESSAGE": {
      const payload = job.payload as unknown as CampaignJobPayload;
      const result = await sendWhatsappMessage({
        phone: payload.customerPhone,
        body: payload.message,
      });
      if (!result.delivered) {
        throw new Error(result.reason);
      }
      return;
    }
    case "AGGREGATE_ANALYTICS":
      return;
    default:
      return;
  }
};

export const runPendingJobs = async () => {
  const jobs = (await prismaAny.integrationJob.findMany({
    where: {
      status: {
        in: ["PENDING", "FAILED"] satisfies JobStatus[],
      },
      runAt: {
        lte: new Date(),
      },
    },
    orderBy: { runAt: "asc" },
    take: 10,
  })) as Array<{
    id: string;
    type: JobType;
    payload: Prisma.JsonValue;
    attempts: number;
    maxAttempts: number;
  }>;

  for (const job of jobs) {
    if (job.attempts >= job.maxAttempts) {
      continue;
    }

    try {
      await prismaAny.integrationJob.update({
        where: { id: job.id },
        data: {
          status: "PROCESSING" satisfies JobStatus,
          attempts: {
            increment: 1,
          },
          lastError: null,
        },
      });

      await processJob(job);

      await prismaAny.integrationJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED" satisfies JobStatus,
        },
      });
    } catch (error) {
      await prismaAny.integrationJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED" satisfies JobStatus,
          lastError: error instanceof Error ? error.message : "Job failed",
          runAt: new Date(Date.now() + 60_000),
        },
      });
    }
  }
};

let timer: NodeJS.Timeout | null = null;

export const startJobWorker = () => {
  if (timer) {
    return;
  }

  timer = setInterval(() => {
    void runPendingJobs();
  }, 15_000);
};
