# ERP integration implementation plan

> **Standalone workflow review:** the product may launch with HR-generated PDF and copy/paste delivery before Business Central API delivery. Read [STANDALONE_BUILD_REVIEW.md](/Users/prime/Documents/Antigravity%20Projects/Nigcomsatravel/STANDALONE_BUILD_REVIEW.md) before implementing or extending the ERP phases. The standalone review makes finalized costing channel-neutral and requires manual artifacts to stay out of the API pending queue.

**Status:** Track A implementation verified against the deployed Supabase schema; standalone costing/delivery separation is implemented locally and migration `20261026000000_standalone_costing_delivery_mode.sql` must be applied before HR finalization uses it in an environment
**Date:** 20 October 2026
**Scope:** Cloud-first Dynamics integration; on-premises portability later

## What will be built

The travel tool keeps the HOD-approved source memo number as the business identity of one travel request. After HR verifies the calculation, Dynamics creates a separate HR costing memo that references the source memo and routes that costing memo to the MD/CEO.

The source memo number prevents duplicate business requests. An internal `export_id` identifies the exact frozen payload for API retries. These identifiers have different jobs.

The vendor-neutral Track A implementation now exposes a pull API for Dynamics:

- `GET /api/erp/v1/exports` — list unacknowledged HR costing memo payloads.
- `GET /api/erp/v1/exports/{export_id}` — retrieve one immutable payload.
- `POST /api/erp/v1/exports/{export_id}/acknowledgements` — confirm that Dynamics created the HR costing memo and workflow, returning its ERP memo number.
- `GET /api/erp/v1/health` — authenticated integration health check.

### Deployment verification — 22 October 2026

The linked Supabase project was checked through its REST API after the migrations were applied. The `erp_exports` and `erp_delivery_receipts` tables, `staff.erp_employee_number`, request memo/export fields, `rate_overrides.reason`, and the two service-role transaction functions are present. The function checks reached their expected guard paths without creating data. A local HTTP probe also verified unauthenticated requests return `401`, authenticated health returns `200`, an empty queue returns `200`, invalid pagination returns `400`, and acknowledgement of an unknown export returns `404`.

The direct PostgreSQL migration-history command could not complete because the Supabase pooler connection timed out; the REST checks above verify the deployed objects themselves. Before any ERP team receives an endpoint, set a separate `ERP_INTEGRATION_API_KEY` in the application deployment secret and share it through the approved credential channel. The key is intentionally absent from the repository and from the local `.env.local` file.

The implemented contract is documented in `ERP_API_CONTRACT.md`. The collection and acknowledgement endpoints are deliberately vendor-neutral until ICT supplies the Business Central company, field, and workflow details.
- A decision endpoint or polling job is a later phase because the ERP team has not confirmed its outcome mechanism.

### Standalone costing channel

HR finalization now targets the standalone channel by default. The finalized payload is stored as a held/manual artifact, so it can support the approved-costing view, PDF, copy/paste memo, and JSON download without entering the Business Central API queue. The API list/detail routes only expose records whose delivery mode is explicitly `business_central_api`.

Apply `20261026000000_standalone_costing_delivery_mode.sql` before deploying this action. It adds the delivery-mode boundary and an atomic standalone finalization wrapper around the existing HR review transaction.

The approved-costing detail page is available to HR/Admin at `/hr/costing/{export_id}`. It renders the persisted memo body, supports PDF/JSON download, copies the memo body or line-item table, and records a manual Business Central company/memo/workflow reference through the audited `erp_manual_handoffs` table. Apply `20261026010000_manual_erp_handoff.sql` before enabling that handoff form.

### Recommended Dynamics API method

Use a versioned HTTPS REST/JSON pull integration. Dynamics, or its approved integration layer, obtains an OAuth 2.0 access token through Microsoft Entra ID using client credentials, calls our export endpoint, creates the HR costing memo, and calls our acknowledgement endpoint. Use a dedicated integration application/service principal with least-privilege permissions and separate sandbox and production credentials.

