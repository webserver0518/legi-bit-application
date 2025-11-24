import { Outlet, NavLink, useNavigate } from 'react-router-dom';

function CasesPage() {
  const navigate = useNavigate();

  return (
    <section className="card shadow-sm" dir="rtl">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
          <div>
            <h2 className="h4 mb-1">ניהול תיקים</h2>
            <p className="mb-0 text-muted">רשימת תיקים, פרטים ופעולות</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/app/cases/new')}
          >
            ➕ תיק חדש
          </button>
        </div>

        <div className="mb-3 border-bottom pb-2 d-flex gap-3 flex-wrap">
          <NavLink end to="" className={({ isActive }) => `nav-link px-0 ${isActive ? 'fw-bold text-primary' : ''}`}>
            רשימה
          </NavLink>
          <NavLink
            to="new"
            className={({ isActive }) => `nav-link px-0 ${isActive ? 'fw-bold text-primary' : ''}`}
          >
            יצירת תיק
          </NavLink>
        </div>

        <Outlet />
      </div>
    </section>
  );
}

export default CasesPage;
