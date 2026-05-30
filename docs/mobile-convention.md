# Mobile Convention (Expo + Expo Router + NativeWind + Tanstack Query)

The Raket mobile app is organized **by feature**, not by file type. Every feature owns its screens, components, hooks, API calls, and types in one folder. Components are dumb; hooks hold the logic. The result: components are trivial to read, easy to test, and reusable across screens.

> **Mental model:** a component renders what it's given. A hook decides what to give it. If a component has an `if (loading)`, a `useEffect`, or a fetch call inside, it's doing the hook's job.

---

## 1. Folder structure

```
apps/mobile/
  src/
    app/                                # Expo Router (routes only)
      _layout.tsx                       # root <Stack> + providers + auth bootstrap
      (auth)/
        _layout.tsx                     # stack for signed-out screens (no tab bar)
        login.tsx                       # /login
        verify.tsx                      # /verify
        setup-profile.tsx               # /setup-profile
      (authed)/
        _layout.tsx                     # auth gate (redirects to /login if no session)
        (tabs)/
          _layout.tsx                   # bottom tab bar
          index.tsx                     # / (dashboard)
          invoices.tsx                  # /invoices (list)
          chat.tsx                      # /chat
          tax.tsx                       # /tax
        invoices/
          new.tsx                       # /invoices/new
          [id]/
            index.tsx                   # /invoices/:id
            sent.tsx                    # /invoices/:id/sent
        payout-method/
          setup.tsx                     # /payout-method/setup
        settings.tsx                    # /settings
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
          use-parse-invoice-text.ts     # Gemini text→invoice
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
      chat/
      fx/
      payments/
      payout-method/
      settlement/
      tax/
    components/                         # ← GLOBAL, PURE components only
      ui/                               # NativeWind-styled primitives
        Button.tsx
        TextField.tsx
        Card.tsx
        BottomSheet.tsx
        Skeleton.tsx
      layout/
        Screen.tsx                      # SafeArea + KeyboardAvoidingView wrapper
        TabBar.tsx
    lib/                                # cross-cutting utilities
      api-client.ts                     # ts-rest client setup
      query-client.ts                   # tanstack-query setup
      auth.ts                           # supabase + expo-secure-store helpers
      format.ts                         # money, date formatters
      env.ts                            # zod-validated EXPO_PUBLIC_* env
      haptics.ts                        # expo-haptics wrappers
      cn.ts                             # clsx + tailwind-merge
    assets/
      icon.png, splash.png, fonts/
  app.json
  metro.config.js
  tailwind.config.ts
```

---

## 2. The three component tiers

Every component falls into exactly one tier. The tier dictates whether it can hold logic.

### Tier 1 — Global components (`src/components/`)

**Pure. No logic. No state beyond `useState` for trivial UI affordances (open/closed, focus). No data fetching. No business rules.**

Examples: `Button`, `TextField`, `Card`, `BottomSheet`, `Skeleton`, `Screen` (SafeArea + keyboard wrapper).

```tsx
// src/components/ui/Button.tsx
import { Pressable, Text, ActivityIndicator, View, PressableProps } from "react-native";
import { forwardRef, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const button = cva("flex-row items-center justify-center rounded-xl", {
  variants: {
    variant: { primary: "bg-emerald-600 active:bg-emerald-700", ghost: "bg-transparent" },
    size: { sm: "h-9 px-3", md: "h-12 px-4", lg: "h-14 px-6" },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

const label = cva("font-semibold", {
  variants: {
    variant: { primary: "text-white", ghost: "text-emerald-600" },
    size: { sm: "text-sm", md: "text-base", lg: "text-lg" },
  },
});

type Props = PressableProps &
  VariantProps<typeof button> & { isLoading?: boolean; children: ReactNode };

export const Button = forwardRef<View, Props>(
  ({ className, variant, size, isLoading, disabled, children, ...rest }, ref) => (
    <Pressable
      ref={ref}
      className={cn(button({ variant, size }), (disabled || isLoading) && "opacity-50", className)}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text className={label({ variant, size })}>{children}</Text>
      )}
    </Pressable>
  ),
);
Button.displayName = "Button";
```

What's allowed here:

- Variants via `cva` / NativeWind.
- Forwarded refs.
- Trivial uncontrolled UI state (open, hover) — but **prefer controlled** so callers retain control.

What's forbidden:

- `useQuery`, `useMutation`, ts-rest calls.
- Importing anything from `features/`.
- Business-specific labels ("Send invoice", "Pay now") — those are passed as `children`/props.

