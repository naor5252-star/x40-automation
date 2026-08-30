import { DreameClient } from "node-dreame";

const email = process.env.DREAME_EMAIL;
const password = process.env.DREAME_PASSWORD;
const region = (process.env.DREAME_REGION || "sg").trim();
const wantedDid = (process.env.DREAME_DEVICE_DID || "").trim();
const returnedBy = (process.env.DREAME_RETURNED_BY || "").trim().toLowerCase();

const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();

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

function returnedLabel() {
  if (returnedBy === "naor") return "נאור חזר הביתה";
  if (returnedBy === "wife") return "בת הזוג חזרה הביתה";
  return "אחד מכם חזר הביתה";
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
      `Telegram HTTP ${response.status}: ${(await response.text()).slice(0, 250)}`
    );
  }
}

function isNoAck(err) {
  return (
    err?.body?.code === 80001 ||
    String(err?.name || "").includes("Offline") ||
    String(err?.message || "").includes("80001")
  );
}

async function runCommand(label, fn) {
  try {
    const result = await fn();
    console.log(`${label}:`, JSON.stringify(result));
    return { sent: true, noAck: result?.kind === "no-ack", error: null };
  } catch (err) {
    if (isNoAck(err)) {
      console.log(`${label}: no HTTP ACK; command may still execute.`);
      return { sent: true, noAck: true, error: null };
    }

    console.log(`${label} failed:`, err?.message || err);
    return { sent: false, noAck: false, error: err?.message || String(err) };
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
console.log(`🏠 Return-home event: ${returnedBy || "unknown"}`);

const vacuum = client.getVacuum(device);

const stopResult = await runCommand(
  "STOP",
  () => vacuum.cancelCurrentJob()
);

await new Promise((resolve) => setTimeout(resolve, 1500));

const dockResult = await runCommand(
  "DOCK",
  () => vacuum.goHome()
);

if (stopResult.sent || dockResult.sent) {
  await sendTelegram(
    [
      `🏠 ${returnedLabel()}.`,
      "🛑 בוצעה בקשה לעצור את תרחיש הניקיון.",
      "🔌 בוצעה בקשה להחזיר את Dreame X40 לעמדת הטעינה.",
      ...(stopResult.noAck || dockResult.noAck
        ? ["ℹ️ Dreame לא החזיר ACK מלא, אבל פקודות העצירה והחזרה נשלחו."]
        : []),
      `🕐 שעה: ${israelTime()}`,
    ].join("\n")
  );
} else {
  await sendTelegram(
    [
      `🏠 ${returnedLabel()}.`,
      "⚠️ לא הצלחתי לשלוח לרובוט את פקודת העצירה/החזרה לעמדה.",
      `🕐 שעה: ${israelTime()}`,
    ].join("\n")
  );
  process.exit(2);
}
