# Business Central integration API

The travel tool exposes a server-owned pull API. Business Central, or an approved Business Central adapter, calls these endpoints over HTTPS. The travel tool never calls the ERP during HR submission. The collection endpoints return only artifacts explicitly enrolled for Business Central API delivery; standalone/manual artifacts remain held for PDF or copy/paste handling.

`costing_memo_template_version` identifies the renderer used for the body and is sent as structured metadata. It is not printed into the memo body unless the approved Business Central template explicitly chooses to display it. The current renderer follows the supplied Business Central “Memo Report” shape: expense-claim metadata, an HR recommendation paragraph, line items, and the HR author sign-off.

`memo_department`, `memo_due_date`, and `memo_approved_by` are nullable because the travel tool does not have the source ERP memo's department, due date, or HOD approver identity. Business Central should populate those report fields from the source HOD memo when available; the adapter must not infer or invent them.

Each `travelers` item carries the mapped Business Central employee number, display name, designation, grade band, DTA rate/amount, local-running rate/amount, transport, airport taxi, and traveller total. All monetary values are two-decimal Naira strings; the request total must equal the sum of traveller totals. Every item returned by these endpoints has `delivery_mode` set to `business_central_api`; a `manual` artifact is never collected automatically.

`payload_sha256` is generated once when the export is committed. Business Central should echo that exact value in its acknowledgement; it does not need to reproduce the database’s canonical JSON serialization.

## Authentication

Send the environment-specific machine credential as:

```http
Authorization: Bearer <ERP_INTEGRATION_API_KEY>
```

The key is server-only, is different for sandbox and production, and must not be a staff login or Supabase credential. The current cloud pilot reads it from `ERP_INTEGRATION_API_KEY`; database-backed key rotation is required before production rollout.

For a zero-downtime interim rotation, deploy the new value as `ERP_INTEGRATION_API_KEY` and keep the old value in `ERP_INTEGRATION_API_KEY_PREVIOUS`. Switch Business Central to the new value, verify a health call, then remove the previous value in a second deployment. Never place either value in the repository or in request logs.

Every response has `Cache-Control: no-store` and an `X-Correlation-ID` UUID. Business Central should retain that value in its connector logs and include it when reporting an integration failure. A valid incoming `X-Correlation-ID` is preserved; otherwise the travel tool generates one.

When `ERP_API_RATE_LIMIT_ENABLED=true`, the API applies a shared per-credential limit using the `erp_api_rate_limit_buckets` table. The default is 120 requests per minute and can be changed with `ERP_API_RATE_LIMIT_PER_MINUTE`. A rejected request returns `429`, `Retry-After`, `X-RateLimit-Limit`, and `X-RateLimit-Remaining: 0`. Apply migration `20261021030000_erp_api_rate_limit.sql` before enabling the flag; the limiter fails closed with `503` if its database function is unavailable.

## Collect pending exports

```http
GET /api/erp/v1/exports?state=pending&limit=50&cursor=<opaque-cursor>
```

The endpoint returns up to 100 exports per page. It includes pending and retryable error records. A read does not remove or acknowledge an export. Start a later polling sweep from the queue head; the cursor only moves within the current page walk.