This is the recommended method because HR submission stays independent of ERP availability, the outbox supports retries and reconciliation, GET is repeatable, and acknowledgement is explicit and idempotent. Because NIGCOMSAT uses Business Central, the ERP-side adapter should use a versioned custom API page/query or, preferably for the multi-step costing-memo/workflow operation, a narrowly scoped codeunit action. The public contract from this tool stays stable while the Business Central adapter implements ERP-specific mapping. Microsoft documents [Business Central custom APIs](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-develop-custom-api) and [Business Central OAuth service-to-service authentication](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/webservices/authenticate-web-services-using-oauth).

## Policy rules

The implementation must use the shared calculator and `notes.md` as the source of truth:

- DTA is a daily Duty Travel Allowance.
- Local running is a separate daily allowance.
- DTA and local running use grade band, destination coverage, and inclusive trip days.
- Coverage is 100% for Lagos, Abuja, and Port Harcourt and 75% elsewhere.
- Transport and airport taxi are flat amounts and are not coverage-scaled.
- One-way travel halves transport and taxi only. It never halves DTA or local running.
- Monday-to-Wednesday means three paid days.
- Amounts are NGN only and must reconcile per traveler and at request level.

## Phase 0 — contract discovery and policy lock

This phase is a short discovery exercise with HR, ICT, and the Dynamics team. We are not coding the integration yet. We are recording technical details needed to connect the already-decided business process.

The output is a signed integration contract, one approved sample payload, one approved memo-body example, and access to a Dynamics sandbox. Every item below must have an answer recorded in the contract.

### 0.1 Capture the official HR costing memo

Ask HR for one real, approved costing memo with sensitive information replaced by sample values. Capture:

- memo subject;
- recipient and routing fields;
- the exact body text and paragraph order;
- where the source HOD memo number appears;
- where trip dates, destination, travelers, DTA, local running, transport, taxi, and total appear;
- HR’s note or recommendation;
- the HR author’s name, position/title, and sign-off location;
- attachments, rich text, tables, or required formatting;
- whether the body is plain text, HTML, or a Dynamics-specific document structure.

**Decision:** identify which values are structured JSON fields and which values are rendered into the memo body. The body must be generated from server data, never typed by the browser as an unverified replacement for the amounts.

**Output:** `memo-template-v1` example and a field mapping table.

### 0.2 Record the Dynamics adapter details

Ask ICT for the Business Central tenant, environment name (sandbox and production), company name/ID, and API base URL or custom API URL. The “sandbox URL” means the test Business Central environment where the integration can safely run sample memos; it is not a staff login URL.

Also confirm whether Dynamics will pull our API over HTTPS, what network allowlisting is needed, and who owns the connector.

**Decision:** use the REST/JSON pull method specified above with a Business Central custom API page/query or codeunit action. We will not write directly to Business Central database tables.

**Output:** endpoint documentation, sandbox credentials/process, network requirements, and named ERP integration owner.

### 0.3 Define the source memo idempotency rule

Ask ICT whether source memo numbers are unique across the Business Central company or can repeat in another company, and whether case, spaces, punctuation, or leading zeros matter. In Business Central, a company is the accounting/data boundary; if two companies can issue the same number, company ID must be part of the uniqueness key. If NIGCOMSAT uses one company, configure that company explicitly rather than building unnecessary multi-company behavior.

**Decision:** preserve the original number for display and create a canonical comparison value only according to Dynamics’ confirmed rules. Enforce one logical request per company/legal entity plus canonical source memo number. A retry reopens or returns the existing request; a second conflicting request returns a safe conflict.

**Output:** examples of equivalent and non-equivalent memo numbers, uniqueness scope, and duplicate-request behavior.

### 0.4 Confirm employee and HR author identity fields

