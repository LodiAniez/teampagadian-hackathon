# Web Convention (Next.js 15 + Tailwind + shadcn/ui)

The Raket web app is organized **by feature**, not by file type. Every feature owns its pages, components, hooks, API calls, and types in one folder. Components are dumb; hooks hold the logic. The result: components are trivial to read, easy to test, and reusable across pages.

> **Mental model:** a component renders what it's given. A hook decides what to give it. If a component has an `if (loading)`, a `useEffect`, or a fetch call inside, it's doing the hook's job.

---

## 1. Folder structure

```
apps/web/
  src/
    app/                                # Next.js App Router (routes only)
      (marketing)/page.tsx
      (auth)/
        login/page.tsx
      (dashboard)/
        layout.tsx                      # shell + auth gate
        dashboard/page.tsx
        invoices/
          page.tsx                      # list page
          new/page.tsx
          [invoiceId]/page.tsx
    features/                           # ← business logic lives here
      auth/
        components/
          PhoneLoginForm.tsx
          OtpInput.tsx
        hooks/
          use-phone-login.ts
          use-otp-verification.ts
        api/
          auth.api.ts                   # ts-rest calls
        types.ts                        # local-only types (rare)
        index.ts                        # re-exports the feature's public surface
      invoices/
        components/
          InvoiceForm/
            InvoiceForm.tsx
            InvoiceForm.parts.tsx       # subcomponents (have their own hook)
            use-invoice-form.ts         # the form's logic
          InvoiceList.tsx
          InvoiceStatusBadge.tsx
        hooks/
          use-invoices.ts               # list/filter
          use-invoice.ts                # single
          use-create-invoice.ts
          use-parse-invoice-text.ts     # Claude text→invoice
        api/
          invoices.api.ts
        utils/
          invoice-totals.ts
        index.ts
      dashboard/
        components/
          Dashboard.tsx
          Dashboard.parts.tsx           # stat cards, sections — has own hook
          use-dashboard.ts
        hooks/
        api/
      payments/
      tax/
      ai-chat/
    components/                         # ← GLOBAL, PURE components only
      ui/                               # shadcn/ui primitives
        button.tsx
        input.tsx
        dialog.tsx
        card.tsx
      layout/
        AppShell.tsx
        Sidebar.tsx
    lib/                                # cross-cutting utilities
      api-client.ts                     # ts-rest client setup
      query-client.ts                   # tanstack-query setup
      auth.ts                           # supabase auth helpers
      format.ts                         # money, date formatters
      env.ts                            # zod-validated NEXT_PUBLIC_* env
    styles/
      globals.css
```

---

## 2. The three component tiers

Every component falls into exactly one tier. The tier dictates whether it can hold logic.

### Tier 1 — Global components (`src/components/`)

**Pure. No logic. No state beyond `useState` for trivial UI affordances (open/closed, focus). No data fetching. No business rules.**

Examples: `Button`, `Input`, `Dialog`, `Card`, `Badge`, `Skeleton`, layout primitives.

```tsx
// src/components/ui/button.tsx
import { cn } from "@/lib/cn";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { cva, VariantProps } from "class-variance-authority";

const buttonVariants = cva("inline-flex items-center justify-center …", {
  variants: {
    variant: { primary: "bg-emerald-600 text-white", ghost: "…" },
    size: { sm: "h-8 px-3", md: "h-10 px-4", lg: "h-12 px-6" },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { isLoading?: boolean };

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant, size, isLoading, children, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={rest.disabled || isLoading}
      {...rest}
    >
      {isLoading ? <Spinner /> : children}
    </button>
  ),
);
Button.displayName = "Button";
```

What's allowed here:
- Variants via `cva` / Tailwind.
- Forwarded refs.
- Trivial uncontrolled UI state (open, hover) — but **prefer controlled** so callers retain control.

What's forbidden:
- `useQuery`, `useMutation`, ts-rest calls.
- Importing anything from `features/`.
- Business-specific labels ("Send invoice", "Pay now") — those are passed as props.

