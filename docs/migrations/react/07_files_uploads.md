# React קבצים והעלאות S3

## מטרות
- להחליף את חוויית הקבצים וההעלאות ב-React עם פריסת RTL ותוויות בעברית.
- להשתמש בזרימת Presigned POST/GET קיימת מול S3 ובקוד ResponseManager ללא שינוי לוגיקה בשרת.
- לשמור על שיוך לתיקים/לקוחות תוך שימוש בקובצי cookie קיימים.

## API רלוונטיים
- `POST /presign/post` – מקבל `file_name`, `file_type`, `file_size`, `key` ומחזיר `url` + `fields` לטופס S3.
- `POST /create_new_file` – יוצר רשומה חדשה ומחזיר `file_serial` (כולל שיוך `case_serial`/`client_serial`).
- `PATCH /update_file?serial=...` – עדכון סטטוס/מטא-דאטה אחרי ההעלאה.
- `POST /update_file_description` – עדכון תיאור בלבד.
- `GET /get_file_url?case_serial&file_serial&file_name` – Presigned GET.
- `DELETE /delete_file?case_serial&file_serial&file_name` – מחיקה מסונכרנת מול S3 ו-Mongo.
- `GET /get_office_files` – טבלת קבצים למשרד הנוכחי.

> כל הקריאות נעשות עם `credentials: 'include'` דרך ה-API client המשותף ומפרקות את מבנה ResponseManager `{data, error, message, status, success}`.

## מבנה UI חדש
- `/app/files` כסט מסכים עם RTL: רשימת קבצים, העלאה, ופרטי קובץ/קישור חתום.
- `FileUploader` מספק גרירה-ושחרור, תור, התקדמות, וניהול שגיאות ללא jQuery/DataTables.
- `FilesListPage` מציג חיפוש, סינון לפי מספר תיק, צפייה/הורדה ומחיקה.
- `FileUploadPage` מבקש `case_serial` (וחיבור `client_serial` אופציונלי) לפני העלאה.
- `FilePreviewPage` מביא קישור חתום ומציג פירוט בעברית.

## מפתחי S3 והסכמות מסלול
- הדרישה: `uploads/{office_serial}/{case_serial}/{file_serial}-{file_name}` (מקף בין מספר הקובץ לשם).
- המצב בפועל בשרת היום (`get_file_url`/`delete_file`): `uploads/{office_serial}/{case_serial}/{file_serial}/{file_name}` (תיקייה פנימית). כדי להימנע משבירת קריאות צפייה/מחיקה קיימות, ה-frontend בונה כעת את המפתח בפורמט הנוכחי אבל כולל דגל `preferHyphenated` בקוד (`filesApi.buildObjectKey`).
- נדרש תיאום עתידי לעדכון השרת כך שיקבל את הפורמט עם המקף או ישתמש בשדה מפתח שמגיע מה-client כדי לעדכן את כל הזרימה ללא שבירת נתונים קיימים.

## זרימת העלאה
1) המשתמש בוחר תיק (חובה) ולפי הצורך מספר לקוח.
2) `create_new_file` יוצר רשומה ומחזיר `file_serial`.
3) בניית מפתח S3 עם `buildObjectKey` (כרגע משתמש בנתיב המקונן כדי להישאר תואם לשרת) והעברת פרטי הקובץ ל-`/presign/post`.
4) שליחת טופס Presigned POST ל-S3 עם התקדמות.
5) `update_file` מסמן סטטוס `active` בסיום; שגיאות נשמרות בתור עם אפשרות ניסיון חוזר.

## הורדה/תצוגה
- הטבלה וכרטיס הפרטים משתמשים ב-`/get_file_url` כדי לקבל קישור GET חתום ומגישים אותו בחלון חדש.
- מחיקה משתמשת ב-`/delete_file` עם אותם פרמטרים כדי לשמור על סנכרון מול Mongo + S3.

## בדיקות ידניות מומלצות
- העלאת קובץ קטן (לדוגמה PDF) ושמירתו תחת תיק קיים, ווידוא שינוי סטטוס ל-`active`.
- בדיקת הזרמת שגיאה (נתק רשת/גודל חריג) ומצב `error` בתור עם כפתור ניסיון חוזר.
- צפייה/הורדה לאחר העלאה ומחיקה מהטבלה.
- לאחר עדכון פורמט המפתח בשרת: לוודא ש`get_file_url` ו-`delete_file` משתמשים באותו מפתח עם המקף.
