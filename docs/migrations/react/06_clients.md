# 06 - לקוחות: מיפוי Endpoints ומעבר ל-React

## Endpoints קיימים
- `/get_office_clients` (GET, cookie auth): מחזיר את כל הלקוחות במשרד, כולל שדות `serial`, `first_name`, `last_name`, `id_card_number`, `phone`, `email`, `city`, `street`, `home_number`, `postal_code`, `birth_date`, `status`, `created_at`. נתמך גם כשהמידע עטוף תחת מפתח `clients`.
- `/create_new_client` (POST, JSON): יוצר לקוח חדש; חובה `first_name`, שדות נוספים כמו `id_card_number`, `phone`, `email`, `address` נתמכים ומאוחסנים כפי שהם.
- `/update_client?serial=<client_serial>` (PATCH, JSON): עדכון לקוח קיים לפי `serial`.
- שדות קשר לתיקים: `clients_with_roles` בתיקים נשאר במבנה המורכב ממערך אובייקטים `{client_serial, role, legal_role}`.

## החלטות UI
- נבנו מסכים חדשים ב-React ללא jQuery/DataTables: רשימת לקוחות עם חיפוש, מסך פרטי לקוח, וטפסי יצירה/עריכה עם טקסטים בעברית ו-RTL.
- הוספנו טופס `ClientForm` עם ולידציות בסיסיות (שם פרטי חובה, פורמטי אימייל/טלפון). שדות כתובת ופרטי קשר נשמרים אחד לאחד מול ה-API.
- ברשימת הלקוחות מופיע כפתור "לקוח חדש" וניהול חיפוש טקסטואלי (ללא תלות ב-DataTables או ייצוא אקסל הישן).

## אינטגרציה עם תיקים
- `cases` משתמש כעת בנתוני הלקוחות דרך `clientsApi.getOfficeClients()` ומעביר אותם ל-`CaseForm`.
- ב-`CaseForm` ניתן לבחור מספר לקוח קיים (datalist) והשם הפרטי/משפחה מתמלאים אוטומטית; עדיין נאכף מבנה `clients_with_roles` עם לקוח ראשי אחד לפחות.
- התצוגות הקיימות של תיקים נשארו ללא jQuery וממשיכות להשתמש ב-ResponseManager וב-credentials cookies.

## בדיקות ידועות/פעולות המשך
- טבלת קשר לתיקים ב-`ClientDetailsPage` מסומנת כ-TODO; נדרש חיתוך API או הרחבת `/get_office_cases` לפי `client_serial` כדי להשלים זאת.
- יש להריץ `npm run lint`/`npm run format` בפרונטאנד לאחר התקנת התלויות (ראה מגבלת רישום ב-`npm install` בסביבות חסומות).
