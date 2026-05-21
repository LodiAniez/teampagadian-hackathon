# Raket — Product Requirements Document

**Status:** Hackathon build (48 hours)
**Owner:** [Team lead]
**Version:** 1.0 — Draft for team alignment
**Last updated:** May 19, 2026

---

## 1. One-Liner

**Raket is the payment account built for Filipino freelancers earning from global clients — get paid in minutes, not days, with transparent FX and AI-powered invoicing.**

---

## 2. Why We're Building This

### The Problem

Over 1.5 million Filipinos freelance for international clients (US, EU, Australia, Singapore). When it's time to get paid, they're stuck choosing between:

- **PayPal** — high fees (~4-7% all-in), fund holds, opaque FX
- **Wise** — better rates but 1-3 day settlement, slow KYC
- **Payoneer** — popular but dated UX, hidden FX spread, no Philippines tax support
- **Direct bank wire** — 3-5 day settlement, ₱500+ receiving fees, terrible FX

For a freelancer billing $500-$5,000 per project, this is real money lost and real cashflow pain — on top of zero tooling for invoicing, earnings tracking, or BIR tax filing.

### The Opportunity

There is no payment product built _specifically_ for the Filipino freelancer earning globally. Wise is generic. PayPal is hostile. Local fintech (GCash, Maya) is domestic-only. We can win the wedge by being the focused operating system for this user: invoice → get paid → track → file taxes, all in one product, with the FX transparency and Philippines-native UX nobody else offers.

### Why Now

- BSP has modernized payment rails (InstaPay, QR Ph, real-time settlement)
- Ethereum L2s (Morph) now offer ~2s finality with near-zero fees — making crypto settlement practical for everyday freelancer payouts
- AI (Claude, GPT) makes invoice generation, document parsing, and conversational financial assistants buildable by a small team
- The Filipino freelance economy is growing 20%+ year-over-year

---

## 3. Target User

**Primary persona: "Maria the Freelancer"**

- Filipina, 28, based in Cebu
- Frontend developer / UI designer / content writer / video editor (representative roles)
- Earns $1,500-$5,000/month from 3-7 international clients
- Currently uses PayPal + Excel + an accountant
- Frustrations: slow PayPal payouts, surprise FX losses, manual invoice creation, anxiety around BIR filing
- Tech-comfortable, has GCash and Maya, prefers mobile but does work on a laptop

**Out of scope for hackathon (future personas):**

- Small agencies (2-10 people) — same workflow, just team accounts
- Domestic freelancers (PH-to-PH) — different value prop, lower urgency
- Companies hiring freelancers — different buyer, different product

---

## 4. Goals & Success Metrics

### Hackathon Goals

1. **Win or place** in the hackathon (primary)
2. **Build a credible, demoable MVP** that doesn't visibly break on stage
3. **Establish technical foundation** the team can continue building post-hackathon

### Demo Success Criteria

- Full end-to-end flow works live: create invoice → send → client pays by card → Morph settles → "₱83,685 delivered to GCash •••• 1234" toast with Morph Explorer link → ask AI
- Single live demo run completes in under 4 minutes
- At least one "wow moment" judges remember (target: client pays by card → 5 seconds later PHP lands in GCash with a live on-chain receipt)
- No visible errors during the demo run
- Pitch lands the differentiation clearly: judges can repeat _why_ we're different after seeing it

### Post-Hackathon Success Indicators (for context)

- 100 freelancer signups in first 30 days post-hackathon (if continued)
- 50% of signups send at least one invoice
- Average freelancer saves ₱2,000+ per $500 invoice vs PayPal (provable in product)

---

## 5. Scope

### In Scope (V1 / Hackathon Build)

**Authentication**

- Phone number + OTP passwordless login (mocked SMS for demo)
- Basic user profile (name, business name, default currency)

**Payout Method**

