// Re-export the typed ts-rest client. Hooks in this feature import `api` from
// here so the import surface is stable if we ever swap clients or add
// per-feature middleware.
export { api } from "@/lib/api-client";
