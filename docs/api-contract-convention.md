# API Contract Convention

The single source of truth for every HTTP endpoint in Raket. Contracts are written with [ts-rest](https://ts-rest.com) + [Zod](https://zod.dev), live in `packages/contracts`, and are imported by both the NestJS API and the Next.js web app. If a contract changes, **both sides break at compile time** — that is the point.

> **Rule of thumb:** if the frontend and backend disagree on a shape, the contract is wrong, not the code. Fix the contract first.

---

## 1. Where contracts live

```
packages/
  contracts/
    src/
      index.ts                  # exports the root `contract`
      shared/                   # primitives reused across features
        pagination.ts
        error.ts
        money.ts
      auth/
        auth.contract.ts
        auth.schema.ts
      invoices/
        invoices.contract.ts
        invoices.schema.ts
      payouts/
        ...
    package.json                # name: "@raket/contracts"
    tsconfig.json
  types/
    src/
      index.ts                  # re-exports all types
      dashboard.ts              # shared aggregate/display types
    package.json                # name: "@raket/types"
    tsconfig.json
```

**Two shared packages, two different jobs:**

| Package            | Contents                                               | Runtime?                                   |
| ------------------ | ------------------------------------------------------ | ------------------------------------------ |
| `@raket/contracts` | Zod schemas + ts-rest routers                          | Yes — request validation, response parsing |
| `@raket/types`     | Plain TypeScript interfaces for aggregate/display data | No — type-only, no Zod dependency          |

Use `@raket/types` for shapes that are assembled by the API from multiple sources (dashboard aggregates, list projections) and do not need runtime schema validation at the wire boundary. Use `@raket/contracts` for everything that travels directly as a request or response body.

- **One folder per feature**, matching the backend slice and frontend feature name.
- **`*.schema.ts`** — Zod schemas + inferred TS types (the data shapes).
- **`*.contract.ts`** — the ts-rest router for that feature (the wire shapes).
- **`shared/`** — primitives only. No feature logic.

---

## 2. Schema conventions (Zod)

Schemas are written once, used everywhere: request validation, response typing, and frontend form types.

```ts
// packages/contracts/src/invoices/invoices.schema.ts
import { z } from "zod";

export const InvoiceStatusSchema = z.enum(["draft", "sent", "paid", "overdue", "void"]);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

export const InvoiceLineItemSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unit: z.string().max(32),
  rate: z.number().nonnegative(),
  amount: z.number().nonnegative(),
});
export type InvoiceLineItem = z.infer<typeof InvoiceLineItemSchema>;

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  status: InvoiceStatusSchema,
  amount: z.number().nonnegative(),
  currency: z.string().length(3), // ISO-4217
  issueDate: z.string().date(), // YYYY-MM-DD
  dueDate: z.string().date(),
  lineItems: z.array(InvoiceLineItemSchema),
  createdAt: z.string().datetime(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;
```

Rules:

1. **One schema per resource.** Compose with `.pick()`, `.omit()`, `.extend()` for create/update variants — never re-declare fields.
2. **Always export the inferred type** next to the schema. Consumers import `Invoice`, not `z.infer<typeof InvoiceSchema>`.
3. **Money is `number` in minor units? No — use major units (`number`) consistently across the wire.** Backend converts to/from minor units at the Stripe boundary.
4. **Dates** — calendar dates use `z.string().date()` (`YYYY-MM-DD`), instants use `z.string().datetime()` (ISO-8601 UTC). Never send `Date` objects.
5. **IDs are UUIDs** (`z.string().uuid()`) unless the contract explicitly says otherwise (e.g., Stripe IDs are `z.string().startsWith("pi_")`).
6. **Enums use `z.enum`**, not union strings. Keeps autocomplete and runtime parsing aligned.

### Create/Update variants

```ts
export const CreateInvoiceBodySchema = InvoiceSchema.omit({
  id: true,
  status: true,
  createdAt: true,
}).extend({
  lineItems: z.array(InvoiceLineItemSchema.omit({ id: true, amount: true })),
});
export type CreateInvoiceBody = z.infer<typeof CreateInvoiceBodySchema>;
```

Always derive from the canonical schema. If you find yourself manually re-typing fields, stop and use `.pick`/`.omit`.

---

## 3. Contract conventions (ts-rest)

```ts
// packages/contracts/src/invoices/invoices.contract.ts
import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { InvoiceSchema, CreateInvoiceBodySchema, InvoiceStatusSchema } from "./invoices.schema";
import { PaginationQuerySchema, PaginatedResponseSchema } from "../shared/pagination";
import { ErrorResponseSchema } from "../shared/error";

const c = initContract();

export const invoicesContract = c.router(
  {
    list: {
      method: "GET",
      path: "/",
      query: PaginationQuerySchema.extend({
        status: InvoiceStatusSchema.optional(),
        clientId: z.string().uuid().optional(),
      }),
      responses: {
        200: PaginatedResponseSchema(InvoiceSchema),
        401: ErrorResponseSchema,
      },
      summary: "List invoices for the authenticated user",
    },
    getById: {
      method: "GET",
      path: "/:invoiceId",
      pathParams: z.object({ invoiceId: z.string().uuid() }),
      responses: {
        200: InvoiceSchema,
        404: ErrorResponseSchema,
      },
    },
    create: {
      method: "POST",
      path: "/",
      body: CreateInvoiceBodySchema,
      responses: {
        201: InvoiceSchema,
        400: ErrorResponseSchema,
        422: ErrorResponseSchema,
      },
    },
  },
  {
    pathPrefix: "/invoices",
    strictStatusCodes: true,
  },
);
```

And compose at the root:

```ts
// packages/contracts/src/index.ts
import { initContract } from "@ts-rest/core";
import { authContract } from "./auth/auth.contract";
import { invoicesContract } from "./invoices/invoices.contract";
import { payoutsContract } from "./payouts/payouts.contract";

const c = initContract();

export const contract = c.router(
  {
    auth: authContract,
    invoices: invoicesContract,
    payouts: payoutsContract,
  },
  { pathPrefix: "/api/v1" },
);

export * from "./invoices/invoices.schema";
export * from "./auth/auth.schema";
// ...re-export every schema; consumers import from "@raket/contracts"
```

Rules:

1. **One sub-router per feature.** Composed at root with `pathPrefix: "/api/v1"`.
2. **`strictStatusCodes: true`** is mandatory. Anything not listed in `responses` is a bug.
3. **Every endpoint declares all error responses it can produce** (`400`, `401`, `404`, `422`, `500` as applicable). The frontend pattern-matches on these.
4. **No untyped responses.** Never `z.any()` or `z.unknown()`.
5. **`summary` is required** for every endpoint — it's the docstring and powers OpenAPI generation.

### HTTP verb conventions

| Verb     | Use for                                            | Returns                     |
| -------- | -------------------------------------------------- | --------------------------- |
| `GET`    | Read, list, search (no side effects)               | 200                         |
| `POST`   | Create, command, action (`/:id/send`, `/:id/void`) | 201 (create) / 200 (action) |
| `PATCH`  | Partial update                                     | 200                         |
| `PUT`    | Replace (rare — prefer PATCH)                      | 200                         |
| `DELETE` | Soft-delete or hard-delete                         | 204                         |

For non-CRUD actions, use sub-resources: `POST /invoices/:id/send`, `POST /invoices/:id/void`. Don't smuggle actions into PATCH bodies.

### Path conventions

- Plural resource names: `/invoices`, `/payout-methods`, `/clients`.
- `kebab-case` for multi-word paths.
- Nested resources only when ownership is unambiguous and one-level deep: `/invoices/:invoiceId/line-items`. Beyond that, flatten.
- Path params are typed via `pathParams: z.object({...})` — no implicit strings.

---

## 4. Standard response shapes

### Success

Single resource → return the resource directly:

```ts
responses: { 200: InvoiceSchema }
```

List/paginated → use `PaginatedResponseSchema`:

```ts
// packages/contracts/src/shared/pagination.ts
import { z, ZodTypeAny } from "zod";

export const PaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const PaginatedResponseSchema = <T extends ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    nextCursor: z.string().nullable(),
  });
```

Cursor pagination only. No `page`/`offset` — it breaks under writes and is harder to make consistent.

### Error

```ts
// packages/contracts/src/shared/error.ts
import { z } from "zod";

export const ErrorCodeSchema = z.enum([
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL",
]);

export const ErrorResponseSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  details: z.record(z.unknown()).optional(), // field-level errors, etc.
  requestId: z.string().uuid(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
```

Every error response uses this shape. `code` is the machine-readable discriminator the frontend switches on; `message` is human-readable but not user-facing copy.

---

## 5. Authentication

All authenticated endpoints rely on the standard `Authorization: Bearer <jwt>` header. We **do not** declare it per-endpoint; ts-rest sees it via headers config once at the router level when needed:

```ts
const c = initContract();

const authedHeaders = z.object({
  authorization: z.string().startsWith("Bearer "),
});

export const invoicesContract = c.router(
  {
    /* ... */
  },
  {
    pathPrefix: "/invoices",
    baseHeaders: authedHeaders,
    strictStatusCodes: true,
  },
);
```

Public endpoints (`/auth/request-otp`, `/auth/verify-otp`, Stripe webhook) live in their own router without `baseHeaders`.

---

## 6. Versioning

- Root prefix is `/api/v1`. **Never** ship breaking changes within a version.
- Additive changes (new optional field, new endpoint) are safe within `v1`.
- Breaking changes mean a new contract file and a new prefix (`v2`). The frontend imports from the new contract; old endpoints stay live until rollout completes.
- For the hackathon: we will not ship `v2`. Optimize for `v1` correctness.

---

## 7. Consuming the contract

### Backend (NestJS) — see `docs/api-convention.md`

```ts
import { contract } from "@raket/contracts";
@TsRestHandler(contract.invoices.list)
```

### Frontend (Next.js) — see `docs/web-convention.md`

```ts
import { contract } from "@raket/contracts";
import { initQueryClient } from "@ts-rest/react-query";

export const api = initQueryClient(contract, {
  baseUrl: process.env.NEXT_PUBLIC_API_URL!,
  baseHeaders: {
    /* auth header injected via interceptor */
  },
});
```

Both sides import from `@raket/contracts`. Neither side declares its own types for the wire.

---

## 8. Workflow when changing a contract

1. Edit the schema/contract in `packages/contracts`.
2. Run `pnpm build` at the workspace root — TypeScript surfaces every breakage.
3. Fix the backend handler. Fix the frontend caller. Both compile or neither ships.
4. If the change is breaking (renamed field, removed endpoint, narrowed enum), call it out in the PR description and confirm no in-flight feature depends on the old shape.

> **Anti-pattern:** Don't add a temporary "any" or `// @ts-expect-error` to make the contract change compile. If the contract is right, fix the code. If the code is right, fix the contract.

---

## 9. Checklist before merging a contract change

- [ ] Schema and contract live in the right feature folder.
- [ ] Inferred types are exported alongside schemas.
- [ ] All error responses (`401`, `404`, `422`, etc.) are listed.
- [ ] `strictStatusCodes: true` is on.
- [ ] No `z.any` / `z.unknown` in request or response shapes.
- [ ] Path uses plural, kebab-case, versioned prefix.
- [ ] Pagination uses `PaginatedResponseSchema` with cursor.
- [ ] `summary` is filled in.
- [ ] Backend handler and frontend caller both compile.
