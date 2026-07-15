# ניהול תרופות ותורים

אפליקציית Web (PWA) בעברית לניהול טיפול רפואי אישי — תרופות, מינונים, שעות לקיחה, תורים רפואיים ותזכורות Push.

## טכנולוגיות

| שכבה | טכנולוגיה |
|---|---|
| Build | Vite 5 + `@vitejs/plugin-react-swc` |
| שפה | TypeScript 5 |
| UI | React 18, shadcn/ui (Radix), Tailwind CSS |
| Routing | react-router-dom 6 |
| Data | @tanstack/react-query |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| PWA | vite-plugin-pwa |

## הרצה מקומית

דרישות: Node.js 18+ ו-npm.

```sh
# 1. התקנת התלויות (פעם אחת)
npm install

# 2. הגדרת משתני הסביבה
#    העתק את .env.example ל-.env ומלא את הערכים מפרויקט ה-Supabase שלך
#    (Supabase Dashboard -> Project Settings -> API)
cp .env.example .env

# 3. הפעלת שרת הפיתוח
npm run dev
```

האפליקציה תעלה על http://localhost:8080

## פקודות נוספות

```sh
npm run build      # build לייצור
npm run preview    # תצוגה מקדימה של ה-build
npm run lint       # בדיקת ESLint
npm run test       # הרצת בדיקות (Vitest)
```

## מבנה הפרויקט

```
src/
  pages/                  Index (האפליקציה), Auth (התחברות), NotFound
  components/             קומפוננטות עסקיות (תרופות, תורים, לוח שנה, ייבוא)
  components/ui/          פרימיטיבים של shadcn/ui
  hooks/                  useAuth, useSupabaseData, useNotifications ועוד
  integrations/supabase/  יצירת ה-client (נוצר אוטומטית) וטיפוסים
  types/                  טיפוסי Medication ו-Appointment
supabase/
  migrations/             סכימת בסיס הנתונים
  functions/              Edge Functions: push-subscribe, send-notifications
```

## בסיס הנתונים

| טבלה | תוכן |
|---|---|
| `medications` | תרופות: שם, מינון, שעות, תדירות, תאריכים |
| `appointments` | תורים רפואיים |
| `completions` | תיעוד לקיחת תרופה |
| `arrivals` | תיעוד הגעה לתור |
| `pending_reminders` | תזכורות שממתינות לשליחה |
| `push_subscriptions` | מנויי Push של הדפדפן |
| `notification_log` | מניעת כפילויות בהתראות |
| `vapid_keys` | מפתחות VAPID ל-Web Push |

כל טבלאות המשתמש מוגנות ב-Row Level Security לפי `auth.uid()`.

## ייבוא נתונים

האפליקציה תומכת בייבוא מקובץ CSV או JSON דרך מסך "ייבוא נתונים":

```json
{
  "medications": [
    { "name": "Nexium", "dosage": "20mg", "times": ["07:00"], "frequency": "daily", "startDate": "2026-03-06" }
  ],
  "appointments": [
    { "type": "בדיקת דם", "date": "2026-03-19", "time": "08:00", "location": "מעבדה" }
  ]
}
```

- `times` — מערך בפורמט `HH:MM` (ב-CSV: מופרד ב-`;`)
- `frequency` — אחד מתוך `daily`, `weekly`, `once`, `every_x_days`
- תאריכים בפורמט `YYYY-MM-DD`

## אבטחה

- קובץ `.env` אינו נכלל ב-git. אין לשמור בו מפתחות ב-repository.
- ה-Edge Functions משתמשות ב-service role key שנשמר בצד השרת בלבד.