> **Test:** could you ship this component on a non-Raket app unchanged? If no, it doesn't belong in `src/components/`.

### Tier 2 — Feature components (`src/features/<feature>/components/`)

**Render-only. If the component needs any logic, that logic moves to a custom hook in the same feature.**

The component reads from its props (and from its dedicated hook, if it has one). It does not call `useQuery` directly. It does not call `fetch`. It does not contain business rules.

```tsx
// src/features/invoices/components/InvoiceList.tsx
import { useInvoices } from "../hooks/use-invoices";
import { InvoiceListView } from "./InvoiceListView";

export function InvoiceList({ status }: { status?: InvoiceStatus }) {
  const { invoices, isLoading, error, loadMore, hasMore, onRefresh, isRefreshing } = useInvoices({
    status,
  });

  return (
    <InvoiceListView
      invoices={invoices}
      isLoading={isLoading}
      error={error}
      onLoadMore={loadMore}
      hasMore={hasMore}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
    />
  );
}
```

```tsx
// src/features/invoices/components/InvoiceListView.tsx — pure, no hooks
import { FlashList } from "@shopify/flash-list";
import { RefreshControl } from "react-native";

export function InvoiceListView({
  invoices,
  isLoading,
  error,
  onLoadMore,
  hasMore,
  onRefresh,
  isRefreshing,
}: Props) {
  if (error) return <ErrorState message={error.message} />;
  if (isLoading && invoices.length === 0) return <InvoiceListSkeleton />;
  if (invoices.length === 0) return <EmptyState />;

  return (
    <FlashList
      data={invoices}
      renderItem={({ item }) => <InvoiceRow invoice={item} />}
      keyExtractor={(i) => i.id}
      estimatedItemSize={72}
      onEndReached={hasMore ? onLoadMore : undefined}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    />
  );
}
```

**The pattern:** the outer component is a 5-line adapter between the hook and the view. The view is pure. Both are easy to test (the view with props, the hook with a query client).

### Tier 3 — Shared / parts components (`*.parts.tsx`)

When a feature component grows large, split it into a parent + a `*.parts.tsx` file containing subcomponents. **Each shared `*.parts` component that has logic owns a hook in the same folder.**

```
features/dashboard/components/
  Dashboard.tsx              # composes the screen
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
  return (
    <EarningsCardView
      totalPhp={totalPhp}
      totalUsd={totalUsd}
      deltaPct={deltaPct}
      isLoading={isLoading}
    />
  );
}

export function FxComparison({ amountUsd }: { amountUsd: number }) {
  const { raket, paypal, wise, bank, savings } = useFxComparison({ amountUsd });
  return (
    <FxComparisonView raket={raket} paypal={paypal} wise={wise} bank={bank} savings={savings} />
  );
}
```

Rule: a `*.parts.tsx` file is fine. A `*.parts.tsx` file with inline `useQuery` calls is not.

---

## 3. Hooks — where logic actually lives

Every non-trivial component is paired with a hook. The hook owns:

- Data fetching (`useQuery`, `useMutation` via ts-rest).
- Derived state and memoization.
- Local UI state that has business meaning.
- Side effects (`useEffect`, `useFocusEffect`).
- Mapping API data → view-model.
- Native SDK calls (Stripe React Native, Supabase realtime, `expo-haptics`, `expo-secure-store`, `expo-clipboard`).

```ts
// features/invoices/hooks/use-invoices.ts
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
    onRefresh: query.refetch,
    isRefreshing: query.isRefetching,
  };
}
```

Hook conventions:

- **Filename:** `use-<thing>.ts`, kebab-case. The exported hook is `useThing` (camelCase).
- **One hook = one concern.** If `useInvoices` is doing list _and_ create, split into `useInvoices` + `useCreateInvoice`.
- **Hooks return a shaped object**, not a tuple. Names beat positions for view-models.
- **Don't return raw `useQuery` results** from feature hooks. Map to the shape the view needs (`{ invoices, isLoading, error, loadMore }`), not `{ data, isPending, fetchNextPage, … }`. The view should not know tanstack-query exists.
- **Wrap native SDKs.** A hook like `useTokenizeCard()` wraps `usePaymentSheet()` from Stripe React Native and returns the same kind of view-model shape. Components never touch the Stripe SDK directly.
- **Lifecycle:** for subscriptions that should only run while a screen is focused, start in `useFocusEffect` and tear down on blur. Don't leak realtime channels in the background.

### Form hooks

