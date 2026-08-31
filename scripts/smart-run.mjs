import { DreameClient } from "node-dreame";

const primaryMode = (process.env.DREAME_PRIMARY_MODE || "shortcut").trim().toLowerCase();
const shortcutName = (process.env.DREAME_SHORTCUT_NAME || "ניקוי עמוק").trim();
const shortcutId = (process.env.DREAME_SHORTCUT_ID || "").trim();

const requestedRoomText = String(process.env.DREAME_CLEAN_GENIUS_ROOMS || "2,3,4,7,8").trim();
const roomText = requestedRoomText.replace(/\s+/g, "") === "7,1,2,4,5"
  ? "2,3,4,7,8"
  : requestedRoomText;
const roomIds = roomText.split(",").map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x > 0);

const cleanGeniusMode = Number(process.env.DREAME_CLEAN_GENIUS_MODE || "1");
const cleanGeniusLabel = (
  process.env.DREAME_CLEAN_GENIUS_LABEL ||
  "סלון, חדר שינה ראשי 3, חדר שינה ראשי 2, משרד, מסדרון"
).trim();

const fallbackName = (process.env.DREAME_FALLBACK_SHORTCUT_NAME || "שאיבה בלבד").trim();
const fallbackId = (process.env.DREAME_FALLBACK_SHORTCUT_ID || "").trim();

const waterCodes = new Set(
  String(process.env.DREAME_WATER_EMPTY_CODES || "107,116")
    .split(",").map((x) => Number(x.trim())).filter(Number.isFinite)
);

const email = process.env.DREAME_EMAIL;
const password = process.env.DREAME_PASSWORD;
const region = (process.env.DREAME_REGION || "sg").trim();
const wantedDid = (process.env.DREAME_DEVICE_DID || "").trim();
const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();

const callbackUrl = (process.env.DREAME_CALLBACK_URL || "").trim();
const callbackToken = (process.env.DREAME_CALLBACK_TOKEN || "").trim();

async function sendRunEvent(event) {
  if (!callbackUrl || !callbackToken) {
    console.log(`Run callback not configured; skipped event=${event}`);
    return;
  }

  try {
    const endpoint = callbackUrl.replace(/\/$/, "") + "/run-event";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Run-Callback-Token": callbackToken,
      },
      body: JSON.stringify({ event }),
    });

    if (!response.ok) {
      console.log(
        `Run callback ${event} HTTP ${response.status}: ` +
        `${(await response.text()).slice(0, 200)}`
      );
    } else {
      console.log(`✅ Run callback sent: ${event}`);
    }
  } catch (err) {
    console.log(`Run callback ${event} failed: ${err?.message || err}`);
  }
}

const statusDelaySeconds = Math.max(60, Number(process.env.DREAME_STATUS_DELAY_SECONDS || "300"));
const statusDelayMs = statusDelaySeconds * 1000;

if (!email || !password) throw new Error("Missing Dreame credentials");
if (primaryMode === "shortcut" && !shortcutId) throw new Error("primary_mode=shortcut requires DREAME_SHORTCUT_ID");
if (primaryMode === "cleangenius") {
  if (!roomIds.length) throw new Error("DREAME_CLEAN_GENIUS_ROOMS is empty/invalid");
  if (![1, 2].includes(cleanGeniusMode)) throw new Error("DREAME_CLEAN_GENIUS_MODE must be 1 or 2");
}

function cleanGeniusModeName() { return cleanGeniusMode === 2 ? "Deep" : "Routine"; }
function primaryLabel() {
  return primaryMode === "cleangenius" ? `CleanGenius ${cleanGeniusModeName()}` : shortcutName;
}
function israelTime() {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());
}

