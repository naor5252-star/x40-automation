import { DreameClient } from "node-dreame";

const email = process.env.DREAME_EMAIL;
const password = process.env.DREAME_PASSWORD;
const region = (process.env.DREAME_REGION || "sg").trim();
const wantedDid = (process.env.DREAME_DEVICE_DID || "").trim();
const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();
const callbackUrl = (process.env.DREAME_CALLBACK_URL || "").trim();
const callbackToken = (process.env.DREAME_CALLBACK_TOKEN || "").trim();

const waterCodes = new Set(
  String(process.env.DREAME_WATER_EMPTY_CODES || "107,116")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter(Number.isFinite)
);

if (!email || !password) {
  throw new Error("Missing DREAME_EMAIL or DREAME_PASSWORD");
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
  if (!botToken || !chatId) return;

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Telegram HTTP ${response.status}: ${(await response.text()).slice(0, 250)}`
    );
  }
}

function extractNumericValues(value) {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  if (typeof value === "number") return [value];
  if (typeof value === "string") {
    return value
      .split(/[,\s]+/)
      .map((x) => Number(x.trim()))
      .filter(Number.isFinite);
  }
  return [];
}

async function reportWaterStatus(payload) {
  if (!callbackUrl || !callbackToken) {
    throw new Error("Water callback URL/token missing");
  }

  const endpoint = callbackUrl.replace(/\/$/, "") + "/water-event";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Water-Callback-Token": callbackToken,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Water callback HTTP ${response.status}: ${(await response.text()).slice(0, 250)}`
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

let waterMissing = false;
let waterStatusKnown = false;
let detectedCodes = [];

try {
  const props = await client.getProperties(
    String(device.did),
    [
      { siid: 2, piid: 2 },
      { siid: 4, piid: 18 },
    ],
    { timeoutMs: 20000 }
  );

  const codes = [];

  for (const p of props || []) {
    if (!p || (p.code !== 0 && p.code !== undefined)) continue;
    if (p.value === undefined || p.value === null) continue;

    if (p.siid === 2 && p.piid === 2) {
      const n = Number(p.value);
      if (Number.isFinite(n)) codes.push(n);
      waterStatusKnown = true;
    }

    if (p.siid === 4 && p.piid === 18) {
      codes.push(...extractNumericValues(p.value));
      waterStatusKnown = true;
    }
  }

  detectedCodes = [...new Set(codes)];
  waterMissing = detectedCodes.some((code) => waterCodes.has(code));
} catch (err) {
  console.log(`⚠️ Water status read failed: ${err?.message || err}`);
}

const status = waterMissing ? "missing" : waterStatusKnown ? "ok" : "unknown";
const checkedAt = new Date().toISOString();

await reportWaterStatus({
  status,
  waterMissing,
  waterStatusKnown,
  codes: detectedCodes,
  checkedAt,
});

if (waterMissing) {
  await sendTelegram(
    [
      "💧 בדיקת מים לקראת ההפעלה הבאה",
      "⚠️ זוהה שחסרים מים במיכל המים הנקיים.",
      "🚰 צריך למלא את המיכל לפני הניקוי הבא.",
      `🕐 שעה: ${israelTime()}`,
    ].join("\n")
  );
}

console.log(
  `✅ Water check completed: status=${status}, codes=${detectedCodes.join(",") || "none"}`
);
