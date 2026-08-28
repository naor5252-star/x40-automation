# Telegram notifications for Dreame X40

This extension sends a Telegram message only after Dreame MQTT confirms that
the robot entered an active cleaning task (`siid=4`, `piid=1`, `value=2`).

## 1. Create a Telegram bot

In Telegram, open `@BotFather`.

Send:

`/newbot`

Choose a bot name and a username ending in `bot`.

BotFather will return a bot token.

Do NOT put the token in source code.

## 2. GitHub Secret: TELEGRAM_BOT_TOKEN

Repository:

Settings → Secrets and variables → Actions → New repository secret

Name:

`TELEGRAM_BOT_TOKEN`

Value:

the token from BotFather.

## 3. Find your Chat ID

Open your new bot in Telegram and press START / send it:

`hello`

Then:

GitHub → Actions → Dreame X40 Shortcut → Run workflow

Choose:

`mode = telegram-find-chat`

The log will show something like:

`TELEGRAM_CHAT_ID=123456789`

## 4. GitHub Secret: TELEGRAM_CHAT_ID

Create another repository secret:

`TELEGRAM_CHAT_ID`

with the number from the previous step.

## 5. Test Telegram

Run the workflow with:

`mode = telegram-test`

You should receive:

`✅ Dreame X40 Telegram מחובר בהצלחה`

## 6. Normal automatic notification

When Cloudflare starts the normal `run-id` workflow:

1. GitHub connects an MQTT watcher to the X40.
2. The watcher is ready before the cleaning command is sent.
3. The normal Dreame shortcut command is sent.
4. When MQTT reports `TASK_STATUS=2`, Telegram sends:

🤖 Dreame X40 התחיל לעבוד
🧹 תוכנית: ניקוי עמוק
🕐 שעה: 10:23

If the robot never reports an active cleaning task, no Telegram start
notification is sent.

Optional GitHub Variable:

`TELEGRAM_WATCH_SECONDS = 75`

## Important

This watcher runs when the automation launches the robot through GitHub.
A cleaning started manually in Dreamehome at an unrelated time will not
generate a Telegram notification because there is no always-on MQTT watcher.
