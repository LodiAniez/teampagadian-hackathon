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

- Full end-to-end flow works live: create invoice → send → receive payment → see USDC confirmed on-chain + PHP equivalent displayed → ask AI a question
- Single live demo run completes in under 4 minutes
- At least one "wow moment" judges remember (target: judge scans QR → MetaMask approves → on-chain txn confirmed live on stage in ~2s)
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

- Add a payout destination — Morph wallet address (architecture extends to GCash/Maya/bank off-ramp post-hackathon)
- Naming: "Payout method" in UI (not "wallet") — future-proofs the concept
- Address validated on frontend (regex) and backend (`viem`'s `isAddress()`) before saving
- Confirmation step shows the entered address back to the freelancer: _"USDC will be sent to 0x1234...5678 — double-check before confirming"_
- OTP verification when adding or changing a payout method (high-risk action)

**Invoice Creation**
Three input modes, all routing to the same review form:

1. **Plain text input** — freelancer types a sentence, Claude parses to structured invoice
2. **Quotation upload** — freelancer uploads existing PDF/image quote, Claude vision extracts line items
3. **Manual form** — fallback for direct entry

Invoice currency is locked to **USD for V1**. USDC is 1:1 with USD — no conversion needed. Multi-currency invoicing is post-hackathon.

**Invoice Sending**

- Copy payment link (hosted `/pay/[invoiceId]` page with wallet connect)
- Display QR code (encodes `/pay/[invoiceId]` URL — any camera app opens the pay page cleanly)
- Send email to client via Resend (includes link, QR, and inline invoice summary)

**Client Payment Experience**

- Raket-hosted `/pay/[invoiceId]` page (mobile-optimized)
- Pay in USDC on Morph L2 — client connects wallet (MetaMask or any EVM wallet)
- Invoice amount shown in USD prominently (e.g. "$1,600 USD") with "= 1,600 USDC" directly below — bridges the mental gap for non-crypto clients
- Page auto-prompts `wallet_addEthereumChain` for Morph Hoodi testnet if client is on wrong network; Pay button blocked until correct chain is active
- One-click ERC20 `transfer` approval → ~2s on-chain confirmation

**Settlement & Payout**

- Each invoice gets a unique derived payment address (HD wallet child key) — freelancer's real wallet stays private
- Backend subscribes to USDC `Transfer` events via `viem`'s `watchContractEvent` (WebSocket); polling every 5s as fallback
- On-chain confirmation triggers: (1) invoice marked paid in Postgres, (2) USDC forwarded to freelancer's wallet, (3) `amount_php` stored using live FX rate at that moment
- Supabase Realtime pushes the invoice status change to the frontend instantly — dashboard toast appears within ~5s of MetaMask approval
- USDC settled directly to freelancer's Morph wallet — real, verifiable on-chain with Morph Explorer link

**Freelancer Dashboard**

- Total earnings shown as USDC (primary) with PHP equivalent (secondary, computed from stored FX rate at time of payment)
- This month, pending invoices, savings-vs-PayPal counter
- Earnings chart by month, by client, by country
- Invoice list with status filters and Morph Explorer link per paid invoice
- Side-by-side FX comparison component (us vs PayPal vs Wise vs bank wire)

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
- Real GCash/Maya/bank payout integration (architecture supports it, not built)
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
- Fiat card payment acceptance (USDC on Morph is the payment rail for hackathon)
- PHP off-ramp from USDC (architecture supports it; not built for demo)
- AP / vendor payment features (we are receive-only)
- Error states beyond the demo happy path

---

## 6. Key User Flows

### Flow 1: First-time freelancer onboarding (90 seconds)

1. Land on marketing page → click "Sign up"
2. Enter phone number → receive OTP (mocked) → enter code
3. Complete profile: name, business name, default currency (auto-filled USD)
4. Prompt: "Add a payout method to start receiving payments"
5. Enter Morph wallet address as payout destination → verify with OTP → success
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
3. Page shows: invoice summary, amount in USDC, freelancer name
4. Client clicks "Connect wallet" → MetaMask (or any EVM wallet) prompts approval
5. Client approves USDC transfer → ~2s Morph L2 confirmation
6. Sees success page with on-chain transaction hash
7. (On freelancer's dashboard: real-time toast: "42 USDC received from Northwind Digital — view on Morph Explorer")

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
| Payments      | Morph L2 + USDC (ERC20)                       | On-chain settlement, ~2s finality, verifiable txn hash on stage                     |
| Web3 client   | viem + wagmi                                  | Type-safe EVM interactions, React wallet hooks                                      |
| AI            | Anthropic Claude API (Sonnet 4.6 + Haiku 4.5) | Tool-use first-class, TypeScript SDK                                                |
| AI SDK        | Vercel AI SDK                                 | Streaming UI hooks, free, fast integration                                          |
| Email         | Resend                                        | Free tier, simple API                                                               |
| QR Generation | `qrcode` npm package                          | Trivial, server-side                                                                |
| Hosting       | Vercel (FE) + Railway (BE)                    | Both have free tiers, fast deploys                                                  |

### Data Model (Core Tables)

```
users (id, phone, name, business_name, default_currency, created_at)
payout_methods (id, user_id, type [morph_wallet|gcash|bank], details JSONB, is_default, created_at)
clients (id, user_id, name, email, country, default_currency, created_at)
invoices (id, user_id, client_id, status, amount, currency, issue_date, due_date,
          morph_payment_address, source_type, source_file_url, created_at)
invoice_line_items (id, invoice_id, description, quantity, unit, rate, amount)
payments (id, invoice_id, amount_usdc, amount_php, fx_rate_at_settlement, morph_tx_hash, paid_at)
payouts (id, payment_id, payout_method_id, amount_usdc, status, morph_tx_hash)
```

### External Integrations

- **Morph Hoodi Testnet:** Chain ID `2910`, RPC `https://rpc-hoodi.morph.network`, Explorer `https://explorer-hoodi.morph.network`
- **USDC on Morph Hoodi:** `0x1178341838B764dCfFA5BCEAb1d41443Fd71a227` — ERC20 transfer, no custom smart contract needed
- **viem `watchContractEvent`:** WebSocket subscription for USDC Transfer events; polling every 5s as fallback
- **Supabase Realtime:** Subscribed to `invoices` table — pushes paid status to frontend for instant toast
- **Claude API:** Messages API with tools, vision for quotation parsing
- **Resend:** Transactional email
- **Exchange rate API:** exchangerate.host (free) for USDC→PHP rate, stored at settlement time

---

## 8. Differentiation (What Wins the Pitch)

| Feature                           | Raket                | PayPal     | Wise     | Payoneer   |
| --------------------------------- | -------------------- | ---------- | -------- | ---------- |
| Settlement to PH                  | ~2s on Morph L2      | 3-5 days   | 1-3 days | 1-2 days   |
| FX transparency                   | On-chain, verifiable | ~4% hidden | ✅       | ⚠️ Partial |
| AI invoice creation               | ✅                   | ❌         | ❌       | ❌         |
| Quotation upload + AI extract     | ✅                   | ❌         | ❌       | ❌         |
| Conversational earnings assistant | ✅                   | ❌         | ❌       | ❌         |
| BIR-ready tax summaries           | ✅                   | ❌         | ❌       | ❌         |
| Built for Filipino freelancers    | ✅                   | ❌         | ❌       | ⚠️ Generic |

---

## 9. Risks & Mitigations

| Risk                                         | Impact                          | Mitigation                                                                                  |
| -------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------- |
| Morph RPC unavailable during demo            | Demo-killing                    | Keep a pre-recorded backup video of the payment flow; use a local RPC fallback if available |
| Judge/demo wallet not funded with USDC       | Demo-killing                    | Team controls the "client" laptop — pre-fund a dedicated demo wallet before going on stage  |
| Morph testnet congestion or reorg            | Demo-killing                    | Test 20+ payments day-of; have a confirmed txn hash ready to show as fallback               |
| AI returns wrong/weird output on stage       | Credibility loss                | Pre-script demo prompts, seed data deliberately, test 10+ times                             |
| BIR tax numbers are wrong                    | Credibility loss with PH judges | Verify rates against BIR.gov.ph the week of hackathon                                       |
| Quotation upload fails on judge's random PDF | Demo-killing                    | Don't let judges upload — use pre-tested sample PDFs                                        |
| WiFi fails on stage                          | Demo-killing                    | Record backup demo video by hour 40                                                         |
| Scope creep                                  | Schedule slip                   | Lock V1 scope at hour 4, anything new goes to stretch list                                  |

---

## 10. Timeline (48 Hours)

| Phase                 | Hours | Output                                                           |
| --------------------- | ----- | ---------------------------------------------------------------- |
| Setup & Foundation    | 0-4   | Repos, deploys, auth keys, demo script locked                    |
| Core data + auth      | 4-10  | Schema, seeded data, login flow working                          |
| Invoice creation flow | 10-18 | Three input modes + form + AI parsing                            |
| Payment flow          | 14-24 | Morph payment address generation, USDC event listener, /pay page |
| Dashboard             | 18-28 | Earnings views, FX comparison component                          |
| AI chat assistant     | 26-36 | Tool-use loop, chat UI, prompt chips                             |
| BIR ITR generation    | 30-38 | Quarterly breakdown, pre-filled 1701Q PDF, AI narrative          |
| Polish & QA           | 36-44 | Demo run-throughs, bug fixes, animations                         |
| Pitch & submission    | 40-48 | Deck, rehearsal, backup video, submit                            |

_Phases overlap by design — frontend and backend leads work in parallel._

---

## 11. Team & Responsibilities

| Person                         | Primary Owner Of                                                          |
| ------------------------------ | ------------------------------------------------------------------------- |
| Person A (Frontend lead)       | Auth UI, invoice forms, dashboard, FX comparison, chat UI                 |
| Person B (Backend lead)        | DB schema, API, Morph payment service, on-chain event listener, tax logic |
| Person C (AI + integrations)   | Claude prompts, tool-use loop, quotation parsing, AI narrative            |
| Person D (Design + pitch + QA) | Branding, demo data, polish, pitch deck, demo rehearsals                  |

If team is 3: drop Person D, distribute their work, but assign one explicit demo/pitch owner.

---

## 12. Open Questions

- [ ] Confirm hackathon submission requirements (video length, repo public/private, etc.)
- [ ] Which judge panel? Sponsors? Affects pitch tuning.
- [ ] Verify current BIR rates (8% income tax option, percentage tax, deadlines for Q1/Q2 2026)
- [ ] Decide demo persona name and final brand details before hour 6
- [ ] Confirm whether sponsor APIs (e.g., GCash, Maya) are available to integrate as bonus points
- [ ] Fund demo wallets with Morph Hoodi testnet USDC before hour 10 (faucet: `https://explorer-hoodi.morph.network`)
- [x] ~~Confirm USDC contract address on Morph testnet~~ → `0x1178341838B764dCfFA5BCEAb1d41443Fd71a227`
- [x] ~~Decide whether to show USDC amount or PHP equivalent on pay page~~ → USD prominently, USDC below
- [x] ~~Confirm Morph testnet RPC~~ → `https://rpc-hoodi.morph.network` (chain `2910`)

---

## 13. Decisions Locked (Post-Discussion)

1. **Name:** Raket — Filipino slang for "gig/side hustle," instantly resonant with target user
2. **Auth:** Phone + OTP, passwordless (no email/password)
3. **Payout terminology:** "Payout method" not "card" — future-proofs for GCash/Maya/bank
4. **OTP placement:** On payout method add/change only, NOT on every invoice send
5. **Quotation handling:** Upload-as-input only, NOT a separate quotation workflow
6. **QR code:** Generated for every invoice, embedded in dashboard + email + PDF
7. **Payment rail:** Morph L2 + USDC (ERC20) — no Stripe, no fiat card acceptance for hackathon. Client pays in USDC; freelancer receives USDC to Morph wallet. Real, on-chain, verifiable.
8. **AI model:** Claude Sonnet 4.6 for invoice generation + chat assistant; Haiku 4.5 for lightweight tasks
9. **Demo flow:** Type-to-invoice → send → team-controlled client wallet pays USDC on stage → txn confirmed on Morph Explorer → ask AI
10. **BIR scope:** Generate pre-filled ITR (1701Q / 1701A) PDFs ready to file — filing itself stays with the freelancer via eBIRForms. We prepare, they submit.
11. **Demo wallet:** Team controls the "client" device on stage — no dependency on judges having crypto wallets
12. **Invoice currency:** USD only for V1 — USDC is 1:1 with USD, no conversion needed. Multi-currency is post-hackathon.
13. **Payment address:** Unique HD wallet child address derived per invoice — freelancer's real wallet never exposed publicly
14. **Event detection:** `viem` `watchContractEvent` (WebSocket) as primary; 5s polling as fallback
15. **QR code:** Encodes `/pay/[invoiceId]` URL — not EIP-681. Any camera app opens the pay page cleanly.
16. **Morph chain:** Hard-coded to Hoodi testnet (chain `2910`). Pay page auto-prompts chain switch; Pay button blocked until correct chain is active.
17. **Wallet validation:** `isAddress()` on backend + regex on frontend. Confirmation step before OTP on payout method save.
18. **PHP earnings:** `amount_php` stored at settlement time using live FX rate at that moment. AI assistant queries stored value — not a live rate.
19. **Real-time toast:** Supabase Realtime subscribed to `invoices` table. Invoice status change pushes to frontend instantly.
20. **Fee narrative:** Near-zero on the transfer leg (Morph gas). On-ramp and off-ramp are freelancer's choice — same as choosing a bank. Do not claim zero fees end-to-end.

---

## 14. Appendix: Pitch One-Liner Variants

**For the hackathon submission form:**

> Raket is a cross-border payment platform for Filipino freelancers — get paid by global clients in seconds via Morph L2, with on-chain settlement, AI-powered invoicing, and BIR-ready tax summaries.

**For the 60-second pitch opener:**

> Over 1.5 million Filipinos freelance for global clients. Every one of them loses 4-7% to PayPal, waits days for Wise, and stitches together spreadsheets to file BIR taxes. Raket fixes all of that in one product — the payment account built for the way Filipinos actually earn today.

**For the elevator (10 seconds):**

> Raket — get paid for every gig, from anywhere in the world.

---

_This is a hackathon PRD. Optimize for shipping, not perfection. Lock scope, build the demo path, polish what judges will see. Cut anything that isn't on the demo flow._
