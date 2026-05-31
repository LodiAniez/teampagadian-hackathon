# API Convention (NestJS + Prisma)

The Raket backend is a NestJS app organized as **vertical slices**: every feature owns its controller, service, Prisma queries, DTOs, and tests in a single folder. There is no shared "services" or "repositories" layer to thread through. Slices talk to each other only via well-defined ports (other services injected directly, or domain events).

> **Mental model:** if you delete a feature folder, the rest of the app should still compile (after removing the one line that registers its module). If it doesn't, the slice is leaking.

---

## 1. Folder structure

```
apps/api/
  src/
    main.ts
    app.module.ts                 # imports every feature module
    common/                       # cross-cutting, framework-level only
      prisma/
        prisma.service.ts
        prisma.module.ts
      auth/
        auth.guard.ts             # global JWT guard
        current-user.decorator.ts
      filters/
        ts-rest-exception.filter.ts
      pipes/
      config/
        env.schema.ts             # Zod-validated env
        config.module.ts
    modules/                      # ← vertical slices live here
      auth/
        auth.module.ts
        auth.controller.ts
        auth.service.ts
        auth.types.ts             # internal types (NOT wire shapes)
        otp.service.ts            # slice-local helper services
        __tests__/
          auth.service.spec.ts
          auth.e2e.spec.ts
      invoices/
        invoices.module.ts
        invoices.controller.ts
        invoices.service.ts
        invoice-parser.service.ts # Gemini text→invoice
        invoices.repository.ts    # only if Prisma calls are non-trivial
        invoices.types.ts
        __tests__/
      payments/
      payouts/
      tax/
      ai-chat/
  prisma/
    schema.prisma
    migrations/
    seed.ts
  test/
    setup.ts
```

**Hard rules:**

- A slice **may** import from `common/` (Prisma, guards, config).
- A slice **may** import another slice's `*.service.ts` — that is the public surface.
- A slice **may not** import another slice's `*.repository.ts`, `*.types.ts`, or controllers.
- Schemas, DTOs, and wire types live in `@raket/contracts`. Never re-declare them here.

---

## 2. Module skeleton

```ts
// modules/invoices/invoices.module.ts
import { Module } from "@nestjs/common";
import { PrismaModule } from "@/common/prisma/prisma.module";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { InvoiceParserService } from "./invoice-parser.service";
import { ClientsModule } from "../clients/clients.module";

@Module({
  imports: [PrismaModule, ClientsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceParserService],
  exports: [InvoicesService], // exported only if another slice needs it
})
export class InvoicesModule {}
```

Each module is **self-contained**: imports its dependencies explicitly, exports only what other slices legitimately need.

---

## 3. Controller — ts-rest handlers

We use `@ts-rest/nest`. Controllers are thin: they bind the contract, pull auth context, and call the service. No business logic, no Prisma.

```ts
// modules/invoices/invoices.controller.ts
import { Controller, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { contract } from "@raket/contracts";
import { AuthGuard } from "@/common/auth/auth.guard";
import { CurrentUser } from "@/common/auth/current-user.decorator";
import { InvoicesService } from "./invoices.service";

@UseGuards(AuthGuard)
@Controller()
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @TsRestHandler(contract.invoices.list)
  list(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.invoices.list, async ({ query }) => {
      const page = await this.invoices.list(user.id, query);
      return { status: 200, body: page };
    });
  }

  @TsRestHandler(contract.invoices.create)
  create(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.invoices.create, async ({ body }) => {
      const invoice = await this.invoices.create(user.id, body);
      return { status: 201, body: invoice };
    });
  }
}
```

Rules:

- **One handler method per contract endpoint.** Name matches the contract key.
- **Auth is a guard, not a service call.** `@UseGuards(AuthGuard)` at the controller; `@CurrentUser()` pulls the typed user.
- **No try/catch in controllers** unless mapping a specific service error to a specific HTTP code. Use the global filter (§7).
- **No Prisma in controllers. Ever.**

---

## 4. Service — the business logic

The service owns the slice's behaviour. It is the only place that:

- Calls Prisma (directly, or via a slice-local repository if queries get complex).
- Calls external integrations (Stripe, Gemini, Resend) via injected adapter services.
- Orchestrates multiple steps in a transaction.

