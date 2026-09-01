const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();

const ranToday =
  String(process.env.DREAME_RAN_TODAY || "false").toLowerCase() === "true";
const fallbackUsed =
  String(process.env.DREAME_FALLBACK_USED || "false").toLowerCase() === "true";

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

if (ranToday && !fallbackUsed) {
  await sendTelegram(
    [
      "🪣 תזכורת אחרי ניקיון",
      "🤖 ה־Dreame X40 עבד היום ללא fallback.",
      "💦 כדאי לרוקן את מיכל המים המלוכלכים.",
      `🕐 שעה: ${israelTime()}`,
    ].join("\n")
  );
}

console.log("✅ Evening reminder completed.");
