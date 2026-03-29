import dotenv from "dotenv";

dotenv.config();

const DEFAULT_FRONTEND_URL = "http://localhost:3000";
const DEFAULT_BACKEND_PORT = 4000;

const corsOrigin =
  process.env.CORS_ORIGIN?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) ?? [DEFAULT_FRONTEND_URL];

export const config = {
  port: Number(process.env.PORT ?? DEFAULT_BACKEND_PORT),
  jwtSecret: process.env.JWT_SECRET ?? "change_me",
  frontendUrl: process.env.FRONTEND_URL ?? DEFAULT_FRONTEND_URL,
  corsOrigin,
  appName: process.env.APP_NAME ?? "SmartTable OS",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  whatsappWebhookUrl: process.env.WHATSAPP_WEBHOOK_URL,
  whatsappApiKey: process.env.WHATSAPP_API_KEY,
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM,
  awsRegion: process.env.AWS_REGION,
  awsBucket: process.env.AWS_S3_BUCKET,
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsPublicBaseUrl: process.env.AWS_PUBLIC_BASE_URL,
  upiVpa: process.env.UPI_VPA,
  upiPayeeName: process.env.UPI_PAYEE_NAME ?? "SmartTable OS",
};
