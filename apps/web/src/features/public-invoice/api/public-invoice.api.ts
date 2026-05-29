// Thin re-export for the public-invoice feature. Mirrors features/invoices/api/invoices.api.ts.
// Components import hooks; hooks import from here, which forwards to the typed ts-rest client.
export { api } from "@/lib/api-client";
