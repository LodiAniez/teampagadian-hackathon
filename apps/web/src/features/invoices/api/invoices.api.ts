// Thin re-exports for the invoices feature. Components import hooks; hooks import
// from here, which forwards to the typed ts-rest client. Keeps imports stable if
// we ever need to swap clients or add per-feature middleware.
export { api } from "@/lib/api-client";
