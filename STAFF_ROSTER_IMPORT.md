# Staff roster import

The Admin staff screen accepts a Google Sheets export in CSV format. The browser previews and validates every row before the server writes anything.

Apply `supabase/migrations/20261028000000_staff_employment_cadre.sql` before importing so the employment `cadre` column exists.

## Export from Google Sheets

In Google Sheets, use **File → Download → Comma-separated values (.csv)** and upload the downloaded file under **Admin → Staff Management → Bulk Import**.

The minimum columns are:

```csv
email,designation
ada.okafor@nigcomsat.gov.ng,Manager
```

The recommended roster includes the complete trusted profile:

```csv
first_name,surname,email,role,department,level,cadre,designation,erp_employee_number
Ada,Okafor,ada.okafor@nigcomsat.gov.ng,staff,Engineering,Manager,Engineering,Manager,BC-001
```

The nominal roll has two separate fields. `cadre` is the employment category, such as Engineer or Finance, and is stored on `staff.cadre`. `designation` is the rank, such as Manager or Officer II; it must match one of the configured Designations and is stored through `staff.designation_id`, which is what the DTA calculator uses to resolve the grade band. An unknown designation is rejected before import.

`role` defaults to `staff` when blank. Department, level, names, and the Business Central employee number may be blank; if supplied, department and level must match configured values. Missing names should be completed by an administrator before the person is used as an HR memo author, because the final memo uses the trusted name and designation from the staff record.

## Account behavior

For each valid row, the server:

1. Normalizes the email to lowercase.
2. Creates a Supabase Auth account with that email if one does not exist.
3. Creates or repairs the matching `staff` row.
4. Marks the Auth email confirmed because access uses the application's one-time email code flow.

The import is idempotent by email. Re-uploading a corrected sheet repairs the matching staff row rather than creating a second account. A duplicate email within one file is rejected in the preview. No password is created or shared; staff sign in with a six-digit code sent to their official email.

The import does not grant HR, MD, or Admin privileges unless the sheet explicitly contains that role. The admin should review the preview and the result report before asking staff to sign in.
