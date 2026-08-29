import { DreameClient } from "node-dreame";

const primaryName = (process.env.DREAME_SHORTCUT_NAME || "ניקוי עמוק").trim();
const primaryId = (process.env.DREAME_SHORTCUT_ID || "").trim();

const fallbackName = (process.env.DREAME_FALLBACK_SHORTCUT_NAME || "שאיבה בלבד").trim();
const fallbackId = (process.env.DREAME_FALLBACK_SHORTCUT_ID || "").trim();

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

const timeoutSeconds = Math.max(30, Number(process.env.DREAME_SMART_RUN_TIMEOUT_SECONDS || "100"));
const graceSeconds = Math.max(3, Number(process.env.DREAME_PRIMARY_GRACE_SECONDS || "12"));

if (!email || !password) throw new Error("Missing Dreame credentials");
if (!primaryId) throw new Error("Missing DREAME_SHORTCUT_ID");

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

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
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
console.log(`Primary: ${primaryName} (${primaryId})`);
console.log(`Fallback: ${fallbackName} (${fallbackId || "not configured"})`);
console.log(`Water codes: ${[...waterCodes].join(",")}`);

async function sendShortcut(name, id) {
  console.log(`▶️ Sending "${name}" id=${id}`);

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
      console.log(`⚠️ No HTTP ACK for "${name}", continuing with MQTT`);
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

async function confirm(name, fallback) {
  console.log(`✅ Confirmed cleaning: ${name}`);

  const lines = ["🤖 Dreame X40 התחיל לעבוד"];
  if (fallback) {
    lines.push("💧 אין מים במיכל המים הנקיים — עברתי לתוכנית החלופית");
  }
  lines.push(`🧹 תוכנית: ${name}`);
  lines.push(`🕐 שעה: ${israelTime()}`);

  await sendTelegram(lines.join("\n"));
  await finish(0);
}

async function useFallback(errorCode) {
  if (fallbackSent || finished) return;
  fallbackSent = true;

  if (graceTimer) {
    clearTimeout(graceTimer);
    graceTimer = null;
  }

  console.log(`💧 Clean-water error ${errorCode}; switching to fallback`);

  if (!fallbackId) {
    await sendTelegram(
      `💧 Dreame X40: אין מים במיכל המים הנקיים\n⚠️ לא הוגדר קיצור חלופי\n🕐 ${israelTime()}`
    );
    await finish(7);
    return;
  }

  phase = "fallback";
  await sendShortcut(fallbackName, fallbackId);
}

sub.on("properties", async (changes) => {
  for (const p of changes) {
    // Error code is siid=2/piid=2.
    if (p.siid === 2 && p.piid === 2) {
      const code = Number(p.value);
      console.log(`MQTT errorCode=${code}`);

      if (waterCodes.has(code)) {
        await useFallback(code);
        return;
      }
    }

    // Active task: siid=4/piid=1/value=2.
    if (p.siid === 4 && p.piid === 1 && Number(p.value) === 2) {
      console.log(`MQTT active task; phase=${phase}`);

      if (phase === "fallback") {
        await confirm(fallbackName, true);
        return;
      }

      // Give the dock a few seconds to report an empty clean-water tank.
      if (!graceTimer) {
        graceTimer = setTimeout(
          () => confirm(primaryName, false),
          graceSeconds * 1000
        );
      }
    }
  }
});

sub.on("error", (err) => console.log("MQTT error:", err?.message || err));

setTimeout(async () => {
  if (finished) return;
  await sendTelegram(
    `⚠️ Dreame X40: לא הצלחתי לאשר שהניקוי התחיל\n🕐 ${israelTime()}`
  );
  await finish(8);
}, timeoutSeconds * 1000);

await new Promise((r) => setTimeout(r, 1500));
await sendShortcut(primaryName, primaryId);

await new Promise(() => {});

