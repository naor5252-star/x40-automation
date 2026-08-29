const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();

const delaySeconds = Math.max(
  1,
  Number(process.env.TELEGRAM_FLOW_TEST_DELAY_SECONDS || "15")
);

if (!botToken || !chatId) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
}

function israelTime() {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

async function sendTelegram(text) {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Telegram HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`
    );
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const delayMs = delaySeconds * 1000;

console.log("🧪 Telegram flow test started.");
console.log("🚫 This test does NOT contact Dreame and does NOT start the robot.");
console.log(`⏱️ Test delay between status stages: ${delaySeconds}s`);

await sendTelegram(
  [
    "🧪 בדיקת אוטומציית Dreame — ללא הפעלת הרובוט",
    "",
    "1️⃣ 🏠 שניכם מחוץ לבית.",
    "⏱️ זמן ההמתנה הנדרש עבר — תנאי האוטומציה התקיים.",
    `🕐 שעה: ${israelTime()}`,
  ].join("\n")
);

await sendTelegram(
  [
    "🧪 בדיקה בלבד",
    "",
    "2️⃣ 📨 בוצעה בקשה להפעלת תרחיש הניקיון.",
    "🧠 מצב: CleanGenius Deep",
    "🏠 חדרים: סלון, חדר שינה ראשי 3, חדר שינה ראשי 2, משרד, מסדרון",
    "🚫 בפועל לא נשלחה שום פקודה לרובוט.",
    `🕐 שעה: ${israelTime()}`,
  ].join("\n")
);

console.log(`Waiting ${delaySeconds}s before primary status...`);
await wait(delayMs);

await sendTelegram(
  [
    "🧪 בדיקה בלבד",
    "",
    "3️⃣ 📊 סטטוס בקשת הניקיון אחרי 5 דקות",
    "✅ תרחיש הניקיון פעיל / בתהליך.",
    "🔎 זהו סטטוס מדומה לצורך בדיקת ההודעות בלבד.",
    `🕐 שעה: ${israelTime()}`,
  ].join("\n")
);

await sendTelegram(
  [
    "🧪 בדיקה בלבד",
    "",
    "4️⃣ 💧 אין מים במיכל המים הנקיים.",
    "📨 בוצעה בקשה להפעלת ה־fallback.",
    "🧹 תוכנית: שאיבה בלבד",
    "🚫 בפועל לא נשלחה שום פקודה לרובוט.",
    `🕐 שעה: ${israelTime()}`,
  ].join("\n")
);

console.log(`Waiting ${delaySeconds}s before fallback status...`);
await wait(delayMs);

await sendTelegram(
  [
    "🧪 בדיקה בלבד",
    "",
    "5️⃣ 📊 סטטוס בקשת ה־fallback אחרי 5 דקות",
    "✅ ה־fallback פעיל / בתהליך.",
    "🔎 זהו סטטוס מדומה לצורך בדיקת ההודעות בלבד.",
    `🕐 שעה: ${israelTime()}`,
  ].join("\n")
);

console.log("✅ Telegram flow test completed.");
