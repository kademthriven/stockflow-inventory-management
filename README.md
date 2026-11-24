# StockFlow

StockFlow is a focused inventory workspace for small sellers. It combines secure organization-scoped accounts, fast product management, low-stock visibility, and a calm operational interface in one deployable full-stack application.

## What is included

- Email/password signup and login with organization creation
- PBKDF2 password hashing and hashed, expiring server-side sessions
- Strict organization scoping for every product query and mutation
- Product creation, search, editing, and confirmed deletion
- Name, SKU, description, quantity, cost, selling price, and optional product threshold
- Organization-wide fallback low-stock threshold
- Dashboard totals and an actionable low-stock list
- Responsive desktop, tablet, and mobile layouts
- Durable Cloudflare D1 storage with versioned Drizzle migrations
- Accessible loading, empty, error, validation, and confirmation states

## Stack

- Next.js App Router on Vinext and Cloudflare Workers
- React 19, TypeScript, and Tailwind CSS
- Drizzle ORM with Cloudflare D1
- Zod validation
- Radix/shadcn primitives and Lucide icons

## Local setup

Prerequisites: Node.js 22.13 or newer, Git, and tar.

```bash
npm run install:ci
npm run db:generate
npm run build
```

Apply the generated migration to the local D1 database. Replace the migration filename if a newer migration exists:

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_large_maddog.sql
```

Start the development server:

```bash
npm run dev
```

The terminal prints the local URL (normally `http://localhost:5173`). Create an account from the signup screen; no database seeding or manual database edits are required.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run check
npm run build
```

With the local server running, exercise authentication, CRUD, dashboard totals, settings, SKU rules, and cross-tenant isolation:

```bash
npm run test:smoke -- http://127.0.0.1:5173
```

## Security model

- Passwords are never stored directly. Each password is hashed with a unique random salt using PBKDF2-HMAC-SHA-256.
- Session tokens are returned only through `HttpOnly`, `SameSite=Lax` cookies; only their SHA-256 digests are persisted.
- Authentication is resolved server-side for every protected request.
- Organization IDs are derived from the authenticated session, never trusted from request payloads.
- Product reads, writes, aggregates, SKU uniqueness, settings, and deletes are scoped to that organization.
- Invalid credentials use a generic response and expired sessions are rejected.

## Data model

- `organizations`: tenant identity and default low-stock threshold
- `users`: one owner account per MVP organization
- `sessions`: hashed opaque sessions with expiration timestamps
- `products`: tenant-owned inventory records; `(organization_id, sku)` is unique

Prices are stored as integer cents to avoid floating-point rounding errors. A product is low stock when its quantity is less than or equal to its product threshold, or the organization default when no product override is set.

## Project structure

```text
app/                    Routes, pages, and API handlers
components/stockflow/   Product-specific interface components
db/                     Drizzle database access and schema
drizzle/                Generated, versioned SQL migrations
lib/                    Authentication, validation, and inventory logic
.openai/hosting.json    Deployment and D1 binding configuration
worker/                 Cloudflare Worker entry point
```

## Assessment scope

This build intentionally excludes variants, categories, warehouses, supplier and purchase-order flows, channel integrations, imports, billing, role management, audit logs, and complex analytics. Those features are outside the six-hour MVP brief.

## Deployment

The repository contains the tracked hosting manifest and generated database migration required for deployment. Hosted migrations are applied before the Worker is published.
