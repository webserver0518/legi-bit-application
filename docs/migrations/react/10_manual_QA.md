# Manual QA checklist for React SPA migration

This checklist validates the React SPA against the legacy Flask experience using the same cookie-based session and MFA flows. All browser fetches must rely on the reverse proxy so that `/login`, `/logout`, `/auth/**`, and `/api/**` share the same origin—no CORS is expected when testing.

## Auth and MFA
- Navigate to `/login` and submit valid credentials to the `/login` POST endpoint (FormData) with `credentials: 'include'`. Expect a Hebrew success message such as "שם משתמש וסיסמה תקינים" and redirect to `/app/dashboard`.
- Submit an invalid password; verify `/login` returns an error message in Hebrew (e.g., "פרטי ההתחברות אינם נכונים") and the UI shows it inline.
- Trigger MFA-required users: first submit username/password to `/login`; when the ResponseManager payload includes `require_mfa`, render the MFA step and resubmit `/login` with `mfa_code` included. Ensure wrong codes show "קוד MFA שגוי" and correct codes reach the dashboard.
- Confirm session persistence by reloading `/app/dashboard` and letting `<RequireAuth>` call the session helper (placeholder `/auth/session` until the endpoint exists). Unauthenticated state should redirect to `/login`.
- Test `/logout` via the proxy to clear the session and redirect to the public area.

## Dashboard (user/admin)
- Load `/app/dashboard` for a regular user. Verify calls to `/get_office_name`, `/get_username`, `/get_office_cases`, `/get_office_clients`, `/get_office_files` succeed and counts/cards match legacy Hebrew labels.
- For admin users, visit `/app/admin` dashboard and check `/base_admin_dashboard` (or equivalent) returns expected stats. Confirm recent lists render without jQuery and maintain RTL.
- Validate loading/empty/error states display Hebrew text and RTL alignment.

## Cases
- Navigate to `/app/cases` to list cases via `/get_office_cases` (or filtered variants). Table headers and buttons should use legacy Hebrew labels; sorting and search should work client-side without DataTables.
- Open a case from the list to call `/get_case` and render details, including clients/files/status history. Errors should surface via ResponseManager messages.
- Create a new case through `/create_new_case` using a populated form with required fields (`office_serial`, `case_category`, etc.). On success, verify the new record appears in the list.
- Edit an existing case via `/update_case` and change status with `/update_case_status`; ensure Hebrew confirmations and inline validation errors show.
- Delete a case with `/delete_case`; confirm success message and list refresh.
- Check metadata endpoints `/get_case_categories` and `/get_case_statuses` populate selectors.

## Clients
- Visit `/app/clients` and load data from `/get_office_clients`; confirm columns/labels render in Hebrew with RTL tables.
- Create a client through `/create_new_client` and validate required fields (name, phone/email format). Error messages from ResponseManager should display inline.
- Edit an existing client with `/update_client` and verify changes appear in the list/detail page.
- When creating/editing cases, confirm client selection uses `clients_with_roles` data if exposed by the backend.

## Files and uploads
- Open `/app/files` to list office files via `/get_office_files`. Empty states and errors should be Hebrew/RTL.
- Upload a file from the files workspace or a case context:
  - Request presigned POST data from `/presign/post` and ensure the S3 key follows `uploads/{office_serial}/{case_serial}/{file_serial}-{file_name}` (note backend currently uses a nested path; document discrepancies).
  - Upload the file using the provided fields and then call `/create_new_file` to register metadata. Show progress, success, or failure messages in Hebrew.
- Update file metadata with `/update_file` and delete via `/delete_file`.
- Retrieve a presigned GET URL from `/get_file_url` and confirm downloads/preview work.

## Admin and office management
- As an admin, visit `/app/admin/users` and load roles from `/get_roles_list`.
- Add/edit/delete users through `/manage_user` (FormData) and confirm responses show Hebrew success/error messages.
- Verify office context helpers `/get_office_name` and `/get_office_serial` are used where needed in admin/office settings screens.

## RTL and layout
- Throughout the SPA, confirm `<html dir="rtl" lang="he">` context or container-level RTL classes keep text and controls right-aligned.
- Ensure Bootstrap RTL styles are loaded and Hebrew copy is preserved across buttons, headings, alerts, and placeholders.

## Error states and network handling
- Simulate network failure or 500 responses on key endpoints (e.g., `/login`, `/get_office_cases`, `/presign/post`); ensure the API client surfaces ResponseManager `message`/`error` fields and the UI shows Hebrew alerts without crashing.
- Verify unauthorized (401) responses redirect to `/login` via `<RequireAuth>`.

## Performance and smoke checks
- After building the SPA, confirm Nginx serves the React static assets with gzip enabled and `try_files $uri /index.html;` supports deep links.
- Perform basic navigation between routes to ensure no jank, console errors, or missing credentialed fetches (`credentials: 'include'` should be set on all API calls).
