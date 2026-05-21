# Raket — Architecture

Companion to [`prd.md`](./prd.md). Source of truth for the system layout: who talks to whom, where state lives, what is real vs mocked for the hackathon demo.

The diagrams below use Mermaid; they render natively on GitHub.

---

## 1. System Context

The outer view: human actors, the Raket platform as one box, and every external service it depends on. Mocked legs are marked.

**Important.** Morph is a passive USDC ledger. It does not route, convert, or hold USD. The NestJS hot wallet **signs** an ERC-20 `transfer` locally with `viem` and **broadcasts** it to Morph; Morph just validates the signature and includes the tx in a block.

```mermaid
flowchart LR
    classDef actor fill:#fef3c7,stroke:#92400e,color:#1f2937
    classDef raket fill:#dbeafe,stroke:#1e40af,color:#1e3a8a,stroke-width:2px
    classDef real fill:#dcfce7,stroke:#166534,color:#14532d
    classDef mock fill:#fee2e2,stroke:#991b1b,color:#7f1d1d,stroke-dasharray: 5 5

    Maria([Maria<br/>Freelancer]):::actor
    Client([Client<br/>Pays by card]):::actor

    subgraph Raket["Raket Platform"]
        Web[Next.js 15<br/>on Vercel]:::raket
        API[NestJS API<br/>on Railway<br/>holds hot wallet key]:::raket
        DB[(Supabase Postgres<br/>+ Realtime + Auth)]:::raket
    end

    Stripe[Stripe Checkout<br/>+ Webhooks<br/>USD only]:::real
    Morph[Morph L2 - chain 2910<br/>passive USDC ledger<br/>no Raket smart contract]:::real
    Claude[Anthropic Claude<br/>Sonnet 4.6 / Haiku 4.5]:::real
    Resend[Resend<br/>Transactional email]:::real
    FX[exchangerate.host<br/>USD to PHP]:::real
    Coins[Coins.ph + InstaPay<br/>USDC to PHP to GCash]:::mock
    GCash([Freelancer's GCash<br/>mobile money account]):::actor

    Maria -->|Create invoice, view dashboard| Web
    Client -->|Open /pay/invoiceId| Web
    Web <-->|HTTPS| API
    API <--> DB
    Web <-->|Realtime subscribe| DB

    Client -->|"Pay $X USD by card"| Stripe
    Stripe -->|"webhook: $X USD received"| API
    API -->|"Poll fallback (10s)"| Stripe

    API -->|"sign locally + broadcast<br/>USDC.transfer(coinsph, X)"| Morph
    API -->|"waitForTransactionReceipt"| Morph

    API -->|Messages API + tools + vision| Claude
    API -->|Send invoice email| Resend
    API -->|Fetch live rate at settlement| FX

    API -.->|Mocked animation only| Coins
    Coins -.->|Mocked InstaPay leg| GCash
```

**Legend.** Blue = Raket-owned. Green solid = real external integration. Red dashed = mocked for hackathon; real in production.

---

## 2. Mental Model: USD and USDC Are Parallel Pipes

A common misread of the diagram above: _"Stripe sends USD into Morph and the chain converts it to USDC."_ That's wrong, and worth calling out because it shapes how you reason about every other part of the system.

**No currency crosses the Stripe ↔ Morph boundary.** Raket runs two independent settlement pipes. The Stripe webhook is the trigger that ties them together — not a money transfer.

