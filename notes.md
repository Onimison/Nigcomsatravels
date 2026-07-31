
NIGCOMSAT TRAVEL REQUEST TOOL — PRODUCT REVIEW DOCUMENT (FINAL)




1. Executive Summary

This document replaces the manual HR → MD travel request process with a self-service web tool. Staff submit requests, HR reviews and applies company policy (allowances), and MD provides final approval. The system handles resubmissions, maintains full audit history, and provides role-based dashboards for Staff, HR, MD, and System Admin.

Key Principles:
- Single Auth Mechanism: Passwordless OTP for everyone.
- Immutable History: Rejected requests are never edited; resubmissions create new linked records.
- Role-Based Views: Strict database-level security (RLS) ensures users only see what they should.
- Admin-First:System configuration (staff, rates, levels) is managed via UI, not database.


2. Authentication & Access Control

2.1 Login Mechanism (All Users)
- Mechanism:6-digit numeric OTP sent to the user's official email.
- Why OTP over Magic Link/Passwords: Plain-text codes pass spam filters faster and work reliably when emails are opened on a different device than the one initiating login. Also, staffs/users do not need to remember passwords.
- Implementation: Supabase `signInWithOtp()` with a custom email template configured to send a numeric code. Verification via `verifyOtp()` with `type='email'`.
- Session: Expires after 8 hours of inactivity.
- Logout: Mandatory logout button; no persistent "remember me" for shared office devices.

  2.2 Role Detection & Enforcement
- Roles are stored in the `staff` table: `staff`, `hr`, `md`, `admin`.
- On login, the system reads the role and routes the user to their specific dashboard.
- Database Security: Supabase RLS policies enforce that:
  - Staff see only their own requests.
  - HR sees all requests in the review pipeline.
  - MD sees pending approvals and approved history.
  - Admin sees all data for management purposes.


 2.3 Account Status
- Login checks `staff.active = true`. Deactivated staff (offboarded) cannot log in, even if their email exists.
- Every login attempt (success and failure) is logged to `auth_audit_log` for security auditing.

---

 3. Role-Based Dashboards

3.1 Staff Dashboard
Primary Action: Request to Travel (Fields 1–7 + Reason for Travel)

Key Features:
- Pre-Submit Estimate:** Before submitting, the system queries `rate_reference` and displays a non-binding estimate labeled *"Subject to HR verification."* If no rate exists, shows *"No reference rate found; HR will compute manually."*

- **Date-Overlap Warning:** If new travel dates overlap with any existing `pending_hr`, `pending_md`, or `approved` request, the system displays: *"Warning: This trip overlaps with your existing request to [Destination] ([Dates]). Please confirm this is intentional."* (Warning only; submission is not blocked.)
- **Pending Requests (List View):** Displays all requests where status is `pending_hr` or `pending_md`, with friendly status labels mapped directly to the backend enum.
  - *"Awaiting HR Review"*
  - *"Awaiting MD Approval"*
  - *"Returned by HR for Revision"* (if `hr_rejected`)
  - *"Returned by MD for Revision"* (if `md_rejected`)
  - *"Rejected (Final)"*
  - *"Approved"*
- **Travel History:** Groups requests by `travel_group_id` to show the full lifecycle of a trip (e.g., Request → Rejected → Resubmitted → Approved) as one visual story.
- **Ongoing Trip:** Auto-computed view (no manual field) showing any `approved` request where today's date falls between departure and return dates.

---

### 3.2 HR Dashboard
**Primary Action:** Review Requests (Status = `pending_hr`)

**Key Features:**
- **Review Screen:** Displays staff details, destination, days, and the staff's original `reason_for_travel` (for context).
- **"Suggest Standard Rates" Button:** Auto-populates fields 8–12 (Allowance for Local Running, Flight, Airport Taxi, Accommodation, Per Diem) from the `rate_reference` table based on the destination and level. HR clicks "Confirm" to accept or manually overrides (overrides are logged to `rate_overrides`).
- **Live Total:** Updates in real-time as HR adjusts numbers.
- **Overlap Flag:** Shows if the staff has overlapping approved trips elsewhere (same warning as staff sees).
- **Resubmission Context:** If reviewing a request from a `travel_group_id` with a previous version, the prior rejection reason is displayed prominently so HR doesn't review blind.
- **Actions:**
  - **Approve:** Forwards to MD. Optional recommendation/note field.
  - **Reject:** Requires mandatory text reason (stored and shown to staff). If rejection is marked **"Final,"** the request cannot be resubmitted.

---

### 3.3 MD Dashboard (Final Approval Authority)
**Primary Action:** Approve or Reject Requests (Status = `pending_md`)

**Key Features:**
- **Queue Sorting/Filtering:**
  - Sort by: *Total Cost (High to Low)*, *Earliest Departure*, *Department*.
  - Filter by: *Department*, *Destination*.
- **Review Screen:** Displays:
  - Full Cost Breakdown (Fields 8–12).
  - Applied Level Coverage Percentage.
  - Final Total Cost.
  - Staff's Original Reason for Travel.
  - HR's Recommendation/Note (side-by-side with staff reason).
