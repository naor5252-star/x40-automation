# Dreame X40 MQTT Shortcut Capture Fix

## Why this version exists

Your X40 is found in Dreame region `sg` and is reported online, but HTTP
`getProperties(4-48)` returns Dreame code `80001`.

This package avoids depending on that HTTP read.

### One-time discovery
GitHub opens a Dreame MQTT subscription. While it is listening, manually start
(or edit/save) the desired Dreame shortcut. When property 4-48 is pushed, the
script prints:

`FOUND_SHORTCUT_ID=<number>`

### Normal automation
After that, put the discovered ID into Cloudflare variable
`DREAME_SHORTCUT_ID`. Normal cleaning uses the ID directly and does not need
to read 4-48 again.

## Install

From the root of the existing Git repo:

```sh
sh /path/to/install_mqtt_shortcut_fix.sh
git add scripts/dreame.mjs .github/workflows/dreame.yml src/index.js
git commit -m "Use MQTT to capture Dreame shortcut ID"
git push
```

## GitHub variables

Recommended:

- `DREAME_REGION` = `sg`
- `DREAME_CAPTURE_SECONDS` = `150`

Keep existing secrets:

- `DREAME_EMAIL`
- `DREAME_PASSWORD`

## Capture the "ניקוי עמוק" ID

GitHub:
Actions → Dreame X40 Shortcut → Run workflow

Choose:

- mode: `capture`
- shortcut_name: `ניקוי עמוק`
- shortcut_id: leave empty

As soon as the log says:

`👉 NOW trigger the shortcut in Dreamehome.`

Open Dreamehome and manually start `ניקוי עמוק`.

You may stop/pause it once the robot reacts.

Look in the GitHub log for:

`FOUND_SHORTCUT_ID=...`

If starting it does not publish 4-48, run capture again and edit the shortcut
in Dreamehome, make a harmless change, save it, then change it back after
capture. Saving the shortcut is more likely to republish its configuration.

## Test by ID

Run the workflow again:

- mode: `run-id`
- shortcut_name: `ניקוי עמוק`
- shortcut_id: `<the number captured>`

This is the first real automation test.

## Cloudflare variables

After the ID test succeeds, configure:

- `DREAME_SHORTCUT_ID` = captured ID
- `DREAME_SHORTCUT_NAME` = `ניקוי עמוק`
- `START_TIME` = `10:00`
- `END_TIME` = `15:00`
- `AWAY_DELAY_MINUTES` = `10`
- `MAX_RUNS_PER_DAY` = `1`
- `TIMEZONE` = `Asia/Jerusalem`
- `DRY_RUN` = `true` initially
- `GITHUB_OWNER` = your GitHub owner
- `GITHUB_REPO` = `x40-automation`
- `GITHUB_WORKFLOW` = `dreame.yml`
- `GITHUB_REF` = `main`

Secrets:

- `WEBHOOK_TOKEN`
- `GITHUB_DISPATCH_TOKEN`

Once `/trigger-test` works and starts the correct shortcut, change:

`DRY_RUN=false`
