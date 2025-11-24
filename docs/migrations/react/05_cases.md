# 05 – העברת מסכי התיקים ל-React

## מטרות
- החלפת מסכי התיקים (רשימה, צפייה, יצירה/עדכון) ב-React עם כיווניות RTL ושמירת טקסטים בעברית.
- עבודה מול ה-API הקיים תוך שימוש במבנה ResponseManager והזדהות מבוססת קוקיות.
- הסרת תלות ב-DataTables/jQuery והחלפתן בטבלאות וקומפוננטות React פשוטות.

## מיפוי נתיבים קיימים
- **רשימת תיקים**: `GET /get_office_cases?expand=true` מחזיר את התיקים של המשרד. משתמשים בסינון/מיון בצד הלקוח בלבד.
- **פרטי תיק**: `GET /get_case?serial=<מספר>&expand=true` מציג פירוט, לקוחות וקבצים קשורים (במידה ומורחב).
- **יצירת תיק**: `POST /create_new_case` עם המטען:
  - `title` (חובה), `field`, `facts`, `against`, `against_type`, `responsible_serial`.
  - `clients_with_roles`: מערך אובייקטים `{client_serial, role, legal_role}`; נדרש לפחות אחד עם `role="main"`.
  - `created_at`: נשלח ע"י ה-UI (ISO string).
- **עדכון תיק**: `PATCH /update_case?serial=<מספר>` מקבל שדות לעדכון, כולל `clients_serials_with_roles` במבנה רשימות `[[client_serial, role, legal_role], ...]`.
- **עדכון סטטוס**: `PATCH /update_case_status?serial=<מספר>` עם גוף `{status}` (לדוגמה `active`/`archived`).
- **מחיקה**: `DELETE /delete_case?serial=<מספר>` מוחק את התיק.
- **מטא-נתונים**: `GET /get_case_categories`, `GET /get_case_statuses` לאכלוס דטא-ליסטים וסינון.

כל הקריאות נעשות דרך `apiClient` עם `credentials: 'include'` ופרסור ResponseManager.

## מבנה ה-UI ב-React
- **ניווט**: `/app/cases` כעמוד ראשי עם טאב רשימה וטאב "תיק חדש". תתי-נתיבים:
  - `/app/cases` – `CasesListPage` (טבלה, חיפוש, סינון סטטוס/תחום, מיון עמודות, כפתורי צפייה/עריכה).
  - `/app/cases/new` – `CaseCreatePage` עם `CaseForm` ליצירה וולידציה ללקוח ראשי.
  - `/app/cases/:caseSerial` – `CaseDetailsPage` מציג מטא-דאטה, תיאור ולקוחות.
  - `/app/cases/:caseSerial/edit` – `CaseEditPage` לעריכת שדות ועדכון סטטוס (קריאה נפרדת לסטטוס במקרה שינוי).
- **קומפוננטת טופס**: `CaseForm` כוללת ולידציה:
  - כותרת חובה.
  - לכל לקוח חובה `client_serial`.
  - נדרש לפחות לקוח אחד עם `role="main"` לפני שליחה.
- **התנהגות RTL**: כל העמודים והטפסים משתמשים ב-`dir="rtl"`, טקסטים ותוויות בעברית.

## שמירת התאמה למורשת
- עמוד הרשימה משחזר את העמודות המרכזיות מה-DataTable הקיים: כותרת, מס' סידורי, תחום, סטטוס, לקוח ראשי, טלפון, יוצר, תאריך יצירה, מס' קבצים.
- מיון וחיפוש נעשים בצד הלקוח ללא תלות ב-jQuery/DataTables.
- הודעות שגיאה/הצלחה נשמרות בעברית ומוצגות באלרטים.

## נקודות המשך/בדיקות
- לוודא שה-`expand` ב-`/get_case` ו-`/get_office_cases` מחזיר את פירוט הלקוחות; אחרת, לשקול קריאת השלמה ללקוחות לפי ה-serials.
- לחדד את שדות ההמרה ל-`clients_serials_with_roles` בעת עריכה מול הסכמה בפלאסק (היום נשלח כמערך רשימות).
- לשלב בדיקות אוטומטיות (`npm run lint`) כאשר הרג'יסטרי זמין בסביבה.
