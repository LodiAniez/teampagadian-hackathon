# Demo chat prompts — rehearsal checklist (TEA-57)

The "Ask your books" chips are the demo's safety net: tap-to-fire prompts that
each exercise a different Gemini tool and land a believable answer. They live in
`packages/contracts/src/chat/chat.schema.ts` (`DEMO_PROMPT_CHIPS` primary +
`BACKUP_PROMPT_CHIPS`) so web/mobile/api share one source of truth.

This file is the **rehearsal script**. The chips are curated against the
[TEA-64](https://linear.app/teampagadian/issue/TEA-64) seed (Maria Santos; top
client Northwind Digital; 25 invoices Jan–May 2026; Q1 has ≥5 paid; ~₱500K
total; Q1 tax ~₱40K @ 8%). Reliability is **empirical** — it must be rehearsed
live, because Gemini tool-routing varies. Do the rehearsal once TEA-64 seed +
the chat endpoint (TEA-55) are running.

## Primary chips

| Chip             | Prompt                                              | Tool                     | Expected answer (seed)                                          |
| ---------------- | --------------------------------------------------- | ------------------------ | --------------------------------------------------------------- |
| `us-earnings`    | "How much did I earn from US clients this quarter?" | `query_earnings`         | Sum for Northwind + Acme over the current quarter, in ₱         |
| `biggest-client` | "Who's my biggest client this year?"                | `get_client_summary`     | Northwind Digital — total earned, invoice count, avg, last paid |
| `q1-tax`         | "What's my tax estimate for Q1?"                    | `calculate_tax_estimate` | ~₱40K due, form 1701Q, 8% election, deadline                    |
| `unpaid`         | "Show me my unpaid invoices"                        | `get_invoice_status`     | The ~4 sent (awaiting-payment) invoices                         |

## Backup phrasings (if Gemini routes a primary wrong on the day)

| Chip                 | Prompt                                                               | Tool                     |
| -------------------- | -------------------------------------------------------------------- | ------------------------ |
| `earnings-year`      | "What are my total earnings this year?"                              | `query_earnings`         |
| `top-client-summary` | "Give me a summary of my top client."                                | `get_client_summary`     |
| `tax-q1-alt`         | "How much income tax will I owe for the first quarter of this year?" | `calculate_tax_estimate` |
| `awaiting-payment`   | "Which invoices are still awaiting payment?"                         | `get_invoice_status`     |

## Rehearsal procedure (manual — pending TEA-64 + live stack)

1. Seed the demo data: `npm run db:seed -w @raket/api` (after TEA-64 lands).
2. Run the API with the chat endpoint (TEA-55) and a valid `GEMINI_API_KEY`.
3. Log in as Maria Santos in the mobile app (or hit `POST /api/v1/ai/chat` directly).
4. Fire each primary chip **≥5 times** and confirm:
   - Gemini calls the **intended tool** (check `smoke:chat` output or server logs).
   - The answer is correct and well-formatted (₱ amounts, right client/figures).
   - The matching tool-card renders on mobile.
5. Target **≥9/10** correct, formatted answers per chip. If a primary is flaky,
   swap in its backup phrasing (same `tool`) and re-rehearse.
6. Record results below.

## Rehearsal log

> Fill in once rehearsed against live seed data.

| Chip             | Attempts | Correct | Notes             |
| ---------------- | -------- | ------- | ----------------- |
| `us-earnings`    | –        | –       | not yet rehearsed |
| `biggest-client` | –        | –       | not yet rehearsed |
| `q1-tax`         | –        | –       | not yet rehearsed |
| `unpaid`         | –        | –       | not yet rehearsed |

## Notes

- `unpaid` maps to `get_invoice_status`; "unpaid" isn't a literal status enum
  (`draft|sent|paid|overdue|void`), so confirm Gemini filters to `sent`
  (+ `overdue`) rather than returning everything. If unreliable, use the
  `awaiting-payment` backup.
- Avoid time-of-day-relative prompts. "this quarter"/"this year" are fine
  because the seed spans the current period; "today"/"this week" are not.