```mermaid
flowchart LR
    classDef usd fill:#dcfce7,stroke:#166534,color:#14532d
    classDef usdc fill:#dbeafe,stroke:#1e40af,color:#1e3a8a
    classDef php fill:#fee2e2,stroke:#991b1b,color:#7f1d1d,stroke-dasharray: 5 5
    classDef glue fill:#fef3c7,stroke:#92400e,color:#1f2937

    subgraph USD["USD pipe — off-chain, Stripe banking rails"]
        direction LR
        ClientCard[Client card<br/>$1,000]:::usd
        StripeBal[Raket's Stripe<br/>USD balance]:::usd
        RaketBank[Raket bank account<br/>USD float]:::usd
    end

    Webhook{{Stripe webhook<br/>NestJS:<br/>'we got paid $X USD'}}:::glue

    subgraph USDC["USDC pipe — on-chain, Morph L2"]
        direction LR
        HotWallet[Raket hot wallet<br/>USDC float<br/>~50,000 USDC pre-funded]:::usdc
        CoinsAddr[Coins.ph deposit<br/>address on Morph]:::usdc
    end

    subgraph PHP["PHP pipe — mocked for hackathon"]
        direction LR
        CoinsPhp[Coins.ph PHP<br/>balance]:::php
        GCashAcct[Freelancer's GCash<br/>mobile money]:::php
    end

    ClientCard -->|"card auth"| StripeBal
    StripeBal -->|"T+2 USD bank payout"| RaketBank
    RaketBank -.->|"operator refills<br/>USDC float off-platform"| HotWallet

    StripeBal -.->|"triggers"| Webhook
    Webhook -.->|"NestJS spends from<br/>USDC float independently"| HotWallet

    HotWallet -->|"viem ERC-20<br/>USDC.transfer"| CoinsAddr
    CoinsAddr -.->|"Coins.ph swaps<br/>USDC → PHP"| CoinsPhp
    CoinsPhp -.->|"InstaPay"| GCashAcct
```

**How to read this.**

- **USD pipe (green):** real, off-chain, slow. Stripe holds the client's USD; bank payouts to Raket land T+2.
- **USDC pipe (blue):** real, on-chain, fast (~2s). The hot wallet starts pre-funded; every paid invoice spends from this float.
- **PHP pipe (red, dashed):** mocked for the hackathon. In production, Coins.ph (BSP-licensed VASP) handles the USDC→PHP swap and InstaPay leg to GCash.
- **The webhook (amber):** the only thing that crosses pipes — as a _signal_, not as money. USD doesn't become USDC; NestJS independently spends USDC because the webhook told it Stripe got paid.

**Why this matters.** Raket is fronting USDC out of its own balance for every paid invoice. Stripe reimburses days later in USD; the operator turns that back into USDC off-platform. §13.13 of `prd.md` calls the hot wallet "scaffolding" for exactly this reason — at any real volume Raket would be the bank.

**Production swap-in.** Stripe Stablecoin Payments collapses both pipes: Stripe converts the client's USD → USDC internally and deposits USDC directly to Raket's settlement wallet on Morph. The hot-wallet refill loop disappears, and Raket no longer floats anything.

---

## 3. Component View

Inside the Raket boxes. Names line up with the modules in `apps/web/src/features/*` and `apps/api/src/modules/*`.

```mermaid
flowchart TB
    classDef web fill:#dbeafe,stroke:#1e40af,color:#1e3a8a
    classDef api fill:#e0e7ff,stroke:#3730a3,color:#312e81
    classDef store fill:#f3e8ff,stroke:#6b21a8,color:#581c87

    subgraph Frontend["Next.js 15 (apps/web)"]
        direction TB
        AuthUI[Auth feature<br/>phone OTP + auth-context]:::web
        InvoiceUI[Invoice feature<br/>create text/upload/manual]:::web
        DashUI[Dashboard feature<br/>earnings, FX compare, savings]:::web
        PayPage["/pay/invoiceId<br/>public client page"]:::web
        ChatUI[AI chat panel<br/>Vercel AI SDK streaming]:::web
        TaxUI[BIR ITR view<br/>1701Q/1701A PDF + CSV]:::web
        RealtimeSub[Supabase Realtime<br/>invoice status toast]:::web
    end

    subgraph Backend["NestJS API (apps/api)"]
        direction TB
        AuthMod[auth module<br/>phone OTP guard, /auth/me]:::api
        InvoiceMod[invoices module<br/>CRUD, line items]:::api
        AiParseMod[ai-parse module<br/>text + vision to invoice]:::api
        PaymentsMod[payments module<br/>Stripe intents + webhook + poll]:::api
        SettlementMod[settlement module<br/>viem hot wallet, FX snapshot]:::api
        PayoutsMod[payouts module<br/>Coins.ph + InstaPay mock]:::api
        ChatMod[chat module<br/>Claude tool-use loop]:::api
        TaxMod[tax module<br/>quarterly calc, PDF gen]:::api
        EmailMod[email module<br/>Resend send + templates]:::api
        ContractsPkg["@raket/contracts<br/>ts-rest + Zod"]:::api
    end

    subgraph Data["Data Layer"]
        Postgres[(Postgres)]:::store
        Realtime[(Supabase Realtime)]:::store
    end

    AuthUI --> AuthMod
    InvoiceUI --> InvoiceMod
    InvoiceUI --> AiParseMod
    PayPage --> PaymentsMod
    DashUI --> InvoiceMod
    DashUI --> TaxMod
    ChatUI --> ChatMod
    TaxUI --> TaxMod
    RealtimeSub <--> Realtime

    PaymentsMod --> SettlementMod
    SettlementMod --> PayoutsMod
    InvoiceMod --> EmailMod

    AuthMod & InvoiceMod & PaymentsMod & SettlementMod & PayoutsMod & TaxMod & ChatMod --> Postgres
    Postgres -. change feed .-> Realtime

    ContractsPkg -. wire types .- Frontend
    ContractsPkg -. wire types .- Backend
```

