# CTO review: Dynamics travel-memo integration

**Status:** Independent review for planning; no implementation approval
**Date:** 19 October 2026
**Review perspective:** Principal CTO architecture review, using a 20+ year enterprise-systems perspective. This is a design review artifact, not a claim about a named individual’s employment history.

## Executive verdict

The earlier plan had the right reliability foundations, but its memo model was ambiguous. The integration must represent two different ERP documents:

1. The **source permission memo** is opened by the staff member in Dynamics for HOD approval. Its memo number is entered into this travel tool after the HOD approves it.
2. The **HR costing memo** is prepared after HR verifies the travel calculation. It references the source memo, contains the calculated DTA, local running, and other approved amounts, includes HR’s note/body, and identifies the HR staff member by their authenticated organizational name and title. Dynamics routes this second memo to the MD/CEO.

The source memo number is the business idempotency key. It must identify one logical travel request and prevent a second active request from being created against the same source memo. An internal `export_id` remains useful as a transport and retry identifier, but it must not replace the source memo number or allow duplicate business requests.

Build the first version on the cloud deployment. Keep the application portable so a later on-premises move is possible, but do not introduce Docker, Kubernetes, service discovery, or an on-premises integration topology before hosting requirements justify them.

## Corrections to the flagged comments

### Comment on the original evidence bullet about local MD approval

The observation is partly right and needs precise wording. The new memo-based MD screen already branches to a read-only component (`PendingCardReadOnly`) and tells the MD that approval happens in ERP. However, the server action `mdApproveReject` still accepts a `pending_md` request based on role and status alone. A caller could therefore reach a legacy mutation path even though the new screen hides the controls. The fix is a server/database authority guard for ERP-owned requests, not a claim that the visible Phase 0 screen currently lets the MD click approve.

### Comment on the original legacy FX display bullet

The earlier statement was overbroad. The legacy `CostBreakdown` component still renders allowance/FX fields for legacy requests, while memo-based requests use `PendingCardReadOnly` and show NGN totals plus per-traveler breakdowns. The task is to preserve that correct new path, complete its frozen costing evidence, and avoid mixing legacy and memo-based fields—not to describe the current memo-based card as an FX display defect.

### Comment about returned-for-revision

Returned-for-revision is not a required interpretation of the two-memo process. The source memo remains the same logical business request. Corrections while HR is still reviewing update the draft before submission. Once a costing memo has been exported, the first release should freeze it. Any post-export correction needs an explicitly agreed ERP amendment/replacement process; it must not silently create another MD-bound costing memo.

## Target business flow

```text
Staff opens source memo in ERP
        ↓
HOD approves source permission memo
        ↓ source_memo_number
Staff enters source memo number and trip details here
        ↓
Server calculates policy amounts; HR reviews/adjusts allowed fields
        ↓ authenticated HR identity + final memo body
Atomic submission creates one frozen HR costing memo export
        ↓
Dynamics imports/upserts by source_memo_number + costing revision/export_id
and creates the HR costing memo linked to the source memo
        ↓
MD/CEO approves the HR costing memo in Dynamics
```

The API must not pretend that it updates the original HOD memo if the real process creates a second HR memo. The receipt must return the ERP-generated costing memo number and workflow reference so both records can be reconciled.

## Identity, idempotency, and authorization

Canonicalize the source memo number only according to rules confirmed by ICT/Dynamics. Preserve the submitted value for display. Do not lowercase, remove punctuation, or discard leading zeros until ERP confirms that those forms are equivalent. Enforce uniqueness on a configured company/legal-entity namespace plus canonical source memo number for every active or reserved logical request, including rejected/cancelled records unless an authorized ERP correction process releases it.

The system should behave as follows:

- Same authenticated requester and same source memo with an unchanged draft may reopen the existing request.
- A second active request for the same source memo returns a conflict and does not reveal another user’s private request details.
- A concurrent pair of submissions can create only one logical request.
- HR retries with the same reviewed revision produce the same frozen export; they do not create another costing memo.
- `export_id` identifies the exact immutable payload for transport retries. It is secondary to the source memo business key.
- A new export revision is blocked after ERP collection until an amendment/replacement contract is agreed. A new internal row must never accidentally create a second MD approval document.

The logged-in office email proves which application account acted. It does not by itself prove the person’s delegated signing authority. The server must obtain the active HR role, full name, and trusted organizational title from the staff/directory record, then snapshot them at submission. Never accept name, title, or authorization claims from the browser. The costing memo should include:

```json
"authorized_by": {
  "staff_id": "internal-uuid",
  "office_email": "hr.staff@nigcomsat.gov.ng",
  "name": "Aisha Example",
  "organizational_title": "Assistant Director, Human Resources",
  "authorized_at": "2026-10-19T10:00:00Z"
}
```

This is an auditable application sign-off. It should not be described as a cryptographic digital signature unless a separate signature system is introduced.

## Costing memo payload

The exact body format remains pending receipt of the current ERP memo template. Add a required body field to the contract, together with a template version and format, but do not invent official wording before HR supplies it. Structured financial fields remain authoritative; the body is checked against them before submission.