> **Test:** could you ship this component on a non-Raket project unchanged? If no, it doesn't belong in `src/components/`.

### Tier 2 — Feature components (`src/features/<feature>/components/`)

**Render-only. If the component needs any logic, that logic moves to a custom hook in the same feature.**

The component reads from its props (and from its dedicated hook, if it has one). It does not call `useQuery` directly. It does not call `fetch`. It does not contain business rules.

```tsx
// src/features/invoices/components/InvoiceList.tsx
import { useInvoices } from "../hooks/use-invoices";
import { InvoiceListView } from "./InvoiceListView";

export function InvoiceList({ status }: { status?: InvoiceStatus }) {
  const { invoices, isLoading, error, loadMore, hasMore } = useInvoices({ status });

  return (
    <InvoiceListView
      invoices={invoices}
      isLoading={isLoading}
      error={error}
      onLoadMore={loadMore}
      hasMore={hasMore}
    />
  );
}
```

```tsx
// src/features/invoices/components/InvoiceListView.tsx — pure, no hooks
export function InvoiceListView({ invoices, isLoading, error, onLoadMore, hasMore }: Props) {
  if (error) return <ErrorState message={error.message} />;
  if (isLoading && invoices.length === 0) return <InvoiceListSkeleton />;
  if (invoices.length === 0) return <EmptyState />;

  return (
    <div className="space-y-2">
      {invoices.map((inv) => <InvoiceRow key={inv.id} invoice={inv} />)}
      {hasMore && <Button onClick={onLoadMore}>Load more</Button>}
    </div>
  );
}
```

**The pattern:** the outer component is a 5-line adapter between the hook and the view. The view is pure. Both are easy to test (the view with props, the hook with a query client).

### Tier 3 — Shared / parts components (`*.parts.tsx`)

When a feature component grows large, split it into a parent + a `*.parts.tsx` file containing subcomponents. **Each shared `*.parts` component that has logic owns a hook in the same folder.**

```
features/dashboard/components/
  Dashboard.tsx              # composes the page
  Dashboard.parts.tsx        # EarningsCard, FxComparison, InvoicesPanel
  use-dashboard.ts           # parent-level orchestration
  use-earnings-card.ts       # logic for EarningsCard
  use-fx-comparison.ts       # logic for FxComparison
```

```tsx
// features/dashboard/components/Dashboard.parts.tsx
import { useEarningsCard } from "./use-earnings-card";
import { useFxComparison } from "./use-fx-comparison";

export function EarningsCard({ range }: { range: DateRange }) {
  const { totalPhp, totalUsd, deltaPct, isLoading } = useEarningsCard({ range });
  return <EarningsCardView {…} />;
}

export function FxComparison({ amountUsd }: { amountUsd: number }) {
  const { raket, paypal, wise, bank, savings } = useFxComparison({ amountUsd });
  return <FxComparisonView {…} />;
}
```

Rule: a `*.parts.tsx` file is fine. A `*.parts.tsx` file with inline `useQuery` calls is not.

---

## 3. Hooks — where logic actually lives

Every non-trivial component is paired with a hook. The hook owns:

- Data fetching (`useQuery`, `useMutation` via ts-rest).
- Derived state and memoization.
- Local UI state that has business meaning.
- Side effects (`useEffect`).
- Mapping API data → view-model.

```ts
// features/invoices/hooks/use-invoices.ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { InvoiceStatus } from "@raket/contracts";

export function useInvoices({ status }: { status?: InvoiceStatus }) {
  const query = api.invoices.list.useInfiniteQuery(
    ["invoices", { status }],
    ({ pageParam }) => ({ query: { cursor: pageParam, limit: 20, status } }),
    { getNextPageParam: (last) => last.body.nextCursor ?? undefined },
  );

  return {
    invoices: query.data?.pages.flatMap((p) => p.body.data) ?? [],
    isLoading: query.isPending,
    error: query.error,
    loadMore: query.fetchNextPage,
    hasMore: !!query.hasNextPage,
  };
}
```

Hook conventions:

