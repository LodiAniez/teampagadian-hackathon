/**
 * TEA-64 — deterministic demo seed (Maria Santos).
 *
 * Idempotent: clears the demo user's payouts → payments → user (in that order,
 * since payments/payouts are onDelete: Restrict and don't cascade from the user
 * delete), then re-creates everything. Run with `npm run db:seed -w @raket/api`.
 *
 * Deliberately NOT randomised (no Faker): the demo's value is in the *relations*
 * between numbers — Northwind is the top client, Q1 has enough paid invoices for
 * the tax story, US clients have current-quarter earnings — and only fixed data
 * guarantees those hold every run. See the plan doc on TEA-64.
 *
 * What the chat/dashboard actually read (verified against the services):
 *   - earnings  = SUM(payments.amount_php) bucketed by payments.paid_at
 *   - tax       = SETTLED payments only, by paid_at within the quarter
 *   - "this quarter"/"this year" resolve against today (≈2026-05-30) → Q2 2026
 * So every paid invoice gets a SETTLED Payment with a real paid_at, plus a
 * DELIVERED Payout. FX mirrors PaymentsService exactly.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const url = process.env.LOCAL_DATABASE_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

// Defaults to a standalone demo user. Set DEMO_USER_PHONE to your own login
// phone (exact format the JWT carries, e.g. "639383673347") to seed the demo
// data ONTO your account instead — the existing row is reused so its
// supabaseUserId stays linked and the mobile app shows this data when you log in.
const DEMO_PHONE = process.env.DEMO_USER_PHONE ?? "+639171234567";

// FX — same rule as PaymentsService: gross = received × rate, 1% fee, net = gross − fee.
const FX_FEE_PERCENT = 0.01;
const RATES: Record<string, number> = { USD: 55.5, EUR: 60.0, GBP: 70.5 };
const round2 = (n: number): number => Math.round(n * 100) / 100;

function fxFor(amount: number, currency: string) {
  const rate = RATES[currency];
  const grossPhp = amount * rate;
  const fxFeeAmount = round2(grossPhp * FX_FEE_PERCENT);
  const amountPhp = round2(grossPhp - fxFeeAmount);
  return { rate, fxFeeAmount, amountPhp };
}

function addDays(iso: string, days: number): Date {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// Stable client keys → details. country drives the "US clients" filter; currency
// drives FX. Tokyo/Lagos/Bondi bill in USD despite their country.
const CLIENTS = {
  northwind: {
    name: "Northwind Digital",
    email: "pay@northwind.io",
    country: "US",
    currency: "USD",
  },
  acme: { name: "Acme Corporation", email: "finance@acme.com", country: "US", currency: "USD" },
  hamburg: {
    name: "Hamburg Consulting GmbH",
    email: "rechnung@hamburg.de",
    country: "DE",
    currency: "EUR",
  },
  brighton: {
    name: "Brighton & Co",
    email: "finance@brighton.co.uk",
    country: "GB",
    currency: "GBP",
  },
  tokyo: {
    name: "Tokyo Studios",
    email: "billing@tokyostudios.jp",
    country: "JP",
    currency: "USD",
  },
  lagos: { name: "Lagos Tech", email: "pay@lagostech.ng", country: "NG", currency: "USD" },
  bondi: { name: "Bondi Creative", email: "accounts@bondi.au", country: "AU", currency: "USD" },
} as const;
type ClientKey = keyof typeof CLIENTS;

const DELIVERABLES = [
  "Brand guideline package",
  "Mobile app UI design",
  "Frontend development",
  "Landing page design",
  "Design system setup",
  "Logo & identity refresh",
  "Marketing website build",
  "UX audit & wireframes",
  "Webflow implementation",
  "Illustration set",
];

// Invoice specs in chronological order (becomes INV-2026-001..025). `issue` is the
// issue date; paid invoices settle `payDays` later. Amounts are in the client's
// currency. Tuned so: Northwind > Acme > Hamburg by net PHP; ≥5 paid in Q1
// (Jan–Mar); US clients (Northwind/Acme) have Q2 (Apr–May) payments; ~₱760K/2026.
type Spec = {
  client: ClientKey;
  status: "paid" | "sent" | "draft";
  amount: number;
  issue: string;
  payDays?: number;
};

const SPECS: Spec[] = [
  // ── Q1: January ──
  { client: "acme", status: "paid", amount: 620, issue: "2026-01-06", payDays: 7 },
  { client: "northwind", status: "paid", amount: 980, issue: "2026-01-12", payDays: 7 },
  { client: "hamburg", status: "paid", amount: 540, issue: "2026-01-20", payDays: 7 },
  { client: "tokyo", status: "paid", amount: 700, issue: "2026-01-27", payDays: 7 },
  // ── Q1: February ──
  { client: "northwind", status: "paid", amount: 1150, issue: "2026-02-04", payDays: 7 },
  { client: "brighton", status: "paid", amount: 480, issue: "2026-02-11", payDays: 7 },
  { client: "bondi", status: "paid", amount: 650, issue: "2026-02-18", payDays: 7 },
  { client: "acme", status: "paid", amount: 540, issue: "2026-02-24", payDays: 7 },
  // ── Q1: March ──
  { client: "northwind", status: "paid", amount: 880, issue: "2026-03-03", payDays: 7 },
  { client: "hamburg", status: "paid", amount: 620, issue: "2026-03-10", payDays: 7 },
  { client: "lagos", status: "paid", amount: 720, issue: "2026-03-18", payDays: 7 },
  { client: "brighton", status: "paid", amount: 510, issue: "2026-03-25", payDays: 7 },
  // ── Q2: April (current quarter) ──
  { client: "northwind", status: "paid", amount: 1250, issue: "2026-04-08", payDays: 7 },
  { client: "acme", status: "paid", amount: 820, issue: "2026-04-15", payDays: 7 },
  { client: "hamburg", status: "paid", amount: 560, issue: "2026-04-22", payDays: 7 },
  // ── Q2: May (current quarter + current month) ──
  { client: "northwind", status: "paid", amount: 1050, issue: "2026-05-05", payDays: 7 },
  { client: "tokyo", status: "paid", amount: 640, issue: "2026-05-09", payDays: 7 },
  { client: "acme", status: "paid", amount: 700, issue: "2026-05-14", payDays: 7 },
  // ── Sent (awaiting payment) ──
  { client: "northwind", status: "sent", amount: 1150, issue: "2026-05-18" },
  { client: "hamburg", status: "sent", amount: 620, issue: "2026-05-20" },
  { client: "brighton", status: "sent", amount: 540, issue: "2026-05-22" },
  { client: "bondi", status: "sent", amount: 780, issue: "2026-05-24" },
  // ── Draft ──
  { client: "acme", status: "draft", amount: 560, issue: "2026-05-26" },
  { client: "tokyo", status: "draft", amount: 690, issue: "2026-05-27" },
  { client: "lagos", status: "draft", amount: 620, issue: "2026-05-28" },
];

// 1–2 line items summing exactly to the invoice amount (qty 1, fixed-price
// deliverables). Two items on every third invoice for texture.
function lineItemsFor(amount: number, index: number) {
  const desc = (offset: number) => DELIVERABLES[(index + offset) % DELIVERABLES.length];
  if (index % 3 === 0) {
    const first = round2(amount * 0.6);
    const second = round2(amount - first);
    return [
      {
        description: desc(0),
        quantity: 1,
        unit: "project",
        rate: first,
        amount: first,
        position: 0,
      },
      {
        description: desc(3),
        quantity: 1,
        unit: "project",
        rate: second,
        amount: second,
        position: 1,
      },
    ];
  }
  return [
    { description: desc(0), quantity: 1, unit: "project", rate: amount, amount, position: 0 },
  ];
}

const pad = (n: number, width: number) => String(n).padStart(width, "0");

async function main(): Promise<void> {
  await prisma.$connect();

  // Idempotent reset. The user ROW is reused (upsert), never deleted, so an
  // adopted account keeps its supabaseUserId / auth link. Its data is cleared in
  // FK dependency order — payments/payouts use onDelete: Restrict and invoices
  // restrict their client, so nothing cascades from the user: payouts → payments
  // → invoices (line items cascade) → payout methods → clients.
  const existing = await prisma.user.findUnique({
    where: { phone: DEMO_PHONE },
    select: { id: true },
  });
  if (existing) {
    await prisma.payout.deleteMany({ where: { payment: { userId: existing.id } } });
    await prisma.payment.deleteMany({ where: { userId: existing.id } });
    await prisma.invoice.deleteMany({ where: { userId: existing.id } });
    await prisma.payoutMethod.deleteMany({ where: { userId: existing.id } });
    await prisma.client.deleteMany({ where: { userId: existing.id } });
  }

  const profile = {
    name: "Maria Santos",
    businessName: "Maria Santos Design Studio",
    defaultCurrency: "USD",
    defaultHourlyRate: { amount: 75, currency: "USD" },
    bir2303Election: "EIGHT_PERCENT",
  } as const;

  const user = await prisma.user.upsert({
    where: { phone: DEMO_PHONE },
    update: profile,
    create: { phone: DEMO_PHONE, ...profile },
  });

  // Namespace the globally-unique demo fields by user, so seeding a second demo
  // user (e.g. onto your own account via DEMO_USER_PHONE) can't collide with an
  // existing demo dataset's tokens / payment-intent ids / morph tx hashes.
  const uslug = user.id.slice(0, 8);
  const uhex = user.id.replace(/-/g, "").slice(0, 16);

  const payoutMethod = await prisma.payoutMethod.create({
    data: {
      userId: user.id,
      type: "CARD",
      details: {
        brand: "visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2027,
        stripePaymentMethodId: "pm_demo_seed",
      },
      isDefault: true,
    },
  });

  const clientIds = {} as Record<ClientKey, string>;
  for (const key of Object.keys(CLIENTS) as ClientKey[]) {
    const c = CLIENTS[key];
    const created = await prisma.client.create({
      data: {
        userId: user.id,
        name: c.name,
        email: c.email,
        country: c.country,
        defaultCurrency: c.currency,
      },
    });
    clientIds[key] = created.id;
  }

  let paid = 0;
  let totalNetPhp = 0;
  for (let i = 0; i < SPECS.length; i++) {
    const spec = SPECS[i];
    const seq = i + 1;
    const currency = CLIENTS[spec.client].currency;
    const number = `INV-2026-${pad(seq, 3)}`;
    const sent = spec.status !== "draft";

    const invoice = await prisma.invoice.create({
      data: {
        userId: user.id,
        clientId: clientIds[spec.client],
        number,
        status: spec.status,
        amount: spec.amount,
        currency,
        issueDate: addDays(spec.issue, 0),
        dueDate: addDays(spec.issue, 14),
        sourceType: "manual",
        sentAt: sent ? addDays(spec.issue, 1) : null,
        publicShareToken: sent ? `tok_demo_${uslug}_${seq}` : null,
        stripePaymentIntentId: spec.status === "paid" ? `pi_demo_inv_${uslug}_${seq}` : null,
        lineItems: { create: lineItemsFor(spec.amount, i) },
      },
    });

    if (spec.status !== "paid") continue;

    const paidAt = addDays(spec.issue, spec.payDays ?? 7);
    const { rate, fxFeeAmount, amountPhp } = fxFor(spec.amount, currency);
    totalNetPhp += amountPhp;
    paid += 1;

    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        userId: user.id,
        stripePaymentIntentId: `pi_demo_pay_${uslug}_${seq}`,
        stripeChargeId: `ch_demo_${uslug}_${seq}`,
        amountReceived: spec.amount,
        amountReceivedCurrency: currency,
        amountPhp,
        fxRate: rate,
        fxFeeAmount,
        fxFeePercent: FX_FEE_PERCENT,
        morphTxHash: `0x${uhex}${pad(seq, 64 - uhex.length)}`,
        morphTxStatus: "SETTLED",
        paidAt,
      },
    });

    await prisma.payout.create({
      data: {
        paymentId: payment.id,
        payoutMethodId: payoutMethod.id,
        amountPhp,
        status: "DELIVERED",
        externalTxnId: `coinsph_demo_${uslug}_${seq}`,
        completedAt: addDays(spec.issue, (spec.payDays ?? 7) + 1),
      },
    });
  }

  console.log("✅ Seed complete");
  console.log(`   user: Maria Santos  id=${user.id}`);
  console.log(`   invoices: ${SPECS.length} (paid=${paid})`);
  console.log(`   total net earnings: ₱${Math.round(totalNetPhp).toLocaleString("en-PH")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
