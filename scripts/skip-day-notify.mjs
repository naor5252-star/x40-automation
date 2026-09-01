const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();

if (!botToken || !chatId) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
}

function israelTime() {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

const response = await fetch(
  `https://api.telegram.org/bot${botToken}/sendMessage`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: [
        "⏭️ ניקיון Dreame X40 דולג היום",
        "📅 האוטומציה לא תפעיל ניקיון אוטומטי עד מחר.",
        `🕐 שעה: ${israelTime()}`,
      ].join("\n"),
    }),
  }
);

if (!response.ok) {
  throw new Error(
    `Telegram HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`
  );
}

console.log("✅ Skip-day Telegram notification sent.");