- **Filename:** `use-<thing>.ts`, kebab-case. The exported hook is `useThing` (camelCase).
- **One hook = one concern.** If `useInvoices` is doing list *and* create, split into `useInvoices` + `useCreateInvoice`.
- **Hooks return a shaped object**, not a tuple. Names beat positions for view-models.
- **Don't return raw `useQuery` results** from feature hooks. Map to the shape the view needs (`{ invoices, isLoading, error, loadMore }`), not `{ data, isPending, fetchNextPage, … }`. The view should not know tanstack-query exists.

### Form hooks

Forms get their own hook even when the form has no API calls. The hook owns validation, default values, and submit handling.

```ts
// features/invoices/components/InvoiceForm/use-invoice-form.ts
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateInvoiceBodySchema, type CreateInvoiceBody } from "@raket/contracts";
import { useCreateInvoice } from "../../hooks/use-create-invoice";
import { useRouter } from "next/navigation";

export function useInvoiceForm() {
  const router = useRouter();
  const create = useCreateInvoice();

  const form = useForm<CreateInvoiceBody>({
    resolver: zodResolver(CreateInvoiceBodySchema),
    defaultValues: { lineItems: [defaultLineItem()] },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const invoice = await create.mutateAsync(values);
    router.push(`/invoices/${invoice.id}`);
  });

  return { form, onSubmit, isSubmitting: create.isPending };
}
```

The component receives `{ form, onSubmit, isSubmitting }` and binds inputs — nothing more.

---

## 4. API layer (ts-rest + tanstack-query)

A single typed client, configured once. Every feature imports it; no feature instantiates its own.

```ts
// src/lib/api-client.ts
import { initQueryClient } from "@ts-rest/react-query";
import { contract } from "@raket/contracts";
import { env } from "./env";
import { getAccessToken } from "./auth";

export const api = initQueryClient(contract, {
  baseUrl: env.NEXT_PUBLIC_API_URL,
  baseHeaders: {
    authorization: async () => {
      const token = await getAccessToken();
      return token ? `Bearer ${token}` : "";
    },
  },
});
```

Usage in hooks:

```ts
const { data } = api.invoices.list.useQuery(["invoices"], { query: { limit: 20 } });
const create = api.invoices.create.useMutation();
```

Rules:

