# Invoice AI Generation (`parseText`)

Single source of truth for the AI invoice-parsing feature: `POST /invoices/parse-text`. A stateless, **Gemini-powered** transform that turns a freelancer's plain-text description of work into a structured invoice draft. No DB writes. Backend only (`apps/api`); no `/web` changes. Upload and manual entry are out of scope.

## At a glance

| Aspect                | Value                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Endpoint              | `POST /api/v1/invoices/parse-text` (Bearer auth)                                         |
| Stateless             | Yes — no DB writes                                                                       |
| Provider              | Google Gemini via `@google/genai`                                                        |
| Model                 | `GEMINI_MODEL` env (default `gemini-2.5-flash`)                                          |
| Extraction method     | Structured output (`responseSchema` + JSON mime type), `temperature: 0`                  |
| On partial extraction | Partial draft + `warnings[]` (never throws for missing fields)                           |
| On provider failure   | One retry on transient (502/503/504/network); else clean `500`, real error logged        |
| Tests                 | `GeminiService` unit test (mocked SDK); parser intentionally untested (hackathon triage) |

## Request / response

**Request body** (`ParseInvoiceTextBodySchema`):

```ts
{
  text: string;                       // 1–2000 chars, required
  defaultCurrency?: "USD" | "EUR" | "GBP" | "PHP";  // optional
}
```

**200 response** (`ParsedInvoiceDraftSchema`):

```ts
{
  clientName: string | null;
  clientEmail: string | null;         // email-validated when present
  currency: "USD" | "EUR" | "GBP" | "PHP";
  issueDate: string;                  // YYYY-MM-DD
  dueDate: string | null;             // YYYY-MM-DD
  lineItems: Array<{
    description: string;
    quantity: number | null;
    unit: string | null;
    rate: number | null;
    amount: number | null;
  }>;
  warnings: string[];
}
```

