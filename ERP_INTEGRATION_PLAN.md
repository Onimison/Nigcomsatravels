# Dynamics 365 integration — proposed build plan

Status: FOR REVIEW. No application implementation authorized by this document.
Date: 18 October 2026

## 1. Recommendation

Extend the existing Next.js/Supabase application with a versioned, authenticated API that the ERP team calls. HR submission commits a frozen allowance breakdown into a durable Postgres outbox. Dynamics collects those submissions, creates or updates the appropriate memo approval workflow, and acknowledges successful import.

Keep this as one application and one database. Use database transactions and idempotent processing to make it reliable. Do not add microservices, Kubernetes, Kafka, or a separate integration platform without a demonstrated requirement.

Dynamics is the approval authority for every ERP-routed request. Our application owns calculations, HR verification, the export record, and visibility. Automatic final-outcome updates require the ERP team to call our decision endpoint; their willingness and ability to do this remain unconfirmed.

## 2. Evidence from the existing app

- Next.js 16.2.12, React 19, Supabase Auth/Postgres, and Zod are installed. Local Next Route Handler documentation was inspected.
- Memo numbers, multiple travelers, policy snapshots, NGN totals, HR adjustments, and rejection/resubmission relationships already exist.
- `src/lib/actions/hr-review-v2.actions.ts` currently saves traveler prices, request status, approval history, and overrides in separate operations. Failures can leave partial changes; the override insert result is not checked.
- `src/lib/actions/requests.actions.ts` still permits local MD approval/rejection. The v2 memo-based screen is read-only, but ERP routing must also prevent this legacy server path from approving ERP-owned requests at the database and server layers.
- The MD interface has separate legacy and memo-based branches: legacy requests use the old allowance/FX display, while memo-based requests use the read-only NGN per-traveler breakdown. The integration must preserve the latter and keep the data models separate.
- `src/proxy.ts` calls Supabase session authentication before its API-route bypass. Machine API traffic should use its own authentication path without this session dependency.
- `approvals.approver_id` requires a local staff identity. It cannot honestly represent an external decision without a new provenance model.
- Staff records do not currently have a confirmed ERP employee-number mapping.
- GitHub Actions already runs lint and build. This needs integration, database, concurrency, and API contract coverage.
- Existing active-memo uniqueness includes `pending_hr`, `pending_md`, and `approved`; existing resubmissions create a new request row with the same `travel_group_id`.
- `notes.md` assumes outbound push, an HR-owned ERP credential, and polling ERP for outcomes. The latest direction replaces the push assumption with ERP collection from our endpoints. Decision callbacks remain a separate agreement. Update the PRD accordingly during implementation.
- A pre-existing working-tree modification exists in the HR v2 action. Preserve and review it before implementation; do not overwrite it.

## 3. Review and challenge record

Three specialist agents reviewed architecture, security/reliability, and product/design. The coordinating review reconciled their findings. These are engineering role perspectives, not claims of real employment history.

| Proposal challenged | Problem raised | Agreed direction |
| --- | --- | --- |
| Add endpoints around the existing HR action | Partial writes could publish amounts without a complete audit | First make HR submission and export creation one transaction |
| Use a permanent increasing cursor | Transactions can commit out of order; pending items can be skipped | Query durable unacknowledged work; complete bounded page sweeps and restart from the head |
| Mark delivery after a successful GET | A collector may crash before saving anything in ERP | GET is read-only; require an explicit durable-import acknowledgement |
| Retry by creating another export | A timeout could create a duplicate ERP memo/workflow | Retries reuse the immutable export ID; Dynamics enforces its uniqueness |
| Keep local MD approval as a fallback | Two systems could make conflicting final decisions | Freeze approval authority per request; manual reconciliation records an ERP decision |
| Assume ERP posts final decisions | Existing PRD says the ERP does not push outcomes | Negotiate callbacks separately; make missing outcome visibility explicit |
| Allow manual copy/paste to count as delivered | A collector may already hold the same request | Copy/print changes no state; manual import uses shared deduplication or coordinated reconciliation |
| Represent ERP approver using a local account | Machine authentication does not prove a specific human approved | Store authenticated integration actor and ERP-reported human identity separately |
| Add a broker and orchestration cluster | Adds deployment and support burden without proven demand | Use the existing database as the durable handoff store |