Forms get their own hook even when the form has no API calls. The hook owns validation, default values, and submit handling.

```ts
// features/invoices/components/InvoiceForm/use-invoice-form.ts
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateInvoiceBodySchema, type CreateInvoiceBody } from "@raket/contracts";
import { useCreateInvoice } from "../../hooks/use-create-invoice";
import { useRouter } from "expo-router";

export function useInvoiceForm() {
  const router = useRouter();
  const create = useCreateInvoice();

  const form = useForm<CreateInvoiceBody>({
    resolver: zodResolver(CreateInvoiceBodySchema),
    defaultValues: { lineItems: [defaultLineItem()] },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const invoice = await create.mutateAsync(values);
    router.push(`/invoices/${invoice.id}/sent`);
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
  baseUrl: env.EXPO_PUBLIC_API_URL,
  baseHeaders: {
    authorization: async () => {
      const token = await getAccessToken(); // reads expo-secure-store
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
- **Streaming endpoints** (chat) need React Native fetch streaming — wrap them in a `useStreamingChat()` hook that exposes `{ messages, send, isStreaming }`. Keep ts-rest typings for the request body; do the SSE parsing inside the hook.
- **Query keys** are arrays starting with the feature name: `["invoices"]`, `["invoices", { status: "paid" }]`, `["invoice", invoiceId]`. Keep them stable — they're the cache identity.

---

## 5. Routing & navigation (Expo Router)

Expo Router is file-based, like Next.js App Router. Folders under `src/app/` become routes; `_layout.tsx` files compose shared layouts.

Patterns:

- **Route groups** (parenthesised folders like `(auth)`, `(tabs)`) are organisational — they don't appear in the URL.
- **Auth gate** lives in `(authed)/_layout.tsx`: redirect to `/login` when no session. Don't repeat the check in every screen.
- **Modals:** declare `presentation: 'modal'` on the destination's `<Stack.Screen>`; open via `router.push({ pathname, params })`.
- **Params:** typed via `useLocalSearchParams<{ id: string }>()`. Read in the screen, pass down as props or query keys — feature components should not read route params.
- **Deep links:** configured in `app.json` `scheme: 'raket'`. QR-from-email flows that need to land in-app target `(authed)/invoices/[id]` style routes.

```tsx
// src/app/(authed)/(tabs)/invoices.tsx
import { Stack } from "expo-router";
import { Screen } from "@/components/layout/Screen";
import { InvoiceList } from "@/features/invoices";

