# Raket — Product Requirements Document

**Status:** Hackathon build (48 hours)
**Owner:** [Team lead]
**Version:** 1.0 — Draft for team alignment
**Last updated:** May 16, 2026

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

There is no payment product built *specifically* for the Filipino freelancer earning globally. Wise is generic. PayPal is hostile. Local fintech (GCash, Maya) is domestic-only. We can win the wedge by being the focused operating system for this user: invoice → get paid → track → file taxes, all in one product, with the FX transparency and Philippines-native UX nobody else offers.

### Why Now

- BSP has modernized payment rails (InstaPay, QR Ph, real-time settlement)
- Stripe and similar acquirers now serve Asia better than 2 years ago
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

- Full end-to-end flow works live: create invoice → send → receive payment → see PHP land → ask AI a question
- Single live demo run completes in under 4 minutes
- At least one "wow moment" judges remember (target: the FX comparison or the QR-scan-on-stage)
- No visible errors during the demo run
- Pitch lands the differentiation clearly: judges can repeat *why* we're different after seeing it

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
- Add a payout destination (card via Stripe for hackathon; architecture extends to GCash/Maya/bank)
- Naming: "Payout method" in UI (not "card") — future-proofs the concept
- OTP verification when adding or changing a payout method (high-risk action)

**Invoice Creation**
Three input modes, all routing to the same review form:
1. **Plain text input** — freelancer types a sentence, Claude parses to structured invoice
2. **Quotation upload** — freelancer uploads existing PDF/image quote, Claude vision extracts line items
3. **Manual form** — fallback for direct entry

**Invoice Sending**
- Copy payment link (Stripe-hosted checkout URL)
- Display QR code (scannable, opens checkout on phone)
- Send email to client via Resend (includes link, QR, and inline invoice summary)

**Client Payment Experience**
- Stripe-hosted checkout page (mobile-optimized)
- Pay in client's currency (USD / EUR / GBP for hackathon)
- Transparent FX rate displayed before payment

**Settlement & Payout**
- Stripe webhook triggers on `payment_intent.succeeded`
- FX conversion using mid-market rate + 1% flat fee
- Mocked payout to freelancer's payout method (animated toast + transaction ID)
- Real-time status update on freelancer's dashboard

**Freelancer Dashboard**
- Total earnings, this month, pending invoices, savings-vs-PayPal counter
- Earnings chart by month, by client, by country
- Invoice list with status filters
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
- Quotation workflow (create quote → send → approve → convert) — we only support quotation *upload* as input
- Mobile native app (responsive web only)
- Settings / preferences pages beyond payout method
- Multi-language support (English only)
- Multiple payout methods per user (one is enough for demo)
- Real OTP SMS delivery (mocked — code shown on screen)
- USDC / stablecoin rails (future consideration)
- AP / vendor payment features (we are receive-only)
- Error states beyond the demo happy path

---

## 6. Key User Flows

### Flow 1: First-time freelancer onboarding (90 seconds)

