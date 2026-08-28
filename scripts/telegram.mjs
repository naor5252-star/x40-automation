const mode = (process.argv[2] || "watch").trim().toLowerCase();

const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();
const shortcutName = (process.env.DREAME_SHORTCUT_NAME || "ניקוי עמוק").trim();

function telegramUrl(method) {
  if (!botToken) throw new Error("Missing TELEGRAM_BOT_TOKEN");
  return `https://api.telegram.org/bot${botToken}/${method}`;
}

async function telegramCall(method, body = undefined) {
  const response = await fetch(telegramUrl(method), {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Telegram returned non-JSON: HTTP ${response.status} ${text.slice(0, 200)}`);
  }

  if (!response.ok || json.ok !== true) {
    throw new Error(`Telegram API failed: HTTP ${response.status} ${text.slice(0, 300)}`);
  }

  return json.result;
}

function israelTime(date = new Date()) {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

async function sendStartedMessage() {
  if (!chatId) throw new Error("Missing TELEGRAM_CHAT_ID");

  const text = [
    "🤖 Dreame X40 התחיל לעבוד",
    `🧹 תוכנית: ${shortcutName}`,
    `🕐 שעה: ${israelTime()}`,
  ].join("\n");

  await telegramCall("sendMessage", {
    chat_id: chatId,
    text,
  });

  console.log("✅ Telegram start notification sent.");
}

async function findChat() {
  const updates = await telegramCall("getUpdates");

  if (!Array.isArray(updates) || updates.length === 0) {
    console.log(`
No Telegram updates found yet.

1. Open your bot in Telegram.
2. Press START or send it a message such as: hello
3. Run this workflow again with mode=telegram-find-chat.
`);
    return;
  }

  const chats = new Map();

  for (const update of updates) {
    const message =
      update.message ||
      update.edited_message ||
      update.channel_post ||
      update.callback_query?.message;

    const chat = message?.chat;
    if (!chat?.id) continue;

    chats.set(String(chat.id), {
      id: String(chat.id),
      type: chat.type || "?",
      title: chat.title || "",
      username: chat.username || "",
      firstName: chat.first_name || "",
      lastName: chat.last_name || "",
    });
  }

  if (chats.size === 0) {
    console.log("Updates exist, but no chat IDs were found. Send a normal message to the bot and retry.");
    return;
  }

  console.log("\nTelegram chats found:");
  for (const chat of chats.values()) {
    const label = [
      chat.title,
      chat.firstName,
      chat.lastName,
      chat.username ? `@${chat.username}` : "",
    ].filter(Boolean).join(" ");

    console.log(
      `  TELEGRAM_CHAT_ID=${chat.id} | type=${chat.type}${label ? ` | ${label}` : ""}`
    );
  }
}

async function telegramTest() {
  if (!chatId) throw new Error("Missing TELEGRAM_CHAT_ID");

  await telegramCall("sendMessage", {
    chat_id: chatId,
    text: `✅ Dreame X40 Telegram מחובר בהצלחה\n🕐 ${israelTime()}`,
  });

  console.log("✅ Telegram test message sent.");
}

async function connectDreame() {
  const { DreameClient } = await import("node-dreame");

  const email = process.env.DREAME_EMAIL;
  const password = process.env.DREAME_PASSWORD;
  const configuredRegion = (process.env.DREAME_REGION || "sg").trim().toLowerCase();
  const wantedDid = (process.env.DREAME_DEVICE_DID || "").trim();

  if (!email || !password) {
    throw new Error("Missing DREAME_EMAIL or DREAME_PASSWORD");
  }

  const regions =
    configuredRegion === "auto"
      ? ["sg", "eu", "de", "us", "in", "ru", "tw", "cn"]
      : [configuredRegion];

  for (const region of regions) {
    try {
      const client = new DreameClient({ email, password, region });
      await client.login();
      const devices = await client.getDevices({ timeoutMs: 25000 });
      if (!devices.length) continue;

      let device;

      if (wantedDid) {
        device = devices.find((d) => String(d.did) === wantedDid);
      } else {
        device =
          devices.find((d) => /r2416|r2449/i.test(String(d.model))) ||
          devices.find((d) => /x40/i.test(String(d.name))) ||
          devices.find((d) => String(d.model).startsWith("dreame.vacuum.")) ||
          devices[0];
      }

      if (device) return { client, device, region };
    } catch (err) {
      console.log(
        `Telegram watcher: Dreame region ${region} failed: ${err?.message || err}`
      );
    }
  }

  throw new Error("Telegram watcher could not find Dreame X40");
}

async function watchForRobotStart() {
  if (!botToken || !chatId) {
    console.log(
      "ℹ️ Telegram secrets are not configured; skipping start notification watcher."
    );
    return;
  }

  const timeoutSeconds = Math.max(
    20,
    Number(process.env.TELEGRAM_WATCH_SECONDS || "75")
  );

  const { client, device, region } = await connectDreame();

  console.log(
    `Telegram watcher: ${device.name} | ${device.model} | region=${region}`
  );

  const sub = await client.subscribe(device);

  console.log(
    `✅ Telegram watcher MQTT connected. Waiting up to ${timeoutSeconds}s for TASK_STATUS=2...`
  );

  let done = false;

  await new Promise((resolve, reject) => {
    const timer = setTimeout(async () => {
      if (done) return;
      done = true;

      console.log(
        "⚠️ No confirmed robot-start MQTT event before timeout; Telegram notification was not sent."
      );

      await sub.close().catch(() => {});
      resolve();
    }, timeoutSeconds * 1000);

    sub.on("properties", async (changes) => {
      if (done) return;

      for (const p of changes) {
        // Dreame lifecycle: siid=4, piid=1, value=2 => active cleaning task.
        if (p.siid === 4 && p.piid === 1 && Number(p.value) === 2) {
          done = true;
          clearTimeout(timer);

          try {
            console.log("✅ Robot start confirmed by Dreame MQTT.");
            await sendStartedMessage();
            await sub.close().catch(() => {});
            resolve();
          } catch (err) {
            await sub.close().catch(() => {});
            reject(err);
          }

          return;
        }
      }
    });

    sub.on("error", (err) => {
      console.log(`Telegram watcher MQTT error: ${err?.message || err}`);
    });
  });
}

if (mode === "telegram-find-chat" || mode === "find-chat") {
  await findChat();
} else if (mode === "telegram-test" || mode === "test") {
  await telegramTest();
} else if (mode === "watch") {
  await watchForRobotStart();
} else {
  throw new Error(`Unknown Telegram mode: ${mode}`);
}
