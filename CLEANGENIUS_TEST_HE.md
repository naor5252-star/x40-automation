# CleanGenius manual test

This stage does NOT modify src/index.js / Cloudflare automatic dispatch.

Room IDs:
7 = סלון
1 = חדר שינה ראשי 3
2 = חדר שינה ראשי 2
4 = משרד
5 = מסדרון

Manual GitHub test:

Actions -> Dreame X40 Shortcut -> Run workflow

mode = smart-run
primary_mode = cleangenius
clean_genius_rooms = 7,1,2,4,5
clean_genius_mode = 1
clean_genius_label = סלון, חדר שינה ראשי 3, חדר שינה ראשי 2, משרד, מסדרון

Keep fallback shortcut name/id as currently configured.

1 = CleanGenius Routine
2 = CleanGenius Deep

After this succeeds, patch Cloudflare to make CleanGenius the automatic primary.