The first release runs on the current cloud deployment. On-premises planning begins after the cloud version is tested and working; portability is a design constraint, not a reason to add infrastructure prematurely. The process uses two ERP memos: staff first open a source permission memo for HOD approval and enter its approved memo number here; after HR verifies the request, Dynamics creates a separate HR costing memo that references the source memo, includes the calculated travel amounts and HR's note, and routes it to the MD. ## 4. Contract decisions with the ERP team

Prepare a draft OpenAPI specification and examples early. Before locking the contract, agree:

1. Dynamics product/version, current cloud deployment, future on-premises constraints, legal entity/company context, network access, and sandbox availability.
2. Confirm that collection creates the HR costing memo linked to the HOD-approved source memo, rather than updating the source permission memo. Precisely define when the MD approval workflow starts.
3. Employee identifiers, memo lookup rules, required fields, supported monetary precision, and allowance terminology. Do not map local running to per diem without policy confirmation.
4. Acknowledgement meaning: the payload is durably imported and linked to the agreed ERP workflow. An HTTP fetch is insufficient.
5. ERP-side uniqueness on our `export_id`, including automated and manual import paths. Without this, we cannot promise duplicate-free ERP effects.
6. Poll frequency, volume, maximum travelers/payload, pagination behavior, per-item import failures, outage recovery, and support contacts.
7. Whether ERP can POST approval/rejection decisions; required approver identity and evidence; returned-for-revision versus final rejection; correction/cancellation behavior.
8. Authentication choice, credential ownership/rotation, network restrictions, retention, backup expectations, and production host ownership.

We can build and demonstrate the vendor-neutral API before every Dynamics detail is known. Real ERP UAT and automatic final-outcome synchronization depend on these agreements.

## 5. User experience and lifecycle

Keep business approval state separate from delivery state.

| User-visible state | Meaning |
| --- | --- |
| Awaiting HR review | Staff submitted; HR can verify allowed fields |
| Awaiting ERP collection | HR submission committed; immutable export available |
| Awaiting MD approval in ERP | Dynamics acknowledged the agreed durable workflow handoff |
| ERP connection needs attention | Collection is overdue or integration has reported an actionable problem |
| Approved in ERP | Verified final approval recorded from the agreed outcome channel |
| Returned for revision | ERP returned the request; staff may create a new request version |
| Rejected finally | Terminal ERP rejection; no resubmission of that request |

An overdue delivery is an operational condition, not a rejection. Missing outcome updates must display as unknown/pending, never inferred approval.

### HR

- Keep existing calculation review and allowed overrides; show final per-traveler and overall amounts, policy basis, and reasons for deviations.
- Capture a reason for each deviation, or an explicitly associated review reason covering those deviations; numeric override logs alone are insufficient for reviewable evidence.
- Use a button such as “Submit for ERP approval.” After success, show “Saved; awaiting ERP collection” and submission time.
- Reject stale browser reviews through an expected review revision. Explain that the request changed and needs refreshing.
- Freeze the exported financial snapshot. No silent edits or cancellation after submission; corrections need a separately agreed process.
- Provide a timeline, copy/print breakdown, and actionable support reference. Copy/print does not mark receipt.

### Staff and MD

- Staff see accurate progress and rejection reasons on requests they are authorized to view. Named travelers receive access only through explicit RLS authorization.
- ERP-routed requests have a read-only MD view; server and database prohibit local MD decisions.
- Replace the MD view's legacy allowance/FX rendering with the same frozen NGN financial evidence used by HR, print, and export.
- Preserve explicitly identified legacy requests under their existing approval authority until reconciled. Do not silently migrate pending legacy approvals.

### Administration and operations

- Show pending count, oldest pending age, last authenticated ERP contact, last successful acknowledgement, conflicting receipts, and reported import errors.
- Separate integration-health indicators from business approval status. A health request does not prove successful workflow creation.
- Provide authorized credential issue/revoke/rotation with one-time secret display, delivery hold/release controls, and reconciliation history.
- Manual entry must reuse `export_id` where ERP supports it. Otherwise coordinate collector pause/drain and reconcile existing imports before proceeding. A local hold cannot retract a payload already fetched.
- Do not offer a “resend” action that creates a new export or overwrites the frozen payload.
- All states use text as well as color; keyboard operation, focus, readable money/date formats, and accessible status announcements are acceptance criteria.

## 6. API proposal

Prefer export IDs in the external contract: they identify an exact frozen handoff, while a memo may be reused after a returned request.

