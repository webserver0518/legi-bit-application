function LoginPage() {
  return (
    <div className="card shadow-sm" dir="rtl">
      <div className="card-body">
        <p className="text-uppercase text-muted small mb-2">התחברות</p>
        <h2 className="h4 mb-3">כניסה לחשבון</h2>
        <p className="mb-0 text-muted">
          המסך משמש כנקודת התחברות. קריאות ל-API יעברו דרך Nginx עם credentials: "include" כדי
          לשמר עוגיות מאובטחות.
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
