# The Problem Raket Solves

## Who We're Building For

Over 1.5 million Filipinos freelance for international clients — developers, designers, writers, and video editors earning in USD from the US, Europe, and Australia. For most of them, getting paid is the hardest part of the job.

---

## The Problem

### 1. Getting paid internationally is slow and expensive

Filipino freelancers earning globally have no good option:

| Method    | Fee            | Settlement | Pain Point                       |
| --------- | -------------- | ---------- | -------------------------------- |
| PayPal    | 4–7% all-in    | 3–5 days   | Fund holds, opaque FX, high fees |
| Wise      | ~1–2%          | 1–3 days   | Slow KYC, not built for PH       |
| Payoneer  | ~2–3%          | 1–2 days   | Hidden FX spread, dated UX       |
| Bank wire | ₱500+ flat fee | 3–5 days   | Worst FX, most expensive         |

On a $1,600 invoice, PayPal costs ~$96 in fees. Even Wise — the cheapest alternative at ~$32 — still takes 1–3 days and offers none of the invoicing or tax tooling Filipino freelancers need. Speed, transparency, and built-for-PH tooling is what's missing — not just lower fees.

### 2. The pipes are old

The delay isn't PayPal or Wise being slow — it's the infrastructure underneath them. Every cross-border transfer routes through SWIFT and correspondent banks — a system built in the 1970s that processes in batches, not in real-time. Every hop adds a day.

### 3. No tooling built for Filipino freelancers

Beyond payments, Filipino freelancers are stuck with:

- Manual invoicing in Excel or Google Docs
- No visibility into earnings across clients and currencies
- No help with BIR tax filing — a quarterly obligation most freelancers dread

---

## How Raket Solves It

### Instant cross-border settlement via Morph

Raket replaces the old pipes with **Morph** — an Ethereum L2 with ~2 second finality and near-zero fees. When a client pays by card via Stripe, Raket settles the equivalent USDC across the Morph network. From there, the PHP leg routes through Coins.ph and InstaPay to the freelancer's GCash.

No SWIFT. No correspondent banks. No batch clearing cycles.

```
Client pays by card (USD)
        ↓
Stripe collects payment
        ↓
Raket settles USDC via Morph (~2 seconds)
        ↓
Coins.ph converts USDC → PHP  [mocked for demo]
        ↓
PHP delivered to freelancer's GCash  [mocked for demo]
```

Every transaction produces a public, verifiable on-chain receipt on the Morph Explorer — something no PayPal, Wise, or Payoneer can offer.

### AI-powered invoicing

Freelancers type a sentence — _"20 hours of UI design for Northwind at $80/hr"_ — and Raket generates a complete invoice instantly using Claude. No templates, no manual entry.

### BIR-ready tax summaries

Raket computes quarterly income breakdowns and generates pre-filled 1701Q and 1701A PDF forms ready to submit via eBIRForms. Freelancers prepare their ITR in minutes instead of days.

---

## Why Now

- **Morph L2** makes crypto settlement practical for everyday payouts — 2s finality, near-zero gas fees
- **BSP** has modernized Philippine payment rails (InstaPay, QR Ph) — real-time domestic delivery is now possible
- **Claude API** makes AI invoicing and conversational financial tools buildable by a small team
- The Filipino freelance economy is growing 20%+ year-over-year with no focused payment product serving it

---

## Track

**Cross-Border Remittance** — replacing SWIFT with Morph for Filipino freelancers earning globally, settling in seconds, receiving in GCash.
