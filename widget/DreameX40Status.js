// Dreame X40 Status Widget for Scriptable
// Shows presence for two people + whether the robot automation ran today.
//
// First run inside Scriptable will ask for:
// - Cloudflare Worker URL
// - WIDGET_TOKEN
// - Display names
//
// The token is stored in iOS Keychain by Scriptable, not in this source file.

const CONFIG_KEY = "dreame-x40-status-widget-v1";
const DEFAULT_WORKER_URL = "https://x40-automation.naor-5252.workers.dev";

async function setup(existing = null) {
  const a = new Alert();
  a.title = "הגדרת Dreame X40";
  a.message = "הזן את כתובת ה-Worker ואת WIDGET_TOKEN שהגדרת ב-Cloudflare.";

  a.addTextField(
    "Worker URL",
    existing?.workerUrl || DEFAULT_WORKER_URL
  );

  if (typeof a.addSecureTextField === "function") {
    a.addSecureTextField(
      "WIDGET_TOKEN",
      existing?.widgetToken || ""
    );
    a.addSecureTextField(
      "WEBHOOK_TOKEN (לכפתור דלג יום)",
      existing?.controlToken || ""
    );
  } else {
    a.addTextField(
      "WIDGET_TOKEN",
      existing?.widgetToken || ""
    );
    a.addTextField(
      "WEBHOOK_TOKEN (לכפתור דלג יום)",
      existing?.controlToken || ""
    );
  }

  a.addTextField("שם 1", existing?.person1Name || "נאור");
  a.addTextField("שם 2", existing?.person2Name || "אשתי");

  a.addAction("שמור");
  a.addCancelAction("ביטול");

  const result = await a.presentAlert();
  if (result === -1) return existing;

  const cfg = {
    workerUrl: sanitizeBaseUrl(a.textFieldValue(0)),
    widgetToken: a.textFieldValue(1).trim(),
    controlToken: a.textFieldValue(2).trim(),
    person1Name: a.textFieldValue(3).trim() || "נאור",
    person2Name: a.textFieldValue(4).trim() || "אשתי",
  };

  if (!cfg.workerUrl.startsWith("https://")) {
    throw new Error("כתובת ה-Worker חייבת להתחיל ב-https://");
  }
  if (!cfg.widgetToken) {
    throw new Error("חסר WIDGET_TOKEN");
  }

  Keychain.set(CONFIG_KEY, JSON.stringify(cfg));
  return cfg;
}

function sanitizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function loadConfig() {
  if (!Keychain.contains(CONFIG_KEY)) return null;
  try {
    return JSON.parse(Keychain.get(CONFIG_KEY));
  } catch {
    return null;
  }
}

async function settingsMenu(cfg) {
  const menu = new Alert();
  menu.title = "Dreame X40 Widget";
  menu.addAction("תצוגה מקדימה");
  menu.addAction("שנה הגדרות");
  menu.addDestructiveAction("מחק הגדרות");
  menu.addCancelAction("ביטול");

  const choice = await menu.presentSheet();

  if (choice === 1) {
    return await setup(cfg);
  }

  if (choice === 2) {
    if (Keychain.contains(CONFIG_KEY)) Keychain.remove(CONFIG_KEY);
    return await setup(null);
  }

  if (choice === -1) {
    Script.complete();
    return null;
  }

  return cfg;
}

async function getStatus(cfg) {
  const req = new Request(`${cfg.workerUrl}/status`);
  req.method = "GET";
  req.headers = {
    "X-Widget-Token": cfg.widgetToken,
    "Accept": "application/json",
  };
  req.timeoutInterval = 12;

  return await req.loadJSON();
}

async function ensureControlToken(cfg) {
  if (cfg?.controlToken) return cfg;

  const a = new Alert();
  a.title = "הפעלת דלג יום";
  a.message =
    "נדרש WEBHOOK_TOKEN פעם אחת. הוא יישמר ב-Keychain של Scriptable ולא בקוד.";

  if (typeof a.addSecureTextField === "function") {
    a.addSecureTextField("WEBHOOK_TOKEN", "");
  } else {
    a.addTextField("WEBHOOK_TOKEN", "");
  }

  a.addAction("שמור");
  a.addCancelAction("ביטול");

  const choice = await a.presentAlert();
  if (choice === -1) return null;

  const controlToken = a.textFieldValue(0).trim();
  if (!controlToken) throw new Error("חסר WEBHOOK_TOKEN");

  const updated = { ...cfg, controlToken };
  Keychain.set(CONFIG_KEY, JSON.stringify(updated));
  return updated;
}