| Method and endpoint | Purpose |
| --- | --- |
| `GET /api/erp/v1/exports?state=pending&limit=...&cursor=...` | Bounded pages of exports awaiting acknowledgement |
| `GET /api/erp/v1/exports/{export_id}` | Authorized immutable payload plus separate delivery metadata; usable for reconciliation after acknowledgement |
| `POST /api/erp/v1/exports/{export_id}/acknowledgements` | Confirm durable import and ERP workflow reference |
| `POST /api/erp/v1/exports/{export_id}/decisions` | Conditional scope: record a verified ERP outcome |
| `GET /api/erp/v1/health` | Authenticated integration readiness; minimal operational detail |

Payload fields: `schema_version`, `export_id`, `request_id`, `travel_group_id`, `previous_version_id`, submission/review revision, memo reference, company context if required, trip dates/days/mode/purpose, approved traveler identifiers, snapshotted grade/rates/coverage, final allowance components and totals, HR review identity/note/time, and creation time.

- Currency explicitly `NGN`; monetary API values are fixed two-decimal strings, calculated and checked using exact decimal/minor-unit arithmetic. Inspect the current calculator's rounding before deciding the smallest compatible correction; do not blindly stringify floating-point results.
- Dates use `YYYY-MM-DD`; instants use UTC ISO 8601. Document departure/return dates separately from HR-approved allowance days.
- Exclude unrelated personnel data, private auth identifiers where unnecessary, secrets, and raw database structures.
- Freeze the payload and a server-computed content hash at submission; later policy or staff-name changes cannot alter it. Document hash serialization if ERP is expected to verify it.
- Use a bounded page size (initial candidate default 50, maximum 100), opaque expiring cursor bound to integration/filter, and explicit next-page metadata. Tune against real payload limits.
- Each poll starts a new sweep from the head. Continue to later pages after a single item fails. Do not use a cursor as a permanent checkpoint or remove rows on read.
- Separate reported import failures from acknowledgement. Keep failed imports pending and visible for remediation rather than silently dropping them.
- Authenticate and scope every endpoint; return `Cache-Control: no-store` on successful and error responses.
- Standard JSON errors contain a stable code, safe message, and correlation ID. Distinguish malformed input, invalid credentials, denied scopes, missing resources, conflicts, rate limits, and transient unavailability.

OpenAPI examples must cover success, empty pages, validation errors, expired cursors, key rotation, duplicate ACK, conflicting ACK, retries, and stale decisions.

## 7. Data integrity and transaction boundaries

### Atomic HR submission

Use a narrowly permitted Postgres transaction/RPC. Validate the authenticated active HR/admin actor and approval mode inside the database, lock the request and affected traveler rows, and verify expected review revision and current state. Read authoritative inputs and compute or independently validate amounts inside the trusted transaction boundary; never grant a browser permission to submit arbitrary totals.

Commit final pricing, deviations, HR audit, business transition, immutable export, and delivery record together. Any failure rolls everything back. A retry with the same submission identity returns the already-created result. Concurrent submissions produce one export.

Review broad existing UPDATE grants/RLS: protected financial/state writes must not remain possible through direct PostgREST calls. Carefully harden RPC execution grants, schema qualification/search path, and actor checks. Server-only integration credentials must never be exposed to the browser.

### Proposed logical records

- `erp_integrations` / `erp_api_credentials`: principal, environment, scopes, hashed credentials, validity/revocation and audit metadata.
- `erp_exports`: unique export/submission identity, target integration, frozen payload/hash, request/review identity, approval source, creation time.
- `erp_delivery_receipts`: acknowledgement/workflow identity, timestamps and operational hold/error metadata. Separate mutable delivery metadata from immutable financial payload.
- `erp_external_events`: replay keys, normalized validated input digest, recorded outcome, machine actor, ERP-reported decision-maker, and original response.
- Append-only audit events and bounded rate-limit records as needed. Implement only tables justified by the final schema; these are logical responsibilities, not mandatory one-table-per-line design.

### Receipt and decision rules

- Enforce database uniqueness for one export per submission, one accepted workflow binding, and replay identities scoped to the integration and operation.
- Same ACK/export/workflow returns the original success. A different workflow reference for an already-bound export returns a conflict and raises an operational signal.
- Mutating endpoints accept a documented idempotency identity. Same key and same normalized content returns the stored result; same key with different content returns a conflict. Commit replay record, audit, and business change in one transaction.
- Decisions bind to exact export/review and workflow, validate the state transition, and require a reason for rejection. Late decisions for older returned versions cannot change the latest request.
- A decision may atomically establish receipt if it includes all required workflow evidence and no conflicting binding. Agree this ordering behavior in the contract.
- No silent final-decision reversal. Corrections require an explicit governed process outside the initial endpoint contract.
- External decisions record both the authenticated integration actor and the ERP-reported human. Do not manufacture a local staff approver to satisfy the current foreign key.
- Retain export identities, receipts, and replay protection for the agreed replay/audit period. Do not delete deduplication records while a replay could create another effect.