- Add a GCash number as payout destination (architecture extends to Maya/bank post-hackathon)
- Naming: "Payout method" in UI (not "GCash number") — future-proofs the concept
- GCash number validated on frontend and backend (regex: `^09\d{9}$`)
- Confirmation step shows last 4 digits: _"PHP will be delivered to GCash •••• 1234 — confirm before saving"_
- OTP verification when adding or changing a payout method (high-risk action)

**Invoice Creation**
Three input modes, all routing to the same review form:

1. **Plain text input** — freelancer types a sentence, Claude parses to structured invoice
2. **Quotation upload** — freelancer uploads existing PDF/image quote, Claude vision extracts line items
3. **Manual form** — fallback for direct entry

Invoice currency is locked to **USD for V1**. Multi-currency invoicing is post-hackathon.

**Invoice Sending**

- Copy payment link (hosted `/pay/[invoiceId]` page — Stripe checkout)
- Display QR code (encodes `/pay/[invoiceId]` URL — any camera app opens the pay page cleanly)
- Send email to client via Resend (includes link, QR, and inline invoice summary)

**Client Payment Experience**

- Raket-hosted `/pay/[invoiceId]` page (mobile-optimized) — shows invoice summary, USD amount, freelancer name
- "Pay Now" button opens Stripe-hosted checkout — client pays by card in USD
- Blockchain is completely invisible to the client
- Stripe test card `4242 4242 4242 4242` used for demo

**Settlement & Payout**

- Stripe `payment_intent.succeeded` webhook triggers settlement; polling fallback every 10s if webhook doesn't fire within 10s
- Backend hot wallet (pre-funded with testnet USDC) sends equivalent USDC to Coins.ph deposit address on Morph via `viem` — real on-chain transfer
- `viem.waitForTransactionReceipt()` waits for Morph confirmation (~2s) → `morph_tx_hash` stored on Payment record
- `amount_php` computed using live FX rate from exchangerate.host at settlement time and stored on Payment record
- Supabase Realtime pushes invoice status change to frontend — dashboard toast fires: _"₱83,685 delivered to GCash •••• 1234 — [view on Morph Explorer]"_
- Mocked animation sequence plays automatically: _"Converting via Coins.ph... Sending via InstaPay... Delivered to GCash •••• 1234"_ — disclosed in pitch

**Freelancer Dashboard**

- Total earnings shown in PHP (primary), USD equivalent (secondary) — computed from `amount_php` stored at settlement time
- Savings counter: _"You saved ₱2,580 vs PayPal this month"_ — computed as 4% PayPal fee minus Raket's 2.9% Stripe fee on total USD received
- This month, pending invoices count
- Earnings chart by month, by client, by country
- Invoice list with status filters and Morph Explorer link per paid invoice
- Side-by-side FX comparison component (Raket vs PayPal vs Wise vs bank wire) with specific dollar amounts

**AI Chat Assistant ("Ask your books")**

- Side panel chat interface, streaming responses
- Tool-use loop: Claude → DB query → response
- Pre-built prompt chips for demo reliability
- Supports questions like: "How much did I earn from US clients this quarter?", "Who's my biggest client?", "What's my tax estimate?"

**BIR ITR Generation (preparation, not filing)**

- Quarterly breakdown (Q1-Q4) with gross receipts in PHP
- Income tax computed under 8% election (most common for freelancers)
- **Generate pre-filled 1701Q (quarterly) and 1701A (annual) PDFs** matching BIR form layout, ready to download
- Applicable form references and BIR deadlines clearly shown
- AI-generated plain-English summary paragraph (narrative only — all math computed deterministically in backend)
- CSV export for accountant
- Filing instructions panel ("Next steps: open eBIRForms, copy these values...")
- **Explicit handoff point:** Raket prepares the ITR; freelancer submits via eBIRForms. Filing, payment, and OR issuance are out of scope.

### Out of Scope (V1 / Explicit Cuts)

