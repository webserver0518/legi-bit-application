import { NavLink, Outlet, useNavigate } from 'react-router-dom';

function ClientsPage() {
  const navigate = useNavigate();

  return (
    <section className="card shadow-sm" dir="rtl">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
          <div>
            <h2 className="h4 mb-1">ניהול לקוחות</h2>
            <p className="mb-0 text-muted">רשימות, פרטים וטפסים ללא jQuery או DataTables</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/app/clients/new')}>
            ➕ לקוח חדש
          </button>
        </div>

        <div className="mb-3 border-bottom pb-2 d-flex gap-3 flex-wrap">
          <NavLink end to="" className={({ isActive }) => `nav-link px-0 ${isActive ? 'fw-bold text-primary' : ''}`}>
            רשימה
          </NavLink>
          <NavLink to="new" className={({ isActive }) => `nav-link px-0 ${isActive ? 'fw-bold text-primary' : ''}`}>
            יצירה
          </NavLink>
        </div>

        <Outlet />
      </div>
    </section>
  );
}

export default ClientsPage;
