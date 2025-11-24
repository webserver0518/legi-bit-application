# React ניהול אדמין ומשרד

## מטרות
- להעביר את מסכי הניהול (דשבורד, משתמשים, פרטי משרד) ל-React עם RTL ותוויות בעברית.
- להשתמש בנתיבי האדמין הקיימים בלי לשנות לוגיקת שרת או מבנה נתונים.
- לשמר שימוש בעוגיות (credentials: 'include') ובמבנה ResponseManager `{data, error, message, status, success}`.

## Endpoints רלוונטיים
- `GET /get_roles_list` – רשימת תפקידים (value/label) לצורך בחירה בטפסים.
- `POST /manage_user` – פעולה מרוכזת (`action=add|edit|delete`) לעבודה עם משתמשים, בשדות FormData:
  - `add`: `username`, `password`, `email?`, `office_name` (ברירת מחדל מהמשרד הנוכחי), `roles[]`.
  - `edit`: `username`, `office_serial` חובה, `password?`, `email?`, `roles[]?`.
  - `delete`: `username`, `office_serial` חובה.
- `GET /get_office_users` – רשימת משתמשים של המשרד הנוכחי (שימשו לרשימות/עריכה).
- `GET /get_office_name`, `GET /get_office_serial` – נתוני הקשר למשרד מחיבור הסשן (ממוחזרים במסכי הדשבורד/הגדרות).
- `GET /base_admin_dashboard` – כיום תבנית HTML; ה-SPA מסתמך במקום זאת על מוני המשרד הקיימים (תיקים/לקוחות/קבצים/משתמשים) עד שייווסף endpoint ייעודי.

## מבנה UI חדש
- `/app/admin` – דשבורד אדמין עם כרטיסי ספירה (תיקים, לקוחות, קבצים, משתמשים) ופרטי משרד נוכחי.
- `/app/admin/users` – טופס יצירת משתמש חדש + טבלת משתמשי המשרד עם עריכה/מחיקה ללא jQuery/DataTables.
- `/app/admin/office` – תצוגת שם/מספר משרד ורשימת תפקידים טעונה מ-`/get_roles_list`.

## החלטות ו-TODO
- רשימת המשתמשים נשענת על `GET /get_office_users` (היחיד שקיים כ-JSON). אם יידרש ניהול בין-משרדי, נדרש endpoint ייעודי שיחשוף את `mongodb_service.get_all_users` בפורמט ResponseManager.
- תפקיד `admin` נשמר בלעדי (לא משולב עם תפקידים אחרים) בהתאם להתנהגות legacy.
- כל הקריאות נעשות דרך ה-apiClient עם `credentials: 'include'`; שגיאות ResponseManager נפרסות כהתראות בעברית.
- UI נשאר RTL עם עוגיות/סשן קיימים, ללא שימוש ב-jQuery או DataTables.