- **Budget Awareness:** (Deferred to v1.5) Future enhancement: Department YTD spend warning.
- **Actions:**
  - **Approve:** Final approval. Request becomes `approved`.
  - **Reject:** **Mandatory text reason required** (enforced at database level, not just UI). If marked **"Final,"** resubmission is blocked. If not final, staff can resubmit.
- **History:** Full view of past approvals with cost snapshots.

---

### 3.4 System Admin Dashboard (NEW — v1 Requirement)
**Access:** Role = `admin` (assigned to HR Head or IT lead).

**Why This Is v1, Not v2:** Without this UI, the development team becomes the bottleneck for every new hire, policy change, or rate update. The tool cannot be handed off to HR/IT if they cannot maintain it themselves.

**Features:**
- **Staff Management:** Add, edit, deactivate staff (Name, Email, Role, Department, Level).
- **Level Configuration:** Edit `coverage_percent` and `flight_class` mapping per level (solves the policy document blocker without code deployment).
- **Rate Management:**
  - View and edit `rate_reference` (Master Rate Table).
  - View `rate_overrides` log (HR manual entries).
  - **One-Click "Promote to Master Rate":** Promotes a specific override from `rate_overrides` to `rate_reference`.
  - View AI `rate_suggestions` (if agent is active).
- **Department Management:** Add/Edit Departments and set optional Annual Budget Ceilings (for future budget warnings).
- **FX Rate Override:** Manual override for daily exchange rate (system uses this for new international requests).

---

## 4. Data Model Summary

| Table | Key Fields | Purpose |
| :--- | :--- | :--- |
| `staff` | `id` (UUID), `email`, `first_name`, `surname`, `role`, `department_id`, `level_id`, `active` | Master user list. Managed via Admin UI. |
| `levels` | `id`, `name`, `coverage_percent`, `flight_class` | Policy config. Admin-editable. |
| `departments` | `id`, `name`, `annual_budget_ceiling` | Cost centers. Admin-editable. |
| `rate_reference` | `id`, `destination`, `level_id`, `mode`, `accommodation_rate`, `per_diem_rate`, `flight_estimate`, `airport_taxi` | Master rates. Admin-promoted only. |
| `rate_overrides` | `id`, `request_id`, `field_name`, `overridden_value`, `hr_staff_id`, `timestamp` | Audit trail for HR manual entries. Never auto-promoted. |
| `rate_suggestions` | `id`, `destination`, `suggested_rate`, `source`, `status` | AI agent write-target. Read-only for agent. |
| `travel_requests` | `id`, `travel_group_id` (UUID), `previous_version_id` (UUID), `staff_id`, `destination`, `origin`, `mode`, `days`, `reason_for_travel`, <br> `allowance_local`, `allowance_flight`, `allowance_taxi`, `accommodation`, `per_diem`, `total_cost`, `final_cost`, `status` (enum), `locked_fx_rate`, `submitted_at`, `depart_date`, `return_date` | Main transactional table. `travel_group_id` links all resubmissions. |
| `approvals` | `id`, `request_id`, `approver_id`, `status` (approved/rejected), `reason`, `is_final`, `timestamp` | Audit trail of every approval/rejection action. |
| `auth_audit_log` | `id`, `email`, `success`, `timestamp`, `ip_address` | Security log of all login attempts. |

**Key Design Choice: `travel_group_id` vs `parent_request_id`**
- `travel_group_id` (UUID) is generated on the very first submission and copied to every resubmission.
- `previous_version_id` points to the immediate predecessor for "diff" comparisons.
- **Querying History:** `SELECT * FROM travel_requests WHERE group_id = 'X' ORDER BY created_at ASC` — no recursive CTEs needed.

**Status Enum (Explicit, Mapped to UI Friendly Labels):**
- `pending_hr` → "Awaiting HR Review"
- `pending_md` → "Awaiting MD Approval"
- `hr_rejected` → "Returned by HR for Revision"
- `md_rejected` → "Returned by MD for Revision"
- `rejected_final` → "Rejected (Final)"
- `approved` → "Approved"

*Note: `draft` and `completed` are explicitly excluded from v1. Draft state was ruled out earlier; completed belongs to the deferred retirement/receipts feature.*

---

## 5. Critical Business Rules

### 5.1 Cost Calculation
- `Total_Raw_Allowance` = `allowance_local` + `allowance_flight` + `allowance_taxi` + `accommodation` + `per_diem`
- `Final_Cost` = `Total_Raw_Allowance` × (`levels.coverage_percent` / 100)
- **Key:** The Admin UI holds `coverage_percent`. The code is completely agnostic to policy direction—it just multiplies. If the policy says "GM gets 75%," HR sets that number in the Admin UI.

### 5.2 FX Handling (International Travel)
- Costs entered and stored in **USD**.
- Displayed with **NGN equivalent** using a daily rate.
- **Locking:** At HR finalization, the system fetches the current FX rate from a configurable source and writes it to the specific `travel_requests.locked_fx_rate` row. Later rate fluctuations do not retroactively change approved requests.

