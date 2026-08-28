# Dreame X40 + Cloudflare POC

מטרה: להפעיל ניקוי כאשר **שני האייפונים מחוץ לבית** ורק בין **10:00–15:00**.

## ארכיטקטורה

iPhone של נאור ─┐
                ├─> Cloudflare Worker + Durable Object ─> Dreame adapter (שלב 2)
iPhone של אשתו ─┘

ה-Worker שומר מצב `home/away` לכל אחד, בודק כל 5 דקות, ומפעיל לכל היותר פעם אחת ביום.

כרגע `DRY_RUN=true`, כלומר הוא **לא מפעיל את הרובוט**. הוא רק מחזיר:
`dry_run_would_start_dreame`

זה בכוונה: קודם מאמתים שה-Geofence של שני האייפונים יציב, ורק אז מוסיפים סיסמת Dreame.

## פריסה

נדרש Node.js + חשבון Cloudflare.

```sh
npm install
npx wrangler login
npx wrangler secret put WEBHOOK_TOKEN
npm run deploy
```

Wrangler יציג URL בסגנון:

```text
https://dreame-presence-automation.<your-subdomain>.workers.dev
```

שמור אותו.

## בדיקה ידנית

החלף:
- `WORKER_URL`
- `YOUR_TOKEN`

```sh
curl -X POST "WORKER_URL/presence/naor" \
  -H "X-Webhook-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state":"away"}'

curl -X POST "WORKER_URL/presence/wife" \
  -H "X-Webhook-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state":"away"}'

curl "WORKER_URL/status" \
  -H "X-Webhook-Token: YOUR_TOKEN"
```

## iPhone — נאור

באפליקציית Shortcuts:

### Automation 1 — יציאה מהבית
1. Automation
2. `+`
3. `Leave`
4. בחר את הבית
5. Run Immediately / בלי לשאול
6. Action: `Get Contents of URL`
7. URL:
   `WORKER_URL/presence/naor`
8. Method: POST
9. Header:
   `X-Webhook-Token: YOUR_TOKEN`
10. Request Body: JSON
11. שדה:
   `state` = `away`

### Automation 2 — חזרה הביתה
אותו דבר, רק:
- Trigger: `Arrive`
- `state` = `home`

## iPhone — אשתך

אותו תהליך, אבל ה-URL הוא:

```text
WORKER_URL/presence/wife
```

גם כאן:
- Leave -> `away`
- Arrive -> `home`

## למה יש Cron כל 5 דקות?

אם שניכם יצאתם לפני 10:00, לא יקרה אירוע יציאה חדש בדיוק ב-10:00.
לכן Cloudflare בודק את המצב כל 5 דקות. הקוד עצמו בודק את אזור הזמן
`Asia/Jerusalem`, כך ששינוי שעון קיץ לא דורש לשנות את ה-Cron.

## מניעת הפעלה כפולה

נשמר `lastRunDate`, ולכן אחרי שהרובוט הופעל/היה אמור להיות מופעל,
לא תהיה הפעלה שנייה באותו יום.

## שלב 2 — Dreame

אחרי שה-POC מחזיר בצורה נכונה:

```text
"action": "dry_run_would_start_dreame"
```

נחבר Adapter של DreameHome בענן. המסלול המועדף הוא שירות Python קטן
ב-Cloudflare Container, שיחשוף endpoint פרטי להפעלת `start_clean`.

לא מכניסים את סיסמת Dreame לתוך קוד המקור. היא תישמר כ-Cloudflare Secret.