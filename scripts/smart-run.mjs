import { DreameClient } from "node-dreame";

const primaryMode = (process.env.DREAME_PRIMARY_MODE || "shortcut").trim().toLowerCase();

const shortcutName = (process.env.DREAME_SHORTCUT_NAME || "ניקוי עמוק").trim();
const shortcutId = (process.env.DREAME_SHORTCUT_ID || "").trim();

const roomIds = String(process.env.DREAME_CLEAN_GENIUS_ROOMS || "7,1,2,4,5")
  .split(",")
  .map((x) => Number(x.trim()))
  .filter((x) => Number.isInteger(x) && x > 0);

const cleanGeniusMode = Number(process.env.DREAME_CLEAN_GENIUS_MODE || "1");
const cleanGeniusLabel = (
  process.env.DREAME_CLEAN_GENIUS_LABEL ||
  "סלון, חדר שינה ראשי 3, חדר שינה ראשי 2, משרד, מסדרון"
).trim();

const fallbackName = (
  process.env.DREAME_FALLBACK_SHORTCUT_NAME || "שאיבה בלבד"
).trim();
const fallbackId = (
  process.env.DREAME_FALLBACK_SHORTCUT_ID || ""
).trim();

const waterCodes = new Set(
  String(process.env.DREAME_WATER_EMPTY_CODES || "107,116")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter(Number.isFinite)
);

const email = process.env.DREAME_EMAIL;
const password = process.env.DREAME_PASSWORD;
const region = (process.env.DREAME_REGION || "sg").trim();
const wantedDid = (process.env.DREAME_DEVICE_DID || "").trim();

const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();

const timeoutSeconds = Math.max(
  30,
  Number(process.env.DREAME_SMART_RUN_TIMEOUT_SECONDS || "100")
);

const graceSeconds = Math.max(
  3,
  Number(process.env.DREAME_PRIMARY_GRACE_SECONDS || "12")
);

if (!email || !password) throw new Error("Missing Dreame credentials");

if (primaryMode === "shortcut" && !shortcutId) {
  throw new Error("primary_mode=shortcut requires DREAME_SHORTCUT_ID");
}

if (primaryMode === "cleangenius") {
  if (!roomIds.length) {
    throw new Error("DREAME_CLEAN_GENIUS_ROOMS is empty/invalid");
  }
  if (![1, 2].includes(cleanGeniusMode)) {
    throw new Error("DREAME_CLEAN_GENIUS_MODE must be 1 (Routine) or 2 (Deep)");
  }
}

function cleanGeniusModeName() {
  return cleanGeniusMode === 2 ? "Deep" : "Routine";
}

function primaryLabel() {
  return primaryMode === "cleangenius"
    ? `CleanGenius ${cleanGeniusModeName()}`
    : shortcutName;
}

function israelTime() {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

async function sendTelegram(text) {
  if (!botToken || !chatId) {
    console.log("Telegram not configured; skipped:", text.replace(/\n/g, " | "));
    return;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    }
  );

  if (!response.ok) {
    console.log(
      `Telegram HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`
    );
  }
}

const client = new DreameClient({ email, password, region });
await client.login();

const devices = await client.getDevices({ timeoutMs: 25000 });
if (!devices.length) throw new Error("No Dreame devices found");

const device =
  (wantedDid && devices.find((d) => String(d.did) === wantedDid)) ||
  devices.find((d) => /r2416|x40/i.test(`${d.model} ${d.name}`)) ||
  devices[0];

console.log(`✅ Device: ${device.name} | ${device.model}`);
console.log(`Primary mode: ${primaryMode}`);

if (primaryMode === "cleangenius") {
  console.log(
    `🧠 CleanGenius ${cleanGeniusModeName()} | room IDs=${roomIds.join(",")}`
  );
  console.log(`🏠 Rooms: ${cleanGeniusLabel}`);
} else {
  console.log(`🧹 Shortcut: ${shortcutName} (${shortcutId})`);
}

console.log(`Fallback: ${fallbackName} (${fallbackId || "not configured"})`);
console.log(`Water codes: ${[...waterCodes].join(",")}`);

async function setCleanGenius(mode) {
  console.log(`🧠 Set SmartHost=${mode}`);

  try {
    const result = await client.setProperties(
      String(device.did),
      [{
        siid: 4,
        piid: 50,
        value: JSON.stringify({ k: "SmartHost", v: Number(mode) }),
      }],
      { timeoutMs: 15000 }
    );

    console.log("SmartHost result:", JSON.stringify(result));
  } catch (err) {
    const code = err?.body?.code;
    if (
      code === 80001 ||
      String(err?.name || "").includes("Offline") ||
      String(err?.message || "").includes("80001")
    ) {
      console.log("⚠️ SmartHost returned no HTTP ACK; continuing with MQTT.");
      return;
    }
    throw err;
  }
}

async function sendShortcut(name, id) {
  console.log(`▶️ Sending shortcut "${name}" id=${id}`);

  try {
    await client.callAction(
      String(device.did),
      {
        siid: 4,
        aiid: 1,
        in: [
          { piid: 1, value: 25 },
          { piid: 10, value: String(id) },
        ],
      },
      { timeoutMs: 20000 }
    );
  } catch (err) {
    const code = err?.body?.code;
    if (
      code === 80001 ||
      String(err?.name || "").includes("Offline") ||
      String(err?.message || "").includes("80001")
    ) {
      console.log(`⚠️ No HTTP ACK for "${name}"; continuing with MQTT`);
      return;
    }
    throw err;
  }
}

