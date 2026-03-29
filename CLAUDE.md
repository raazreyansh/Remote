# SmartTable OS - CLAUDE.md

> This file is the local coding contract for this repository.
> It is optimized for the repo that exists today, not the future architecture we may migrate to later.

---

## Project Identity

- Product: SmartTable OS
- Type: Multi-tenant QR-based restaurant management SaaS
- Market: India-first, with global expansion as a roadmap
- Team model: Solo founder, AI-assisted execution
- Current repo shape: two-app layout with [`backend/`](/Users/akbai/OneDrive/Documents/Playground/backend) and [`frontend/`](/Users/akbai/OneDrive/Documents/Playground/frontend)
- Goal: production-grade software, not prototypes

---

## Non-Negotiable Rules

```text
1. NEVER read, write, or reference: .env, .env.*, secrets.*, credentials.*, *.key, *.pem
2. NEVER run destructive commands such as rm -rf, DROP TABLE, or DELETE without WHERE
3. NEVER modify .github/workflows or existing prisma migrations without explicit approval
4. NEVER expose secrets in logs, API responses, thrown error payloads, or console output
5. ALWAYS validate inputs before business logic
6. ALWAYS enforce tenant scoping on tenant-owned data access
7. ALWAYS ask before schema migrations, dependency additions, or architecture changes
8. ALWAYS write TypeScript with strict types; no any, no ts-ignore, no type-smuggling hacks
9. ALWAYS handle errors explicitly; no silent catches
10. ALWAYS tell the user when the repo and the contract disagree
```

---

## Current Repo Reality

This repository does **not** currently match a full `apps/` + `packages/` monorepo.

Actual layout today:

```text
smarttable-os/
|- backend/
|  |- prisma/
|  |- src/
|  |- types/
|  |- package.json
|  `- tsconfig.json
|- frontend/
|  |- public/
|  |- src/
|  |- package.json
|  `- tsconfig.json
|- docs/
|- docker-compose.yml
|- README.md
`- CLAUDE.md
```

Roadmap items like mobile apps, shared packages, or a turborepo are allowed as future design goals, but they are **not** current assumptions.

---

## Architecture Rules

### Multi-Tenancy

Every tenant-owned database query must be scoped to the restaurant context provided by trusted server-side auth or trusted route resolution.

Use server-controlled tenant identifiers, not client-provided ones.

```typescript
// Good
const { restaurantId } = req.user;
const menuItems = await prisma.menuItem.findMany({
  where: { restaurantId },
});

