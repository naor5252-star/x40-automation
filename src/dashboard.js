export const dashboardHtml = String.raw`<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#0b1220">
  <title>Dreame X40 Control Center</title>
  <style>
    :root {
      color-scheme: dark;
      --bg:#07101d;
      --panel:#0f1b2d;
      --panel2:#14233a;
      --line:#243653;
      --text:#f7f9fc;
      --muted:#93a4bc;
      --blue:#4f8cff;
      --green:#34c759;
      --orange:#ff9f0a;
      --red:#ff453a;
      --purple:#bf5af2;
      --shadow:0 18px 48px rgba(0,0,0,.28);
      --radius:18px;
    }
    * { box-sizing:border-box; }
    body {
      margin:0;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;
      background:
        radial-gradient(circle at 80% -10%, rgba(79,140,255,.18), transparent 34rem),
        var(--bg);
      color:var(--text);
      min-height:100vh;
    }
    button,input,select,textarea { font:inherit; }
    button { cursor:pointer; }
    .shell { max-width:1180px; margin:auto; padding:18px 14px 60px; }
    .topbar {
      display:flex; align-items:center; justify-content:space-between;
      gap:12px; margin-bottom:18px;
    }
    h1 { font-size:24px; margin:0; letter-spacing:-.4px; }
    h2 { font-size:17px; margin:0 0 13px; }
    .subtitle { color:var(--muted); font-size:12px; margin-top:4px; }
    .grid { display:grid; gap:12px; }
    .grid4 { grid-template-columns:repeat(4,minmax(0,1fr)); }
    .grid2 { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .card {
      background:linear-gradient(180deg,rgba(20,35,58,.96),rgba(15,27,45,.96));
      border:1px solid var(--line);
      border-radius:var(--radius);
      padding:16px;
      box-shadow:var(--shadow);
    }
    .metric-label { color:var(--muted); font-size:12px; }
    .metric-main { font-weight:750; font-size:20px; margin-top:8px; }
    .metric-sub { color:var(--muted); font-size:11px; margin-top:7px; line-height:1.5; }
    .dot {
      width:9px; height:9px; border-radius:50%; display:inline-block;
      margin-left:6px; vertical-align:1px;
    }
    .ok { color:var(--green); }
    .warn { color:var(--orange); }
    .bad { color:var(--red); }
    .muted { color:var(--muted); }
    .toolbar {
      display:grid; grid-template-columns:repeat(5,minmax(0,1fr));
      gap:9px;
    }
    .btn {
      border:1px solid var(--line);
      background:#182943;
      color:var(--text);
      border-radius:12px;
      padding:11px 10px;
      font-weight:650;
      min-height:44px;
    }
    .btn:hover { filter:brightness(1.08); }
    .btn.primary { background:var(--blue); border-color:var(--blue); }
    .btn.good { background:#153c28; border-color:#24683f; }
    .btn.warnb { background:#493411; border-color:#7b5615; }
    .btn.danger { background:#481b22; border-color:#7b2d39; }
    .btn.ghost { background:transparent; }
    .section { margin-top:14px; }
    .fields {
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:12px;
    }
    label { display:block; color:var(--muted); font-size:11px; margin-bottom:6px; }
    input,select,textarea {
      width:100%;
      border:1px solid var(--line);
      border-radius:11px;
      background:#0b1728;
      color:var(--text);
      padding:10px 11px;
      outline:none;
    }
    input:focus,select:focus,textarea:focus { border-color:var(--blue); }
    textarea { min-height:74px; resize:vertical; }
    .row { display:flex; gap:9px; align-items:center; flex-wrap:wrap; }
    .switchrow {
      display:flex; align-items:center; justify-content:space-between;
      border:1px solid var(--line); border-radius:12px; padding:10px 12px;
      min-height:44px; background:#0b1728;
    }
    .switchrow input { width:auto; transform:scale(1.15); }
    .pill {
      border:1px solid var(--line);
      border-radius:999px; padding:5px 9px;
      color:var(--muted); font-size:11px;
      display:inline-flex; align-items:center;
    }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    th,td { padding:9px 7px; border-bottom:1px solid var(--line); text-align:right; vertical-align:top; }
    th { color:var(--muted); font-weight:600; }
    code,pre {
      direction:ltr; text-align:left;
      font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
    }
    pre {
      white-space:pre-wrap; word-break:break-word;
      max-height:420px; overflow:auto;
      padding:12px; border-radius:12px;
      background:#08111f; border:1px solid var(--line);
      font-size:11px;
    }
    details summary { cursor:pointer; color:#c9d6e8; font-weight:650; }
    .login {
      max-width:480px; margin:12vh auto;
    }
    .hidden { display:none !important; }
    .toast {
      position:fixed; left:14px; bottom:14px; max-width:420px;
      background:#16253b; border:1px solid var(--line);
      padding:12px 14px; border-radius:12px; box-shadow:var(--shadow);
      opacity:0; transform:translateY(12px); pointer-events:none;
      transition:.2s; z-index:100;
    }
    .toast.show { opacity:1; transform:none; }
    .help { color:var(--muted); font-size:11px; line-height:1.55; }
    .dangerzone { border-color:#592b34; }
    .statusline { font-size:11px; color:var(--muted); margin-top:6px; }
    @media(max-width:850px) {
      .grid4,.grid2,.fields { grid-template-columns:1fr 1fr; }
      .toolbar { grid-template-columns:1fr 1fr; }
    }
    @media(max-width:560px) {
      .shell { padding:12px 10px 45px; }
      h1 { font-size:20px; }
      .grid4,.grid2,.fields { grid-template-columns:1fr; }
      .toolbar { grid-template-columns:1fr 1fr; }
      .card { padding:14px; }
      .hide-mobile { display:none; }
    }
  </style>
</head>
<body>
  <div id="login" class="shell login">
    <div class="card">
      <h1>Dreame X40 Control Center</h1>
      <p class="subtitle">ה־WebUI רץ ישירות על ה־Cloudflare Worker שלך.</p>
      <div class="section">
        <label>WEBHOOK_TOKEN</label>
        <input id="tokenInput" type="password" autocomplete="off" placeholder="הזן את הטוקן">
        <p class="help">הטוקן נשמר רק ב־localStorage במכשיר הזה. הוא לא מוצג בדשבורד ולא נשלח לשום שירות אחר.</p>
      </div>
      <button class="btn primary" style="width:100%" onclick="login()">כניסה</button>
      <div id="loginError" class="statusline bad"></div>
    </div>
  </div>

  <div id="app" class="shell hidden">
    <div class="topbar">
      <div>
        <h1>🤖 Dreame X40 Control Center</h1>
        <div class="subtitle" id="clock">—</div>
      </div>
      <div class="row">
        <button class="btn ghost" onclick="refresh()">רענון</button>
        <button class="btn ghost" onclick="logout()">יציאה</button>
      </div>
    </div>

    <div class="grid grid4">
      <div class="card">
        <div class="metric-label">נאור</div>
        <div class="metric-main" id="naorState">—</div>
        <div class="metric-sub" id="naorTime">—</div>
        <div class="row" style="margin-top:10px">
          <button class="btn good" onclick="setPresence('naor','home')">בבית</button>
          <button class="btn warnb" onclick="setPresence('naor','away')">בחוץ</button>
        </div>
      </div>
      <div class="card">
        <div class="metric-label">בת הזוג</div>
        <div class="metric-main" id="wifeState">—</div>
        <div class="metric-sub" id="wifeTime">—</div>
        <div class="row" style="margin-top:10px">
          <button class="btn good" onclick="setPresence('wife','home')">בבית</button>
          <button class="btn warnb" onclick="setPresence('wife','away')">בחוץ</button>
        </div>
      </div>
      <div class="card">
        <div class="metric-label">ניקיון היום</div>
        <div class="metric-main" id="runState">—</div>
        <div class="metric-sub" id="runSub">—</div>
      </div>
      <div class="card">
        <div class="metric-label">מים לקראת ההפעלה הבאה</div>
        <div class="metric-main" id="waterState">—</div>
        <div class="metric-sub" id="waterSub">—</div>
      </div>
    </div>

    <div class="card section">
      <h2>שליטה מהירה</h2>
      <div class="toolbar">
        <button id="skipBtn" class="btn warnb" onclick="toggleSkip()">דלג יום</button>
        <button class="btn" onclick="manualCheck()">בדוק תנאי הפעלה</button>
        <button class="btn" onclick="waterCheck()">בדיקת מים עכשיו</button>
        <button class="btn primary" onclick="runNow()">הפעל עכשיו</button>
        <button class="btn danger" onclick="stopDock()">עצור וחזור לעמדה</button>
      </div>
      <div class="statusline" id="lastAction">—</div>
    </div>

    <div class="grid grid2 section">
      <div class="card">
        <h2>סטטוס אוטומציה</h2>
        <div id="decisionBox" class="help">—</div>
      </div>
      <div class="card">
        <h2>אינטגרציות</h2>
        <div id="integrationBox" class="help">—</div>
      </div>
    </div>

    <div class="card section">
      <div class="row" style="justify-content:space-between">
        <h2>פרמטרים</h2>
        <span class="pill">נשמרים ב־Durable Object • ללא deploy</span>
      </div>
      <div class="fields">
        <div><label>שעת התחלה</label><input id="startTime" type="time"></div>
        <div><label>שעת סיום</label><input id="endTime" type="time"></div>
        <div><label>זמן מחוץ לבית לפני הפעלה (דקות)</label><input id="awayDelayMinutes" type="number" min="0" max="240"></div>
        <div><label>מקסימום הפעלות ביום</label><input id="maxRunsPerDay" type="number" min="0" max="20"></div>
        <div><label>מקסימום זמן ריצה פעילה (דקות)</label><input id="activeRunMaxMinutes" type="number" min="5" max="1440"></div>
        <div>
          <label>Dry Run</label>
          <div class="switchrow"><span>לא להפעיל בפועל</span><input id="dryRun" type="checkbox"></div>
        </div>
        <div><label>שעת תזכורת ערב</label><input id="eveningCheckTime" type="time"></div>
        <div><label>שעת בדיקת מים</label><input id="waterCheckTime" type="time"></div>
        <div><label>Timezone</label><input id="timezone" type="text"></div>

        <div>
          <label>מצב ניקיון ראשי</label>
          <select id="primaryMode">
            <option value="cleangenius">CleanGenius</option>
            <option value="shortcut">Shortcut</option>
          </select>
        </div>
        <div><label>שם Shortcut ראשי</label><input id="shortcutName" type="text"></div>
        <div><label>Shortcut ID ראשי</label><input id="shortcutId" type="text"></div>

        <div><label>Room IDs</label><input id="cleanGeniusRooms" type="text" placeholder="2,3,4,7,8"></div>
        <div>
          <label>CleanGenius Mode</label>
          <select id="cleanGeniusMode">
            <option value="1">Routine</option>
            <option value="2">Deep</option>
          </select>
        </div>
        <div><label>שמות חדרים</label><input id="cleanGeniusLabel" type="text"></div>

        <div><label>Fallback Shortcut</label><input id="fallbackShortcutName" type="text"></div>
        <div><label>Fallback Shortcut ID</label><input id="fallbackShortcutId" type="text"></div>
        <div><label>קודי חוסר מים</label><input id="waterEmptyCodes" type="text"></div>
      </div>

      <details class="section">
        <summary>הגדרות מתקדמות — GitHub / Worker</summary>
        <div class="fields" style="margin-top:12px">
          <div><label>GitHub Owner</label><input id="githubOwner" type="text"></div>
          <div><label>GitHub Repo</label><input id="githubRepo" type="text"></div>
          <div><label>Workflow</label><input id="githubWorkflow" type="text"></div>
          <div><label>Git Ref</label><input id="githubRef" type="text"></div>
          <div style="grid-column:span 2"><label>Worker Public URL</label><input id="workerPublicUrl" type="url"></div>
        </div>
      </details>

      <div class="row section">
        <button class="btn primary" onclick="saveSettings()">שמור פרמטרים</button>
        <button class="btn ghost" onclick="resetSettings()">חזור לערכי Cloudflare</button>
      </div>
      <p class="help">Secrets כגון סיסמת Dreame, Telegram Bot Token ו־GitHub token אינם מוצגים ואינם ניתנים לעריכה מה־WebUI.</p>
    </div>

    <div class="card section">
      <div class="row" style="justify-content:space-between">
        <h2>היסטוריית אירועים</h2>
        <button class="btn ghost" onclick="clearHistory()">נקה היסטוריה</button>
      </div>
      <div style="overflow:auto">
        <table>
          <thead><tr><th>זמן</th><th>אירוע</th><th>פרטים</th></tr></thead>
          <tbody id="historyRows"></tbody>
        </table>
      </div>
    </div>

    <div class="card section">
      <details>
        <summary>Raw JSON — כל הנתונים שה־Worker מחזיק</summary>
        <pre id="rawJson">{}</pre>
      </details>
    </div>
  </div>

  <div id="toast" class="toast"></div>

<script>
  const TOKEN_KEY = "dreame-x40-dashboard-token";
  let data = null;
  let refreshTimer = null;

  const $ = (id) => document.getElementById(id);

  function token() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  async function api(path, options = {}) {
    const headers = {
      "X-Webhook-Token": token(),
      ...(options.body ? {"Content-Type":"application/json"} : {}),
      ...(options.headers || {})
    };

    const response = await fetch(path, {
      ...options,
      headers
    });

    const text = await response.text();
    let payload;
    try { payload = text ? JSON.parse(text) : {}; }
    catch { payload = {text}; }

    if (!response.ok) {
      throw new Error(payload.error || payload.text || "HTTP " + response.status);
    }
    return payload;
  }

  function toast(message, kind="") {
    const el = $("toast");
    el.textContent = message;
    el.style.borderColor =
      kind === "bad" ? "#7b2d39" :
      kind === "ok" ? "#24683f" : "#243653";
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 3200);
  }

  async function login() {
    const value = $("tokenInput").value.trim();
    if (!value) return;
    localStorage.setItem(TOKEN_KEY, value);
    try {
      await refresh();
      $("login").classList.add("hidden");
      $("app").classList.remove("hidden");
      startPolling();
    } catch (err) {
      localStorage.removeItem(TOKEN_KEY);
      $("loginError").textContent = "כניסה נכשלה: " + err.message;
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    clearInterval(refreshTimer);
    location.reload();
  }

  function stateText(person) {
    if (person?.state === "home") return "🟢 בבית";
    if (person?.state === "away") return "🟠 בחוץ";
    return "⚪ לא ידוע";
  }

  function fmt(iso) {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat("he-IL", {
        dateStyle:"short", timeStyle:"short"
      }).format(new Date(iso));
    } catch { return iso; }
  }

  function actionText(d) {
    if (!d) return "אין החלטה שמורה";
    const parts = [
      "action=" + (d.action || "none"),
      "bothAway=" + Boolean(d.bothAway),
      "awayLongEnough=" + Boolean(d.awayLongEnough),
      "inWindow=" + Boolean(d.inWindow),
      "runs=" + (d.runsToday ?? "?") + "/" + (d.maxRunsPerDay ?? "?"),
      "skipped=" + Boolean(d.skippedToday)
    ];
    return parts.join(" • ");
  }

  function fillSettings(s) {
    const ids = [
      "startTime","endTime","awayDelayMinutes","maxRunsPerDay",
      "activeRunMaxMinutes","eveningCheckTime","waterCheckTime",
      "timezone","primaryMode","shortcutName","shortcutId",
      "cleanGeniusRooms","cleanGeniusMode","cleanGeniusLabel",
      "fallbackShortcutName","fallbackShortcutId","waterEmptyCodes",
      "githubOwner","githubRepo","githubWorkflow","githubRef","workerPublicUrl"
    ];
    for (const id of ids) {
      if ($(id) && s[id] !== undefined) $(id).value = s[id];
    }
    $("dryRun").checked = Boolean(s.dryRun);
  }

  function render(d) {
    data = d;
    $("clock").textContent =
      (d.localTime?.date || "") + " • " + (d.localTime?.time || "");

    $("naorState").textContent = stateText(d.naor);
    $("wifeState").textContent = stateText(d.wife);
    $("naorTime").textContent = "עודכן: " + fmt(d.naor?.updatedAt);
    $("wifeTime").textContent = "עודכן: " + fmt(d.wife?.updatedAt);

    const runs =
      d.runInfo?.date === d.localTime?.date ? Number(d.runInfo?.count || 0) : 0;
    const active = Boolean(d.runInfo?.active);
    $("runState").textContent =
      active ? "🟢 פעיל" : runs ? "✅ בוצע היום" : "⚪ טרם הופעל";
    $("runSub").textContent =
      "הפעלות: " + runs +
      (d.runInfo?.lastRunAt ? " • אחרונה: " + fmt(d.runInfo.lastRunAt) : "");

    const w = d.waterInfo;
    if (!w?.checkedAt) {
      $("waterState").textContent = "⚪ טרם נבדק";
      $("waterSub").textContent = "בדיקה מתוזמנת: " + d.config?.waterCheckTime;
    } else if (w.status === "missing") {
      $("waterState").textContent = "🔴 חסר מים";
      $("waterSub").textContent = "נבדק: " + fmt(w.checkedAt);
    } else if (w.status === "ok") {
      $("waterState").textContent = "🟢 יש מים";
      $("waterSub").textContent = "נבדק: " + fmt(w.checkedAt);
    } else {
      $("waterState").textContent = "🟠 לא ידוע";
      $("waterSub").textContent =
        "נבדק: " + fmt(w.checkedAt) +
        (w.readError ? " • " + w.readError : "");
    }

    const skipped = d.skipInfo?.date === d.localTime?.date;
    $("skipBtn").textContent = skipped ? "▶️ בטל דילוג" : "⏭️ דלג יום";
    $("skipBtn").className = skipped ? "btn good" : "btn warnb";

    $("decisionBox").textContent = actionText(d.lastDecision);

    const i = d.integrations || {};
    $("integrationBox").innerHTML =
      "GitHub: <b>" + (i.githubConfigured ? "✅ מוגדר" : "❌ חסר") + "</b><br>" +
      "WEBHOOK_TOKEN: <b>" + (i.webhookTokenConfigured ? "✅" : "❌") + "</b> • " +
      "WIDGET_TOKEN: <b>" + (i.widgetTokenConfigured ? "✅" : "❌") + "</b><br>" +
      "Repo: " + (i.github?.owner || "—") + "/" + (i.github?.repo || "—") +
      " • " + (i.github?.workflow || "—") + "@" + (i.github?.ref || "—");

    fillSettings(d.effectiveSettings || {});

    const rows = (d.history || []).map(e => {
      const detail = JSON.stringify(e.details || {});
      return "<tr><td>" + fmt(e.at) + "</td><td>" +
        escapeHtml(e.type || "") + "</td><td><code>" +
        escapeHtml(detail) + "</code></td></tr>";
    }).join("");
    $("historyRows").innerHTML =
      rows || '<tr><td colspan="3" class="muted">אין אירועים</td></tr>';

    $("rawJson").textContent = JSON.stringify(d, null, 2);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
  }

  async function refresh() {
    const d = await api("/api/dashboard");
    render(d);
    return d;
  }

  function startPolling() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => refresh().catch(() => {}), 20000);
  }

  async function doAction(path, message, options = {}) {
    try {
      $("lastAction").textContent = message + "…";
      const result = await api(path, {method:"POST", ...options});
      $("lastAction").textContent = JSON.stringify(result);
      toast("הפעולה נשלחה", "ok");
      setTimeout(refresh, 1200);
      return result;
    } catch (err) {
      $("lastAction").textContent = err.message;
      toast(err.message, "bad");
      throw err;
    }
  }

  async function toggleSkip() {
    await doAction("/api/skip-toggle", "מעדכן דילוג");
  }

  async function manualCheck() {
    await doAction("/api/check", "בודק תנאים");
  }

  async function waterCheck() {
    await doAction("/api/water-check-now", "שולח בדיקת מים");
  }

  async function runNow() {
    if (!confirm("להפעיל ניקיון עכשיו? הפעולה עוקפת נוכחות, שעות ודילוג יום. Dry Run עדיין מכובד.")) return;
    await doAction("/api/run-now", "מפעיל עכשיו");
  }

  async function stopDock() {
    if (!confirm("לעצור את הניקיון ולשלוח את הרובוט לעמדת הטעינה?")) return;
    await doAction("/api/stop-dock", "עוצר ומחזיר לעמדה");
  }

  async function setPresence(person, state) {
    const label = state === "home" ? "בבית" : "בחוץ";
    if (state === "home" && !confirm("לסמן " + person + " כבית? אם יש ניקיון פעיל הוא עשוי להיעצר.")) return;
    await doAction("/api/presence/" + person, "מעדכן נוכחות ל־" + label, {
      body: JSON.stringify({state})
    });
  }

  function readSettings() {
    const val = id => $(id).value.trim();
    return {
      startTime: val("startTime"),
      endTime: val("endTime"),
      awayDelayMinutes: Number(val("awayDelayMinutes")),
      maxRunsPerDay: Number(val("maxRunsPerDay")),
      activeRunMaxMinutes: Number(val("activeRunMaxMinutes")),
      dryRun: $("dryRun").checked,
      eveningCheckTime: val("eveningCheckTime"),
      waterCheckTime: val("waterCheckTime"),
      timezone: val("timezone"),
      primaryMode: val("primaryMode"),
      shortcutName: val("shortcutName"),
      shortcutId: val("shortcutId"),
      cleanGeniusRooms: val("cleanGeniusRooms"),
      cleanGeniusMode: val("cleanGeniusMode"),
      cleanGeniusLabel: val("cleanGeniusLabel"),
      fallbackShortcutName: val("fallbackShortcutName"),
      fallbackShortcutId: val("fallbackShortcutId"),
      waterEmptyCodes: val("waterEmptyCodes"),
      githubOwner: val("githubOwner"),
      githubRepo: val("githubRepo"),
      githubWorkflow: val("githubWorkflow"),
      githubRef: val("githubRef"),
      workerPublicUrl: val("workerPublicUrl")
    };
  }

  async function saveSettings() {
    try {
      const result = await api("/api/settings", {
        method:"PUT",
        body:JSON.stringify(readSettings())
      });
      toast("הפרמטרים נשמרו", "ok");
      await refresh();
      return result;
    } catch (err) {
      toast("שמירה נכשלה: " + err.message, "bad");
    }
  }

  async function resetSettings() {
    if (!confirm("למחוק את כל ה־overrides ולחזור לערכי Cloudflare?")) return;
    await doAction("/api/settings/reset", "מאפס הגדרות");
  }

  async function clearHistory() {
    if (!confirm("לנקות את היסטוריית האירועים?")) return;
    await doAction("/api/history/clear", "מנקה היסטוריה");
  }

  window.addEventListener("load", async () => {
    if (!token()) return;
    try {
      await refresh();
      $("login").classList.add("hidden");
      $("app").classList.remove("hidden");
      startPolling();
    } catch {
      localStorage.removeItem(TOKEN_KEY);
    }
  });
</script>
</body>
</html>`;