async function startPrimary() {
  if (primaryMode === "shortcut") {
    await sendShortcut(shortcutName, shortcutId);
    return;
  }

  // Enable CleanGenius first.
  await setCleanGenius(cleanGeniusMode);
  await new Promise((r) => setTimeout(r, 800));

  console.log(
    `▶️ Starting selected rooms with CleanGenius: [${roomIds.join(",")}]`
  );

  // node-dreame's verified segment-cleaning API.
  const vacuum = client.getVacuum(device);

  try {
    const result = await vacuum.cleanSegments(roomIds);
    console.log("cleanSegments result:", JSON.stringify(result));
  } catch (err) {
    const code = err?.body?.code;
    if (
      code === 80001 ||
      String(err?.name || "").includes("Offline") ||
      String(err?.message || "").includes("80001")
    ) {
      console.log(
        "⚠️ cleanSegments returned no HTTP ACK; continuing with MQTT confirmation."
      );
      return;
    }
    throw err;
  }
}

const sub = await client.subscribe(device);
console.log("✅ MQTT connected");

let finished = false;
let phase = "primary";
let fallbackSent = false;
let graceTimer = null;

async function finish(code = 0) {
  if (finished) return;
  finished = true;

  if (graceTimer) clearTimeout(graceTimer);

  await sub.close().catch(() => {});
  process.exit(code);
}

async function confirmPrimary() {
  console.log(`✅ Confirmed cleaning: ${primaryLabel()}`);

  const lines = [
    "🤖 Dreame X40 התחיל לעבוד",
  ];

  if (primaryMode === "cleangenius") {
    lines.push(`🧠 מצב: CleanGenius ${cleanGeniusModeName()}`);
    lines.push(`🏠 חדרים: ${cleanGeniusLabel}`);
  } else {
    lines.push(`🧹 תוכנית: ${shortcutName}`);
  }

  lines.push(`🕐 שעה: ${israelTime()}`);

  await sendTelegram(lines.join("\n"));
  await finish(0);
}

async function confirmFallback() {
  console.log(`✅ Confirmed fallback: ${fallbackName}`);

  await sendTelegram(
    [
      "🤖 Dreame X40 התחיל לעבוד",
      "💧 אין מים במיכל המים הנקיים — עברתי אוטומטית לתוכנית החלופית",
      `🧹 תוכנית: ${fallbackName}`,
      `🕐 שעה: ${israelTime()}`,
    ].join("\n")
  );

  await finish(0);
}

async function useFallback(errorCode) {
  if (fallbackSent || finished) return;
  fallbackSent = true;

  if (graceTimer) {
    clearTimeout(graceTimer);
    graceTimer = null;
  }

  console.log(`💧 Water error ${errorCode}; switching to fallback`);

  if (!fallbackId) {
    await sendTelegram(
      [
        "💧 Dreame X40: אין מים במיכל המים הנקיים",
        "⚠️ לא הוגדר קיצור חלופי.",
        `🕐 ${israelTime()}`,
      ].join("\n")
    );
    await finish(7);
    return;
  }

  phase = "fallback";

  // Disable CleanGenius before a non-CleanGenius fallback.
  if (primaryMode === "cleangenius") {
    await setCleanGenius(0);
    await new Promise((r) => setTimeout(r, 500));
  }

  await sendShortcut(fallbackName, fallbackId);
}

sub.on("properties", async (changes) => {
  if (finished) return;

  for (const p of changes) {
    // Dreame error code.
    if (p.siid === 2 && p.piid === 2) {
      const code = Number(p.value);
      console.log(`MQTT errorCode=${code}`);

      if (waterCodes.has(code)) {
        await useFallback(code);
        return;
      }
    }

    // Active cleaning task.
    if (p.siid === 4 && p.piid === 1 && Number(p.value) === 2) {
      console.log(`MQTT active task; phase=${phase}`);

      if (phase === "fallback") {
        await confirmFallback();
        return;
      }

      if (!graceTimer) {
        console.log(
          `Primary active; waiting ${graceSeconds}s for possible clean-water error...`
        );
        graceTimer = setTimeout(
          () => confirmPrimary(),
          graceSeconds * 1000
        );
      }
    }
  }
});

sub.on("error", (err) => {
  console.log("MQTT error:", err?.message || err);
});

setTimeout(async () => {
  if (finished) return;

  const targetLabel = phase === "fallback" ? fallbackName : primaryLabel();
  console.log(
    `⚠️ No MQTT start confirmation for ${targetLabel}; command was sent, treating as success.`
  );

  const lines = [
    "✅ Dreame X40: פקודת הניקוי נשלחה",
    "⚠️ Dreame לא החזיר אישור התחלה, לכן לא ניתן לאמת את ההפעלה דרך MQTT.",
  ];

  if (phase === "fallback") {
    lines.push(`🧹 תוכנית: ${fallbackName}`);
  } else if (primaryMode === "cleangenius") {
    lines.push(`🧠 מצב: CleanGenius ${cleanGeniusModeName()}`);
    lines.push(`🏠 חדרים: ${cleanGeniusLabel}`);
  } else {
    lines.push(`🧹 תוכנית: ${shortcutName}`);
  }

  lines.push(`🕐 שעה: ${israelTime()}`);

  await sendTelegram(lines.join("\n"));
  await finish(0);
}, timeoutSeconds * 1000);

// Subscribe FIRST, then send the task.
await new Promise((r) => setTimeout(r, 1500));
await startPrimary();

await new Promise(() => {});