async function sendTelegram(text) {
  if (!botToken || !chatId) {
    console.log("Telegram not configured; skipped:", text.replace(/\n/g, " | "));
    return;
  }
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!response.ok) {
    console.log(`Telegram HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
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
console.log(`Status delay: ${statusDelaySeconds}s`);
if (requestedRoomText !== roomText) console.log(`⚠️ Migrated room IDs ${requestedRoomText} -> ${roomText}`);

async function setCleanGenius(mode) {
  try {
    await client.setProperties(
      String(device.did),
      [{ siid: 4, piid: 50, value: JSON.stringify({ k: "SmartHost", v: Number(mode) }) }],
      { timeoutMs: 15000 }
    );
  } catch (err) {
    const code = err?.body?.code;
    if (code === 80001 || String(err?.name || "").includes("Offline") || String(err?.message || "").includes("80001")) {
      console.log("⚠️ SmartHost no HTTP ACK; continuing.");
      return;
    }
    throw err;
  }
}

async function sendShortcut(name, id) {
  try {
    await client.callAction(
      String(device.did),
      { siid: 4, aiid: 1, in: [{ piid: 1, value: 25 }, { piid: 10, value: String(id) }] },
      { timeoutMs: 20000 }
    );
  } catch (err) {
    const code = err?.body?.code;
    if (code === 80001 || String(err?.name || "").includes("Offline") || String(err?.message || "").includes("80001")) {
      console.log(`⚠️ No HTTP ACK for "${name}"; command may still execute.`);
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
  await setCleanGenius(cleanGeniusMode);
  await new Promise((r) => setTimeout(r, 800));
  const vacuum = client.getVacuum(device);
  try {
    const result = await vacuum.cleanSegments(roomIds);
    console.log("cleanSegments result:", JSON.stringify(result));
  } catch (err) {
    const code = err?.body?.code;
    if (code === 80001 || String(err?.name || "").includes("Offline") || String(err?.message || "").includes("80001")) {
      console.log("⚠️ cleanSegments no HTTP ACK; command may still execute.");
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
let primaryStatusSent = false;
let fallbackStatusSent = false;
let primaryRequestedAt = 0;
let fallbackRequestedAt = 0;
let primaryActiveSeen = false;
let fallbackActiveSeen = false;
let lastMiotState = null, lastMiotStateAt = 0;
let lastTaskStatus = null, lastTaskStatusAt = 0;
let lastErrorCode = null, lastErrorCodeAt = 0;
let primaryStatusTimer = null, fallbackStatusTimer = null;

const ACTIVE_MIOT_STATES = new Set([1,7,9,10,12,17,18,20,22,23,25,27,28,30,37,38,97,101,103,104,105,107,116,117,120,121,122]);
const PAUSED_MIOT_STATES = new Set([3,4,21,102,106,108]);
const IDLE_MIOT_STATES = new Set([2,5,6,8,13,24,29]);
const MIOT_STATE_NAMES = new Map([
  [1,"ניקוי"],[2,"המתנה"],[3,"מושהה"],[4,"מושהה"],[5,"חוזר לעמדה"],[6,"טעינה"],
  [7,"שטיפה"],[8,"ייבוש מטליות"],[9,"ניקוי מטליות"],[10,"חוזר לשטיפה"],[12,"ניקוי"],
  [13,"טעינה הושלמה"],[17,"חוזר להתקנת מטליות"],[18,"חוזר להסרת מטליות"],
  [20,"מילוי מים / שטיפת מטליות"],[21,"ניקוי מושהה"],[22,"ריקון אבק"],[23,"ניקוי מרחוק"],
  [25,"שלב ניקוי נוסף"],[27,"ניקוי חלקי"],[28,"חוזר לריקון"],[29,"ממתין למשימה"],
  [30,"ניקוי בסיס"],[97,"קיצור דרך פעיל"],[101,"ניקוי עמוק התחלתי"],
  [116,"מתקין מטלית"],[117,"מסיר מטלית"],[121,"נכנס לעמדה"],[122,"יוצא מהעמדה"],
]);

function updateObservedProperty(p) {
  const now = Date.now();
  if (p.siid === 2 && p.piid === 1) {
    lastMiotState = Number(p.value); lastMiotStateAt = now;
    console.log(`state=${lastMiotState}`);
  }
  if (p.siid === 4 && p.piid === 1) {
    lastTaskStatus = Number(p.value); lastTaskStatusAt = now;
    console.log(`taskStatus=${lastTaskStatus} phase=${phase}`);
    if (lastTaskStatus === 2) {
      if (phase === "fallback") {
        fallbackActiveSeen = true;
        void sendRunEvent("fallback-active");
      } else {
        primaryActiveSeen = true;
        void sendRunEvent("primary-active");
      }
    }
  }
  if (p.siid === 2 && p.piid === 2) {
    lastErrorCode = Number(p.value); lastErrorCodeAt = now;
    console.log(`errorCode=${lastErrorCode}`);
  }
}

async function refreshStatusBestEffort() {
  try {
    const result = await client.getProperties(
      String(device.did),
      [{ siid: 2, piid: 1 }, { siid: 4, piid: 1 }, { siid: 2, piid: 2 }],
      { timeoutMs: 15000 }
    );
    for (const p of result || []) {
      if (p && (p.code === 0 || p.code === undefined) && p.value !== undefined) updateObservedProperty(p);
    }
  } catch (err) {
    console.log(`⚠️ Status HTTP refresh unavailable: ${err?.message || err}`);
  }
}

function technicalStateLine() {
  const stateName = MIOT_STATE_NAMES.get(lastMiotState) || "לא ידוע";
  const state = lastMiotState === null ? "?" : `${lastMiotState} (${stateName})`;
  const task = lastTaskStatus === null ? "?" : String(lastTaskStatus);
  const error = lastErrorCode === null ? "?" : String(lastErrorCode);
  return `🔎 state=${state}, task=${task}, error=${error}`;
}

function requestStatus(kind) {
  const requestAt = kind === "fallback" ? fallbackRequestedAt : primaryRequestedAt;
  const activeSeen = kind === "fallback" ? fallbackActiveSeen : primaryActiveSeen;

  if (kind === "primary" && fallbackSent) {
    return ["💧 זוהה חוסר מים במיכל המים הנקיים.", "➡️ הבקשה הראשית הועברה ל־fallback.", technicalStateLine()];
  }

  const freshTask = lastTaskStatusAt >= requestAt;
  const freshState = lastMiotStateAt >= requestAt;
  const freshError = lastErrorCodeAt >= requestAt;

  if (activeSeen || (freshTask && lastTaskStatus === 2) || (freshState && ACTIVE_MIOT_STATES.has(lastMiotState))) {
    return [kind === "fallback" ? "✅ ה־fallback פעיל / בתהליך." : "✅ תרחיש הניקיון פעיל / בתהליך.", technicalStateLine()];
  }
  if (freshState && PAUSED_MIOT_STATES.has(lastMiotState)) {
    return ["⏸️ התרחיש מושהה כרגע.", technicalStateLine()];
  }
  if (freshError && lastErrorCode !== 0 && lastErrorCode !== 68 && !(kind === "fallback" && waterCodes.has(lastErrorCode))) {
    return [`❌ זוהתה שגיאה ברובוט: ${lastErrorCode}.`, technicalStateLine()];
  }
  if (freshState && IDLE_MIOT_STATES.has(lastMiotState)) {
    return [kind === "fallback" ? "⚠️ ה־fallback לא נראה פעיל כרגע." : "⚠️ תרחיש הניקיון לא נראה פעיל כרגע.", technicalStateLine()];
  }
  return ["⚠️ הפקודה נשלחה, אבל ה־X40 לא החזיר אישור מצב חד־משמעי.", technicalStateLine()];
}

async function finish(code = 0) {
  if (finished) return;
  finished = true;
  if (primaryStatusTimer) clearTimeout(primaryStatusTimer);
  if (fallbackStatusTimer) clearTimeout(fallbackStatusTimer);
  await sub.close().catch(() => {});
  process.exit(code);
}

async function maybeFinish() {
  if (!primaryStatusSent) return;
  if (fallbackSent && !fallbackStatusSent) return;
  await finish(0);
}

async function sendPrimaryStatus() {
  if (finished || primaryStatusSent) return;
  await refreshStatusBestEffort();

  if (!fallbackSent && lastErrorCode !== null && waterCodes.has(lastErrorCode)) {
    await useFallback(lastErrorCode);
  }

  await sendTelegram([
    "📊 סטטוס בקשת הניקיון אחרי 5 דקות",
    ...requestStatus("primary"),
    `🕐 שעה: ${israelTime()}`,
  ].join("\n"));

  primaryStatusSent = true;
  await maybeFinish();
}

async function sendFallbackStatus() {
  if (finished || fallbackStatusSent) return;
  await refreshStatusBestEffort();

  await sendTelegram([
    "📊 סטטוס בקשת ה־fallback אחרי 5 דקות",
    ...requestStatus("fallback"),
    `🧹 fallback: ${fallbackName}`,
    `🕐 שעה: ${israelTime()}`,
  ].join("\n"));

  fallbackStatusSent = true;
  await maybeFinish();
}

async function useFallback(errorCode) {
  if (fallbackSent || finished) return;
  fallbackSent = true;
  phase = "fallback";
  console.log(`💧 Water error ${errorCode}; switching to fallback`);

  if (!fallbackId) {
    await sendTelegram([
      "💧 אין מים במיכל המים הנקיים.",
      "❌ לא ניתן לשלוח fallback כי לא הוגדר fallback ID.",
      `🕐 שעה: ${israelTime()}`,
    ].join("\n"));
    fallbackStatusSent = true;
    return;
  }

  if (primaryMode === "cleangenius") {
    await setCleanGenius(0);
    await new Promise((r) => setTimeout(r, 500));
  }

  fallbackRequestedAt = Date.now();

  try {
    await sendShortcut(fallbackName, fallbackId);
  } catch (err) {
    await sendTelegram([
      "💧 אין מים במיכל המים הנקיים.",
      `❌ ניסיון לשלוח fallback נכשל: ${err?.message || err}`,
      `🕐 שעה: ${israelTime()}`,
    ].join("\n"));
    fallbackStatusSent = true;
    return;
  }

  await sendRunEvent("fallback-used");

  await sendTelegram([
    "💧 אין מים במיכל המים הנקיים.",
    "📨 בוצעה בקשה להפעלת ה־fallback.",
    `🧹 תוכנית: ${fallbackName}`,
    `🕐 שעה: ${israelTime()}`,
  ].join("\n"));

  fallbackStatusTimer = setTimeout(() => void sendFallbackStatus(), statusDelayMs);
}

sub.on("properties", async (changes) => {
  if (finished) return;
  for (const p of changes) {
    updateObservedProperty(p);
    if (p.siid === 2 && p.piid === 2 && waterCodes.has(Number(p.value)) && !fallbackSent) {
      await useFallback(Number(p.value));
    }
  }
});

sub.on("error", (err) => console.log("MQTT error:", err?.message || err));

await sendTelegram([
  "🏠 שניכם מחוץ לבית.",
  "⏱️ זמן ההמתנה הנדרש עבר — תנאי האוטומציה התקיים.",
  `🕐 שעה: ${israelTime()}`,
].join("\n"));

await new Promise((r) => setTimeout(r, 1500));

primaryRequestedAt = Date.now();
primaryStatusTimer = setTimeout(() => void sendPrimaryStatus(), statusDelayMs);

try {
  await startPrimary();
} catch (err) {
  await sendTelegram([
    "❌ לא הצלחתי לשלוח את בקשת תרחיש הניקיון.",
    `שגיאה: ${err?.message || err}`,
    `🕐 שעה: ${israelTime()}`,
  ].join("\n"));
  await finish(1);
}

await sendTelegram([
  "📨 בוצעה בקשה להפעלת תרחיש הניקיון.",
  `🧠 מצב: ${primaryLabel()}`,
  ...(primaryMode === "cleangenius" ? [`🏠 חדרים: ${cleanGeniusLabel}`, `🔢 IDs: ${roomIds.join(",")}`] : []),
  `🕐 שעה: ${israelTime()}`,
].join("\n"));

await new Promise(() => {});
