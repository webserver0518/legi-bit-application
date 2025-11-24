import { NavLink, Outlet } from 'react-router-dom';

const navLinks = [
  { to: '/app/dashboard', label: 'לוח בקרה' },
  { to: '/app/cases', label: 'תיקים' },
  { to: '/app/clients', label: 'לקוחות' },
  { to: '/app/files', label: 'קבצים' },
  { to: '/app/admin', label: 'ניהול' },
];

function AppLayout() {
  return (
    <div className="min-vh-100 bg-body" dir="rtl">
      <header className="border-bottom bg-white shadow-sm">
        <div className="container py-3 d-flex justify-content-between align-items-center">
          <div>
            <p className="text-uppercase text-muted small mb-1">אזור מערכת</p>
            <h1 className="h5 mb-0">פורטל ניהול</h1>
          </div>
          <div className="d-flex align-items-center gap-3">
            <span className="badge text-bg-light">כניסה באמצעות עוגיות</span>
          </div>
        </div>
        <nav className="bg-light border-top">
          <div className="container d-flex flex-wrap gap-3 py-2">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `nav-link px-2 ${isActive ? 'fw-semibold text-primary' : 'text-secondary'}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="container py-4">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
