import type { QuotationMimeType } from "@raket/contracts";

export type InvoiceMode = "text" | "upload" | "manual";

export type UploadSelectedFile = {
  uri: string;
  name: string;
  size: number;
  mimeType: QuotationMimeType;
};

// One slot drives every status the upload panel can show. Kept as a discriminated
// union so the panel can branch on severity (pickError/serverError = red;
// emptyDraft = amber) without callers passing color flags.
export type UploadPanelMessage =
  | { kind: "pickError"; text: string }
  | { kind: "serverError"; text: string }
  | { kind: "emptyDraft"; text: string }
  | null;