```ts
// modules/invoices/invoices.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";
import type { CreateInvoiceBody, Invoice, PaginatedResponse } from "@raket/contracts";
import { InvoiceParserService } from "./invoice-parser.service";
import { toInvoiceDto } from "./invoices.mapper";

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: InvoiceParserService,
  ) {}

  async list(
    userId: string,
    query: { cursor?: string; limit: number; status?: string },
  ): Promise<PaginatedResponse<Invoice>> {
    const rows = await this.prisma.invoice.findMany({
      where: { userId, ...(query.status && { status: query.status }) },
      include: { lineItems: true },
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      orderBy: { createdAt: "desc" },
    });

    const nextCursor = rows.length > query.limit ? rows.pop()!.id : null;
    return { data: rows.map(toInvoiceDto), nextCursor };
  }

  async create(userId: string, body: CreateInvoiceBody): Promise<Invoice> {
    const invoice = await this.prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          userId,
          clientId: body.clientId,
          status: "draft",
          amount: sumLineItems(body.lineItems),
          currency: body.currency,
          issueDate: new Date(body.issueDate),
          dueDate: new Date(body.dueDate),
          lineItems: {
            create: body.lineItems.map((li) => ({
              description: li.description,
              quantity: li.quantity,
              unit: li.unit,
              rate: li.rate,
              amount: li.quantity * li.rate,
            })),
          },
        },
        include: { lineItems: true },
      });
      return created;
    });

    return toInvoiceDto(invoice);
  }
}
```

### Mappers

Prisma row shapes and contract shapes are not identical (snake_case ↔ camelCase, `Date` ↔ ISO string, decimal handling). Convert at the boundary:

```ts
// modules/invoices/invoices.mapper.ts
import type { Invoice as InvoiceDto } from "@raket/contracts";

export function toInvoiceDto(row: InvoiceWithLineItems): InvoiceDto {
  return {
    id: row.id,
    clientId: row.clientId,
    status: row.status,
    amount: Number(row.amount),
    currency: row.currency,
    issueDate: row.issueDate.toISOString().slice(0, 10),
    dueDate: row.dueDate.toISOString().slice(0, 10),
    lineItems: row.lineItems.map(/* ... */),
    createdAt: row.createdAt.toISOString(),
  };
}
```

> **Rule:** services return contract types. Prisma types never leak past the service boundary.

---

## 5. Prisma usage

- One `PrismaService extends PrismaClient` in `common/prisma`. Injected everywhere via `PrismaModule`.
- **Each slice owns its own queries.** Don't build a generic `findAll(where, include)` helper — that's the start of a repository god-object.
- Lift queries into a `*.repository.ts` only when:
  - The same query is used in 3+ places in the slice, **or**
  - The query has non-trivial joins/aggregations that benefit from a name and a unit test.
- Use `$transaction` for any operation that writes more than one row.
- **No raw SQL** without a comment explaining why Prisma can't express it.

### Schema conventions (`schema.prisma`)

- Table names: plural, `snake_case` via `@@map`. Model names: singular, `PascalCase`.
- Column names: `camelCase` in Prisma, `snake_case` on disk via `@map`.
- IDs: `id String @id @default(uuid())`.
- Timestamps: `createdAt`, `updatedAt` on every table.
- Foreign keys: explicit `userId String` + relation. Index every FK.
- Money in `Decimal` (not `Float`). Currency separate (`String @db.VarChar(3)`).

```prisma
model Invoice {
  id              String    @id @default(uuid())
  userId          String    @map("user_id")
  clientId        String    @map("client_id")
  status          String
  amount          Decimal   @db.Decimal(18, 2)
  currency        String    @db.VarChar(3)
  issueDate       DateTime  @map("issue_date") @db.Date
  dueDate         DateTime  @map("due_date") @db.Date
  lineItems       InvoiceLineItem[]
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  user            User      @relation(fields: [userId], references: [id])
  client          Client    @relation(fields: [clientId], references: [id])

  @@index([userId, createdAt])
  @@index([clientId])
  @@map("invoices")
}
```

---

## 6. Validation

ts-rest validates request bodies, queries, and path params against the Zod contract automatically. **Do not** re-validate inside the service. Trust the handler signature.

If you need _business_ validation (e.g., "due date must be after issue date in this user's timezone"), do it in the service and throw a typed exception (§7).

---

## 7. Errors & exceptions

The wire-level error shape is defined in `@raket/contracts` (`ErrorResponseSchema`). The backend produces it via:

1. **NestJS exceptions** thrown from the service (`NotFoundException`, `ForbiddenException`, etc.).
2. A **global filter** that maps Nest exceptions → contract `ErrorResponse`.

