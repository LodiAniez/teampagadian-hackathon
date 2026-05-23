import { initContract } from "@ts-rest/core";
import { authContract } from "./auth/auth.contract";
import { invoicesContract } from "./invoices/invoices.contract";

const c = initContract();

export const contract = c.router(
  {
    auth: authContract,
    invoices: invoicesContract,
  },
  { pathPrefix: "/api/v1" },
);

export type Contract = typeof contract;

export * from "./shared/error";
export * from "./shared/pagination";
export * from "./shared/money";
export * from "./auth/auth.schema";
export * from "./clients/clients.schema";
export * from "./invoices/invoices.schema";
export * from "./payout-methods/payout-methods.schema";