1. Land on marketing page → click "Sign up"
2. Enter phone number → receive OTP (mocked) → enter code
3. Complete profile: name, business name, default currency (auto-filled USD)
4. Prompt: "Add a payout method to start receiving payments"
5. Add card via Stripe Elements → verify with OTP → success
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
2. Clicks button (or scans QR on phone)
3. Stripe-hosted checkout opens, shows amount in USD with FX preview ("Maria receives ₱X")
4. Enters card details → pays
5. Sees success page
6. (On freelancer's dashboard: real-time toast: "₱83,685 received from Northwind Digital, sent to your card •••• 4242")

### Flow 4: Freelancer asks AI assistant (30 seconds)

1. Click chat panel on dashboard
2. Click prompt chip: "How much did I earn from US clients this quarter?"
3. AI responds in 2-3 seconds: "You earned ₱287,450 from 5 invoices to US clients this quarter — that's about 59% of your total income."
4. Click "Tax estimate" chip
5. AI responds: "Based on your Q1 earnings of ₱487K, you owe roughly ₱39K in income tax (8% election). Due May 15. Set this aside before spending."

---

## 7. Technical Architecture

### Stack

| Layer | Tech | Why |
|---|---|---|
| Frontend | Next.js 15 (App Router) | Team strength, fast iteration, Vercel deploy |
| Backend | NestJS | Team strength, structured for handing off post-hackathon |
| Database | Postgres (Supabase) | Free tier, auth + realtime included |
| Auth | Supabase Auth (phone OTP) | Saves 3-4 hours vs custom |
| Payments | Stripe (test mode) | Best DX, hosted checkout, multi-currency |
| AI | Anthropic Claude API (Sonnet 4.6 + Haiku 4.5) | Tool-use first-class, TypeScript SDK |
| AI SDK | Vercel AI SDK | Streaming UI hooks, free, fast integration |
| Email | Resend | Free tier, simple API |
| QR Generation | `qrcode` npm package | Trivial, server-side |
| Hosting | Vercel (FE) + Railway (BE) | Both have free tiers, fast deploys |

### Data Model (Core Tables)

```
users (id, phone, name, business_name, default_currency, created_at)
payout_methods (id, user_id, type, details JSONB, is_default, created_at)
clients (id, user_id, name, email, country, default_currency, created_at)
invoices (id, user_id, client_id, status, amount, currency, issue_date, due_date,
          stripe_payment_intent_id, source_type, source_file_url, created_at)
invoice_line_items (id, invoice_id, description, quantity, unit, rate, amount)
payments (id, invoice_id, amount_usd, amount_php, fx_rate, fx_fee, paid_at)
payouts (id, payment_id, payout_method_id, amount_php, status, external_txn_id)
```

### External Integrations

- **Stripe:** Payment Intents, Webhooks, Payouts (mocked)
- **Claude API:** Messages API with tools, vision for quotation parsing
- **Resend:** Transactional email
- **Exchange rate API:** exchangerate.host (free) for mid-market FX rate

---

## 8. Differentiation (What Wins the Pitch)

| Feature | Raket | PayPal | Wise | Payoneer |
|---|---|---|---|---|
| Settlement to PH | Minutes | 3-5 days | 1-3 days | 1-2 days |
| FX transparency | Mid-market + 1% | ~4% hidden | ✅ | ⚠️ Partial |
| AI invoice creation | ✅ | ❌ | ❌ | ❌ |
| Quotation upload + AI extract | ✅ | ❌ | ❌ | ❌ |
| Conversational earnings assistant | ✅ | ❌ | ❌ | ❌ |
| BIR-ready tax summaries | ✅ | ❌ | ❌ | ❌ |
| Built for Filipino freelancers | ✅ | ❌ | ❌ | ⚠️ Generic |

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Stripe webhook fails during live demo | Demo-killing | Use Stripe CLI to test, have backup video, polling fallback |
| AI returns wrong/weird output on stage | Credibility loss | Pre-script demo prompts, seed data deliberately, test 10+ times |
| BIR tax numbers are wrong | Credibility loss with PH judges | Verify rates against BIR.gov.ph the week of hackathon |
| Quotation upload fails on judge's random PDF | Demo-killing | Don't let judges upload — use pre-tested sample PDFs |
| WiFi fails on stage | Demo-killing | Record backup demo video by hour 40 |
| Mocked payout looks fake | Pitch weakness | Be honest in pitch: "PHP payout is mocked, here's our integration path" |
| Scope creep | Schedule slip | Lock V1 scope at hour 4, anything new goes to stretch list |

---

## 10. Timeline (48 Hours)

| Phase | Hours | Output |
|---|---|---|
| Setup & Foundation | 0-4 | Repos, deploys, auth keys, demo script locked |
| Core data + auth | 4-10 | Schema, seeded data, login flow working |
| Invoice creation flow | 10-18 | Three input modes + form + AI parsing |
| Payment flow | 14-24 | Stripe checkout, webhook, mock payout |
| Dashboard | 18-28 | Earnings views, FX comparison component |
| AI chat assistant | 26-36 | Tool-use loop, chat UI, prompt chips |
| BIR ITR generation | 30-38 | Quarterly breakdown, pre-filled 1701Q PDF, AI narrative |
| Polish & QA | 36-44 | Demo run-throughs, bug fixes, animations |
| Pitch & submission | 40-48 | Deck, rehearsal, backup video, submit |

*Phases overlap by design — frontend and backend leads work in parallel.*

---

## 11. Team & Responsibilities

| Person | Primary Owner Of |
|---|---|
| Person A (Frontend lead) | Auth UI, invoice forms, dashboard, FX comparison, chat UI |
| Person B (Backend lead) | DB schema, API, Stripe integration, webhook handler, tax logic |
| Person C (AI + integrations) | Claude prompts, tool-use loop, quotation parsing, AI narrative |
| Person D (Design + pitch + QA) | Branding, demo data, polish, pitch deck, demo rehearsals |

If team is 3: drop Person D, distribute their work, but assign one explicit demo/pitch owner.

---

## 12. Open Questions

- [ ] Confirm hackathon submission requirements (video length, repo public/private, etc.)
- [ ] Which judge panel? Sponsors? Affects pitch tuning.
- [ ] Verify current BIR rates (8% income tax option, percentage tax, deadlines for Q1/Q2 2026)
- [ ] Decide demo persona name and final brand details before hour 6
- [ ] Confirm whether sponsor APIs (e.g., GCash, Maya) are available to integrate as bonus points

---

## 13. Decisions Locked (Post-Discussion)

1. **Name:** Raket — Filipino slang for "gig/side hustle," instantly resonant with target user
2. **Auth:** Phone + OTP, passwordless (no email/password)
3. **Payout terminology:** "Payout method" not "card" — future-proofs for GCash/Maya/bank
4. **OTP placement:** On payout method add/change only, NOT on every invoice send
5. **Quotation handling:** Upload-as-input only, NOT a separate quotation workflow
6. **QR code:** Generated for every invoice, embedded in dashboard + email + PDF
7. **PHP payout:** Mocked for hackathon, integration path documented for pitch
8. **AI model:** Claude Sonnet 4.6 for invoice generation + chat assistant; Haiku 4.5 for lightweight tasks
9. **Demo flow:** Type-to-invoice → send → judge pays (with QR on stage) → money lands → ask AI
10. **BIR scope:** Generate pre-filled ITR (1701Q / 1701A) PDFs ready to file — filing itself stays with the freelancer via eBIRForms. We prepare, they submit.

---

## 14. Appendix: Pitch One-Liner Variants

**For the hackathon submission form:**
> Raket is a cross-border payment platform for Filipino freelancers — get paid by global clients in minutes, not days, with transparent FX, AI-powered invoicing, and BIR-ready tax summaries.

**For the 60-second pitch opener:**
> Over 1.5 million Filipinos freelance for global clients. Every one of them loses 4-7% to PayPal, waits days for Wise, and stitches together spreadsheets to file BIR taxes. Raket fixes all of that in one product — the payment account built for the way Filipinos actually earn today.

**For the elevator (10 seconds):**
> Raket — get paid for every gig, from anywhere in the world.

---

*This is a hackathon PRD. Optimize for shipping, not perfection. Lock scope, build the demo path, polish what judges will see. Cut anything that isn't on the demo flow.*