```json
{
  "schema_version": "1.0",
  "items": [
    {
      "id": "export-uuid",
      "request_id": "request-uuid",
      "source_memo_number": "MEMO-2026-001",
      "revision": 1,
      "delivery_mode": "business_central_api",
      "schema_version": "1.0",
      "payload": {
        "schema_version": "1.0",
        "export_id": "export-uuid",
        "delivery_mode": "business_central_api",
        "source_memo_number": "MEMO-2026-001",
        "costing_memo_revision": 1,
        "costing_memo_subject": "TRIP TO KANO TO OFFICIAL INSPECTION",
        "costing_memo_body": "...",
        "costing_memo_body_format": "plain_text",
        "costing_memo_template_version": "NIGCOMSAT-HR-TRAVEL-v2",
        "memo_type": "Expense Claim",
        "memo_priority": "Urgent",
        "memo_department": null,
        "memo_addressed_to": "Managing Director / Chief Executive Officer",
        "memo_due_date": null,
        "memo_approved_by": null,
        "coverage_percent": 75,
        "costing_memo_lines": [
          {
            "line_number": 10000,
            "description": "Air ticket for Example Traveller (two legs)",
            "quantity": "1.00",
            "unit_price": "300000.00",
            "amount": "300000.00"
          },
          {
            "line_number": 20000,
            "description": "DTA of 75% for Example Traveller",
            "quantity": "3.00",
            "unit_price": "30000.00",
            "amount": "90000.00"
          },
          {
            "line_number": 30000,
            "description": "Local running of 30% of DTA for Example Traveller",
            "quantity": "3.00",
            "unit_price": "9000.00",
            "amount": "27000.00"
          },
          {
            "line_number": 40000,
            "description": "Airport taxi for Example Traveller (two legs)",
            "quantity": "1.00",
            "unit_price": "80000.00",
            "amount": "80000.00"
          }
        ],
        "hr_author_name": "Example HR Officer",
        "hr_author_title": "Human Resources Officer",
        "hr_author_email": "hr@example.gov.ng",
        "hr_authorized_at": "2026-10-21T09:00:00Z",
        "hr_note": "Approved after checking the route.",
        "trip_origin": "Abuja",
        "trip_destination": "Kano",
        "departure_date": "2026-10-21",
        "return_date": "2026-10-23",
        "days": 3,
        "trip_type": "return",
        "mode": "air",
        "reason_for_travel": "Official inspection",
        "travelers": [
          {
            "employee_identifier": "BC-EMP-001",
            "name": "Example Traveller",
            "designation": "Manager",
            "grade_band": "B3",
            "dta_rate": "30000.00",
            "dta_amount": "90000.00",
            "local_running_rate": "9000.00",
            "local_running_amount": "27000.00",
            "transport_amount": "300000.00",
            "airport_taxi_amount": "80000.00",
            "total_amount": "497000.00"
          }
        ],
        "total_amount": "497000.00",
        "currency": "NGN"
      },
      "payload_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
      "state": "pending",
      "available_at": "2026-10-21T09:00:00Z",
      "created_at": "2026-10-21T09:00:00Z"
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```

## Retrieve one export

```http
GET /api/erp/v1/exports/{export_id}
```

This returns the same immutable payload after acknowledgement for reconciliation. Business Central should upsert its costing memo by `export_id` and retain `source_memo_number` and `costing_memo_revision` as business references.

## Acknowledge a durable ERP import

Call this only after Business Central has created the HR costing memo, linked it to the source HOD memo, and created or attached the MD/CEO workflow:

```http
POST /api/erp/v1/exports/{export_id}/acknowledgements
Content-Type: application/json
```

```json
{
  "export_id": "export-uuid",
  "source_memo_number": "MEMO-2026-001",
  "erp_company_id": "NIGCOMSAT",
  "erp_costing_memo_number": "BC-MEMO-00421",
  "erp_workflow_reference": "BC-WF-8841",
  "received_payload_sha256": "0000000000000000000000000000000000000000000000000000000000000000"
}
```

The acknowledgement is idempotent. Repeating the same values returns the original successful result. A different ERP memo number, workflow reference, company, source memo, or hash returns `409 acknowledgement_conflict`; it never silently overwrites the first receipt.

## Health

```http
GET /api/erp/v1/health
```

This checks authenticated API and database readiness. It does not prove that a particular costing memo has been created in Business Central.

## Error shape

```json
{
  "error": {
    "code": "acknowledgement_conflict",
    "message": "The acknowledgement conflicts with the stored export state"
  }
}
```

Retry network failures, `429`, and retryable `5xx` responses with capped exponential backoff and jitter. Do not blindly retry `400`, `401`, `404`, or `409` responses.

## Mock connector and UAT harness

The repository includes `scripts/erp-uat.mjs`, a small mock Business Central connector. It validates the live collection response, checks that every export has a matching immutable payload and source memo, and reconciles DTA, local running, transport, taxi, traveler totals, and the request total using integer Naira cents. It also checks that the payload has no uncontracted fields such as per diem.

Run the read-only smoke check against a local server or deployed sandbox:

```bash
ERP_API_BASE_URL=http://localhost:3000 \
ERP_INTEGRATION_API_KEY='sandbox-secret' \
npm run erp:uat
```

After creating one controlled sandbox request and reviewing it in HR, run the acknowledgement scenario. It acknowledges each export with deterministic mock Business Central references, repeats the same acknowledgement to verify idempotency, and can send a conflicting acknowledgement to verify reconciliation protection:

```bash
ERP_API_BASE_URL=https://travel-tool-sandbox.example.gov.ng \
ERP_INTEGRATION_API_KEY='sandbox-secret' \
ERP_UAT_COMPANY_ID='NIGCOMSAT-SANDBOX' \
npm run erp:uat -- --ack --conflict --require-export
```

The harness never creates travel requests and never prints the API key. `--ack` changes export state, so use it only against the approved sandbox environment. To replay one acknowledged export, pass its `export_id` explicitly:

```bash
npm run erp:uat -- --ack --export-id <export-uuid>
```
