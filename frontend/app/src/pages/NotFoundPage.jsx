import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <section className="card shadow-sm" dir="rtl">
      <div className="card-body">
        <h2 className="h4 mb-3">הדף לא נמצא</h2>
        <p className="mb-3 text-muted">נראה שהנתיב שביקשתם אינו קיים.</p>
        <div className="d-flex gap-2">
          <Link className="btn btn-outline-primary" to="/">
            חזרה לדף הבית
          </Link>
          <Link className="btn btn-primary" to="/app/dashboard">
            מעבר ללוח הבקרה
          </Link>
        </div>
      </div>
    </section>
  );
}

export default NotFoundPage;