- Real KYC/AML compliance flow (mocked for demo)
- Real Coins.ph API integration (mocked — animated sequence for demo)
- Real InstaPay integration (mocked — requires banking license)
- Maya/bank payout methods (GCash only for V1)
- **Filing the ITR with BIR** (we generate the form, freelancer submits via eBIRForms)
- **Paying taxes to BIR** (out of scope — handled by freelancer through AABs)
- **Issuing BIR Official Receipts** (requires CAS accreditation — roadmap item)
- Recurring invoices / subscriptions
- Multi-user team accounts
- Quotation workflow (create quote → send → approve → convert) — we only support quotation _upload_ as input
- Mobile native app (responsive web only)
- Settings / preferences pages beyond payout method
- Multi-language support (English only)
- Multiple payout methods per user (one is enough for demo)
- Real OTP SMS delivery (mocked — code shown on screen)
- Client-side crypto wallet (Morph is backend infrastructure only)
- AP / vendor payment features (we are receive-only)
- Error states beyond the demo happy path

---

## 6. Key User Flows

### Flow 1: First-time freelancer onboarding (90 seconds)

1. Land on marketing page → click "Sign up"
2. Enter phone number → receive OTP (mocked) → enter code
3. Complete profile: name, business name, default currency (auto-filled USD)
4. Prompt: "Add a payout method to start receiving payments"
5. Enter GCash number as payout destination → confirm last 4 digits → verify with OTP → success
6. Land on empty dashboard with prompt: "Create your first invoice"

### Flow 2: Create and send an invoice (60 seconds)

1. Click "+ New invoice"
2. Choose input mode: text / upload / manual (default: text)
3. **Text mode:** Type "20 hours of UI design for Northwind at $80/hr, due in 14 days"
4. AI parses → form prefills with client, line items, amounts, dates
5. Review and edit if needed → click "Generate invoice"
6. Success screen with three actions: Copy link / Show QR / Send via email
7. Click "Send via email" → enter client email → confirm → sent

### Flow 3: Client pays the invoice (45 seconds)

1. Client receives email with "Pay Now" button + QR code
2. Clicks button (or scans QR on phone) → Raket pay page opens
3. Page shows: invoice summary, USD amount, freelancer name — no crypto visible
4. Client clicks "Pay Now" → Stripe-hosted checkout opens
5. Client enters card details (`4242 4242 4242 4242` for demo) → pays
6. Stripe confirms → backend hot wallet sends USDC on Morph (~2s) → Morph confirms
7. Mocked animation on freelancer's dashboard: _"Converting via Coins.ph... Sending via InstaPay..."_
8. Toast: _"₱83,685 delivered to GCash •••• 1234 — [view on Morph Explorer]"_

### Flow 4: Freelancer asks AI assistant (30 seconds)

1. Click chat panel on dashboard
2. Click prompt chip: "How much did I earn from US clients this quarter?"
3. AI responds in 2-3 seconds: "You earned ₱287,450 from 5 invoices to US clients this quarter — that's about 59% of your total income."
4. Click "Tax estimate" chip
5. AI responds: "Based on your Q1 earnings of ₱487K, you owe roughly ₱39K in income tax (8% election). Due May 15. Set this aside before spending."

---

## 7. Technical Architecture

### Stack

| Layer         | Tech                                          | Why                                                                                 |
| ------------- | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| Frontend      | Next.js 15 (App Router)                       | Team strength, fast iteration, Vercel deploy                                        |
| Backend       | NestJS                                        | Team strength, structured for handing off post-hackathon                            |
| Database      | Postgres (Supabase)                           | Free tier, auth + realtime included                                                 |
| Realtime      | Supabase Realtime                             | Push invoice status changes to frontend — instant dashboard toast, zero extra infra |
| Auth          | Supabase Auth (phone OTP)                     | Saves 3-4 hours vs custom                                                           |
| Payments      | Stripe (test mode)                            | Client-facing card checkout, webhook, battle-tested DX                              |
| Settlement    | Morph L2 + USDC (ERC20)                       | On-chain cross-border settlement, ~2s finality, verifiable txn hash on stage        |
| Web3 client   | viem                                          | Backend hot wallet ops — send USDC, wait for receipt. No client-side wallet needed. |
| AI            | Anthropic Claude API (Sonnet 4.6 + Haiku 4.5) | Tool-use first-class, TypeScript SDK                                                |
| AI SDK        | Vercel AI SDK                                 | Streaming UI hooks, free, fast integration                                          |
| Email         | Resend                                        | Free tier, simple API                                                               |
| QR Generation | `qrcode` npm package                          | Trivial, server-side                                                                |
| Hosting       | Vercel (FE) + Railway (BE)                    | Both have free tiers, fast deploys                                                  |