Delivery is at least once. Duplicate-free effects depend on durable deduplication in BOTH systems; there is no distributed exactly-once transaction.

## 8. Security and reliability

- Initial recommendation: dedicated bearer API credentials per integration/environment, at least 256 bits of random secret, identifiable key prefix, hash-only storage, constant-time verification, narrow read/ack/decision scopes, expiry, immediate revoke, and overlapping rotation. Transfer secrets through an agreed secure channel.
- If organizational policy requires Entra application tokens, substitute validated issuer/audience/tenant/application roles; keep the same domain contract. Do not give ERP Supabase service credentials or human login sessions.
- HTTPS throughout; validate reverse-proxy forwarding and TLS configuration. Network allowlisting is optional defense, never the sole identity control.
- Shared atomic per-credential throttling in Postgres initially; initial candidate 120 requests/minute, tuned with batch size and ERP polling. Return `429` and `Retry-After`. Use host ingress protection for unauthenticated floods; availability depends on chosen hosting.
- No in-memory-only rate limiter or positive authorization cache across instances. Credential database unavailable means fail closed with `503`; revoked/invalid credential means `401`.
- Bound body size, traveler count, pagination, database statement/lock time, and request duration. Candidate ERP client timeout 10 seconds and database statement budget 3 seconds, validated in deployment tests.
- ERP owns collection/ACK retries: retry network failures, `429` and retryable `5xx` with capped exponential backoff and jitter; honor `Retry-After`; stop and alert on persistent auth/configuration failures. Do not retry business conflicts blindly.
- App returns quickly rather than sleeping inside API handlers. No remote ERP call in the HR transaction or submit action.
- Structured logs include correlation ID, integration/key ID, export ID, status, and duration. Redact authorization headers, payloads, staff data, and raw database errors.
- Alert on overdue exports, missing ERP contact, error-rate/latency growth, workflow conflicts, repeated authentication failures, and decisions overdue under the agreed ERP SLA.
- Define backup/restore ownership and recovery targets with ICT. A restore must reconcile imported ERP workflows before replaying the recovered queue. Exercise this in staging.

## 9. Engineering concepts: explicit choices

| Concept | Decision for this build |
| --- | --- |
| Rate limiting | Shared per-key limits plus host ingress protection |
| Caching | No API response caching or auth-success caching initially; use indexes and bounded queries |
| Load balancing | Use host-provided balancing when replicas exist; stateless app handlers and shared DB state |
| Reverse proxies | Use the deployment ingress for TLS/routing/request limits; verify trusted headers |
| API gateways | Logical auth/validation/throttling boundary in app; dedicated gateway only for ICT policy or measured needs |
| CI/CD | Extend existing CI; staged migrations, contract tests, staging ERP UAT, controlled deployment |
| Docker | Optional deployment packaging if the agreed government/self-hosted target needs it; not an API prerequisite |
| Kubernetes | Defer; no demonstrated orchestration requirement |
| Service discovery | Stable configured API/DB addresses; no service mesh/discovery system |
| Circuit breakers | ERP collector may use one after repeated failures; our pull API has no outbound ERP dependency to wrap |
| Timeouts | Bound API, DB, and collector work; rollback timed-out transactions |
| Retries | At-least-once collection and idempotent mutations; client-owned transient retry policy |
| Exponential backoff | Capped backoff with jitter and Retry-After support |
| Idempotency | Essential at HR submission, ERP import, ACK, and decision boundaries |
| Message queues | Postgres outbox is the durable handoff queue; no separate broker initially |
| Pub/Sub | Defer; one known consuming integration |
| Event-driven architecture | Persist the HR-submitted event/snapshot and consume by polling; no microservice split |
| Distributed transactions | Avoid cross-system transactions; local atomic transactions plus acknowledgements and reconciliation |
| Saga pattern | Defer; no current multi-service compensating workflow. Add explicit correction workflows only if required |

