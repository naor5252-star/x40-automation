# Dreame X40 - fallback when clean water is empty

Cloudflare Variables:

DREAME_FALLBACK_SHORTCUT_NAME = שאיבה בלבד
DREAME_FALLBACK_SHORTCUT_ID = <fallback shortcut ID>
DREAME_WATER_EMPTY_CODES = 107,116

Existing primary variables stay unchanged:

DREAME_SHORTCUT_NAME = ניקוי עמוק
DREAME_SHORTCUT_ID = <primary shortcut ID>

Logic:
1. MQTT connects first.
2. Primary shortcut is sent.
3. errorCode 107 or 116 -> fallback shortcut.
4. TASK_STATUS value 2 confirms cleaning.
5. Telegram says which shortcut actually started.

To discover fallback ID:
GitHub Actions -> Dreame X40 Shortcut -> Run workflow
mode = capture
shortcut_name = fallback shortcut name

Then trigger/edit/save that shortcut in Dreamehome and look for:
FOUND_SHORTCUT_ID=...