```ts
// common/filters/ts-rest-exception.filter.ts
@Catch()
export class TsRestExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const requestId = host.switchToHttp().getRequest().id ?? randomUUID();

    const mapped = toErrorResponse(exception, requestId);
    res.status(mapped.status).json(mapped.body);
  }
}
```

Mapping table (must stay in sync with `ErrorCodeSchema`):

| Throws                                    | Code                | Status |
| ----------------------------------------- | ------------------- | ------ |
| `ZodError` (shouldn't occur post-ts-rest) | `VALIDATION_FAILED` | 422    |
| `UnauthorizedException`                   | `UNAUTHENTICATED`   | 401    |
| `ForbiddenException`                      | `FORBIDDEN`         | 403    |
| `NotFoundException`                       | `NOT_FOUND`         | 404    |
| `ConflictException`                       | `CONFLICT`          | 409    |
| Anything else                             | `INTERNAL`          | 500    |

Custom domain errors (`InsufficientFundsError`, `InvoiceAlreadyPaidError`) extend a small `DomainException` base and carry their own code mapping. Define them in `<slice>.errors.ts`.

> Never `throw new Error("...")` from a service. Either it's a known domain error (typed exception) or it's a bug (let it bubble; the filter returns 500).

---

## 8. External integrations

Each external service gets its own slice or a dedicated module under `modules/integrations/`. Wrap the SDK behind a service you own — never let `Stripe`, `GoogleGenAI`, or `Resend` SDK types appear in another slice's signature.

```
modules/
  integrations/
    stripe/
      stripe.module.ts
      stripe.service.ts          # exposes high-level methods we use
      stripe-webhook.controller.ts
    claude/
      claude.module.ts
      claude.service.ts
      prompts/                   # versioned prompt strings
    resend/
```

This keeps the slice testable (mock our service, not the vendor SDK) and gives one place to swap implementations.

### Stripe webhook (special case)

- Has its own controller, **no `AuthGuard`** (Stripe signs the request instead).
- Uses raw body parsing (`bodyParser: false` for that route).
- Verifies the signature before touching anything.
- Emits a domain event (`payment.succeeded`) and returns 200 fast. Long work happens out-of-band.

---

## 9. Configuration & secrets

- All env vars are declared in `common/config/env.schema.ts` as a Zod schema and parsed once at boot. The app crashes loudly if a required var is missing.
- Inject config via `ConfigService<EnvConfig, true>` — never `process.env.X` inside a service.

```ts
// common/config/env.schema.ts
export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  RESEND_API_KEY: z.string().startsWith("re_"),
});
export type EnvConfig = z.infer<typeof EnvSchema>;
```

---

## 10. Testing

Two layers, both colocated with the slice:

- **Unit tests** (`*.spec.ts`) — service logic with Prisma mocked (use `vitest-mock-extended` or jest-mock). Cover branches and edge cases.
- **E2E tests** (`*.e2e.spec.ts`) — boot the Nest app, hit it through ts-rest, talk to a **real** test database (Supabase local or a disposable Postgres). No mocked DB.

Test naming: `describe("InvoicesService.create")` → `it("rejects when client belongs to another user")`. Behaviour, not implementation.

> **Hackathon reality:** if you have to choose, write an E2E test for the demo path (create invoice → send → pay webhook → payout) and skip exhaustive unit coverage. Tests that protect the demo earn their keep.

---

## 11. Naming summary

| Thing                 | Convention                                     |
| --------------------- | ---------------------------------------------- |
| Folder                | `kebab-case` (`payout-methods/`)               |
| File                  | `feature.role.ts` (`invoices.service.ts`)      |
| Class                 | `PascalCase` (`InvoicesService`)               |
| Method                | `camelCase`, verb-first (`createInvoice`)      |
| Prisma model          | `PascalCase` singular (`Invoice`)              |
| Table                 | `snake_case` plural (`invoices`)               |
| Env var               | `SCREAMING_SNAKE_CASE`                         |
| Contract endpoint key | `camelCase` verb (`list`, `getById`, `create`) |

---

## 12. Checklist before merging an API change

- [ ] New endpoint exists in `@raket/contracts` first; backend implements it second.
- [ ] Controller method is a thin ts-rest handler — no business logic.
- [ ] Service returns contract types, not Prisma types.
- [ ] Prisma writes that span multiple rows are wrapped in `$transaction`.
- [ ] Every FK and frequently-filtered column is indexed.
- [ ] Errors are typed (Nest exceptions or `DomainException` subclasses), never bare `Error`.
- [ ] External SDK types do not leak past the integration's own service.
- [ ] At minimum, the demo path is covered by an E2E test.