Ask which Business Central employee identifier identifies each traveler and which identifier identifies the HR author. Prefer a stable employee/personnel number from the Business Central Employee record or an approved custom employee field. Do not use an email address or Business Central login username as the traveler’s business identity unless ICT confirms that it is the permanent employee key. The integration service principal is a separate machine identity and must not be treated as the HR author.

Confirm that the staff record contains the author’s legal/full name and organizational sign-off title. The authenticated office email identifies the account, but the server must read the name and title from trusted staff data and snapshot them when HR submits.

**Decision:** define behavior for a missing employee mapping or missing HR title: block submission with a clear correction message. Never accept these values from the browser and never invent them from an email address.

**Output:** identity mapping table and sample `authorized_by` object.

### 0.5 Define the acknowledgement response

Agree what Dynamics sends after it has durably completed the import. The acknowledgement should include:

- `export_id`;
- source memo number;
- ERP-created HR costing memo number;
- Dynamics workflow/reference ID;
- import status;
- timestamp;
- optional error code/message when it cannot create the costing memo.

**Decision:** an HTTP GET is not an acknowledgement. Dynamics acknowledges only after the costing memo and its MD workflow link exist durably. Repeating the same acknowledgement is successful; a conflicting memo/workflow reference is a reconciliation error.

**Output:** acknowledgement request/response examples and retry rules.

### 0.6 Decide how the MD outcome returns

Ask whether Dynamics can call a decision endpoint, whether our system can poll a supported Dynamics endpoint, or whether outcome reconciliation must initially be manual.

**Decision:** do not promise automatic “approved” or “rejected” status until one mechanism has been tested. If no automated mechanism exists, show the request as awaiting verified ERP outcome and record manual evidence through a controlled operation.

**Output:** decision API contract, polling specification, or manual reconciliation procedure.

### 0.7 Approve the security and operating arrangement

Agree who owns the integration credential, how it is delivered, how it is rotated/revoked, allowed source IPs if applicable, polling frequency, payload limits, support hours, and incident contact. Confirm sandbox and production are separate credentials.

**Output:** security responsibility matrix, credential runbook, polling limits, and support contacts.

### Phase 0 completion checklist

Phase 0 is complete only when all of these exist:

- approved redacted HR costing memo and template version;
- written DTA/local-running field mapping;
- recorded two-memo workflow and Dynamics link fields;
- confirmed Dynamics product, sandbox, REST/JSON adapter, and connector owner;
- source memo canonicalization and uniqueness rules;
- employee and HR-author identity mappings;
- acknowledgement response with ERP costing memo number and workflow reference;
- tested or explicitly documented MD-outcome mechanism;
- approved sample JSON and body rendering;
- security, credential, polling, support, and escalation owners.

If any item is unanswered, Phase 0 is not failed; it is simply not complete, and implementation should not proceed past the affected dependency.

## Working while the Dynamics contact is slow

We do not need every Business Central detail before starting. Split the work into two tracks.

### Track A — can start immediately in the travel tool

Build and test these against a versioned, vendor-neutral contract:

- source memo number capture and duplicate protection;
- the existing DTA/local-running calculator and NGN reconciliation;
- HR review, override reasons, trusted HR name/title snapshot;
- immutable costing payload and memo body renderer;
- export/outbox records and export IDs;
- `GET` list/detail endpoints;
- acknowledgement endpoint and idempotent replay handling;
- scoped integration authentication, rate limiting, logging, and audit;
- staff/HR/admin progress states;
- OpenAPI specification and a mock Business Central connector;
- concurrency, failure, security, and contract tests.

For local development, use a fake Business Central adapter that returns a deterministic costing memo number and workflow reference. This proves our side without pretending that the fake values are production ERP values.

### Track B — requires Business Central confirmation

These items cannot be truthfully finalized without the ERP team:

- the real Business Central API URL and environment names;
- company ID and exact source-memo field;
- employee/personnel field names;
- the custom API page or codeunit action they will implement;
- the real HR costing memo number and workflow-reference fields;
- Business Central approval-workflow behavior;
- production Entra application registration and permissions;
- end-to-end sandbox UAT.

Treat these as adapter configuration and UAT dependencies, not reasons to pause the core application. Use placeholders in development, keep them in environment configuration, and reject deployment to production until the real values are supplied and tested.

### Practical communication package for the Dynamics team

Send the ERP contact one short technical package rather than a long list of questions:

1. Our proposed `GET /api/erp/v1/exports` and acknowledgement endpoints.
2. One sample HR costing payload with a fake source memo number.
3. The statement that Business Central should create a new costing memo linked to the source HOD memo.
4. The request for only five items: sandbox API URL, company ID, employee identifier field, costing-memo/workflow fields, and Entra authentication owner.
5. A request for a 30-minute sandbox test once their adapter is available.

Until that reply arrives, the engineering team can finish Track A and demonstrate the complete travel-tool workflow using the mock adapter. The Business Central adapter then becomes a bounded integration task instead of a dependency for the whole product.

## Phase 1 — source-memo identity and data foundation

Implementation started: the migration adds the ERP employee-number mapping, immutable export identity, revisioned payload, HR author snapshot, costing-memo body/template metadata, and an `erp_export_id` link on the request. Admin staff management can now maintain each person’s Business Central employee number. Until ICT confirms multiple Business Central companies, the active memo uniqueness scope is the travel tool’s single configured company.

Add canonical source memo identity and company scope, permanent reservation for one logical request, approval authority (`erp` versus explicitly legacy `local`), costing revision, immutable export identity, HR author snapshot, memo body/template metadata, and ERP costing memo number/workflow receipt fields.

Preserve `travel_group_id` and `previous_version_id` for internal lineage. Do not allow post-export corrections to create a second costing memo until an ERP amendment/replacement contract exists. Add constraints and tests for concurrent submissions, retries, different users, terminal records, and stale revisions.

**Gate:** migrations apply to a copy of current data; duplicate source memo behavior is deterministic; existing records are not silently reassigned.

## Phase 2 — atomic HR review and costing snapshot

The HR review action now calls a service-role-only database transaction. It locks the request, updates every traveller, writes the HR approval and override audit rows, renders the costing body, and creates the immutable ERP export together or rolls everything back. RLS and database triggers block authenticated direct updates to Phase 0 request/traveller rows, so the browser cannot bypass that transaction.

Replace the current multi-step HR submission with a guarded transaction or narrowly callable database function. Authenticate HR, lock request/traveler rows, verify the review revision, recalculate with the server calculator, validate NGN totals and memo body, snapshot trusted HR identity/title, and write amounts, overrides/reasons, HR approval, request state, immutable payload, and queue record together.

Any failure rolls back the submission. A retry of the same reviewed revision returns the existing export. Harden RLS and grants so direct PostgREST updates cannot bypass this transaction. The legacy local MD action must reject ERP-owned requests.

**Gate:** failure injection, double-submit, concurrency, unmapped designation, policy-change, and reconciliation tests pass.

## Phase 3 — API authentication and collection contract

The first contract slice is implemented: bearer authentication, no-store list/detail/health responses, bounded collection pages, immutable export retrieval, idempotent acknowledgements, `X-Correlation-ID` response tracing, and a two-key overlap for controlled credential rotation. A shared database-backed rate limiter and feature flag are now implemented in `20261021030000_erp_api_rate_limit.sql`; apply that migration and enable `ERP_API_RATE_LIMIT_ENABLED=true` in sandbox before production. The machine-readable contract is in `ERP_API_OPENAPI.yaml`. Database-backed key storage/revocation and automated OpenAPI contract tests remain before production release.

Implement versioned Next.js Route Handlers under `/api/erp/v1`. Use a dedicated per-environment credential with scoped permissions, hash-only storage, expiry, rotation, revocation, HTTPS, body/page limits, and `Cache-Control: no-store`.

