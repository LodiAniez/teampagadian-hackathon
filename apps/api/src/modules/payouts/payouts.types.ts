import { PayoutMethodType } from "@prisma/client";

const PREFIX: Record<PayoutMethodType, string> = {
  CARD: "CARD-PAYOUT",
  GCASH: "GC",
  MAYA: "MY",
  BANK_ACCOUNT: "BNK",
};

export function generateMockTxnId(type: PayoutMethodType): string {
  const random = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${PREFIX[type]}-${Date.now()}-${random}`;
}

// TODO post-hackathon — replace mock with real disbursement per payout method type:
// - GCASH:        PayMongo Disbursements API or direct GCash Business API
// - MAYA:         Maya Business Disbursements API
// - BANK_ACCOUNT: PESONet / InstaPay via partner bank API or Brankas
// - CARD:         Stripe Payouts (Connect) to debit card destination