export default function InvoicesScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Invoices" }} />
      <InvoiceList />
    </Screen>
  );
}
```

A screen file is thin: declare layout options, render the feature component. Logic stays in the feature's hook.

---

## 6. Styling

- **NativeWind only** for one-off styles. `StyleSheet.create` is acceptable when you need `useAnimatedStyle`, numeric interop with third-party components, or `transform` values not yet supported by NativeWind.
- Compose with `cn(…)` from `clsx` + `tailwind-merge` (already exported from `@/lib/cn`).
- Variant systems via `cva`.
- Primitives in `src/components/ui/` wrap `Pressable`, `TextInput`, `View`, etc. with NativeWind classes. Treat them as ours; keep them pure (Tier 1 rules apply).
- Tokens (brand colors, spacing scale) live in `tailwind.config.ts`. Mirror the web app's palette so brand stays consistent across surfaces. No magic hex codes in component files.
- **Dark mode** is driven by `useColorScheme()` + NativeWind's `dark:` variants. Don't fork components for dark.

---

## 7. State management

In order of preference:

1. **Route state** (`useLocalSearchParams`, params on `router.push`) — for filters, tabs, modal-open-ness that should survive deep-link / app-relaunch.
2. **tanstack-query cache** — for anything fetched from the API. The cache is the store.
3. **Component state** (`useState`, `useReducer`) — for ephemeral UI.
4. **Context** — only for true cross-cutting concerns (theme, auth user). Co-locate the provider with the feature that owns the data.
5. **Zustand / Jotai** — only if 1–4 genuinely don't fit. For the hackathon: don't reach for these.

### Persistence

- **Sensitive** (auth tokens, payment-method ids): `expo-secure-store`. Always access via `lib/auth.ts` helpers; never sprinkle `SecureStore.getItemAsync` across the app.
- **Non-sensitive drafts** (in-progress form values): `@react-native-async-storage/async-storage`. Hydrate from a form hook's effect; persist with debounced writes.
- Tanstack-query persistence is **opt-in per query**. Enable only for queries that are useful before a fresh network call (e.g., last-seen dashboard summary).

> Don't add a global store for data that lives in tanstack-query. The cache is the store.

---

## 8. Naming

| Thing                    | Convention                                                          |
| ------------------------ | ------------------------------------------------------------------- |
| Folder (feature)         | `kebab-case` (`payout-method/`)                                     |
| Folder (component group) | `PascalCase` (`InvoiceForm/`)                                       |
| Component file           | `PascalCase.tsx` (`InvoiceList.tsx`)                                |
| Parts file               | `<Component>.parts.tsx`                                             |
| Hook file                | `use-thing.ts` kebab-case                                           |
| Hook export              | `useThing` camelCase                                                |
| Util/api file            | `kebab-case.ts`                                                     |
| Type-only file           | `types.ts` (only if local types exist)                              |
| Screen file              | Expo Router conventions (`index.tsx`, `[param].tsx`, `_layout.tsx`) |

---

## 9. Imports

- Absolute imports via `@/` (configured in `tsconfig.json` + `metro.config.js`).
- Order: external → `@raket/contracts` → `@/lib` → `@/components` → `@/features/*` → relative (`./`, `../`).
- A feature **may** import from `@raket/contracts`, `@/lib`, `@/components`. A feature **may** import another feature's `index.ts` (its public surface). A feature **may not** reach into another feature's internals (`features/x/hooks/use-…`).
- Screens (`app/`) import from features, never the other way around.

---

## 10. Testing (lightweight for hackathon)

- **Hooks:** test with `@testing-library/react-native`'s `renderHook` and a real `QueryClientProvider`. Mock the ts-rest client at the boundary; mock native SDKs (Stripe, Supabase, `expo-secure-store`) at the same seam.
- **Pure views (`*View.tsx`):** assertion tests with `@testing-library/react-native` + props — they're pure functions of input.
- **Don't test global UI primitives.** They're so thin that the test would just re-state the markup.
- **Demo path:** at minimum, one Maestro flow (or Detox) that exercises login → create invoice → view sent screen → see settlement-animation. Protects the hackathon stage moment.

---

## 11. Anti-patterns (you will be asked to fix these in review)

| Don't                                                       | Do instead                                             |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| `useQuery` inside a screen/component                        | Move it to a hook in the same feature                  |
| `fetch("/api/…")` anywhere                                  | Use `api.<feature>.<endpoint>` from `@/lib/api-client` |
| Re-declaring types that exist in `@raket/contracts`         | Import them                                            |
| `StyleSheet.create({…})` for one-off styles                 | NativeWind classes                                     |
| `Button` with `onPress={() => sendInvoice(id)}` baked in    | Caller passes `onPress`; Button stays generic          |
| Re-implementing safe-area padding per screen                | Wrap the screen body in the `<Screen>` primitive       |
| Feature A importing `features/B/hooks/use-x`                | Export from B's `index.ts`; import that                |
| `if (loading) return …` repeated in every component         | One `<AsyncBoundary>` (or the view pattern from §2)    |
| Inline NativeWind class strings longer than ~120 chars      | Extract to `cva` variants                              |
| `useEffect(() => { fetch… }, [])` inside a screen           | `useQuery` via the typed client                        |
| `SecureStore.getItemAsync(...)` called from a component     | Wrap in `lib/auth.ts`; call via a hook                 |
| `useStripe().confirmPayment(…)` inline in JSX               | Wrap in `useTokenizeCard()` / `usePayInvoice()`        |
| Long-running subscriptions started on mount without cleanup | Start in `useFocusEffect`; tear down on blur           |

---

## 12. Checklist before merging a mobile change

- [ ] Component has no `useQuery`/`useMutation`/`fetch` — the hook does.
- [ ] Global components (`src/components/`) have zero feature-specific logic or copy.
- [ ] `*.parts.tsx` subcomponents with logic each have their own hook.
- [ ] Types come from `@raket/contracts`, not redeclared.
- [ ] NativeWind classes only; no `StyleSheet.create` for one-off styles.
- [ ] Query keys are namespaced and stable.
- [ ] No cross-feature imports into another feature's internals.
- [ ] Native SDKs (Stripe, Supabase, `expo-*`) are accessed through wrappers in `lib/` or a feature hook — never inline.
- [ ] Screen wraps body in the `<Screen>` primitive (SafeArea + keyboard handling); no per-screen safe-area math.
- [ ] Demo path still works on iOS Simulator AND a physical phone via Expo Go (golden + at least one edge case).
