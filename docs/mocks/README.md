# Raket — Demo mocks

Mobile-app UI mockups for the pitch. Each HTML file opens directly in a browser (no server needed) and renders the screen inside an iPhone 14-shaped frame. The **Demo flow** dropdown at the top-right of every page jumps you between screens.

## Setup

```bash
open docs/mocks/index.html
```

That's it. Everything is static HTML + CSS + a tiny shared JS. Tailwind is not used in these mocks — `shared.css` carries the design tokens.

Dependencies pulled from CDN (need internet on demo machine):

- Inter & JetBrains Mono via Google Fonts
- Lucide icons via unpkg (used sparingly)
- QR codes via `api.qrserver.com`

## File map

## Important: app vs browser

**Raket is a freelancer-only app.** Clients never install it, never sign up, never see crypto. They receive an email, tap a link, and pay in their phone's browser. The mocks reflect this split:

| Screen                                                                                                                                  | Who sees it        | Where                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `login.html`, `dashboard.html`, `invoice-create.html`, `invoice-sent.html`, `settlement-animation.html`, `ai-chat.html`, `bir-tax.html` | Freelancer (Maria) | Raket app                                                                                                       |
| `email.html`                                                                                                                            | Client (Acme)      | Their email app                                                                                                 |
| `pay.html`, `stripe-checkout.html`                                                                                                      | Client (Acme)      | **Their mobile browser** — rendered with mobile Safari-style URL bar + bottom toolbar to make this unmistakable |

## File map

| #   | File                        | Surface     | What it is                                                                                                    |
| --- | --------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| ·   | `index.html`                | —           | Cover / navigation hub. Lists every screen.                                                                   |
| 01  | `login.html`                | App         | Phone + OTP. PH +63 prefix, six-digit code, demo code `123456`.                                               |
| 02  | `dashboard.html`            | App         | Earnings hero, savings chip, 6-month chart, recent invoices, FX comparison. Gold FAB triggers the wow moment. |
| 03  | `invoice-create.html`       | App         | Text / Upload / Manual input modes. Claude-parsed preview + editable form.                                    |
| 04  | `invoice-sent.html`         | App         | Success state. Copy link / Show QR / View email.                                                              |
| 05  | `email.html`                | Email app   | The HTML email Acme receives. Tapping Pay Now opens their browser.                                            |
| 06  | `pay.html`                  | **Browser** | The `/pay/[id]` page at `raket.gg/pay/1042`. Browser chrome visible — client never installs Raket.            |
| 07  | `stripe-checkout.html`      | **Browser** | Hosted Stripe Checkout at `checkout.stripe.com`. Test card `4242 4242 4242 4242` pre-filled.                  |
| 08  | `settlement-animation.html` | App         | The wow moment — POV switches to Maria's device. Six steps light up over ~5s. Tap **↻ Restart** to replay.    |
| 09  | `dashboard.html?paid=1`     | App         | Dashboard moments after settlement. Toast already showing, FAB hidden.                                        |
| 10  | `ai-chat.html`              | App         | "Ask your books" — three example exchanges already rendered.                                                  |
| 11  | `bir-tax.html`              | App         | Quarterly breakdown, pre-filled 1701Q PDF, eBIRForms handoff.                                                 |

## Suggested demo order

```
index → login → dashboard → invoice-create → invoice-sent → email →
pay → stripe-checkout → settlement-animation → dashboard?paid=1 →
ai-chat → bir-tax
```

The CTAs inside each screen already wire to the next step — no need to use the Demo flow dropdown unless you're jumping out of order.

## Files

```
docs/mocks/
├── README.md                    ← this file
├── shared.css                   ← design tokens, phone frame, components
├── demo-nav.js                  ← auto-fills the "Demo flow" dropdown
├── index.html
├── login.html
├── dashboard.html
├── invoice-create.html
├── invoice-sent.html
├── pay.html
├── stripe-checkout.html
├── settlement-animation.html
├── email.html
├── bir-tax.html
└── ai-chat.html
```

## Notes for the demo

- **`settlement-animation.html` runs on a timer.** It starts as soon as the page loads. The ↻ Restart button in the top-right of the phone replays it. Plan ~6 seconds for the full sequence; the toast appears at the end.
- **`dashboard.html?paid=1` is the "after" state.** Use it to land on the dashboard with the success toast already visible. Without the `?paid=1` query, the gold "Demo: simulate payment" FAB shows instead.
- **The email mock is real, paste-able HTML.** Open `email.html`, view source on the `<table>` inside the phone — that markup is the actual email body Resend would deliver. Tested for Gmail / Outlook / Apple Mail layout.
- **Test card.** Stripe's `4242 4242 4242 4242` (exp 12/30, CVC 123, ZIP 90210) is pre-filled in `stripe-checkout.html`. Real Stripe accepts this in test mode.
- **Realistic data.** Maria Santos · Acme Northwind · $1,600 UI design invoice · ₱83,685 PHP payout · GCash •••• 1234 · Morph tx `0xa8c2...3f9d`. All values trace back to `prd.md`.
