import { NavLink, Outlet, useNavigate } from 'react-router-dom';

function FilesPage() {
  const navigate = useNavigate();

  return (
    <section className="card shadow-sm" dir="rtl">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
          <div>
            <h2 className="h4 mb-1">ניהול קבצים</h2>
            <p className="mb-0 text-muted">
              העלאה, צפייה וניהול של מסמכים וקבצים מצורפים ללא jQuery.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/app/files/upload')}
          >
            ⬆️ העלאת קבצים
          </button>
        </div>

        <div className="mb-3 border-bottom pb-2 d-flex gap-3 flex-wrap">
          <NavLink
            end
            to=""
            className={({ isActive }) => `nav-link px-0 ${isActive ? 'fw-bold text-primary' : ''}`}
          >
            רשימת קבצים
          </NavLink>
          <NavLink
            to="upload"
            className={({ isActive }) => `nav-link px-0 ${isActive ? 'fw-bold text-primary' : ''}`}
          >
            העלאה
          </NavLink>
        </div>

        <Outlet />
      </div>
    </section>
  );
}

export default FilesPage;
