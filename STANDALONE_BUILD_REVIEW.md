# Standalone Travel Costing Build Review

**Review scope:** standalone HR travel-costing workflow with downloadable PDF and copy/paste output, while preserving a safe path to Dynamics 365 Business Central integration.

**Review panel:** architecture, product/design, and reliability/security perspectives from senior staff/principal engineering review.

## Decision

Build the first release as a standalone HR costing application. HR finalizes the DTA calculation in the travel tool, then downloads a Memo Report PDF or copies the memo fields into Business Central. Business Central remains the authority for the official costing-memo number, MD/CEO workflow, and final decision.

Keep the existing JSON export contract and API boundary, but make API delivery an explicit later channel. A manually prepared PDF must never be silently picked up by the Business Central collector.

## The key boundary

The product must separate these facts:

1. **Costing finalized:** HR verified the calculation, memo wording, identity, and supporting data.
2. **Document generated:** the system produced a PDF or copyable memo representation from that finalized record.
3. **Manual ERP entry recorded:** an authorized user recorded the Business Central memo/workflow reference.
4. **ERP receipt acknowledged:** Business Central confirmed durable automated import.
5. **MD/CEO decision recorded:** the final decision was verified from Business Central.

Downloading, printing, copying, or generating JSON does not prove that the memo was entered in Business Central or approved by the MD/CEO.

## Findings in the current implementation

The current Phase 0 review action is coupled to ERP delivery in several places:

- it requires every traveller to have a Business Central employee number;
- it creates a pending ERP export as part of HR submission;
- it labels the action “Forward to MD”;
- the review card can copy or print editable browser values before HR finalizes the review;
- the current copy output contains a short total breakdown, not the complete memo subject, description, line items, sign-off, and identity;
- the memo renderer includes statements such as a CEO directive and approval-history wording that must be confirmed as factual before they appear in a final document.

These are suitable for an ERP-first flow but would make a standalone release depend on unfinished Business Central mappings. They must be separated before the PDF/copy workflow is released.

## Target model

### Canonical finalized costing

Create one immutable finalized costing snapshot containing:

- source HOD memo number;
- request and revision identifiers;
- origin, destination, dates, trip type, travel mode, reason, and inclusive days;
- policy snapshot and DTA coverage percentage;
- each traveller’s trusted name, designation, grade band, DTA rate, DTA amount, transport, local running, airport taxi, and total;
- HR adjustments and reasons;
- total in NGN;
- HR author name, office email, organizational title, and authorization timestamp;
- memo subject, body, line items, and template version;
- payload hash and finalized timestamp.

The finalization transaction must write the reviewed amounts, overrides, HR approval, audit record, and immutable snapshot together. A repeated click or retry returns the existing finalized revision. A correction creates a superseding revision with a reason; it never silently edits old evidence.

Business Central employee numbers are nullable in this canonical record. They become required only when a finalized costing is explicitly enrolled for API delivery.

### Delivery envelope

Keep delivery metadata separate from the costing itself:

- `delivery_mode`: `manual` or `business_central_api`;
- delivery state: `ready_for_manual_entry`, `manual_entry_recorded`, `api_pending`, `api_acknowledged`, `needs_reconciliation`;
- Business Central company, costing-memo number, and workflow reference when known;
- provenance of the reference: `self_reported` or `api_acknowledged`;
- delivery actor and timestamp.

Manual records must be excluded from the API collection endpoint. Enrolling an existing manual record for API delivery requires explicit reconciliation so an uncertain manual entry cannot produce a duplicate ERP memo.

### Output channels

The PDF, copied memo text, copied line-item table, screen, and future JSON must render from the same persisted finalized snapshot. They must reconcile exactly.

The PDF should:

- follow the supplied Memo Report layout after HR confirms the final reference format;
- identify the source HOD memo number separately from the future Business Central costing-memo number;
- show the costing ID/revision, currency, finalized date, HR author name/title, DTA lines, transport, local running, taxi, and total;
- state that HR verified the costing and that final approval is handled in Business Central;
- use repeated headers and page numbers for multi-page traveller tables;
- remain a private, authorized document with a stored file hash.

The copy flow should provide separate controls for subject, description/body, and line items. Plain text is the baseline; HTML may be added if Business Central accepts it. Clipboard use is not delivery evidence.

Do not invent an ERP-generated memo number, HOD approver, department, due date, or MD approval. Do not print the template version as a business-facing field unless HR specifically requires it. Remove or make evidence-backed any boilerplate such as a claimed CEO directive.

## Revised product flow

1. Staff submits a request using the approved HOD source memo number.
2. HR reviews the server-calculated DTA and permitted transport/taxi adjustments.
3. HR selects **Finalize costing**. The server validates and locks the reviewed snapshot.
4. The application opens an approved-costing detail page with **Download PDF**, **Copy memo text**, **Copy line items**, and **Download JSON**.
5. The initial delivery state is **Ready for manual entry in Business Central**.
6. After entering the memo in Business Central, HR may record the actual ERP costing-memo number and workflow reference. This is self-reported evidence until an API acknowledgement exists.
7. The application displays **Awaiting MD/CEO decision in Business Central**. It displays an approved or rejected outcome only after a supported callback, poll, or controlled manual reconciliation.

The review screen may show a clearly labelled draft preview, but draft copy/print must not look like an approved memo and must not create a delivery record.

## Applicant costing visibility

The applying staff member must be able to understand the cost of the trip they are requesting.

Before submission, the request form should show a clearly labelled **Estimated costing — subject to HR verification**. It should include:

- inclusive trip days and DTA coverage percentage;
- DTA amount;
- local running amount;
- transport amount;
- airport taxi amount;
- total for the applicant; and
- total for the complete trip when colleagues are included.

After submission, the staff member should see the server-calculated estimate on the request status page. After HR finalizes the review, the same page should show the immutable **HR-approved costing** and the HR adjustment note when one exists. The approved view must be read-only and must never recalculate against current policy rates.

For a group request, the safest default is to show the requester’s own component breakdown and the group total. Individual colleague amounts should be visible only to HR, administrators, or another role explicitly authorized by company policy. The requester can still see which colleagues are on the trip and whether the group total changed.

Use distinct labels so an applicant cannot mistake an estimate for an approved amount:

| Stage | Applicant label |
| --- | --- |
| Request form | Estimated costing — subject to HR verification |
| Submitted, awaiting HR | Estimated costing — awaiting HR verification |
| HR finalized | HR-approved costing — final approval handled in Business Central |
| ERP reference recorded | HR-approved costing — Business Central memo recorded |
| Final ERP decision verified | Business Central final decision recorded |

The applicant must not see HR-only override controls, credential data, internal reconciliation details, or claims that MD/CEO approval has occurred.

## Revised implementation phases

### Phase A — costing and delivery separation

- Add an explicit delivery mode to the finalized artifact/export record.
- Permit standalone finalization without Business Central employee mappings.
- Require employee mappings only when API delivery is selected.
- Make the finalization action atomic and idempotent.
- Rename “Forward to MD” to “Finalize costing”.
- Remove or label pre-finalization copy/print as draft.
- Preserve source memo identity separately from the future ERP costing-memo identity.
- Expose the applicant’s estimate and the finalized applicant-facing costing without exposing HR-only controls or unauthorized colleague amounts.

**Gate:** HR can finalize a complete request while Business Central mappings and network access are unavailable.

### Phase B — approved-costing detail and outputs

- Add a persistent approved-costing detail page.
- Render the PDF from the stored snapshot, not live policy or staff tables.
- Add separate copy controls for subject, body, and line items.
- Add a read-only applicant costing view that renders the persisted snapshot and distinguishes estimates from HR-approved figures.
- Add JSON download from the same snapshot.
- Add private artifact storage, file hash, authorization checks, and retryable document generation.
- Test long names, long notes, multiple travellers, multi-page tables, amount-in-words, and historical downloads.

**Gate:** screen, PDF, copied content, and JSON have identical totals and author identity.

### Phase C — manual ERP handoff

- Add manual handoff recording with the actual Business Central costing-memo number and workflow reference.
- Record actor, timestamp, source memo number, costing revision, and `self_reported` provenance.
- Show “manual entry recorded” separately from “ERP acknowledgement” and “MD decision”.
- Add reconciliation warnings before a finalized manual record can be enrolled for API delivery.

**Gate:** an operator can explain and audit every handoff without claiming that copying or downloading proves ERP receipt.

### Phase D — Business Central API adapter

- Enable only newly selected artifacts for API collection.
- Require Business Central employee mappings at enrollment, not at standalone finalization.
- Reuse the finalized costing ID, revision, payload hash, and source memo number for deduplication.
- Keep manual artifacts out of the collector unless explicitly reconciled.
- Preserve the existing authenticated, rate-limited, no-store GET and idempotent acknowledgement contract.

**Gate:** sandbox tests pass for duplicate polling, lost responses, repeated acknowledgements, conflicting references, ERP downtime, and manual-to-API cutover.

### Phase E — outcome synchronization

- Add an outcome callback or polling adapter only after Business Central confirms that capability.
- Store the integration principal separately from the ERP-reported MD/CEO identity.
- Bind outcomes to source memo, costing revision, export ID, and workflow reference.
- Reject stale, replayed, or wrong-revision outcomes.

**Gate:** approval, return-for-correction, rejection, duplicate, stale, and conflicting-decision scenarios are auditable.

## Infrastructure decisions

The standalone release does not need Kubernetes, service discovery, a message broker, a saga coordinator, or distributed transactions. The existing database transaction, immutable snapshot, authenticated API boundary, rate limiting, retries, timeouts, and reconciliation model are sufficient.

Use private object storage or authenticated streaming for PDFs. Do not put employee or financial details in public URLs, filenames, logs, or QR codes. Use the existing hosting ingress/load balancer rather than adding custom infrastructure.

## Release acceptance criteria

- HR finalization works when ERP mappings and Business Central connectivity are unavailable.
- Duplicate clicks create one finalized revision and one audit event.
- Historical PDFs reproduce the original approved amounts after policy or staff data changes.
- PDF, copied body, copied lines, screen, and JSON reconcile exactly.
- Manual artifacts never enter the API pending queue automatically.
- Manual and API delivery have distinct provenance and status.
- A correction creates a new revision and retains the prior evidence.
- Unauthorized users cannot download or copy the complete costing record.
- PDF generation failure does not roll back the approved costing and can be retried.
- No document claims MD/CEO approval or ERP receipt without corresponding evidence.

## Immediate next build slice

Phase A and the approved-costing output slice are now implemented locally. The existing ERP export tables and hashes remain the durable foundation, with explicit delivery mode. Apply the two new migrations before deploying the updated action and handoff form:

- `20261026000000_standalone_costing_delivery_mode.sql`
- `20261026010000_manual_erp_handoff.sql`

The next production gate is migration verification and a controlled HR request: finalize it, download the PDF, copy the body/line items, record the Business Central reference, and verify that the ERP API collection endpoint does not return the manual artifact.

