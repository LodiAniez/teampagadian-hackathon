import type { QuotationMimeType } from "@raket/contracts";

export type RnFile = {
  uri: string;
  name: string;
  mimeType: QuotationMimeType;
};

// React Native's FormData accepts file objects { uri, name, type }, but
// TypeScript's lib.dom typings only allow Blob | string. To call append with
// a file object we narrow through a local view of FormData that adds the RN
// overload — narrower than `as` casts, isolated to this helper module, and
// doesn't pollute the global FormData type (which would confuse other call
// sites that pass FormData as a fetch body).
type RnFormData = FormData & {
  append(name: string, value: { uri: string; name: string; type: string }): void;
};

export function appendFile(form: FormData, fieldName: string, file: RnFile): void {
  const rnForm: RnFormData = form;
  rnForm.append(fieldName, { uri: file.uri, name: file.name, type: file.mimeType });
}

export type MultipartResponse = {
  status: number;
  /** Parsed JSON, or null when the body wasn't JSON-parseable. */
  body: unknown;
};

// XMLHttpRequest is the RN-canonical way to upload FormData. We don't use
// fetch here because RN's fetch type definitions reject FormData as a body
// (lib.dom's FormData ≠ RN's BodyInit_, compounded by undici-types leaking
// in via @types/node) — every type-safe workaround we tried still required
// an unsafe cast. XHR's send() accepts FormData cleanly, no casts needed.
// Returns the raw status + parsed JSON so callers can branch on status.
export function postMultipart(
  url: string,
  body: FormData,
  headers: Record<string, string>,
): Promise<MultipartResponse> {
  return new Promise<MultipartResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    for (const [name, value] of Object.entries(headers)) {
      if (value) xhr.setRequestHeader(name, value);
    }
    xhr.onload = () => {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(xhr.responseText);
      } catch {
        parsed = null;
      }
      resolve({ status: xhr.status, body: parsed });
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Network timeout"));
    xhr.send(body);
  });
}
