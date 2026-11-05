# Demo readiness review

Reviewed on 5 November 2026 by two independent senior engineering perspectives:

- A staff/principal engineer focused on workflow correctness, error handling, and the DTA-to-memo path.
- A principal engineer focused on security, data integrity, PDF output, and management-demo risks.

Both reviewers challenged the first-pass recommendations before changes were made. The review treats the current product as a standalone tool that prepares an HR costing for entry into the ERP. A Business Central sandbox is not available, so no claim is made that the live ERP connector has been verified.

## Address and memo output

The memo renderer now uses the approved company address:

`NIGERIAN COMMUNICATIONS SATELLITE LIMITED, Olusegun Obasanjo Space Centre, Umar Musa Yar'Adua Expressway, Lugbe, Abuja`

The template revision is now `NIGCOMSAT-HR-TRAVEL-v3`. Existing finalized exports remain immutable and retain the address that was stored when they were created. Create a fresh controlled request for the demo so the new address appears in the copied body, JSON, and PDF.

The PDF and finalized-costing page now say that the document is prepared for ERP entry and that MD/CEO approval remains in the ERP workflow. They do not claim that Business Central has already processed the approval.

## Issues fixed before the demo

- Staff, HR, and MD data-load failures no longer present as empty queues or misleading zero counts.
- A missing manual-handoff migration or failed handoff read is shown clearly while PDF and copy/paste export remain available.
- Clipboard permission failures on the HR review screen show a visible recovery message.
- Blank, negative, or non-numeric transport and airport-taxi values block HR finalization instead of becoming zero.
- Staff-band lookup failures and missing selected staff records block request creation explicitly.
- Failed traveller inserts now check whether compensation succeeded and log the cleanup failure for Admin follow-up.
- Unit tests cover DTA arithmetic, unmapped travellers, memo rendering, the approved address, and the template revision.

## Remaining operational gates

These are flagged for the next environment/integration phase rather than hidden from the demo:

1. Move request and traveller writes into one database transaction/RPC before production. The current compensation path is explicit but still has a failure window.
2. Apply and verify the standalone finalization and manual-handoff migrations in the target Supabase project.
3. Create a controlled fresh demo request after the migration check and verify the PDF, copied body, and immutable export payload together.
4. Obtain a Business Central sandbox before enabling or describing API delivery and approval-outcome synchronization.
5. Improve the PDF layout to match the paper ERP memo more closely, including the real header and a table, before operational rollout.
6. Add stable user-facing error messages with server-side correlation logging and application-level OTP throttling before external rollout.

## Recommended demo sequence

1. Sign in as a staff member whose department and DTA designation are populated.
2. Enter the approved HOD memo number and show the staff-side DTA estimate.
3. Submit the request and open it from the HR queue.
4. Adjust only transport or airport taxi if needed; show that DTA and local running remain policy-derived.
5. Finalize the costing using the logged-in HR staff member's name and organizational title.
6. Open the finalized costing page and demonstrate the new address, memo body copy action, JSON export, and PDF download.
7. Explain that the current handoff is prepared for manual ERP entry and that MD/CEO approval remains in the ERP workflow until the Business Central sandbox is available.