`@raket/contracts` is the wire spec. Both sides break at compile time when a contract changes — by design, per [`docs/api-contract-convention.md`](./api-contract-convention.md).

---

## 4. Payment & Settlement Sequence

The demo path end-to-end. This is the 4-minute on-stage run. Real legs are solid; mocked legs are dashed.

```mermaid
sequenceDiagram
    autonumber
    participant C as Client (browser)
    participant W as Next.js /pay page
    participant S as Stripe (USD)
    participant A as NestJS API<br/>(holds hot wallet key)
    participant DB as Postgres
    participant M as Morph L2<br/>(passive USDC ledger)
    participant FX as exchangerate.host
    participant CP as Coins.ph + InstaPay (mocked)
    participant F as Freelancer dashboard

    C->>W: Open /pay/invoiceId
    W->>A: GET invoice summary
    A->>DB: SELECT invoice + line_items
    A-->>W: invoice payload (USD, freelancer, items)
    W-->>C: Render summary + Pay Now

    C->>S: Pay Now (Stripe Checkout, card 4242...)
    S-->>C: 3DS / confirmation
    S-->>A: webhook payment_intent.succeeded<br/>"received $X USD into Raket Stripe balance"

    Note over A: If no webhook in 10s,<br/>poll Stripe API.
    A->>DB: UPDATE invoice status=PAID,<br/>INSERT payment(stripe_charge_id)

    A->>FX: GET USD→PHP rate
    FX-->>A: rate

    Note over A,M: NestJS signs the transaction locally with the<br/>hot wallet private key (viem). Morph is a passive<br/>ledger — it does not "release" or "route" funds.<br/>It validates the signature and includes the tx in a block.
    A->>M: broadcast signed tx:<br/>USDC.transfer(coinsph_addr, X)
    M-->>A: tx hash
    A->>M: waitForTransactionReceipt(hash)
    M-->>A: receipt (~2s, status=success)
    Note right of M: Hot wallet balance: -X USDC<br/>Coins.ph deposit addr:  +X USDC
    A->>DB: UPDATE payment SET<br/>morph_tx_hash, amount_php, fx_rate

    A-->>CP: (mocked) Coins.ph detects deposit →<br/>swaps USDC → PHP → InstaPay to GCash
    Note over CP: Animated UI only.<br/>Real Coins.ph integration is post-hackathon.

    DB-->>F: Supabase Realtime push (invoice updated)
    F-->>F: Toast: "₱83,685 delivered to GCash •••• 1234<br/>[view on Morph Explorer]"

    Note over S,A: Separately, T+2 later: Stripe pays the $X USD<br/>to Raket's bank account. Operator uses this USD to<br/>refill the hot wallet's USDC float off-platform.
```

**Why webhook + poll.** Webhooks are the primary signal; the 10s poll is the demo-killer mitigation from §9 of `prd.md` — if Stripe is slow, we still settle.

