# Dreame X40 — Cloudflare + GitHub Actions

המטרה:

`שני האייפונים Away` + `10:00–15:00` → Cloudflare → GitHub Action → DreameHome → הקיצור **"ניקוי עמוק"**.

## מה יש בחבילה

- `scripts/dreame.mjs` — מתחבר ל-DreameHome, קורא את property 4-48, מפענח את שמות הקיצורים, מאתר את "ניקוי עמוק" ושולח את action להפעלתו.
- `.github/workflows/dreame.yml` — GitHub Action שאפשר להריץ ידנית או מ-Cloudflare.
- `src/index.js` — גרסת Worker שמפעילה את ה-Workflow רק כששני הטלפונים Away ובין 10:00–15:00.
- `install_dreame_automation.sh` — מתקין את שלושת הקבצים אוטומטית בתוך repo קיים.

## שלב 1 — GitHub Secrets

ב-repository:

Settings → Secrets and variables → Actions → Secrets

צור:

- `DREAME_EMAIL` — המייל של חשבון DreameHome.
- `DREAME_PASSWORD` — הסיסמה של DreameHome.

אל תשים אותם בקוד.

ב-Variables אפשר להוסיף:

- `DREAME_REGION` = `eu`
- `DREAME_DEVICE_DID` — אופציונלי. אם לא מוגדר, הסקריפט מנסה לזהות X40 אוטומטית.

## שלב 2 — בדיקה ידנית ב-GitHub

Actions → `Dreame X40 Shortcut` → Run workflow.

תחילה:

- mode = `list`
- shortcut_name = `ניקוי עמוק`

הפעולה `list` **לא מפעילה את הרובוט**. היא רק מציגה את רשימת הקיצורים וה-IDs.

אם הרשימה כוללת `ניקוי עמוק`, הרץ שוב:

- mode = `run`
- shortcut_name = `ניקוי עמוק`

זה אמור להפעיל את הקיצור.

## שלב 3 — GitHub token עבור Cloudflare

צור Fine-grained Personal Access Token ב-GitHub עבור ה-repository הזה.

ה-token צריך לאפשר ל-Cloudflare לבצע Workflow Dispatch.
בחר repository access רק ל-repo הזה והענק Actions: Read and write.

שמור את ה-token — לא לשים אותו בקוד.

## שלב 4 — Cloudflare Variables / Secrets

Worker → Settings → Variables and Secrets.

השאר את:
- `WEBHOOK_TOKEN` הקיים.

הוסף Variables:

- `GITHUB_OWNER` = שם המשתמש/organization של ה-repo
- `GITHUB_REPO` = שם ה-repository
- `GITHUB_WORKFLOW` = `dreame.yml`
- `GITHUB_REF` = `main`
- `DREAME_SHORTCUT_NAME` = `ניקוי עמוק`
- `DRY_RUN` = `true` בשלב הראשון

הוסף Secret:

- `GITHUB_DISPATCH_TOKEN` = ה-Fine-grained PAT שיצרת.

## שלב 5 — בדיקת Cloudflare → GitHub

אפשר לבדוק בלי לחכות ל-10:00:

POST:
`https://YOUR-WORKER.workers.dev/trigger-test`

Headers:
- `X-Webhook-Token: <ה-token הקיים שלך>`
- `Content-Type: application/json`

Body:
```json
{
  "shortcut_name": "ניקוי עמוק"
}
```

`/trigger-test` מפעיל את GitHub Action ידנית ואינו משנה את `lastRunDate`.

## שלב 6 — הפעלה אוטומטית

אחרי ש:
1. GitHub `mode=run` מפעיל נכון את "ניקוי עמוק".
2. `/trigger-test` מפעיל אותו דרך Cloudflare.
3. Presence של שני האייפונים עובד.

שנה ב-Cloudflare:

`DRY_RUN=false`

מאותו רגע:

- שני הטלפונים חייבים להיות `away`.
- השעה בישראל חייבת להיות בין 10:00 ל-15:00.
- ההפעלה מתבצעת מקסימום פעם אחת ביום.
- Cron בודק כל 5 דקות, לכן גם אם יצאתם לפני 10:00, הוא יכול להפעיל אחרי 10:00.

## התקנה עם iSH

אם ה-repo כבר cloned באייפון:

```sh
cd /path/to/your/repo
sh /path/to/install_dreame_automation.sh
git add scripts/dreame.mjs .github/workflows/dreame.yml src/index.js
git commit -m "Add Dreame X40 shortcut automation"
git push
```

ה-installer שומר backup של `src/index.js` הקיים בשם `src/index.js.before-dreame-github.bak`.
