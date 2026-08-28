# ווידג׳ט Dreame X40 לאייפון

הווידג׳ט מציג:

- נאור — בבית / בחוץ
- אשתך — בבית / בחוץ
- האם הרובוט הופעל היום דרך האוטומציה
- שעת ההפעלה האחרונה ומספר ההפעלות היום

> שים לב: "הופעל היום" מבוסס על `runInfo` של Cloudflare — כלומר הפעלה שנשלחה
> דרך האוטומציה שלנו. הפעלה ידנית ישירות מתוך Dreamehome לא תיספר כרגע.

## 1. התקן Scriptable

הווידג׳ט משתמש באפליקציית Scriptable כדי להציג JSON מה-Cloudflare Worker
כ-iOS Home Screen Widget.

## 2. צור WIDGET_TOKEN ב-Cloudflare

אפשר ליצור Token אקראי ב-iSH:

```sh
openssl rand -hex 32
```

ב-Cloudflare:

Worker → Settings → Variables and Secrets → Add

- Name: `WIDGET_TOKEN`
- Type: Secret
- Value: ה-token שיצרת

זה Token לקריאה בלבד. הקוד ב-Worker מאפשר לו רק:

`GET /status`

הוא לא יכול לעדכן Presence ולא יכול להפעיל את הרובוט.

## 3. עדכן את ה-Worker

החבילה מכילה `src/index.js` מעודכן.

אם אתה משתמש ב-installer:

```sh
cd /path/to/x40-automation
sh /path/to/install_dreame_widget.sh

git add src/index.js widget/DreameX40Status.js DREAME_WIDGET_HE.md
git commit -m "Add iPhone Dreame status widget"
git push
```

Cloudflare המחובר ל-GitHub יפרוס את הגרסה החדשה.

## 4. העבר את DreameX40Status.js ל-Scriptable

באפליקציית Files באייפון:

1. שמור את `DreameX40Status.js`.
2. העבר אותו ל-`iCloud Drive/Scriptable`.
3. פתח Scriptable.
4. הסקריפט אמור להופיע ברשימה.
5. הפעל אותו פעם אחת.

בהפעלה הראשונה הוא יבקש:

- Worker URL
- WIDGET_TOKEN
- שם שלך
- שם אשתך

ברירת המחדל של ה-URL כבר מוגדרת ל:

`https://x40-automation.naor-5252.workers.dev`

ה-Token נשמר ב-Keychain של iOS ולא בתוך קובץ הסקריפט.

## 5. הוסף למסך הבית

1. לחיצה ארוכה על מסך הבית.
2. הוסף Widget.
3. בחר Scriptable.
4. מומלץ לבחור גודל Medium.
5. לחיצה ארוכה על הווידג׳ט → Edit Widget.
6. Script → `DreameX40Status`.

## מה תראה

לדוגמה:

- נאור: 🏠 בבית
- אשתי: 🚶 בחוץ
- ✅ הרובוט הופעל היום ב-11:14
- 1 הפעלות דרך האוטומציה • ניקוי עמוק

או:

- נאור: 🚶 בחוץ
- אשתי: 🚶 בחוץ
- ○ הרובוט עדיין לא הופעל היום

## רענון

הסקריפט מבקש מ-iOS רענון כל 5 דקות. iOS מחליטה בפועל מתי לרענן
Home Screen Widgets, ולכן זה לא בהכרח בדיוק כל 5 דקות.

לחיצה על הווידג׳ט פותחת את Scriptable ומביאה סטטוס חדש.
