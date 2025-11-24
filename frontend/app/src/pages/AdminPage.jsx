import { NavLink, Outlet } from 'react-router-dom';

const adminLinks = [
  { to: '/app/admin', label: 'דשבורד אדמין', end: true },
  { to: '/app/admin/users', label: 'ניהול משתמשים' },
  { to: '/app/admin/office', label: 'הגדרות משרד' },
];

function AdminPage() {
  return (
    <div className="card border-0 shadow-sm" dir="rtl">
      <div className="card-header bg-white d-flex flex-column flex-lg-row gap-3 justify-content-between align-items-lg-center">
        <div>
          <p className="text-uppercase text-muted small mb-1">ניהול מערכת</p>
          <h1 className="h5 mb-0">כלי אדמין ומשרד</h1>
        </div>
        <div className="nav nav-pills flex-row gap-2">
          {adminLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : 'text-primary'} px-3`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </div>
      <div className="card-body bg-light">
        <Outlet />
      </div>
    </div>
  );
}

export default AdminPage;