### 5.3 Resubmission & Immutability
- **Rule:** Rejected requests are immutable. No edits.
- **Resubmission:** Staff clicks "Resubmit" on a rejected request.
  - System creates a new row.
  - New row copies `travel_group_id` from the rejected parent.
  - New row sets `previous_version_id` = rejected row's `id`.
  - New row starts with `status = 'pending_hr'`.
- **Diff View (Deferred to v1.5):** Future enhancement to highlight what changed between versions.

### 5.4 Mandatory Rejection Reason (Enforced)
- The `approvals.reason` field is **NOT NULL** when `status = 'rejected'`.
- **Database Constraint:** `CHECK (status != 'rejected' OR reason IS NOT NULL)`
- This ensures HR and MD *must* provide a reason, preventing staff from receiving a rejection with no context.

---

## 6. Reporting & Audit

### 6.1 Finance Reporting
- **Query Target:** Normal indexed queries (materialized view deferred to v1.5; 250 staff doesn't require it yet).
- **Filters:** Department, Level, Date Range, Destination, Status.
- **Breakdown:** Costs itemized by the 5 allowance categories (not just a lump sum).

### 6.2 Audit Trail
- **`auth_audit_log`:** Tracks all login attempts (success/failure).
- **`rate_overrides`:** Tracks every HR manual change to allowances.
- **`approvals`:** Tracks who approved/rejected and when, including rejection reasons.
- **`travel_requests`:** `created_at` and `updated_at` timestamps track lifecycle.

*Note: "Who viewed this request" audit log is deferred to v1.5; nobody requested it, and it adds complexity without immediate value.*

---

## 7. Security & RLS Policies

### 7.1 Row-Level Security (Supabase)
*These MUST be applied to the `travel_requests` table immediately. No frontend filtering allowed.*

```sql
-- Helper function to get app role from staff table
CREATE FUNCTION current_staff_role()
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
  SELECT role FROM staff WHERE id = auth.uid();
$$;

-- Staff: See only their own requests
CREATE POLICY staff_see_own ON travel_requests
  FOR SELECT USING (auth.uid() = staff_id);

-- HR: See all requests except approved (unless for reporting)
CREATE POLICY hr_read_all ON travel_requests
  FOR SELECT USING (current_staff_role() = 'hr');

CREATE POLICY hr_update_allowances ON travel_requests
  FOR UPDATE USING (current_staff_role() = 'hr')
  WITH CHECK (status = 'pending_hr');

-- MD: See pending approvals and their own history (including rejections)
CREATE POLICY md_read_pending_and_history ON travel_requests
  FOR SELECT USING (
    current_staff_role() = 'md' 
    AND status IN ('pending_md', 'approved', 'md_rejected', 'rejected_final')
  );

CREATE POLICY md_update_status ON travel_requests
  FOR UPDATE USING (current_staff_role() = 'md')
  WITH CHECK (status IN ('pending_md', 'approved', 'md_rejected'));

-- Admin: Full access
CREATE POLICY admin_all ON travel_requests
  FOR ALL USING (current_staff_role() = 'admin');
```

### 7.2 Environment Separation
- Separate Supabase projects (or clearly separated schemas) for development vs. production.
- API keys and service role keys **never** committed to the repository.
- Code review required before merging to main branch (lightweight; just second pair of eyes).

---

## 8. Build Order (Sprints)

*Assign these in order to prevent merge conflicts and logical gaps:*

| Sprint | Focus | Deliverable |
| :--- | :--- | :--- |
| **0** | Foundation | Supabase setup, RLS policies, Admin UI (Staff/Levels/Rates/Depts CRUD) |
| **1** | Auth + Staff Dashboard | OTP login, Request Form, Estimate, Overlap Warning, History |
| **2** | HR Dashboard | Review, Rate Suggestions, Reject/Forward with travel_group_id |
| **3** | MD Dashboard | Review, Budget Awareness (v1.5 placeholder), Approve/Reject with mandatory reason |
| **4** | Reporting & Audit | Filters, Breakdown, Audit Logs |
| **5** | (Optional) AI Agent | Writes only to `rate_suggestions`; never to master tables |

---

## 9. Open Questions (Resolved)

| Question | Answer |
| :--- | :--- |
| Can a staff member have more than one active request at a time? | **Yes.** Pending requests is a list view. |
| Does the MD dashboard include cost figures? | **Yes.** Full breakdown, coverage percentage, and final total shown. |
| Should HR/MD use the same passwordless login as staff? | **Yes.** One auth mechanism for everyone. |
| Should both staff reason and HR note be visible to MD? | **Yes.** Side-by-side, neither supersedes the other. |

---

## 10. Deferred to v1.5 (Not Abandoned)

The following are explicitly deferred to avoid scope creep:

- **Diff View (Resubmission Changes):** Highlighting what changed between rejected request and resubmission. Useful but not critical for launch.



---