The outbox/consumer approach follows the publisher/consumer split described by Microsoft's [Idempotent Consumer guidance](https://learn.microsoft.com/nb-no/azure/architecture/patterns/idempotent-consumer). Background retry guidance uses [capped exponential backoff with jitter](https://learn.microsoft.com/en-us/azure/architecture/best-practices/transient-faults). These references support the patterns, not a requirement to adopt Azure infrastructure.

## 10. Delivery phases and review gates

### Phase 1 — contract and product agreement

Deliver revised PRD, decision records, draft OpenAPI, representative multi-traveler JSON, lifecycle/HR/admin screen sketches, data classification, and ERP responsibility checklist. Settle collection/ACK identity and outcome-channel scope before production implementation depends on them.

### Phase 2 — integrity foundation

Deliver migrations, guarded atomic HR submission, audit integrity, revision checks, financial precision validation, approval-source enforcement, and compatibility handling for legacy requests. Gate: failure injection and concurrency tests prove no partial submission or duplicate export.

### Phase 3 — machine API and durable collection

Deliver scoped authentication, rotation/revocation, throttling, list/detail/ACK, replay protection, operational holds/errors, reconciliation reads, API-specific proxy handling, and contract documentation. Gate: simulated ERP collector survives crashes, duplicate reads/ACKs, invalid credentials, late commits, and outages without losing work.

### Phase 4 — product and operational readiness

Deliver truthful status UX, accessible timelines, admin integration view, secure credential workflow, alarms, runbooks, and copy/print fallback with reconciliation procedure. Gate: HR can distinguish saved, collected, awaiting decision, and needs-attention without developer interpretation.

### Phase 5 — outcome integration, if ERP supports it

Deliver external decision endpoint, provenance, rejection/resubmission behavior, stale-event handling, and staff outcome visibility. If callbacks are unavailable, document and train an authorized manual recording process with evidence; label it as manual and do not advertise automatic outcome synchronization.

### Phase 6 — staging, pilot, and controlled release

Run joint ERP sandbox UAT, volume/latency tests at an agreed multiple of expected peak, credential rotation, outage and restore drills, and a limited HR pilot. Reconcile existing pending requests and designate their approval source before cutover. Enable new ERP routing through a feature flag after review of evidence.

Rollback stops NEW ERP exports. Previously exported requests remain ERP-owned, including unacknowledged exports that might already have been collected. Preserve their API/receipt processing until reconciled. Do not turn local MD approval back on for them.

No calendar estimate is committed before ERP sandbox access, hosting constraints, contract scope, and existing data quality are known.

## 11. Definition of done

- Complete HR-to-ERP-to-outcome demonstration where the outcome channel is supported.
- Failure at any HR write leaves all financial/state/audit/export records unchanged; stale/concurrent review cannot publish a second snapshot.
- Policy changes after submission do not modify any exported amount. Traveler totals, component totals, and request total reconcile exactly.
- Missing ERP mapping, unmapped grades, wrong currency, invalid dates, and inconsistent amounts block export with clear remediation.
- GET never removes work. Collector failures, out-of-order commits, expired cursors, and more than one page of backlog recover through repeated full sweeps.
- ERP upserts by export ID. Repeated collection/ACK/decision creates no duplicate workflow or outcome; conflicting replays fail visibly.
- No local approval path, including direct database API access, can change an ERP-owned final approval.
- Scope isolation, revoked keys, malformed/oversized input, rate limits, and unavailable auth/DB dependencies behave as specified.
- External actor provenance is truthful; unauthorized staff cannot view another request's breakdown through UI or API.
- CI runs lint/build plus meaningful calculator, state-machine, API contract, RLS, transaction rollback, and concurrency tests against an isolated test database. CI uses synthetic data and no production credentials.
- Accessibility and HR usability checks pass; operational states do not rely on color alone.
- Published OpenAPI, sandbox examples/Postman collection, credential-rotation instructions, deployment/rollback runbook, support ownership, and restore/reconciliation procedure are reviewed by both teams.
- Production targets are agreed and measured: polling freshness, API latency/availability, stale queue threshold, outcome timeliness, recovery and retention. Candidate starting targets are collection within two minutes under normal conditions with a one-minute poll, a warning after five minutes without expected collection, and API p95 below one second under agreed load; these are proposals, not guarantees.

## 12. Approval scope

Approve the phased plan and the default pull/outbox architecture before implementation begins. Remaining ERP contract questions should be resolved through the reviewable draft and sandbox tests. No application code, database migration, deployment, or external message has been performed as part of this planning exercise.