### Data Model (Core Tables)

```
users (id, phone, name, business_name, default_currency, created_at)
payout_methods (id, user_id, type [gcash], details JSONB, is_default, created_at)
  -- details: { gcash_number: "09XX XXX XXXX" }
clients (id, user_id, name, email, country, default_currency, created_at)
invoices (id, user_id, client_id, status, amount, currency, issue_date, due_date,
          stripe_payment_intent_id, source_type, source_file_url, created_at)
invoice_line_items (id, invoice_id, description, quantity, unit, rate, amount)
payments (id, invoice_id, amount_usd, amount_php, fx_rate_at_settlement, morph_tx_hash, stripe_charge_id, paid_at)
payouts (id, payment_id, payout_method_id, amount_php, status, external_txn_id)
  -- status: pending → processing → delivered (Coins.ph+InstaPay leg mocked for demo)
```

### External Integrations

- **Stripe:** Payment Intents (test mode), Webhooks (`payment_intent.succeeded`), polling fallback every 10s
- **Morph Hoodi Testnet:** Chain ID `2910`, RPC `https://rpc-hoodi.morph.network`, Explorer `https://explorer-hoodi.morph.network`
- **USDC on Morph Hoodi:** `0x1178341838B764dCfFA5BCEAb1d41443Fd71a227` — hot wallet sends ERC20 transfer via `viem.sendTransaction()` + `waitForTransactionReceipt()`
- **Coins.ph + InstaPay:** Mocked — animated UI sequence only. Real integration is post-hackathon.
- **Supabase Realtime:** Subscribed to `invoices` table — pushes paid status to frontend for instant toast
- **Claude API:** Messages API with tools, vision for quotation parsing
- **Resend:** Transactional email
- **Exchange rate API:** exchangerate.host (free) for USD→PHP rate, fetched and stored at settlement time

---

## 8. Differentiation (What Wins the Pitch)

| Feature                           | Raket              | PayPal    | Wise     | Payoneer   |
| --------------------------------- | ------------------ | --------- | -------- | ---------- |
| Settlement to GCash               | ~5s end-to-end     | 3-5 days  | 1-3 days | 1-2 days   |
| Fee on $1,600 invoice             | ~$46 (2.9% Stripe) | ~$96 (6%) | ~$32 ✅  | ~$48       |
| On-chain settlement proof         | ✅ Morph Explorer  | ❌        | ❌       | ❌         |
| AI invoice creation               | ✅                 | ❌        | ❌       | ❌         |
| Quotation upload + AI extract     | ✅                 | ❌        | ❌       | ❌         |
| Conversational earnings assistant | ✅                 | ❌        | ❌       | ❌         |
| BIR-ready tax summaries           | ✅                 | ❌        | ❌       | ❌         |
| Built for Filipino freelancers    | ✅                 | ❌        | ❌       | ⚠️ Generic |

---

## 9. Risks & Mitigations

| Risk                                         | Impact                          | Mitigation                                                                                                        |
| -------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Stripe webhook delayed or missed             | Demo-killing                    | Polling fallback every 10s catches it; test webhook on Railway URL before going on stage                          |
| Hot wallet drained before demo               | Demo-killing (demo only)        | Top-up at hour 0; production path uses Stripe Stablecoin Payments (no float) — risk does not exist post-hackathon |
| Morph RPC unavailable during demo            | Demo-killing                    | Pre-recorded backup video of payment flow; have a confirmed txn hash ready as fallback                            |
| Morph testnet congestion or reorg            | Demo-killing                    | Test 20+ payments day-of; fallback to showing a pre-confirmed txn hash                                            |
| AI returns wrong/weird output on stage       | Credibility loss                | Pre-script demo prompts, seed data deliberately, test 10+ times                                                   |
| BIR tax numbers are wrong                    | Credibility loss with PH judges | Verify rates against BIR.gov.ph the week of hackathon                                                             |
| Quotation upload fails on judge's random PDF | Demo-killing                    | Don't let judges upload — use pre-tested sample PDFs                                                              |
| WiFi fails on stage                          | Demo-killing                    | Record backup demo video by hour 40                                                                               |
| Scope creep                                  | Schedule slip                   | Lock V1 scope at hour 4, anything new goes to stretch list                                                        |