// Bad
const { restaurantId } = req.body;
```

If a route is public-by-slug, the route must resolve the restaurant on the server first and only then read tenant-owned records through that resolved restaurant context.

### API Design

- Current API shape in this repo uses routes like `/api/auth/*`, `/api/admin/*`, `/api/public/*`, and `/api/kitchen/*`
- Do not invent `/api/v1/*` routes unless the user explicitly asks for a versioning migration
- Keep response envelopes consistent when modifying handlers:
  - success case: `{ success: true, data }`
  - error case: `{ success: false, error: { code, message } }`

### Error Handling

```typescript
try {
  const result = await someOperation();
  return res.json({ success: true, data: result });
} catch (error) {
  loggerLike.error('module.operation failed', {
    context: 'module.operation',
    userId: req.user?.id,
  });

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    },
  });
}
```

Never leak raw database errors, stack traces, provider secrets, JWT payloads, or payment details to clients.

---

## Current Stack

These versions reflect the checked-in manifests as of March 19, 2026.

### Backend

| Tool | Version in repo | Notes |
|------|------------------|-------|
| Node.js | 20+ expected | Native fetch is available |
| Express | 5.2.1 | Async handlers supported |
| Prisma | 6.19.0 | Prefer Prisma over raw SQL |
| Socket.io | 4.8.3 | Tenant-scoped room naming |
| Zod | 4.3.6 | Use for request validation |
| bcryptjs | 3.0.3 | Current password hashing library in repo |
| helmet | 8.1.0 | Mount before routes |
| jsonwebtoken | 9.0.3 | JWT handling |
| morgan | 1.10.1 | Current HTTP logging middleware |

### Frontend

| Tool | Version in repo | Notes |
|------|------------------|-------|
| Next.js | 16.1.6 | App Router |
| React | 19.2.3 | Modern React patterns |
| Tailwind CSS | 4.x | Utility-first styling |
| socket.io-client | 4.8.3 | Realtime updates |
| framer-motion | 12.35.1 | Motion and transitions |

### Not Currently Present

- No mobile app package in this repo
- No root workspace config
- No `pnpm-workspace.yaml`
- No committed `.claude/` folder
- No shared root `package.json`

If we later migrate to a monorepo, update this file in the same change.

---

## Security Rules

### Forbidden Files

Do not open or modify:

```text
.env
.env.*
secrets/
**/credentials.json
**/*.key
**/*.pem
**/.ssh/**
backend/.env
backend/prisma/.env
frontend/.env.local
```

### Validation

Every write route must validate request input before business logic. Prefer Zod schemas colocated with the route or module they protect.

```typescript
const schema = z.object({
  name: z.string().trim().min(1).max(100),
});
```

### SQL Safety

- Prefer Prisma queries
- Only use raw SQL if Prisma cannot express the query and the need is measured
- Never use string-built SQL
- If raw SQL is necessary, parameterize it

### Payments

- Never trust payment status from the client
- Verify provider signatures before mutating order state
- Make payment transitions idempotent
- Persist payment events before final status changes

### Logging

- Never log passwords, tokens, card data, webhook secrets, or full auth headers
- The repo currently uses `morgan`; if deeper structured logging is added later, update this file

---

## TypeScript Standards

- `strict: true` must remain enabled
- Do not introduce `any`
- Do not add `@ts-ignore`
- Do not use `as unknown as`
- Prefer explicit return types on exported functions and service-layer functions

Current repo note:

- [`backend/tsconfig.json`](/Users/akbai/OneDrive/Documents/Playground/backend/tsconfig.json) is strict but does not yet include every advanced flag from the earlier aspirational contract
- [`frontend/tsconfig.json`](/Users/akbai/OneDrive/Documents/Playground/frontend/tsconfig.json) is strict and Next-managed

Do not pretend stronger compiler settings exist if they do not.

---

## Naming and Structure

Follow existing project patterns before inventing new ones.

- Backend files: prefer kebab-case or established local convention
- React components: PascalCase
- Functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Prisma models: PascalCase
- DB fields: camelCase

New files should normally live inside the relevant module directory.
Exception: root governance files such as [`CLAUDE.md`](/Users/akbai/OneDrive/Documents/Playground/CLAUDE.md) are allowed at the repository root.

---

## Workflow

### Before Work

1. Read the nearest relevant README or module context if it exists
2. Check existing patterns in the touched area
3. Run `git status`
4. Confirm you are not on `main`, `production`, `release/*`, or `master`
5. If the tree is dirty, avoid overwriting unrelated work

### Package Manager

This repo is currently `npm`-based, not `pnpm`-based.

Use the commands that actually exist.

### Backend Commands

Run from [`backend/`](/Users/akbai/OneDrive/Documents/Playground/backend):

```bash
npm install
npm run dev
npm run build
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:seed
npm run schema:sql
```

### Frontend Commands

Run from [`frontend/`](/Users/akbai/OneDrive/Documents/Playground/frontend):

```bash
npm install
npm run dev
npm run build
npm run lint
```

### Verification Expectations

For backend changes:

- Run `npm run build` in [`backend/`](/Users/akbai/OneDrive/Documents/Playground/backend)

For frontend changes:

- Run `npm run lint` in [`frontend/`](/Users/akbai/OneDrive/Documents/Playground/frontend) when frontend code is touched
- Run `npx tsc --noEmit` in [`frontend/`](/Users/akbai/OneDrive/Documents/Playground/frontend) if TypeScript-only verification is needed and no dedicated script exists

### Tests

There are currently no test scripts declared in the checked-in package manifests.

Rules:

- If a relevant automated test exists, run it
- If no test harness exists for the touched area, say so explicitly
- Do not claim a test passed if no command exists

---

## Git Rules

- Never push directly to `main`, `production`, `release/*`, or `master`
- Prefer working branches with the `codex/` prefix when Codex creates them
- Never force push unless the user explicitly requests it
- Never commit secret-bearing files
- Do not revert user changes you did not make

This repo is currently uncommitted. Treat the entire workspace as user-owned unless the current task clearly scopes your edits.

---

## SmartTable Domain Rules

### Order Lifecycle

```text
PENDING -> CONFIRMED -> PREPARING -> READY -> SERVED -> COMPLETED
                                                ^
                                 CANCELLED before SERVED
```

### Table States

```text
AVAILABLE -> OCCUPIED -> BILL_REQUESTED -> CLEARED -> AVAILABLE
```

### QR Flow

```text
Customer scans QR -> menu loads -> cart builds -> order placed for table
-> kitchen/admin receives update -> order status syncs back to customer
```

### Public Route Safety

- Public menu routes may be unauthenticated
- Public routes must still enforce tenant resolution safely
- Table or order identifiers from the client must be validated

---

## Environment Variables Reference

This section documents names referenced by the checked-in README and code patterns. It is documentation only. Do not open actual env files.

### Backend

```bash
DATABASE_URL=
JWT_SECRET=
FRONTEND_URL=
CORS_ORIGIN=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
WHATSAPP_WEBHOOK_URL=
AWS_REGION=
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_PUBLIC_BASE_URL=
UPI_VPA=
UPI_PAYEE_NAME=
```

### Frontend

```bash
NEXT_PUBLIC_API_URL=
```

If new environment variables are introduced, document the names here without exposing values.

---

## Definition of Done

A task is complete only when all applicable items are true:

- The code matches the current repo structure and tooling
- TypeScript remains strict in touched code
- Inputs are validated where required
- Tenant-owned reads and writes are properly scoped
- Errors are handled explicitly
- No secrets are hardcoded or leaked
- Relevant build, lint, or test commands were run when available
- Any unavailable verification steps are called out clearly
- Any contract-vs-repo mismatch discovered during the work is surfaced to the user

---

## Change Policy

Always ask before:

- adding dependencies
- creating migrations
- changing the API surface significantly
- changing auth or tenancy architecture
- replacing current tooling with a new workspace system

Do not silently "upgrade" the repo to match an aspirational architecture.

---

## Last Updated

- Last updated: March 19, 2026
- Owner: SmartTable OS
