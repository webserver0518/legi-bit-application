# Router, Layouts, and Auth Guard

## Goals
- Introduce React Router v6 with public and protected sections.
- Provide RTL-friendly layouts and stub pages for main areas.
- Add a credentials-including API client and auth session guard.

## Routing Structure
- `/` → Public layout with welcome page (RTL) and link to login.
- `/login` → Public layout with login placeholder copy.
- `/app/*` → Protected area wrapped in `<RequireAuth>`, using `AppLayout` for navigation.
  - `/app/dashboard` (also the index for `/app`)
  - `/app/cases`
  - `/app/clients`
  - `/app/files`
  - `/app/admin/*`
- `*` → 404 page with quick links back to home or dashboard.

## Auth Guard
- `<RequireAuth>` calls `authApi.getSession()` on mount and waits for a ResponseManager payload `{ data, error, message, status, success }`.
- While loading, a Hebrew/RTL spinner is shown; on failure it redirects to `/login` preserving the requested location.
- All fetches are performed with `credentials: "include"` so cookies are forwarded via the Nginx proxy.

### Session Endpoint Note
- The Flask routes currently have no read-only session endpoint under `flask/app/routes/`.
- `authApi.getSession()` points to `/auth/session` as a **placeholder**; when a minimal helper is added later, update the path without altering business logic.

## API Client
- `src/api/apiClient.js` wraps `fetch` with `credentials: "include"`, JSON parsing, ResponseManager field extraction, and standardized error throwing when `success` is false.
- `src/api/authApi.js` exposes `getSession()` for `<RequireAuth>`.

## Layouts and Pages
- `PublicLayout` and `AppLayout` apply RTL containers, Hebrew labels, and navigation links to the protected pages.
- Stub pages exist for dashboard, cases, clients, files, and admin to anchor future development.