**Why `waitForTransactionReceipt`.** Morph finality is ~2s; awaiting the receipt synchronously means we only write `morph_tx_hash` to the DB after the chain has confirmed, so the toast we surface to the freelancer is never a lie.

**Why "Morph is passive" matters.** There is no Raket smart contract on Morph (`prd.md` §13.14). The chain is doing exactly one thing: executing an ERC-20 `transfer` whose authorization is the hot wallet's signature. All business logic — _should we send? how much? to whom?_ — lives in NestJS. Morph is the venue, not an actor.

---

## 5. Invoice Creation Flow

Three input modes, one form. Claude does the heavy lifting on the text and upload paths.

```mermaid
flowchart LR
    classDef ui fill:#dbeafe,stroke:#1e40af,color:#1e3a8a
    classDef ai fill:#fce7f3,stroke:#9d174d,color:#831843
    classDef store fill:#f3e8ff,stroke:#6b21a8,color:#581c87

    Start([+ New Invoice]):::ui
    Mode{Input mode}:::ui

    Text[Text:<br/>20hrs UI design for Acme...]:::ui
    Upload[Upload:<br/>quotation.pdf / .png]:::ui
    Manual[Manual form]:::ui

    ClaudeText[Claude Sonnet 4.6<br/>text → structured invoice]:::ai
    ClaudeVision[Claude Sonnet 4.6 vision<br/>document → line items]:::ai

    Review[Review form<br/>edit, set due date]:::ui
    Save[(invoices +<br/>invoice_line_items)]:::store
    Send[Send: copy link / QR / Resend email]:::ui

    Start --> Mode
    Mode -->|text| Text --> ClaudeText --> Review
    Mode -->|upload| Upload --> ClaudeVision --> Review
    Mode -->|manual| Manual --> Review
    Review --> Save --> Send
```

---

## 6. Data Model

From §7 of `prd.md`. One user owns clients, invoices, payout methods. Invoices fan out to line items, payments, payouts.

```mermaid
erDiagram
    users ||--o{ payout_methods : owns
    users ||--o{ clients : owns
    users ||--o{ invoices : issues
    clients ||--o{ invoices : billed_on
    invoices ||--|{ invoice_line_items : has
    invoices ||--o| payments : settled_by
    payments ||--o| payouts : delivered_via
    payout_methods ||--o{ payouts : routed_to

    users {
        uuid id PK
        string phone
        string name
        string business_name
        string default_currency
        timestamp created_at
    }
    payout_methods {
        uuid id PK
        uuid user_id FK
        string type "gcash"
        jsonb details "gcash_number"
        bool is_default
    }
    clients {
        uuid id PK
        uuid user_id FK
        string name
        string email
        string country
        string default_currency
    }
    invoices {
        uuid id PK
        uuid user_id FK
        uuid client_id FK
        string status "DRAFT|SENT|PAID|VOID"
        decimal amount
        string currency "USD"
        date issue_date
        date due_date
        string stripe_payment_intent_id
        string source_type "text|upload|manual"
        string source_file_url
    }
    invoice_line_items {
        uuid id PK
        uuid invoice_id FK
        string description
        decimal quantity
        string unit
        decimal rate
        decimal amount
    }
    payments {
        uuid id PK
        uuid invoice_id FK
        decimal amount_usd
        decimal amount_php
        decimal fx_rate_at_settlement
        string morph_tx_hash
        string stripe_charge_id
        timestamp paid_at
    }
    payouts {
        uuid id PK
        uuid payment_id FK
        uuid payout_method_id FK
        decimal amount_php
        string status "pending|processing|delivered"
        string external_txn_id
    }
```

**Source-of-truth notes.**

- `payments.amount_php` is **snapshotted at settlement time** using the FX rate fetched then. AI queries read this stored value; we never re-quote a live rate against historical payments.
- `payments.morph_tx_hash` is only written after `waitForTransactionReceipt` confirms — its presence is the truth that money moved on-chain.
- `payouts.status` advances `pending → processing → delivered`; the last two transitions are mocked for the demo.

---

## 7. What's Real vs Mocked

Pulled from §5 and §13 of `prd.md` — call this out explicitly so reviewers can see the seam between hackathon scaffolding and the production path.

