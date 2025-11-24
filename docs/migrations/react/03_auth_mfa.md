# React SPA – API client contract and MFA login flow

## Contract for SPA API calls
- All fetches go through `src/api/apiClient.js`, which applies `credentials: 'include'` and expects a ResponseManager payload shaped like `{ data, error, message, status, success }`.
- Helpers are exposed for `get`, `post`, `patch`, and `delete` (alias `del`), all parsing the ResponseManager response and throwing a standardized `ApiError` with `status` and `payload` when `success` is false.
- JSON requests add `Content-Type: application/json` automatically, while `FormData` (e.g., the `/login` flow) is sent without forcing headers so boundary metadata stays correct.

## `/login` behavior and MFA stages
- The Flask endpoint at `flask/app/routes/site.py` handles POST-only login via form fields `username`, `password`, and optional `mfa_code` (6 digits). On invalid credentials it returns `ResponseManager.unauthorized` with an error message; on MFA-enabled users without a code it returns `{ success: true, data: { require_mfa: true } }`; with a valid code it returns `{ success: true, data: { redirect: '/dashboard' } }` and sets cookies.
- The SPA uses `authApi.login()` to POST the same endpoint twice when needed: first with username/password, then (if `require_mfa` is present) with the same credentials plus `mfa_code`. All requests rely on existing cookies set by Flask/Nginx, not tokens.
- Successful logins redirect users to `/app/dashboard` (or the `redirect` value from the backend). Backend messages like “קוד MFA שגוי” are surfaced directly in the UI.

## Session placeholder
- The current code still references a placeholder session check at `/auth/session` (see `src/api/authApi.js` and `<RequireAuth />`). The backend does not yet expose this helper; once added, it should return a ResponseManager payload so the guard can continue to function without further SPA changes.

## UI expectations
- Login UI preserves Hebrew copy, RTL layout, and distinguishes between the credential stage and the MFA stage. Errors and info messages are shown inline, and loading states are accessible with spinners and ARIA roles.
