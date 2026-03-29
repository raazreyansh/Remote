# SmartTable OS

SmartTable OS is a multi-tenant restaurant SaaS platform that replaces paper menus with a full digital table operating system:

- Customer-facing QR menu with images, customization, AI upsells, split-bill-ready order flow, and live tracking
- Restaurant admin dashboard for onboarding, menu management, tables, promotions, loyalty, customers, and analytics
- Kitchen display system with realtime order sync
- Payment orchestration for pay-at-table, pay-at-counter, UPI, card, Stripe, and Apple Pay style flows
- Stripe subscription billing for restaurants at `INR 999/month`
- Razorpay guest checkout for customer food orders
- WhatsApp receipt delivery hook and downloadable digital bills
- QR and NFC table management
- Loyalty, campaigns, referral-ready growth tooling, and game-changing AI automation opportunities

## Stack

- Frontend: Next.js 16, TypeScript, Tailwind CSS 4, installable PWA
- Motion: Framer Motion
- Backend: Node.js, Express 5, Socket.IO, Zod
- Database: PostgreSQL with Prisma
- Realtime: Socket.IO rooms per restaurant tenant
- Deployment targets: Vercel or AWS for frontend, AWS/Railway/Render for backend, managed Postgres

## Monorepo

- [frontend](/Users/akbai/OneDrive/Documents/Playground/frontend)
- [backend](/Users/akbai/OneDrive/Documents/Playground/backend)
- [docker-compose.yml](/Users/akbai/OneDrive/Documents/Playground/docker-compose.yml)
- [ci.yml](/Users/akbai/OneDrive/Documents/Playground/.github/workflows/ci.yml)
- [PLAYSTORE.md](/Users/akbai/OneDrive/Documents/Playground/docs/PLAYSTORE.md)
- [OPERATIONS.md](/Users/akbai/OneDrive/Documents/Playground/docs/OPERATIONS.md)

## Core capabilities

- Customer menu app
  - QR/NFC table detection
  - Rich food cards with photos, ingredients, prep time, and dietary tags
  - Cart, notes, promo codes, service request buttons, and AI recommendation rail
  - Voice-style menu Q&A module
  - AR preview and social share CTAs
  - Live order tracking and digital receipt page

- Admin SaaS
  - Restaurant self-registration
  - Menu category and item management
  - Table generation with QR/NFC
  - Promotion and WhatsApp campaign setup
  - Customer and loyalty visibility
  - Analytics for peak hours, revenue/table, top items, repeat customers, and upsell performance

- Kitchen display
  - Instant incoming order stream
  - Item-level status updates
  - Realtime sync back to customer order tracking

- Backend platform
  - Tenant-isolated data model
  - Loyalty ledger and subscription model
  - Recommendation telemetry
  - Payment records and receipt generation hooks
  - WhatsApp webhook integration point

## Local setup

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name smarttable_init
npm run prisma:seed
npm run dev
```

Backend runs on `http://localhost:4000`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

### 3. Docker

```bash
docker compose up --build
```

This starts Postgres, API, frontend, and a background worker for receipts/campaign jobs.

## Seeded demo

- Restaurant slug: `smart-bistro`
- Admin email: `owner@smarttable.ai`
- Password: `admin1234`
- Example QR menu: [customer menu](http://localhost:3000/r/smart-bistro/menu?tableToken=smart-bistro-table-1)
- Launch coupon supported in onboarding: `LAUNCH500`
- Referral flow supported via per-restaurant `referralCode` and 3-referral extension logic

## Key APIs

### Health

- `GET /api/health`
- `GET /api/health/ready`

### Public

- `GET /api/public/restaurants/:slug/menu`
- `GET /api/public/restaurants/:slug/recommendations`
- `POST /api/public/restaurants/:slug/orders`
- `GET /api/public/restaurants/:slug/orders/:orderId`
- `PATCH /api/public/restaurants/:slug/orders/:orderId/payment-intent`
- `PATCH /api/public/restaurants/:slug/orders/:orderId/payment`
- `POST /api/public/restaurants/:slug/orders/:orderId/payment/verify`
- `POST /api/public/restaurants/:slug/service-requests`

### Auth

- `POST /api/auth/admin/register`
- `POST /api/auth/admin/login`
- `GET /api/auth/admin/me`

### Admin

- `GET /api/admin/dashboard`
- `GET /api/admin/integrations/status`
- `POST /api/admin/billing/checkout-session`
- `PATCH /api/admin/restaurant`
- `POST /api/admin/uploads/presign`
- `GET/POST/PUT/DELETE /api/admin/categories`
- `GET/POST/PUT/DELETE /api/admin/menu-items`
- `GET/POST/PUT/DELETE /api/admin/tables`
- `POST /api/admin/tables/bulk-generate`
- `GET /api/admin/tables/:tableId/qr`
- `GET /api/admin/orders`
- `PATCH /api/admin/orders/:orderId/status`
- `PATCH /api/admin/orders/:orderId/items/:itemId/status`
- `GET /api/admin/customers`
- `GET/POST /api/admin/promotions`
- `GET/POST /api/admin/campaigns`
- `GET /api/admin/analytics/summary`
- `GET /api/admin/analytics/export`

### Kitchen

- `GET /api/kitchen/orders`
- `PATCH /api/kitchen/orders/:orderId/status`
- `PATCH /api/kitchen/orders/:orderId/items/:itemId/status`

### Integrations

- `POST /api/integrations/stripe/webhook`

## Deployment notes

- Frontend
  - Deploy [frontend](/Users/akbai/OneDrive/Documents/Playground/frontend) to Vercel or AWS Amplify.
  - Set `NEXT_PUBLIC_API_URL`.
  - The app ships a PWA manifest and can be wrapped into an Android app using Trusted Web Activity or Capacitor for Play Store distribution.

- Backend
  - Deploy [backend](/Users/akbai/OneDrive/Documents/Playground/backend) to AWS ECS, Railway, Render, or Fly.io.
  - Set `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `CORS_ORIGIN`.
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- Razorpay: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
  - WhatsApp: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` or fallback `WHATSAPP_WEBHOOK_URL`
  - Storage: `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optionally `AWS_PUBLIC_BASE_URL`
  - UPI: `UPI_VPA`, `UPI_PAYEE_NAME`
  - Run Prisma migrations during deploy.

- Database
  - Use managed PostgreSQL with connection pooling for multi-tenant scale.
  - Add read replicas and analytics offloading as restaurant volume grows.

## Production hardening next steps

- Add real Stripe intents and webhook reconciliation
- Add WhatsApp Business provider integration
- Add object storage for menu images
- Add OAuth providers and role-based access controls
- Add queue workers for campaigns, receipts, and analytics aggregation
- Add Redis for session/cache/rate limiting
- Add region-aware deployment and tenant sharding when restaurant count grows