---

## 10. Timeline (48 Hours)

| Phase                 | Hours | Output                                                                        |
| --------------------- | ----- | ----------------------------------------------------------------------------- |
| Setup & Foundation    | 0-4   | Repos, deploys, auth keys, demo script locked                                 |
| Core data + auth      | 4-10  | Schema, seeded data, login flow working                                       |
| Invoice creation flow | 10-18 | Three input modes + form + AI parsing                                         |
| Payment flow          | 14-24 | Stripe checkout + webhook + polling fallback, hot wallet USDC send, /pay page |
| Dashboard             | 18-28 | Earnings views, FX comparison component                                       |
| AI chat assistant     | 26-36 | Tool-use loop, chat UI, prompt chips                                          |
| BIR ITR generation    | 30-38 | Quarterly breakdown, pre-filled 1701Q PDF, AI narrative                       |
| Polish & QA           | 36-44 | Demo run-throughs, bug fixes, animations                                      |
| Pitch & submission    | 40-48 | Deck, rehearsal, backup video, submit                                         |

_Phases overlap by design — frontend and backend leads work in parallel._

---

## 11. Team & Responsibilities

| Person                         | Primary Owner Of                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| Person A (Frontend lead)       | Auth UI, invoice forms, dashboard, FX comparison, chat UI                                |
| Person B (Backend lead)        | DB schema, API, Stripe integration, hot wallet USDC service, Morph settlement, tax logic |
| Person C (AI + integrations)   | Claude prompts, tool-use loop, quotation parsing, AI narrative                           |
| Person D (Design + pitch + QA) | Branding, demo data, polish, pitch deck, demo rehearsals                                 |

If team is 3: drop Person D, distribute their work, but assign one explicit demo/pitch owner.

---

## 12. Open Questions

- [ ] Confirm hackathon submission requirements (video length, repo public/private, etc.)
- [ ] Which judge panel? Sponsors? Affects pitch tuning.
- [ ] Verify current BIR rates (8% income tax option, percentage tax, deadlines for Q1/Q2 2026)
- [ ] Decide demo persona name and final brand details before hour 6
- [ ] Confirm whether sponsor APIs (e.g., GCash, Maya) are available to integrate as bonus points
- [ ] Fund hot wallet with Morph Hoodi testnet USDC before hour 10 — assign one team member as wallet owner
- [ ] Register Stripe webhook against Railway production URL before demo day
- [x] ~~Confirm USDC contract address on Morph testnet~~ → `0x1178341838B764dCfFA5BCEAb1d41443Fd71a227`
- [x] ~~Confirm Morph testnet RPC~~ → `https://rpc-hoodi.morph.network` (chain `2910`)

---

## 13. Decisions Locked (Post-Discussion)