| Capability              | Hackathon                                                                                                                               | Production path                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Client card payment     | **Real** Stripe test mode                                                                                                               | Stripe live mode                                                                                                                 |
| USD → USDC "conversion" | **Off-platform.** Hot wallet pre-funded with testnet USDC; NestJS spends from float when Stripe webhook fires. USD never touches Morph. | **Stripe Stablecoin Payments** — Stripe converts USD→USDC and deposits USDC directly to Raket's wallet on Morph. No Raket float. |
| Morph settlement        | **Real** — NestJS signs ERC-20 `transfer` with `viem`, broadcasts to Morph Hoodi testnet                                                | Real on Morph mainnet                                                                                                            |
| USDC → PHP off-ramp     | **Mocked** — animated UI sequence only                                                                                                  | Coins.ph API (BSP-licensed VASP)                                                                                                 |
| PHP → GCash delivery    | **Mocked**                                                                                                                              | InstaPay via Coins.ph                                                                                                            |
| Invoice email           | **Real** Resend                                                                                                                         | Real Resend                                                                                                                      |
| AI parsing + chat       | **Real** Claude (Sonnet 4.6 + Haiku 4.5)                                                                                                | Same                                                                                                                             |
| Phone OTP               | **Real** Supabase Auth, **mocked** SMS delivery (code shown on screen)                                                                  | Real SMS via Supabase/Twilio                                                                                                     |
| BIR ITR                 | **Prepared** (PDF + CSV) — freelancer files via eBIRForms                                                                               | Same. Filing stays with freelancer until CAS accreditation.                                                                      |

The hot-wallet float is the single biggest hackathon-only piece. Decision 13 in `prd.md` is the rationale: every paid invoice draws USDC from Raket's balance, Stripe reimburses days later in USD — at any real volume Raket would be the bank. Stripe Stablecoin Payments collapses that bridge into Stripe's existing rails post-hackathon.

---

## 8. Deployment Topology

```mermaid
flowchart LR
    classDef vendor fill:#f1f5f9,stroke:#475569,color:#0f172a

    subgraph Vercel["Vercel"]
        WebDeploy[Next.js web]:::vendor
    end
    subgraph Railway["Railway"]
        ApiDeploy[NestJS api]:::vendor
        HotWallet[(Hot wallet private key<br/>env var only)]:::vendor
    end
    subgraph Supabase["Supabase"]
        Pg[(Postgres)]:::vendor
        SbAuth[Auth - phone OTP]:::vendor
        SbRt[Realtime]:::vendor
    end
    subgraph Chain["Morph Hoodi Testnet"]
        Rpc[RPC: rpc-hoodi.morph.network<br/>chain 2910]:::vendor
        Usdc["USDC ERC20<br/>0x1178...a227"]:::vendor
    end
    subgraph SaaS["Third-party"]
        StripeS[Stripe test mode]:::vendor
        ClaudeS[Anthropic API]:::vendor
        ResendS[Resend]:::vendor
        FxS[exchangerate.host]:::vendor
    end

    WebDeploy <--> ApiDeploy
    ApiDeploy <--> Pg
    ApiDeploy <--> SbAuth
    WebDeploy <--> SbRt
    ApiDeploy --> Rpc
    Rpc --> Usdc
    ApiDeploy --> StripeS
    ApiDeploy --> ClaudeS
    ApiDeploy --> ResendS
    ApiDeploy --> FxS
    HotWallet -. signs txns .-> Rpc
```

**Security note (from §13.22).** `MORPH_HOT_WALLET_PRIVATE_KEY` lives in Railway env vars only — never in source, never in `.env.example`. NestJS does a balance check on startup and warns below 500 testnet USDC.

---

## 9. Cross-References

- Product context: [`prd.md`](./prd.md)
- API contracts (the wire): [`api-contract-convention.md`](./api-contract-convention.md)
- API service layout: [`api-convention.md`](./api-convention.md)
- Frontend feature layout: [`web-convention.md`](./web-convention.md)
- Local dev setup: [`ONBOARDING.md`](./ONBOARDING.md)