Implement list/detail/health endpoints. GET is read-only and never removes work. Dynamics performs bounded sweeps from the queue head; page cursors are navigation aids, never permanent high-water checkpoints. Add database-backed rate limits, safe errors, correlation IDs, redacted logs, and timeouts. Keep machine authentication separate from browser sessions.

**Gate:** OpenAPI examples and contract tests cover authentication, scopes, pagination, malformed input, limits, outages, and no-store behavior.

## Phase 4 — acknowledgement and Dynamics sandbox

Dynamics reads each export, creates the HR costing memo linked to the source memo, starts or attaches the MD/CEO workflow, stores its mapping by `export_id` and source memo number, and acknowledges only after those actions are durable.

The repository now includes `scripts/erp-uat.mjs` and the `npm run erp:uat` command. The read-only mode validates the live export contract and NGN reconciliation. `--ack --conflict --require-export` runs the sandbox acknowledgement, idempotent replay, and conflicting-reference checks against a controlled export. A controlled request is still required before the mutating scenarios can run.

The acknowledgement stores the ERP costing memo number and workflow reference. Repeating the same acknowledgement returns the original result. A conflicting reference returns a reconciliation conflict. A lost HTTP response is safe to retry.

**Gate:** sandbox tests pass for duplicate polls, lost responses, duplicate acknowledgements, conflicting references, ERP downtime, malformed records, and workflow failures.

## Phase 5 — product status, operations, and manual fallback

Add truthful states: awaiting HR review, awaiting ERP collection, costing memo created/awaiting MD approval, integration needs attention, and outcome unknown. Copying or printing never counts as delivery.

Add operational views for oldest unacknowledged export, last ERP contact, acknowledgement lag, failed imports, conflicts, credential state, and reconciliation by source memo/export ID. Manual fallback requires an ERP costing memo number and workflow reference and uses the same deduplication identifiers.

**Gate:** HR can explain each state without developer help; accessibility, keyboard, mobile, audit, and recovery checks pass.

## Phase 6 — outcome synchronization, if supported

If Dynamics can call us, add a decision endpoint bound to source memo, costing revision, export ID, and workflow reference. Store the integration principal separately from the ERP-reported MD/CEO. Require rejection reasons and protect against stale or replayed decisions.

If Dynamics cannot call us, use an explicitly manual audited reconciliation process and show outcome as unknown until verified. Do not promise automatic outcome synchronization.

**Gate:** approval, returned-for-correction, final rejection, stale decision, duplicate decision, and wrong-revision tests pass.

## Phase 7 — cloud pilot and later on-premises readiness

Run the cloud pilot with controlled requests. Exercise credential rotation, backups, restore reconciliation, rate limits, outage recovery, and rollback. Rollback stops new ERP exports but leaves already-exported requests ERP-owned.

After the cloud version operates successfully, document on-premises runtime, network, TLS, secrets, backups, monitoring, deployment packaging, and identity-provider requirements. Add Docker only if the target requires it; add Kubernetes or service discovery only if the chosen platform requires them.

**Final gate:** both teams approve the contract, UAT evidence, runbook, support ownership, security review, and reconciliation procedure.

## Definition of done

- One source memo cannot create two logical active requests.
- HR author name/title are server-derived and frozen in the costing payload.
- The ERP body is generated from the approved template and reconciles with structured amounts.
- DTA, local running, transport, taxi, traveler totals, and request total reconcile exactly in NGN.
- DTA/local running are never halved for one-way travel.
- Duplicate reads, retries, acknowledgements, and decisions cannot create duplicate ERP effects.
- ERP-owned requests cannot be approved through local MD UI, server actions, or direct database writes.
- Cloud failures do not lose a committed HR review or expose a false approval.
- Recovery, auditability, credential rotation, and accessible status displays are tested.
