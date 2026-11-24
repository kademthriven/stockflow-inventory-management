# StockFlow

StockFlow is a multi-tenant inventory MVP for small sellers. Owners can manage products, track stock, and see low-stock items in a responsive dashboard.

## Features

- Email/password signup and login with bcrypt-hashed passwords and server-side sessions
- Organization-scoped product CRUD, name/SKU search, and per-organization SKU uniqueness
- Dashboard product and unit totals with low-stock indicators
- Organization-wide default low-stock threshold, overridable per product
- Product quantity, cost, selling price, and description
- Responsive dashboard, products, settings, login, and signup pages

## Stack

- Next.js App Router, React, TypeScript, and Tailwind CSS
- Express API, shared by local development and the Vercel API function
- Sequelize with SQLite for local development and PostgreSQL for Neon
- Neon PostgreSQL for persistent production data

## Local development

Prerequisites: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

By default, local development uses `data/stockflow.sqlite`. To use Neon locally, set `DATABASE_URL` in the ignored `.env.local` file; use the pooled URL for application traffic. Copy `.env.example` for optional local settings.

## Validation

```bash
npm run check
npm run build
npm test
```

`npm test` starts the app, exercises signup/login, product search and CRUD, dashboard totals, settings, logout, and tenant isolation, then removes its temporary records.

## Data model

- `organizations`: tenant identity and default low-stock threshold
- `users`: one owner account per organization
- `sessions`: hashed opaque session tokens with expiration timestamps
- `products`: tenant-owned inventory; `(organization_id, sku)` is unique

Prices are stored as integer cents. A product is low stock when its quantity is at or below its own threshold, or the organization's default when no product threshold is set.

## Deployment

The project is configured for Vercel. Next.js serves the UI, and `api/index.mjs` hosts the Express API as a Vercel Function. API paths are routed to that function by `vercel.json`.

Set `DATABASE_URL` in the Vercel Production environment to the Neon pooled connection string, then deploy with:

```bash
vercel --prod
```

The API initializes its Sequelize schema on its first request. Do not commit `.env.local` or production database credentials.

## Assessment scope

This MVP intentionally excludes multi-warehouse support, variants, categories, supplier and purchase-order flows, channel integrations, imports, billing, role management, audit logs, and advanced analytics.