function actionUrl(action) {
  const base = URLScheme.forRunningScript();
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}action=${encodeURIComponent(action)}`;
}

async function skipToday(cfg) {
  const req = new Request(`${cfg.workerUrl}/skip-today`);
  req.method = "POST";
  req.headers = {
    "X-Webhook-Token": cfg.controlToken,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  req.body = JSON.stringify({ source: "widget" });
  req.timeoutInterval = 15;

  const result = await req.loadJSON();
  const statusCode = req.response?.statusCode || 200;

  if (statusCode >= 400) {
    throw new Error(
      result?.error ||
      result?.message ||
      `Worker החזיר HTTP ${statusCode}`
    );
  }

  return result;
}

function stateInfo(value) {
  const state = value?.state;

  if (state === "home") {
    return {
      text: "בבית",
      symbol: "house.fill",
      color: new Color("#34C759"),
    };
  }

  if (state === "away") {
    return {
      text: "בחוץ",
      symbol: "figure.walk",
      color: new Color("#FF9F0A"),
    };
  }

  return {
    text: "לא ידוע",
    symbol: "questionmark.circle",
    color: Color.gray(),
  };
}

function shortTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const df = new DateFormatter();
    df.locale = "he_IL";
    df.dateFormat = "HH:mm";
    return df.string(d);
  } catch {
    return "";
  }
}

function updatedText(person) {
  const t = shortTime(person?.updatedAt);
  return t ? `עודכן ${t}` : "";
}

function addSymbol(parent, name, color, size = 18) {
  const image = SFSymbol.named(name).image;
  const img = parent.addImage(image);
  img.imageSize = new Size(size, size);
  img.tintColor = color;
  img.resizable = false;
  return img;
}

function addPersonCard(parent, name, person) {
  const info = stateInfo(person);

  const card = parent.addStack();
  card.layoutVertically();
  card.setPadding(10, 10, 10, 10);
  card.cornerRadius = 12;
  card.backgroundColor = Color.dynamic(
    new Color("#F2F2F7"),
    new Color("#1C1C1E")
  );

  const top = card.addStack();
  top.centerAlignContent();

  addSymbol(top, info.symbol, info.color, 18);
  top.addSpacer(6);

  const title = top.addText(name);
  title.font = Font.semiboldSystemFont(13);
  title.textColor = Color.dynamic(Color.black(), Color.white());
  title.lineLimit = 1;

  card.addSpacer(7);

  const state = card.addText(info.text);
  state.font = Font.boldSystemFont(17);
  state.textColor = info.color;

  const upd = updatedText(person);
  if (upd) {
    card.addSpacer(3);
    const u = card.addText(upd);
    u.font = Font.systemFont(9);
    u.textColor = Color.gray();
    u.lineLimit = 1;
  }

  return card;
}

function buildWidget(data, cfg) {
  const w = new ListWidget();

  const bg = new LinearGradient();
  bg.colors = [
    Color.dynamic(new Color("#FFFFFF"), new Color("#111113")),
    Color.dynamic(new Color("#F5F5F7"), new Color("#1A1A1D")),
  ];
  bg.locations = [0, 1];
  w.backgroundGradient = bg;
  w.setPadding(13, 13, 13, 13);

  const header = w.addStack();
  header.centerAlignContent();

  addSymbol(
    header,
    "sparkles",
    Color.dynamic(new Color("#6E6E73"), new Color("#AEAEB2")),
    15
  );
  header.addSpacer(6);

  const title = header.addText("Dreame X40");
  title.font = Font.boldSystemFont(15);
  title.textColor = Color.dynamic(Color.black(), Color.white());

  header.addSpacer();

  const time = header.addText(data?.localTime?.time?.slice(0, 5) || "");
  time.font = Font.systemFont(10);
  time.textColor = Color.gray();

  w.addSpacer(10);

  const family = config.widgetFamily || "medium";

  if (family === "small") {
    const p1 = stateInfo(data?.naor);
    const p2 = stateInfo(data?.wife);

    const line1 = w.addStack();
    line1.centerAlignContent();
    addSymbol(line1, p1.symbol, p1.color, 15);
    line1.addSpacer(6);
    const t1 = line1.addText(`${cfg.person1Name}: ${p1.text}`);
    t1.font = Font.semiboldSystemFont(12);
    t1.textColor = Color.dynamic(Color.black(), Color.white());

    w.addSpacer(7);

    const line2 = w.addStack();
    line2.centerAlignContent();
    addSymbol(line2, p2.symbol, p2.color, 15);
    line2.addSpacer(6);
    const t2 = line2.addText(`${cfg.person2Name}: ${p2.text}`);
    t2.font = Font.semiboldSystemFont(12);
    t2.textColor = Color.dynamic(Color.black(), Color.white());

    w.addSpacer(10);

    addRobotStatus(w, data, true, cfg);
  } else {
    const people = w.addStack();
    people.layoutHorizontally();

    addPersonCard(people, cfg.person1Name, data?.naor);
    people.addSpacer(8);
    addPersonCard(people, cfg.person2Name, data?.wife);

    w.addSpacer(9);
    addRobotStatus(w, data, false, cfg);
  }

  // iOS may decide to refresh later; this is the requested earliest refresh.
  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);

  // Tapping opens Scriptable and refreshes/preview the script.
  w.url = URLScheme.forRunningScript();

  return w;
}

function addRobotStatus(parent, data, compact, cfg) {
  const today = data?.localTime?.date;
  const runInfo = data?.runInfo;
  const skipInfo = data?.skipInfo;
  const runs = runInfo?.date === today ? Number(runInfo?.count || 0) : 0;
  const ranToday = runs > 0;
  const skippedToday = skipInfo?.date === today;
  const runTime = ranToday ? shortTime(runInfo?.lastRunAt) : "";
  const skipTime = skippedToday ? shortTime(skipInfo?.skippedAt) : "";

  const row = parent.addStack();
  row.centerAlignContent();
  row.setPadding(compact ? 8 : 10, 10, compact ? 8 : 10, 10);
  row.cornerRadius = 12;
  row.backgroundColor = Color.dynamic(
    new Color("#F2F2F7"),
    new Color("#1C1C1E")
  );

  const color = skippedToday
    ? new Color("#FF9F0A")
    : ranToday
      ? new Color("#34C759")
      : Color.gray();

  const symbol = skippedToday
    ? "forward.fill"
    : ranToday
      ? "checkmark.circle.fill"
      : "circle";

  addSymbol(row, symbol, color, compact ? 17 : 20);
  row.addSpacer(8);

  const texts = row.addStack();
  texts.layoutVertically();

  const main = texts.addText(
    skippedToday
      ? `היום דולג${skipTime ? ` ב-${skipTime}` : ""}`
      : ranToday
        ? `הרובוט הופעל היום${runTime ? ` ב-${runTime}` : ""}`
        : "הרובוט עדיין לא הופעל היום"
  );
  main.font = Font.semiboldSystemFont(compact ? 10 : 12);
  main.textColor = Color.dynamic(Color.black(), Color.white());
  main.lineLimit = 1;
  main.minimumScaleFactor = 0.68;

  if (!compact) {
    const sub = texts.addText(
      skippedToday
        ? "האוטומציה לא תפעיל ניקיון היום"
        : ranToday
          ? `${runs} הפעלות דרך האוטומציה • ${data?.config?.shortcutName || "ניקוי עמוק"}`
          : `${data?.config?.shortcutName || "ניקוי עמוק"} • ממתין לתנאים`
    );
    sub.font = Font.systemFont(9);
    sub.textColor = Color.gray();
    sub.lineLimit = 1;
  }

  row.addSpacer(8);

  const button = row.addStack();
  button.centerAlignContent();
  button.setPadding(compact ? 5 : 6, compact ? 6 : 9, compact ? 5 : 6, compact ? 6 : 9);
  button.cornerRadius = 8;
  button.backgroundColor = skippedToday
    ? Color.dynamic(new Color("#E8F8ED"), new Color("#12351D"))
    : Color.dynamic(new Color("#FFF2CC"), new Color("#4A3B00"));

  const buttonText = button.addText(
    skippedToday
      ? (compact ? "בטל" : "בטל דילוג")
      : (compact ? "דלג" : "דלג יום")
  );
  buttonText.font = Font.boldSystemFont(compact ? 9 : 10);
  buttonText.textColor = skippedToday
    ? new Color("#34C759")
    : new Color("#C77800");
  buttonText.lineLimit = 1;

  const url = actionUrl("skip-toggle");
  button.url = url;
  buttonText.url = url;
}

function errorWidget(message) {
  const w = new ListWidget();
  w.setPadding(14, 14, 14, 14);

  const title = w.addText("Dreame X40");
  title.font = Font.boldSystemFont(15);

  w.addSpacer(10);

  const e = w.addText("לא ניתן לקבל סטטוס");
  e.font = Font.boldSystemFont(13);
  e.textColor = new Color("#FF3B30");

  w.addSpacer(4);

  const detail = w.addText(String(message || "שגיאה לא ידועה").slice(0, 130));
  detail.font = Font.systemFont(9);
  detail.textColor = Color.gray();

  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
  return w;
}

// ----- Main -----

let cfg = loadConfig();
const requestedAction = String(args?.queryParameters?.action || "")
  .trim()
  .toLowerCase();

if (!cfg) {
  if (config.runsInWidget) {
    const w = errorWidget("פתח את הסקריפט פעם אחת ב-Scriptable כדי להגדיר URL ו-Token.");
    Script.setWidget(w);
    Script.complete();
    return;
  }

  cfg = await setup(null);
  if (!cfg) {
    Script.complete();
    return;
  }
}

if (
  !config.runsInWidget &&
  (requestedAction === "skip" || requestedAction === "skip-toggle")
) {
  try {
    cfg = await ensureControlToken(cfg);
    if (!cfg) {
      Script.complete();
      return;
    }

    const before = await getStatus(cfg);
    const today = before?.localTime?.date;
    const currentlySkipped = before?.skipInfo?.date === today;

    const confirm = new Alert();
    confirm.title = currentlySkipped
      ? "לבטל את הדילוג להיום?"
      : "דלג על הניקיון היום?";
    confirm.message = currentlySkipped
      ? "האוטומציה תחזור להיות פעילה להמשך היום. אם התנאים מתקיימים, היא תוכל להפעיל ניקיון אוטומטי."
      : "האוטומציה לא תפעיל ניקיון אוטומטי עד מחר. פעולה זו לא עוצרת ניקיון שכבר התחיל.";
    confirm.addAction(
      currentlySkipped ? "כן, בטל דילוג" : "כן, דלג היום"
    );
    confirm.addCancelAction("ביטול");

    const answer = await confirm.presentAlert();
    if (answer === -1) {
      Script.complete();
      return;
    }

    const result = await skipToday(cfg);

    const done = new Alert();
    if (result?.action === "day_skipped") {
      done.title = "הדילוג הופעל";
      done.message =
        "היום סומן כדילוג. נשלחה גם הודעת Telegram.";
    } else if (result?.action === "skip_cancelled") {
      done.title = "הדילוג בוטל";
      done.message =
        "האוטומציה חזרה להיות פעילה להמשך היום. נשלחה גם הודעת Telegram.";
    } else {
      done.title = "הפעולה הושלמה";
      done.message =
        result?.message || "מצב הדילוג עודכן.";
    }

    done.addAction("אישור");
    await done.presentAlert();

    const data = await getStatus(cfg);
    const widget = buildWidget(data, cfg);
    await widget.presentMedium();
  } catch (err) {
    const a = new Alert();
    a.title = "לא ניתן לעדכן את מצב הדילוג";
    a.message = err?.message || String(err);
    a.addAction("אישור");
    await a.presentAlert();
  }

  Script.complete();
  return;
}

if (!config.runsInWidget) {
  cfg = await settingsMenu(cfg);
  if (!cfg) return;
}

try {
  const data = await getStatus(cfg);
  const widget = buildWidget(data, cfg);

  if (config.runsInWidget) {
    Script.setWidget(widget);
  } else {
    await widget.presentMedium();
  }
} catch (err) {
  const widget = errorWidget(err?.message || String(err));

  if (config.runsInWidget) {
    Script.setWidget(widget);
  } else {
    await widget.presentMedium();
  }
}

Script.complete();

