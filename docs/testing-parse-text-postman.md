# Testing `POST /invoices/parse-text` in Postman

How to manually test the AI invoice-parsing endpoint. The endpoint is behind `Bearer` auth, so it's a 3-request flow: get an OTP → exchange it for a token → call the endpoint.

## Prerequisites

- The API is running locally: from `apps/api`, run `npm run dev` (or `npm run dev` at the repo root for the full stack). It listens on **`http://localhost:3001`**.
- `GEMINI_API_KEY` is set in the repo-root `.env` (get a key at https://aistudio.google.com/apikey). Without it the API won't boot.
- `GEMINI_MODEL` defaults to `gemini-2.5-flash`.

## Postman setup

- Base URL: `http://localhost:3001`
- For every request, set the **Body** tab to **raw** and pick **JSON** from the dropdown (Postman sets `Content-Type: application/json` for you).

---

## Step 1 — Request an OTP

- **Method / URL:** `POST` → `http://localhost:3001/api/v1/auth/request-otp`
- **Body (raw JSON):**
  ```json
  { "phone": "+639171234567" }
  ```
- **Response:** includes a `devOtpCode` (dev-only convenience):
  ```json
  { "success": true, "expiresInSeconds": 300, "devOtpCode": "244508" }
  ```
- Copy the `devOtpCode`. It expires in 5 minutes and is single-use, so move to Step 2 promptly.

## Step 2 — Verify OTP → get token

- **Method / URL:** `POST` → `http://localhost:3001/api/v1/auth/verify-otp`
- **Body (raw JSON):** (paste the code from Step 1)
  ```json
  { "phone": "+639171234567", "code": "244508" }
  ```
- **Response:** copy the **`accessToken`** value:
  ```json
  { "user": { "...": "..." }, "accessToken": "eyJhbGci...", "isNewUser": false }
  ```

## Step 3 — Parse invoice text (the feature)

- **Method / URL:** `POST` → `http://localhost:3001/api/v1/invoices/parse-text`
- **Authorization:** open the **Authorization** tab → Type **Bearer Token** → paste the `accessToken`.
  (Or add a header manually: `Authorization: Bearer <token>`.)
- **Body (raw JSON):**
  ```json
  {
    "text": "Bill Acme Corp $1,500 for landing page design and $90/hour for 10 hours of consulting, due in 30 days",
    "defaultCurrency": "USD"
  }
  ```
- **Response (200):** a structured draft with `lineItems` and `warnings`, e.g.
  ```json
  {
    "clientName": "Acme Corp",
    "clientEmail": null,
    "currency": "USD",
    "issueDate": "2026-05-22",
    "dueDate": null,
    "lineItems": [
      {
        "description": "landing page design",
        "quantity": null,
        "unit": "unit",
        "rate": null,
        "amount": 1500
      },
      { "description": "consulting", "quantity": 10, "unit": "hour", "rate": 90, "amount": 900 }
    ],
    "warnings": [
      "Due date could not be determined",
      "Quantity not found for: landing page design",
      "Rate not found for: landing page design"
    ]
  }
  ```

---

## Request fields

| Field             | Required | Notes                                                              |
| ----------------- | -------- | ------------------------------------------------------------------ |
| `text`            | yes      | 1–2000 characters — the plain-text description of the work.        |
| `defaultCurrency` | no       | One of `USD`, `EUR`, `GBP`, `PHP`. Falls back to `USD` if omitted. |

## Troubleshooting

| Result                                         | Likely cause                                                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `401 Unauthorized`                             | Token missing, expired, or malformed in the Authorization tab. Redo Steps 1–2.                                                            |
| `422`                                          | Body failed validation (empty `text`, text too long, or unsupported `defaultCurrency`).                                                   |
| `500` with a Google quota message (`limit: 0`) | The configured Gemini model has no free-tier allowance on that API key's project. Use `gemini-2.5-flash` (the default) or enable billing. |
| `500` with `models/... is not found`           | The configured `GEMINI_MODEL` isn't available to that key (e.g. retired `gemini-1.5-*`).                                                  |
| Connection refused                             | The API isn't running, or it's on a different port.                                                                                       |

## Notes

- The OTP `devOtpCode` is returned only in non-production (or when `OTP_TEST=true`). In production you'd receive the code via SMS.
- The endpoint is **stateless** — it does not save anything to the database. It only transforms text into a draft.
