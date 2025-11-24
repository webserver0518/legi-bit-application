import { Link, Outlet } from 'react-router-dom';

function PublicLayout() {
  return (
    <div className="min-vh-100 bg-light" dir="rtl">
      <header className="border-bottom bg-white shadow-sm">
        <div className="container py-3 d-flex justify-content-between align-items-center">
          <div>
            <p className="text-uppercase text-muted small mb-1">ממשק ריאקט</p>
            <h1 className="h4 mb-0">ברוכים הבאים</h1>
          </div>
          <div className="d-flex align-items-center gap-3">
            <Link className="btn btn-outline-primary" to="/login">
              התחברות
            </Link>
          </div>
        </div>
      </header>

      <main className="container py-4">
        <Outlet />
      </main>
    </div>
  );
}

export default PublicLayout;
