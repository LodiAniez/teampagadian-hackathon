export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";

export type EarningsSummary = {
  totalEarnedPhp: number;
  totalEarnedAllTimePhp: number;
  thisMonthPhp: number;
  pendingInvoicesPhp: number;
  pendingInvoicesCount: number;
  invoiceCountThisMonth: number;
  savingsVsPaypalPhp: number;
};

export type EarningsByMonth = {
  month: string; // YYYY-MM
  amountPhp: number;
  invoiceCount: number;
};

export type EarningsByClient = {
  clientId: string;
  clientName: string;
  country: string | null;
  totalPhp: number;
  invoiceCount: number;
  lastPaidAt: string | null; // ISO-8601 UTC
};

export type EarningsByCountry = {
  country: string;
  totalPhp: number;
  clientCount: number;
};

export type InvoiceListItem = {
  id: string;
  number: string;
  status: InvoiceStatus;
  clientName: string;
  amount: number;
  currency: string; // ISO-4217
  amountPhp: number | null; // null if not paid
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  paidAt: string | null; // ISO-8601 UTC
};
