# Automatic CleanGenius via Cloudflare

Cloudflare variables:

DREAME_PRIMARY_MODE = cleangenius

DREAME_CLEAN_GENIUS_ROOMS = 7,1,2,4,5
DREAME_CLEAN_GENIUS_MODE = 1
DREAME_CLEAN_GENIUS_LABEL = סלון, חדר שינה ראשי 3, חדר שינה ראשי 2, משרד, מסדרון

Fallback:
DREAME_FALLBACK_SHORTCUT_NAME = שאיבה בלבד
DREAME_FALLBACK_SHORTCUT_ID = <your fallback ID>
DREAME_WATER_EMPTY_CODES = 107,116

Safety:
Set DRY_RUN=true for the first Cloudflare test.
After /trigger-test works, set DRY_RUN=false.

Note:
DREAME_CLEAN_GENIUS_MODE:
1 = Routine
2 = Deep