1. **Name:** Raket — Filipino slang for "gig/side hustle," instantly resonant with target user
2. **Auth:** Phone + OTP, passwordless (no email/password)
3. **Payout terminology:** "Payout method" not "card" — future-proofs for GCash/Maya/bank
4. **OTP placement:** On payout method add/change only, NOT on every invoice send
5. **Quotation handling:** Upload-as-input only, NOT a separate quotation workflow
6. **QR code:** Generated for every invoice, embedded in dashboard + email + PDF
7. **Payment flow:** `Client (USD card) → Stripe → hot wallet bridges USD→USDC → Morph (USDC to Coins.ph) → mocked Coins.ph+InstaPay animation → GCash`. Stripe and Morph are real; Coins.ph+InstaPay are mocked and disclosed.
8. **AI model:** Claude Sonnet 4.6 for invoice generation + chat assistant; Haiku 4.5 for lightweight tasks
9. **Demo flow:** Type-to-invoice → send → team-controlled client pays by card (Stripe) → Morph confirms → mocked animation → PHP toast with Explorer link → ask AI
10. **BIR scope:** Generate pre-filled ITR (1701Q / 1701A) PDFs ready to file — filing itself stays with the freelancer via eBIRForms. We prepare, they submit.
11. **Demo control:** Team controls the "client" device on stage — Stripe test card `4242 4242 4242 4242` pre-entered.
12. **Invoice currency:** USD only for V1. Multi-currency is post-hackathon.
13. **USD→USDC bridge — hackathon vs production:**
    - **Hackathon:** Pre-funded hot wallet. When the Stripe webhook fires, backend sends equivalent USDC from our wallet on Morph. This is scaffolding — Raket fronts the USDC out of its own balance.
    - **Production:** **Stripe Stablecoin Payments** (built on Bridge, GA'd 2025). Client pays by card on Stripe Checkout → Stripe converts USD → USDC under the hood → deposits directly to our designated settlement wallet on-chain. No Raket float, no treasury risk, no "forgot to top up" failure mode.
    - **Why the hot wallet doesn't survive to prod:** Every paid invoice draws USDC out of our balance, and Stripe pays us back via standard USD bank payouts days later. At any meaningful volume we'd be the bank, not the platform. Stripe Stablecoin Payments collapses the bridge into Stripe's existing rails, where it belongs.
14. **No smart contract:** Hot wallet sends USDC directly to Coins.ph deposit address. Wallet-to-wallet transfer on Morph — no Solidity needed.
15. **Morph settlement detection:** `viem.waitForTransactionReceipt()` after sending — synchronous, no event listener needed.
16. **Stripe reliability:** Webhook primary (`payment_intent.succeeded`). Polling fallback every 10s if webhook doesn't fire within 10s.
17. **Payout method:** GCash number only for V1. Validated `^09\d{9}$`. Last 4 digits shown in UI. OTP gate on save.
18. **PHP amount:** Live USD→PHP rate from exchangerate.host fetched at settlement time, stored as `fx_rate_at_settlement`. AI queries stored `amount_php` — not a live rate.
19. **Real-time toast:** Supabase Realtime on `invoices` table. Fires after Morph confirmation, includes Explorer link.
20. **Fee narrative:** "$50 more on a $1,600 invoice vs PayPal." Computed as 4% PayPal minus 2.9% Stripe on total USD. Shown as savings counter on dashboard. Do not claim zero fees — Stripe's 2.9% is real.
21. **Morph pitch:** "Stripe collects the payment. Morph settles it in seconds — no SWIFT, no correspondent banks. Every transaction on-chain forever."
22. **Hot wallet security:** `MORPH_HOT_WALLET_PRIVATE_KEY` in Railway env vars only — never in code or `.env.example`. Balance check on NestJS startup, warning if below 500 USDC testnet.

---

## 14. Appendix: Pitch One-Liner Variants

**For the hackathon submission form:**

> Raket is a cross-border payment platform for Filipino freelancers — clients pay by card, Morph settles in seconds, PHP lands in GCash. AI-powered invoicing and BIR-ready tax summaries included.

**For the 60-second pitch opener:**

> Over 1.5 million Filipinos freelance for global clients. Every one of them loses 4-7% to PayPal, waits days for Wise, and stitches together spreadsheets to file BIR taxes. Raket fixes all of that in one product — the payment account built for the way Filipinos actually earn today.

**For the elevator (10 seconds):**

> Raket — get paid for every gig, from anywhere in the world.

---

_This is a hackathon PRD. Optimize for shipping, not perfection. Lock scope, build the demo path, polish what judges will see. Cut anything that isn't on the demo flow._