`template_version` is metadata for the rendering contract, not a sentence that will appear in the ERP memo. It identifies which approved layout and wording rules produced `body`—for example, `NIGCOMSAT-HR-TRAVEL-v1`. Dynamics may ignore it when displaying the memo, or store it as integration metadata. The rendered `body` is what the HR costing memo shows. When HR supplies the real template, the team should replace the placeholder version and define whether the version is visible in ERP audit metadata, omitted from the memo, or printed as a document revision.

The policy in `notes.md` defines two separate daily components:

- **DTA (Duty Travel Allowance):** daily living allowance based on traveller grade band, destination coverage tier, and inclusive trip days.
- **Local running:** a separate daily allowance for incidental local movement, using its own grade-band rate and the same coverage and day count.

Send `dta_amount` and `local_running_amount` separately and retain those names in the audit trail. Coverage scales DTA and local running only; transport and airport taxi do not use coverage. One-way travel halves transport and taxi, but never DTA or local running. Monday-to-Wednesday is three paid days.

```json
{
  "schema_version": "1.0",
  "export_id": "immutable-export-uuid",
  "source_memo_number": "HOD/2026/00125",
  "source_memo_status": "hod_approved",
  "hr_costing_memo": {
    "erp_memo_number": null,
    "subject": "Travel costing for source memo HOD/2026/00125",
    "body": "<exact approved ERP memo body supplied during contract finalization>",
    "body_format": "plain_text",
    "template_version": "NIGCOMSAT-HR-TRAVEL-v1"
  },
  "authorized_by": {
    "name": "Aisha Example",
    "organizational_title": "Assistant Director, Human Resources",
    "office_email": "hr.staff@nigcomsat.gov.ng"
  },
  "trip": {
    "origin": "Abuja",
    "destination": "Lagos",
    "departure_date": "2026-11-02",
    "return_date": "2026-11-04",
    "days": 3,
    "purpose": "Project inspection"
  },
  "travelers": [],
  "total_amount": "265000.00",
  "currency": "NGN"
}
```

`erp_memo_number` is null before Dynamics creates the HR costing memo and is returned in the acknowledgement. The final schema must define the exact component names, employee identifiers, numeric precision, and whether the body is plain text, rich text, or HTML.

## Required data model changes

Add a source-memo identity/reservation with company scope and canonical value; a costing revision number; approval authority (`local` or `erp`); an immutable export snapshot; HR author name/title/email snapshot; memo body/template version; and a receipt containing the ERP costing memo number, source-memo link, workflow reference, and timestamps. Keep the current `travel_group_id`/`previous_version_id` lineage where it helps internal history, but do not use an internal UUID as the ERP business key.

Use a separate external-decision audit record if Dynamics later sends the MD decision. The existing `approvals.approver_id` foreign key points to local staff and must not be populated with a fabricated local MD account. Store the authenticated integration principal separately from the ERP-reported human decision maker.

## Reliability and security decision

Keep the earlier plan’s atomic HR transaction, Postgres outbox, explicit acknowledgement, scoped credentials, hash-only secret storage, rotation, rate limits, bounded payloads, no-store responses, replay protection, and capped exponential backoff. GET remains read-only. Dynamics acknowledges only after its HR costing memo and workflow link are durably created. Duplicate acknowledgement with the same source/export/workflow identity is safe; a conflicting identity is a visible conflict requiring reconciliation.

Do not use a permanent high-water cursor for collection. Dynamics performs repeatable bounded sweeps of unacknowledged exports, continuing past one bad item. Do not add a message broker, Kubernetes, or a distributed transaction coordinator for this volume and topology. The database transaction ends at our system; cross-system correctness comes from idempotency, acknowledgements, and reconciliation.

## Revised delivery gates

1. Obtain the actual ERP memo template and agree the exact two-memo relationship, source memo lookup, costing memo creation, workflow start, and receipt response.
2. Confirm the source memo uniqueness/canonicalization rules and company/legal-entity namespace.
3. Confirm staff directory fields for legal name and organizational sign-off title; add a controlled title field or authoritative directory mapping if the existing designation is not the memo title.
4. Add the body/template contract and server-side rendering/validation against structured amounts.
5. Implement the source-memo reservation and atomic HR submission. Test two concurrent users, same user retry, a different payload, rejected requests, and database failure at every write boundary.
6. Implement list/detail/acknowledgement APIs and return the ERP-created costing memo number. Test lost responses, duplicate imports, duplicate ACKs, conflicting references, and collector outages.
7. Add ERP authority enforcement in the server and database; retain the legacy local route only for explicitly identified legacy records.
8. Run cloud sandbox UAT. Only after successful cloud operation should on-premises deployment planning begin; document portability requirements and test backup/restore separately.
9. Negotiate decision callbacks or a controlled manual reconciliation process. Do not promise automatic final-status synchronization until one of those paths is proven.

## CTO approval position

The plan is ready to move into contract discovery, not production implementation. Approval to build should be conditional on the ERP template, source/costing memo relationship, staff title source, uniqueness rules, and sandbox workflow being confirmed. Once those are supplied, update the OpenAPI document and JSON examples before writing migrations or routes.

