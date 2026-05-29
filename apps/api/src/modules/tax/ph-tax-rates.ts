/**
 * Philippine BIR tax rates and constants for self-employed individuals.
 *
 * Verified by: Code Implementor (TEA-58)
 * Verified date: 2026-05-29
 *
 * Sources cited inline per constant. Primary legal authority: the underlying
 * Republic Acts (TRAIN, CREATE) hosted on LawPhil — bir.gov.ph itself is a
 * JS-rendered SPA that WebFetch cannot extract content from, so the statutes
 * themselves stood in for the BIR's secondary explanatory pages.
 *
 * Legal basis:
 *   - TRAIN Law (RA 10963)  — graduated brackets (Phase 2, 2023+), 8% election,
 *                             VAT rate (NIRC §106), VAT threshold (NIRC §109(BB)).
 *   - CREATE Law (RA 11534) — temporary percentage-tax cut (3% → 1%) effective
 *                             July 1 2020 → June 30 2023; reverts to 3% thereafter.
 *
 * Any change here MUST also update ph-tax-rates.spec.ts in the same commit;
 * the spec lock-asserts every literal so silent drift is impossible.
 */

export const PH_TAX_RATES = {
  EIGHT_PERCENT: {
    // Source: https://lawphil.net/statutes/repacts/ra2017/ra_10963_2017.html
    //   (RA 10963 §5, amending NIRC §24(A)(2)(b):
    //    "an eight percent (8%) tax on gross sales or gross receipts and other
    //    non-operating income in excess of Two hundred fifty thousand pesos
    //    (₱250,000) ... provided gross sales/receipts do not exceed the VAT
    //    threshold under Section 109(BB)") — verified 2026-05-29
    rate: 0.08,
    annualExemption: 250_000,
    grossReceiptsThreshold: 3_000_000,
  },

  // Source: https://lawphil.net/statutes/repacts/ra2017/ra_10963_2017.html
  //   (RA 10963 §5, amending NIRC §24(A)(2)(a) — Phase 2 schedule effective
  //    January 1, 2023 onwards) — verified 2026-05-29
  // Cross-checked: https://www.taxumo.com/blog/bir-tax-table-2026/ — verified 2026-05-29
  GRADUATED_BRACKETS: [
    { upTo: 250_000, rate: 0.0, baseAmount: 0 },
    { upTo: 400_000, rate: 0.15, baseAmount: 0 },
    { upTo: 800_000, rate: 0.2, baseAmount: 22_500 },
    { upTo: 2_000_000, rate: 0.25, baseAmount: 102_500 },
    { upTo: 8_000_000, rate: 0.3, baseAmount: 402_500 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.35, baseAmount: 2_202_500 },
  ],

  PERCENTAGE_TAX: {
    // Source: https://lawphil.net/statutes/repacts/ra2021/ra_11534_2021.html
    //   (RA 11534 §13, amending NIRC §116: "the rates shall be one percent (1%)"
    //    "effective July 1, 2020 until June 30, 2023" — after that window the
    //    statutory 3% rate resumes by operation of law) — verified 2026-05-29
    rate: 0.03,
    appliesTo: "non-VAT registered, not under 8% election",
  },

  VAT: {
    // Source: https://lawphil.net/statutes/repacts/ra2017/ra_10963_2017.html
    //   (RA 10963 amending NIRC §106: "a value-added tax equivalent to twelve
    //    percent (12%) of the gross selling price"; NIRC §109(BB) sets the
    //    ₱3,000,000 gross-sales VAT-exemption threshold) — verified 2026-05-29
    rate: 0.12,
    annualThreshold: 3_000_000,
  },

  DEADLINES: {
    // Source: https://www.taxumo.com/blog/bir-tax-calendar-2026/ — verified 2026-05-29
    //   (BIR's own tax-calendar page on bir.gov.ph was not extractable via
    //   WebFetch; the secondary source cites the BIR 2026 Tax Calendar verbatim.
    //   Statutory backing: NIRC §74 quarterly declarations, §51 annual return.)
    //
    // NOTE: 2026-08-15 (Q2) is a Saturday and 2026-11-15 (Q3) is a Sunday.
    // BIR historically issues a Revenue Memorandum Circular shifting weekend
    // due dates to the next working day; the published 2026 Tax Calendar still
    // lists the statutory dates. Downstream code that surfaces these to users
    // should re-check closer to filing season and apply any weekend shift.
    "1701Q_Q1": "2026-05-15",
    "1701Q_Q2": "2026-08-15",
    "1701Q_Q3": "2026-11-15",
    // Annual return for tax year 2026 is filed by April 15, 2027 (NIRC §51(C)(1)).
    "1701_ANNUAL_TY2026": "2027-04-15",
  },
} as const;

export type PhTaxRates = typeof PH_TAX_RATES;
