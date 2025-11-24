function PublicHomePage() {
  return (
    <div className="card shadow-sm">
      <div className="card-body" dir="rtl">
        <p className="text-uppercase text-muted small mb-2">דף ציבורי</p>
        <h2 className="h4 mb-3">ברוכים הבאים לממשק הריאקט החדש</h2>
        <p className="mb-0 text-muted">
          ממשק זה נבנה עם React Router v6 ותמיכה מלאה ב-RTL. ניתן לנווט אל דף ההתחברות
          או ישירות לאזור האפליקציה.
        </p>
      </div>
    </div>
  );
}

export default PublicHomePage;