Contract declares `200 | 401 | 422`. A provider failure surfaces as a `500` (see [Error handling](#error-handling)) — not currently in the contract's declared responses.

## Architecture & flow

```
POST /invoices/parse-text
  → InvoicesController (ts-rest, thin)
  → InvoicesService.parseText(userId, body)
  → InvoiceParserService.parse(text, defaultCurrency)
  → GeminiService.parseInvoiceText(text, defaultCurrency)   // raw extraction
  ← RawParsedInvoice (loose, nulls preserved)
  ← ParsedInvoiceDraft (fallbacks applied + warnings computed)
```

- **`GeminiService`** (`integrations/gemini/`) — owns the LLM call and returns a loosely-typed `RawParsedInvoice`. No fallbacks, no warnings.
- **`InvoiceParserService`** (`invoices/`) — normalizes the raw result into the strict contract type: applies fallbacks and computes `warnings[]`.
- The two-layer split keeps the Gemini wire-decode (which must tolerate imperfect model output) separate from the contract-shaped result.

## Configuration

```bash
GEMINI_API_KEY="AIza..."        # required — https://aistudio.google.com/apikey
GEMINI_MODEL="gemini-2.5-flash" # optional — defaults to gemini-2.5-flash
```

Validated in `apps/api/src/common/config/env.schema.ts`; the API will not boot without a non-empty `GEMINI_API_KEY`. Also listed in `turbo.json` (`build.env`) and `.env.example`. No local daemon or model download — it's a cloud API key.

> Note: `gemini-2.0-flash` returns `limit: 0` (no free-tier allowance) on some projects/regions; `gemini-2.5-flash` is the working default. Other available models can be set via `GEMINI_MODEL`.

## `GeminiService`

`integrations/gemini/gemini.service.ts`. Registered as a **`@Global()`** module so future `ai-chat/` and `tax/` modules can reuse it.

- One method: `parseInvoiceText(text: string, defaultCurrency?: string): Promise<RawParsedInvoice>`.
- Calls `ai.models.generateContent()` with:
  - `responseMimeType: "application/json"` + `responseSchema: RESPONSE_SCHEMA` (Gemini structured output). Optional fields are marked `nullable` and listed in `required` so the model emits them as `null` rather than omitting the key.
  - `temperature: 0` for deterministic extraction.
  - A `systemInstruction` built per call by `buildSystemInstruction(defaultCurrency)`.
- Parses the JSON text response and validates it against `RawParsedInvoiceSchema` (a deliberately **loose** Zod schema — all fields nullable, no min/max/email — so the parser can repair imperfect output instead of rejecting it).

### Prompt / date anchoring

`buildSystemInstruction` embeds **today's date** and instructs the model to resolve relative dates (`"due in 30 days"`, `"net 15"`, `"by next Friday"`) into `YYYY-MM-DD`. Without this anchor the model returns `null` for relative dates (it has nothing to compute against). The prompt also covers: null-when-absent, currency assumption (from `defaultCurrency` when given), per-line-item splitting, natural-language amount/rate parsing (`"$1,500"` → 1500; `"$90/hour for 10 hours"` → rate 90, qty 10, unit "hour"), and amount computation only when both quantity and rate are present.

### Error handling

- **One retry** on transient upstream failures — `ApiError` with status in `{502, 503, 504}`, or any non-`ApiError` (network/transport) error. Quota (`429`) and other `4xx` **fail fast** (an immediate retry won't recover).
- All failures are logged server-side (`Logger`) with the real error, and surfaced to the client as a generic `InternalServerErrorException` (`500`) — the raw Google error JSON is **never leaked**.
- `parseResponse` throws distinct `500`s for an empty response, malformed JSON, or a schema mismatch.

## `InvoiceParserService`

`invoices/invoice-parser.service.ts`. Pure mapping `RawParsedInvoice` → `ParsedInvoiceDraft`.

**Fallbacks:**

- `currency` → validated via `SupportedCurrencySchema`; on miss, `defaultCurrency ?? "USD"`.
- `issueDate` → `raw.issueDate ?? today()` (`new Date().toISOString().slice(0, 10)`).
- `unit`, `quantity`, `rate`, `amount`, `dueDate`, `clientName`, `clientEmail` → passed through as-is (`null` preserved).

**Warnings** (computed from null checks):

- `clientName === null` → `"Client name could not be extracted"`
- `dueDate === null` → `"Due date could not be determined"`
- per line item `quantity === null` → `"Quantity not found for: <description>"`
- per line item `rate === null` → `"Rate not found for: <description>"`

## Field nullability

Output (`ParsedInvoiceDraft`) shape and where each value comes from:

| Field                     | Nullable | Source / fallback                                                    |
| ------------------------- | -------- | -------------------------------------------------------------------- |
| `clientName`              | yes      | Model; `null` → warning                                              |
| `clientEmail`             | yes      | Model (email-validated when present)                                 |
| `currency`                | no       | Model → `defaultCurrency` → `"USD"`                                  |
| `issueDate`               | no       | Model → today                                                        |
| `dueDate`                 | yes      | Model (resolves relative dates); `null` → warning                    |
| `lineItems[].description` | no       | Model                                                                |
| `lineItems[].quantity`    | yes      | Model; `null` → warning                                              |
| `lineItems[].unit`        | yes      | Model; passed through (`null` when not stated — no `"unit"` default) |
| `lineItems[].rate`        | yes      | Model; `null` → warning                                              |
| `lineItems[].amount`      | yes      | Model (set only when quantity and rate are present)                  |

## Tests

`integrations/gemini/__tests__/gemini.service.spec.ts` mocks `@google/genai` and covers:

1. Happy path — all fields populated returned intact.
2. Request shape — configured model + JSON structured output + user text.
3. Partial path — model nulls preserved.
4. Empty response — throws.
5. Malformed JSON — throws.
6. Schema mismatch — throws.
7. Date anchoring — system instruction includes today's date.
8. Transient retry — a `503` is retried once and then succeeds.
9. No retry on quota — a `429` fails immediately (called once) with a clean error.
10. No leak — the raw upstream error message is not surfaced to the caller.

`InvoiceParserService` has no test (pure mapping, off the demo path — hackathon triage). Full API suite is green; `apps/api` and `packages/contracts` typecheck clean.

## File map

| File                                                                        | Role                                                                                    |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `packages/contracts/src/invoices/invoices.schema.ts`                        | `ParseInvoiceTextBodySchema`, `ParsedInvoiceLineItemSchema`, `ParsedInvoiceDraftSchema` |
| `packages/contracts/src/invoices/invoices.contract.ts`                      | `parseText` route definition                                                            |
| `apps/api/src/modules/integrations/gemini/gemini.service.ts`                | Gemini call + raw decode                                                                |
| `apps/api/src/modules/integrations/gemini/gemini.module.ts`                 | `@Global()` `GeminiModule`                                                              |
| `apps/api/src/modules/integrations/gemini/__tests__/gemini.service.spec.ts` | Unit test (mocked SDK)                                                                  |
| `apps/api/src/modules/invoices/invoice-parser.service.ts`                   | Fallbacks + warnings                                                                    |
| `apps/api/src/modules/invoices/invoices.service.ts`                         | `parseText()` delegates to the parser                                                   |
| `apps/api/src/modules/invoices/invoices.module.ts`                          | Registers `InvoiceParserService`                                                        |
| `apps/api/src/app.module.ts`                                                | Imports `GeminiModule`                                                                  |
| `apps/api/src/common/config/env.schema.ts`                                  | `GEMINI_API_KEY`, `GEMINI_MODEL`                                                        |
| `apps/api/package.json`                                                     | `@google/genai` dependency                                                              |
| `turbo.json`, `.env.example`                                                | Env wiring                                                                              |

See [`testing-parse-text-postman.md`](testing-parse-text-postman.md) for how to exercise the endpoint manually.