- **Components never call `api.*` directly.** That's the hook's job.
- **Server components and route handlers** that need the API use a separate server-side ts-rest client (`@ts-rest/core`'s `initClient`) — same contract, different transport. Document this in `lib/api-client.server.ts`.
- **Query keys** are arrays starting with the feature name: `["invoices"]`, `["invoices", { status: "paid" }]`, `["invoice", invoiceId]`. Keep them stable — they're the cache identity.

---

## 5. Server vs client components

Next.js 15 App Router defaults to server components. We use them deliberately:

- **Server components** — pages and layouts, initial data fetches when the data is needed for first paint (e.g., dashboard stats). Use the server ts-rest client; pass results down as props.
- **Client components** — anything with state, effects, or event handlers. Mark with `"use client"` at the top of the file.

Pattern: the route's `page.tsx` is a server component that fetches the initial payload and renders a client component (`<DashboardClient initialData={…} />`). The client component runs `useDashboard()`, which is seeded via tanstack-query's `initialData`.

```tsx
// app/(dashboard)/dashboard/page.tsx
import { serverApi } from "@/lib/api-client.server";
import { DashboardClient } from "@/features/dashboard/components/DashboardClient";

export default async function DashboardPage() {
  const { body: stats } = await serverApi.dashboard.stats({});
  return <DashboardClient initialStats={stats} />;
}
```

Don't sprinkle `"use client"` across the tree. It belongs at the boundary, as low as possible.

---

## 6. Styling

- **Tailwind only.** No CSS modules, no styled-components.
- Compose with `cn(…)` from `clsx` + `tailwind-merge` (already exported from `@/lib/cn`).
- Variant systems via `cva` (class-variance-authority).
- **shadcn/ui** primitives are copied into `src/components/ui/` and edited freely. Treat them as ours — but keep them pure (Tier 1 rules apply).
- Tokens (brand colors, spacing scale) live in `tailwind.config.ts`. No magic hex codes in component files.

---

## 7. State management

In order of preference:

1. **URL state** (`searchParams`, `useRouter`) — for filters, tabs, modal-open-ness that should survive refresh / be shareable.
2. **tanstack-query cache** — for anything fetched from the API.
3. **Component state** (`useState`, `useReducer`) — for ephemeral UI.
4. **Context** — only for true cross-cutting concerns (theme, auth user). Co-locate the provider with the feature that owns the data.
5. **Zustand / Jotai** — only if 1–4 genuinely don't fit. For the hackathon: don't reach for these.

> Don't add a global store for data that lives in tanstack-query. The cache is the store.

---

## 8. Naming

| Thing                       | Convention                                |
| --------------------------- | ----------------------------------------- |
| Folder (feature)            | `kebab-case` (`ai-chat/`)                 |
| Folder (component group)    | `PascalCase` (`InvoiceForm/`)             |
| Component file              | `PascalCase.tsx` (`InvoiceList.tsx`)      |
| Parts file                  | `<Component>.parts.tsx`                   |
| Hook file                   | `use-thing.ts` kebab-case                 |
| Hook export                 | `useThing` camelCase                      |
| Util/api file               | `kebab-case.ts`                           |
| Type-only file              | `types.ts` (only if local types exist)    |
| Page                        | App Router conventions (`page.tsx`)       |

---

## 9. Imports

- Absolute imports via `@/` (configured in `tsconfig.json`).
- Order: external → `@raket/contracts` → `@/lib` → `@/components` → `@/features/*` → relative (`./`, `../`).
- A feature **may** import from `@raket/contracts`, `@/lib`, `@/components`. A feature **may** import another feature's `index.ts` (its public surface). A feature **may not** reach into another feature's internals (`features/x/hooks/use-…`).
- Routes (`app/`) import from features, never the other way around.

---

## 10. Testing (lightweight for hackathon)

- **Hooks:** test with `@testing-library/react`'s `renderHook` and a real `QueryClientProvider`. Mock the ts-rest client at the boundary.
- **Pure views (`*View.tsx`):** snapshot or assertion tests with props — they're pure functions of input.
- **Don't test global UI primitives.** They're so thin that the test would just re-state the markup.
- **Demo path:** at minimum, one Playwright run that exercises sign-up → create invoice → pay (mocked) → see toast. Protects the hackathon stage moment.

---

## 11. Anti-patterns (you will be asked to fix these in review)

| Don't                                                       | Do instead                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| `useQuery` inside a component                               | Move it to a hook in the same feature                       |
| `fetch("/api/…")` anywhere                                  | Use `api.<feature>.<endpoint>` from `@/lib/api-client`      |
| Re-declaring types that exist in `@raket/contracts`         | Import them                                                 |
| `Button` with `onClick={() => sendInvoice(id)}` baked in    | Caller passes `onClick`; Button stays generic               |
| Sprinkling `"use client"` at the top of every file          | Push the boundary down to the smallest interactive subtree  |
| Feature A importing `features/B/hooks/use-x`                | Export a service from B's `index.ts` and import that        |
| `if (loading) return …` repeated in every component         | One `<AsyncBoundary>` (or the view pattern from §2)         |
| Inline tailwind classes longer than ~120 chars              | Extract to `cva` variants                                   |
| `useEffect(() => { fetch… }, [])`                           | `useQuery` via the typed client                             |

---

## 12. Checklist before merging a web change

- [ ] Component has no `useQuery`/`useMutation`/`fetch` — the hook does.
- [ ] Global components (`src/components/`) have zero feature-specific logic or copy.
- [ ] `*.parts.tsx` subcomponents with logic each have their own hook.
- [ ] Types come from `@raket/contracts`, not redeclared.
- [ ] `"use client"` is only at the lowest necessary boundary.
- [ ] Query keys are namespaced and stable.
- [ ] No cross-feature imports into another feature's internals.
- [ ] Tailwind only; no inline styles, no CSS modules.
- [ ] Demo path still works in the browser (golden + at least one edge case).
