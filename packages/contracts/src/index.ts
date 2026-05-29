import { initContract } from "@ts-rest/core";
import { authContract } from "./auth/auth.contract";
import { dashboardContract } from "./dashboard/dashboard.contract";
import { invoicesContract } from "./invoices/invoices.contract";
import { payoutMethodsContract } from "./payout-methods/payout-methods.contract";
import { publicInvoicesContract } from "./public-invoices/public-invoices.contract";
import { taxContract } from "./tax/tax.contract";

const c = initContract();

export const contract = c.router(
  {
    auth: authContract,
    invoices: invoicesContract,
    payoutMethods: payoutMethodsContract,
    publicInvoices: publicInvoicesContract,
    dashboard: dashboardContract,
    tax: taxContract,
  },
  { pathPrefix: "/api/v1" },
);

export type Contract = typeof contract;

export * from "./shared/error";
export * from "./shared/pagination";
export * from "./shared/money";
export * from "./auth/auth.schema";
export * from "./clients/clients.schema";
export * from "./dashboard/dashboard.schema";
export * from "./invoices/invoices.schema";
export * from "./payout-methods/payout-methods.schema";
export * from "./public-invoices/public-invoices.schema";
export * from "./tax/tax.schema";
