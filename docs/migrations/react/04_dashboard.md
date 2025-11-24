# 04 – לוח בקרה React (RTL, ללא jQuery)

## מה נסרק בדשבורד הישן
- תבניות: `flask/app/templates/base_user_dashboard.html`, `flask/app/templates/base_admin_dashboard.html` (סרגלי צד, כותרות בעברית, חיבורי JS/CSS, תלות ב-jQuery/DataTables/Choices.js).
- סקריפטים: `flask/app/static/js/base_user_dashboard.js`, `flask/app/static/js/base_admin_dashboard.js` (טעינת תת-תפריטים, קריאות `/get_office_name`, `/get_username`, ניווט loader.js).
- סגנון: `flask/app/static/css/dashboard.css` (צבעי כחול, RTL, מצבי sidebar/sub-sidebar).

## מה עבר ל-React
- דשבורד משתמש ואדמין חדשים תחת `frontend/app/src/pages/dashboard/` עם כרטיסים, טבלאות פשוטות ורשימות אחרונות ב-RTL.
- ללא jQuery/DataTables; הכל רכיבי React/Bootstrap בלבד.
- שימוש ב-`apiClient` עם `credentials: 'include'` ופרסינג ResponseManager או טקסט (עבור `/get_office_name` ו-`/get_username`).

## מיפוי קריאות API
- שם משרד: `GET /get_office_name` (טקסט בלבד; עטוף ב-`dashboardApi.fetchOfficeName`).
- שם משתמש: `GET /get_username` (טקסט בלבד; עטוף ב-`dashboardApi.fetchUsername`).
- רשימת תיקים: `GET /get_office_cases` (ResponseManager → `data` רשימת תיקים). 
- רשימת לקוחות: `GET /get_office_clients`.
- רשימת קבצים: `GET /get_office_files` (משמש לספירת קבצים).
- משתמשי משרד (לאדמין): `GET /get_office_users` להצגת טבלה וסטטיסטיקת תפקידים.

## TODO/פערים
- חסר מקור ResponseManager רשמי לשם משרד/משתמש (כרגע טקסט פשוט). אם יתווסף endpoint חדש, לעדכן את `dashboardApi` בהתאם.
- שדות סטטוס/כותרת תיקים ופרטי לקוח מסתמכים על מבנה הנתונים הקיים; יש לחדד מול הסכמה אם שמות שדות שונים.
- פיצול דשבורד אדמין לנתוני-על (לדוגמה ריכוז משרדים) ממתין לאימות endpoints ב-legacy.
