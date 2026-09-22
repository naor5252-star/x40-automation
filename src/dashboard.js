export const dashboardHtml = String.raw`<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#f5f7f5">
  <meta name="color-scheme" content="light">
  <title>בית נקי</title>
  <style>
    :root {
      --bg:#f4f7f5;
      --surface:#ffffff;
      --surface-soft:#f8faf9;
      --surface-strong:#eef4f1;
      --text:#14211c;
      --muted:#6d7d75;
      --line:#dfe8e3;
      --brand:#168f7b;
      --brand-dark:#0d6f60;
      --brand-soft:#dcf4ee;
      --blue:#2878c8;
      --blue-soft:#e8f2fc;
      --amber:#b66b10;
      --amber-soft:#fff1d8;
      --red:#c83f4d;
      --red-soft:#fde9ec;
      --green:#16835e;
      --green-soft:#def4ea;
      --shadow:0 16px 44px rgba(25,58,44,.09);
      --shadow-small:0 5px 18px rgba(25,58,44,.07);
      --radius:24px;
      --radius-small:16px;
    }

    * { box-sizing:border-box; }
    html { -webkit-text-size-adjust:100%; scroll-behavior:smooth; }
    body {
      margin:0;
      min-height:100vh;
      background:
        radial-gradient(circle at 92% 0,rgba(22,143,123,.10),transparent 28rem),
        linear-gradient(180deg,#f8faf9 0,#f1f5f3 100%);
      color:var(--text);
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;
    }

    button,input,select,textarea { font:inherit; }
    button { cursor:pointer; -webkit-tap-highlight-color:transparent; }
    button:disabled { cursor:not-allowed; opacity:.55; }
    .hidden { display:none !important; }
    .ltr { direction:ltr; text-align:left; }
    .muted { color:var(--muted); }
    .danger-text { color:var(--red); }

    .shell {
      width:min(100%,980px);
      margin:0 auto;
      padding:calc(16px + env(safe-area-inset-top)) 14px calc(96px + env(safe-area-inset-bottom));
    }

    .login-shell {
      width:min(100%,460px);
      min-height:100vh;
      margin:auto;
      padding:calc(48px + env(safe-area-inset-top)) 18px 36px;
      display:grid;
      place-items:center;
    }

    .login-card {
      width:100%;
      background:rgba(255,255,255,.94);
      border:1px solid rgba(255,255,255,.85);
      border-radius:30px;
      padding:26px;
      box-shadow:var(--shadow);
    }

    .login-mark,.robot-orb {
      display:grid;
      place-items:center;
      background:linear-gradient(145deg,#dff7f1,#edf6ff);
      color:var(--brand-dark);
      box-shadow:inset 0 0 0 1px rgba(22,143,123,.08);
    }
    .login-mark { width:64px; height:64px; border-radius:22px; font-size:30px; margin-bottom:18px; }
    .login-card h1 { margin:0; font-size:30px; letter-spacing:-.7px; }
    .login-card p { margin:8px 0 22px; color:var(--muted); line-height:1.55; }

    .field { display:grid; gap:7px; }
    .field label { font-size:13px; color:var(--muted); font-weight:650; }
    input,select,textarea {
      width:100%;
      min-height:48px;
      border:1px solid var(--line);
      background:var(--surface-soft);
      color:var(--text);
      border-radius:14px;
      padding:11px 13px;
      outline:none;
    }
    input:focus,select:focus,textarea:focus {
      border-color:var(--brand);
      box-shadow:0 0 0 4px rgba(22,143,123,.12);
    }
    input[type="checkbox"] { width:22px; min-height:22px; accent-color:var(--brand); }

    .topbar {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
      margin:2px 2px 18px;
    }
    .eyebrow { color:var(--muted); font-size:12px; font-weight:700; margin-bottom:5px; }
    .topbar h1 { margin:0; font-size:30px; letter-spacing:-.8px; }
    .top-actions { display:flex; gap:8px; }

    .icon-btn {
      width:46px;
      height:46px;
      border:1px solid var(--line);
      border-radius:15px;
      background:rgba(255,255,255,.9);
      color:var(--text);
      display:grid;
      place-items:center;
      font-size:19px;
      box-shadow:var(--shadow-small);
    }

    .connection-row {
      display:flex;
      gap:8px;
      align-items:center;
      flex-wrap:wrap;
      margin-top:8px;
    }
    .chip {
      display:inline-flex;
      align-items:center;
      gap:6px;
      min-height:30px;
      border-radius:999px;
      padding:5px 10px;
      background:var(--surface-strong);
      color:var(--muted);
      font-size:12px;
      font-weight:750;
    }
    .chip.ok { background:var(--green-soft); color:var(--green); }
    .chip.warn { background:var(--amber-soft); color:var(--amber); }
    .chip.bad { background:var(--red-soft); color:var(--red); }
    .chip.blue { background:var(--blue-soft); color:var(--blue); }
    .dot { width:8px; height:8px; border-radius:50%; background:currentColor; }

    .card {
      background:rgba(255,255,255,.94);
      border:1px solid rgba(221,232,226,.9);
      border-radius:var(--radius);
      box-shadow:var(--shadow-small);
    }
    .card-body { padding:18px; }
    .section { margin-top:14px; }
    .section-title {
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
      margin:0 2px 10px;
    }
    .section-title h2 { margin:0; font-size:18px; letter-spacing:-.3px; }
    .section-title span { color:var(--muted); font-size:12px; }

    .hero {
      padding:20px;
      display:grid;
      grid-template-columns:1fr auto;
      gap:18px;
      align-items:center;
      overflow:hidden;
      position:relative;
      background:
        radial-gradient(circle at 0 0,rgba(40,120,200,.10),transparent 20rem),
        linear-gradient(145deg,#ffffff,#f6fbf9);
    }
    .hero:after {
      content:"";
      position:absolute;
      width:190px;
      height:190px;
      border-radius:50%;
      background:rgba(22,143,123,.06);
      left:-80px;
      bottom:-115px;
    }
    .hero-copy { position:relative; z-index:1; }
    .hero h2 { margin:7px 0 5px; font-size:27px; letter-spacing:-.7px; }
    .hero p { margin:0; color:var(--muted); font-size:13px; line-height:1.55; }
    .robot-orb { width:94px; height:94px; border-radius:32px; font-size:46px; position:relative; z-index:1; }

    .primary-action {
      width:100%;
      min-height:58px;
      border:0;
      border-radius:18px;
      background:linear-gradient(135deg,var(--brand),var(--brand-dark));
      color:white;
      font-weight:850;
      font-size:17px;
      box-shadow:0 12px 28px rgba(13,111,96,.22);
    }
    .primary-action:active,.btn:active,.icon-btn:active { transform:scale(.985); }

    .action-grid {
      display:grid;
      grid-template-columns:2fr repeat(3,1fr);
      gap:10px;
    }
    .btn {
      min-height:48px;
      border:1px solid var(--line);
      border-radius:15px;
      background:var(--surface);
      color:var(--text);
      padding:10px 13px;
      font-weight:780;
      transition:.14s ease;
    }
    .btn.brand { background:var(--brand); color:white; border-color:var(--brand); }
    .btn.soft { background:var(--surface-soft); }
    .btn.warn { background:var(--amber-soft); color:var(--amber); border-color:#f1d8ad; }
    .btn.danger { background:var(--red-soft); color:var(--red); border-color:#f4ccd2; }
    .btn.ghost { background:transparent; box-shadow:none; }

    .status-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
    .status-card { padding:15px; min-height:112px; }
    .status-label { color:var(--muted); font-size:12px; font-weight:700; }
    .status-value { margin-top:10px; font-size:18px; font-weight:850; line-height:1.3; }
    .status-sub { margin-top:7px; color:var(--muted); font-size:12px; line-height:1.45; }

    .plan-card { padding:18px; }
    .plan-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .plan-head h3 { margin:0 0 6px; font-size:19px; }
    .plan-head p { margin:0; color:var(--muted); font-size:13px; }
    .plan-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:15px; }
    .mini-stat { background:var(--surface-soft); border:1px solid var(--line); border-radius:14px; padding:11px; }
    .mini-stat span { display:block; color:var(--muted); font-size:11px; }
    .mini-stat b { display:block; margin-top:5px; font-size:13px; }
    .room-list { display:flex; flex-wrap:wrap; gap:7px; margin-top:14px; }
    .room { border-radius:999px; padding:7px 11px; background:var(--blue-soft); color:var(--blue); font-size:12px; font-weight:750; }
    .editor-divider { height:1px; background:var(--line); margin:20px 0; }
    .room-editor-head { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; }
    .room-editor-head h3 { margin:0; font-size:16px; }
    .room-editor-head p { margin:4px 0 0; color:var(--muted); font-size:12px; }
    .room-profile-grid { display:grid; gap:10px; }
    .room-profile-card { border:1px solid var(--line); border-radius:18px; padding:14px; background:var(--surface-soft); }
    .room-profile-top { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px; }
    .room-profile-top b { font-size:14px; }
    .room-profile-fields { display:grid; grid-template-columns:1.35fr 1fr 1fr 1fr 1fr auto; gap:9px; align-items:end; }
    .room-profile-fields .btn { min-height:48px; }
    .today-plan-summary { border-radius:14px; background:var(--brand-soft); color:var(--brand-dark); padding:11px 13px; font-size:12px; line-height:1.6; margin-bottom:12px; }
    .week-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .day-plan { border:1px solid var(--line); border-radius:18px; padding:13px; background:var(--surface-soft); }
    .day-plan-head { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px; }
    .day-plan-head label { display:flex; align-items:center; gap:6px; margin:0; }
    .day-plan-head input { width:20px; min-height:20px; }
    .day-room { display:grid; grid-template-columns:24px minmax(0,1fr) 74px; gap:8px; align-items:center; padding:7px 0; border-top:1px solid var(--line); }
    .day-room:first-of-type { border-top:0; }
    .day-room input[type="checkbox"] { width:20px; min-height:20px; }
    .day-room input[type="number"] { min-height:38px; padding:7px 9px; text-align:center; }
    .settings-state { min-height:22px; margin-top:10px; color:var(--muted); font-size:12px; }
    .settings-state.dirty { color:var(--amber); font-weight:750; }

    .presence-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .presence-card { padding:16px; }
    .presence-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .presence-name { font-weight:850; }
    .presence-updated { color:var(--muted); font-size:11px; margin-top:5px; }
    .segmented { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:13px; background:var(--surface-soft); padding:5px; border-radius:14px; }
    .segmented button { border:0; min-height:38px; border-radius:10px; background:transparent; color:var(--muted); font-weight:750; }
    .segmented button.active-home { background:var(--green-soft); color:var(--green); }
    .segmented button.active-away { background:var(--amber-soft); color:var(--amber); }

    .debug-toggle-card { padding:15px 17px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
    .debug-toggle-copy h3 { margin:0; font-size:15px; }
    .debug-toggle-copy p { margin:5px 0 0; color:var(--muted); font-size:12px; }
    .switch {
      width:54px;
      height:32px;
      padding:3px;
      border:0;
      border-radius:999px;
      background:#cbd5d0;
      transition:.2s;
      flex:0 0 auto;
    }
    .switch:before {
      content:"";
      display:block;
      width:26px;
      height:26px;
      border-radius:50%;
      background:white;
      box-shadow:0 2px 7px rgba(0,0,0,.18);
      transform:translateX(0);
      transition:.2s;
    }
    .switch[aria-checked="true"] { background:var(--brand); }
    .switch[aria-checked="true"]:before { transform:translateX(-22px); }

    .debug-panel { border:1px solid #efd7ac; background:linear-gradient(180deg,#fffdf7,#fffaf0); }
    .debug-panel > .card-body { display:grid; gap:10px; }
    .debug-banner { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .debug-banner h2 { margin:0; font-size:18px; }
    .debug-banner p { margin:4px 0 0; color:var(--muted); font-size:12px; }
    .debug-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .debug-box { background:rgba(255,255,255,.82); border:1px solid #eadfca; border-radius:16px; padding:14px; min-width:0; }
    .debug-box h3 { margin:0 0 10px; font-size:14px; }
    .debug-line { display:flex; justify-content:space-between; gap:12px; padding:6px 0; border-bottom:1px solid #f1eadc; font-size:12px; }
    .debug-line:last-child { border-bottom:0; }
    .debug-line span { color:var(--muted); }
    pre {
      margin:0;
      max-height:330px;
      overflow:auto;
      white-space:pre-wrap;
      word-break:break-word;
      direction:ltr;
      text-align:left;
      background:#15211c;
      color:#dff5eb;
      border-radius:14px;
      padding:13px;
      font:11px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;
    }
    details summary { cursor:pointer; font-weight:800; }
    details[open] summary { margin-bottom:12px; }

    .event-list { display:grid; gap:9px; }
    .event {
      display:grid;
      grid-template-columns:auto 1fr;
      gap:12px;
      align-items:start;
      padding:14px;
      border:1px solid var(--line);
      border-radius:16px;
      background:var(--surface);
    }
    .event-time { color:var(--muted); font-size:11px; white-space:nowrap; }
    .event-title { font-size:13px; font-weight:800; }
    .event-detail { margin-top:5px; color:var(--muted); font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace; direction:ltr; text-align:left; word-break:break-word; }

    .settings-card { padding:18px; }
    .settings-card h2 { margin:0 0 15px; font-size:18px; }
    .fields { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
    .switch-row { min-height:48px; display:flex; align-items:center; justify-content:space-between; gap:12px; border:1px solid var(--line); border-radius:14px; padding:10px 13px; background:var(--surface-soft); }
    .settings-actions { display:flex; gap:9px; flex-wrap:wrap; margin-top:16px; }
    .note { color:var(--muted); font-size:12px; line-height:1.55; }

    .bottom-nav {
      position:fixed;
      z-index:50;
      bottom:0;
      left:50%;
      transform:translateX(-50%);
      width:min(100%,980px);
      padding:8px 12px calc(8px + env(safe-area-inset-bottom));
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:6px;
      background:rgba(249,251,250,.92);
      border-top:1px solid rgba(215,227,220,.9);
      backdrop-filter:blur(18px);
      -webkit-backdrop-filter:blur(18px);
    }
    .nav-btn {
      border:0;
      background:transparent;
      color:var(--muted);
      min-height:55px;
      border-radius:14px;
      font-weight:750;
      display:grid;
      place-items:center;
      align-content:center;
      gap:3px;
      font-size:11px;
    }
    .nav-btn .nav-icon { font-size:20px; }
    .nav-btn.active { background:var(--brand-soft); color:var(--brand-dark); }

    .toast {
      position:fixed;
      z-index:100;
      left:50%;
      bottom:calc(82px + env(safe-area-inset-bottom));
      transform:translate(-50%,20px);
      width:min(calc(100% - 28px),520px);
      padding:13px 15px;
      border-radius:16px;
      background:#173329;
      color:white;
      box-shadow:var(--shadow);
      opacity:0;
      pointer-events:none;
      transition:.2s;
      text-align:center;
      font-weight:700;
      font-size:13px;
    }
    .toast.show { opacity:1; transform:translate(-50%,0); }
    .toast.bad { background:#8f2835; }

    @media (max-width:720px) {
      .shell { padding-left:10px; padding-right:10px; }
      .topbar { margin-left:5px; margin-right:5px; }
      .topbar h1 { font-size:27px; }
      .hero { padding:18px; }
      .robot-orb { width:80px; height:80px; border-radius:28px; font-size:40px; }
      .hero h2 { font-size:23px; }
      .action-grid { grid-template-columns:1fr 1fr; }
      .action-grid .primary-action { grid-column:1 / -1; }
      .status-grid { grid-template-columns:1fr; }
      .presence-grid,.debug-grid { grid-template-columns:1fr; }
      .fields { grid-template-columns:1fr 1fr; }
      .room-profile-fields { grid-template-columns:1fr 1fr; }
      .week-grid { grid-template-columns:1fr; }
    }

    @media (max-width:470px) {
      .fields { grid-template-columns:1fr; }
      .plan-stats { grid-template-columns:1fr; }
      .hero { grid-template-columns:1fr auto; gap:10px; }
      .robot-orb { width:70px; height:70px; border-radius:24px; font-size:34px; }
      .top-actions .logout-label { display:none; }
    }
  </style>
</head>
<body>
  <section id="login" class="login-shell">
    <div class="login-card">
      <div class="login-mark">◉</div>
      <h1>בית נקי</h1>
      <p>שליטה פשוטה ברובוט Dreame X40 ובתוכנית הניקוי הביתית.</p>
      <div class="field">
        <label for="tokenInput">קוד גישה</label>
        <input id="tokenInput" type="password" autocomplete="off" placeholder="הזן WEBHOOK_TOKEN">
      </div>
      <button class="primary-action section" onclick="login()">כניסה</button>
      <div id="loginError" class="note danger-text section" role="alert"></div>
    </div>
  </section>

  <div id="app" class="shell hidden">
    <header class="topbar">
      <div>
        <div class="eyebrow">DREAME X40</div>
        <h1>בית נקי</h1>
        <div class="connection-row">
          <span id="connectionChip" class="chip"><i class="dot"></i> מתחבר…</span>
          <span id="clock" class="chip">—</span>
        </div>
      </div>
      <div class="top-actions">
        <button class="icon-btn" aria-label="רענון" title="רענון" onclick="refresh(true)">↻</button>
        <button class="icon-btn" aria-label="יציאה" title="יציאה" onclick="logout()"><span class="logout-label">⎋</span></button>
      </div>
    </header>

    <main>
      <section id="view-home" class="view">
        <article class="card hero">
          <div class="hero-copy">
            <span id="runChip" class="chip ok"><i class="dot"></i> מוכן</span>
            <h2 id="heroTitle">מוכן לניקוי</h2>
            <p id="heroSub">טוען את מצב הרובוט והתוכנית…</p>
          </div>
          <div class="robot-orb" aria-hidden="true">◉</div>
        </article>

        <div class="action-grid section">
          <button class="primary-action" onclick="runNow()">▶ התחל ניקוי</button>
          <button class="btn danger" onclick="stopDock()">■ עצור וחזור</button>
          <button id="skipBtn" class="btn warn" onclick="toggleSkip()">דלג היום</button>
          <button class="btn soft" onclick="manualCheck()">בדוק תנאים</button>
        </div>
        <div id="lastActionPublic" class="note section" aria-live="polite"></div>

        <div class="section-title section">
          <h2>מה קורה עכשיו</h2>
          <span id="lastUpdated">—</span>
        </div>
        <div class="status-grid">
          <article class="card status-card">
            <div class="status-label">שלב נוכחי</div>
            <div id="stageValue" class="status-value">—</div>
            <div id="stageSub" class="status-sub">—</div>
          </article>
          <article class="card status-card">
            <div class="status-label">מיקום</div>
            <div id="locationValue" class="status-value">—</div>
            <div class="status-sub">לפי הדיווח האחרון הזמין</div>
          </article>
          <article class="card status-card">
            <div class="status-label">מים</div>
            <div id="waterState" class="status-value">—</div>
            <div id="waterSub" class="status-sub">—</div>
          </article>
        </div>

        <div class="section-title section">
          <h2>תוכנית הניקוי</h2>
          <span id="runCount">—</span>
        </div>
        <article class="card plan-card">
          <div class="plan-head">
            <div>
              <h3 id="planName">—</h3>
              <p id="planDescription">—</p>
            </div>
            <span id="planModeChip" class="chip blue">—</span>
          </div>
          <div class="plan-stats">
            <div class="mini-stat"><span>חלון הפעלה</span><b id="windowValue">—</b></div>
            <div class="mini-stat"><span>שהייה בחוץ</span><b id="awayDelayValue">—</b></div>
            <div class="mini-stat"><span>מקסימום ביום</span><b id="maxRunsValue">—</b></div>
          </div>
          <div id="roomsList" class="room-list"></div>
        </article>

        <div class="section-title section">
          <h2>מי בבית</h2>
          <span>ניתן לעדכן ידנית</span>
        </div>
        <div class="presence-grid">
          <article class="card presence-card">
            <div class="presence-head"><span class="presence-name">נאור</span><span id="naorBadge" class="chip">—</span></div>
            <div id="naorTime" class="presence-updated">—</div>
            <div class="segmented">
              <button id="naorHome" onclick="setPresence('naor','home')">בבית</button>
              <button id="naorAway" onclick="setPresence('naor','away')">בחוץ</button>
            </div>
          </article>
          <article class="card presence-card">
            <div class="presence-head"><span class="presence-name">בת הזוג</span><span id="wifeBadge" class="chip">—</span></div>
            <div id="wifeTime" class="presence-updated">—</div>
            <div class="segmented">
              <button id="wifeHome" onclick="setPresence('wife','home')">בבית</button>
              <button id="wifeAway" onclick="setPresence('wife','away')">בחוץ</button>
            </div>
          </article>
        </div>

        <article class="card debug-toggle-card section">
          <div class="debug-toggle-copy">
            <h3>מצב דיבוג מורחב</h3>
            <p>כבוי כברירת מחדל ונפתח רק למושב הנוכחי</p>
          </div>
          <button id="debugSwitch" class="switch" role="switch" aria-checked="false" aria-label="מצב דיבוג מורחב" onclick="toggleDebug()"></button>
        </article>

        <article id="debugPanel" class="card debug-panel section hidden">
          <div class="card-body">
            <div class="debug-banner">
              <div><h2>דיבוג מורחב</h2><p>מידע לקריאה בלבד. סודות וקוד הגישה אינם מוצגים.</p></div>
              <span class="chip warn">פעיל זמנית</span>
            </div>
            <div class="debug-grid">
              <div class="debug-box">
                <h3>מצב הרובוט</h3>
                <div class="debug-line"><span>סטטוס</span><b id="debugRobotState">—</b></div>
                <div class="debug-line"><span>שלב</span><b id="debugStage">—</b></div>
                <div class="debug-line"><span>מיקום</span><b id="debugLocation">—</b></div>
                <div class="debug-line"><span>הפעלות היום</span><b id="debugRuns">—</b></div>
              </div>
              <div class="debug-box">
                <h3>חיבור ושירותים</h3>
                <div class="debug-line"><span>Worker</span><b id="debugWorker">—</b></div>
                <div class="debug-line"><span>GitHub</span><b id="debugGithub">—</b></div>
                <div class="debug-line"><span>Webhook</span><b id="debugWebhook">—</b></div>
                <div class="debug-line"><span>רענון אחרון</span><b id="debugRefresh">—</b></div>
              </div>
              <div class="debug-box">
                <h3>פקודה אחרונה</h3>
                <div id="debugLastCommand" class="note">—</div>
              </div>
              <div class="debug-box">
                <h3>בקשות API במושב הנוכחי</h3>
                <div id="apiLog" class="note ltr">—</div>
              </div>
            </div>

            <div id="nativeCaptureCard" class="debug-box hidden">
              <div class="debug-banner">
                <div><h3>הקלטת הפעלה ידנית</h3><p id="nativeCaptureStatus">ההקלטה פסיבית ואינה מפעילה את הרובוט.</p></div>
                <span id="nativeCapturePill" class="chip">לא פעיל</span>
              </div>
              <div class="settings-actions">
                <button id="nativeCaptureBtn" class="btn brand" onclick="toggleNativeCapture()">התחל הקלטה</button>
                <button id="copyNativeCaptureBtn" class="btn hidden" onclick="copyNativeCaptureResult()">העתק תוצאה</button>
              </div>
              <details id="nativeCaptureDetails" class="section hidden">
                <summary>תוצאת ההקלטה</summary>
                <pre id="nativeCaptureResult">{}</pre>
              </details>
            </div>

            <details class="debug-box">
              <summary>נתונים גולמיים</summary>
              <div class="settings-actions">
                <button class="btn" onclick="copyRawJson()">העתק JSON</button>
                <button class="btn" onclick="refresh(true)">רענן</button>
              </div>
              <pre id="rawJson">{}</pre>
            </details>
          </div>
        </article>
      </section>

      <section id="view-history" class="view hidden">
        <div class="section-title">
          <h2>היסטוריית אירועים</h2>
          <button class="btn ghost danger-text" onclick="clearHistory()">נקה היסטוריה</button>
        </div>
        <div id="historyRows" class="event-list"></div>
      </section>

      <section id="view-settings" class="view hidden">
        <article class="card settings-card">
          <h2>אוטומציה יומית</h2>
          <div class="fields">
            <div class="field"><label for="startTime">שעת התחלה</label><input id="startTime" type="time"></div>
            <div class="field"><label for="endTime">שעת סיום</label><input id="endTime" type="time"></div>
            <div class="field"><label for="awayDelayMinutes">דקות מחוץ לבית</label><input id="awayDelayMinutes" type="number" min="0" max="240"></div>
            <div class="field"><label for="maxRunsPerDay">מקסימום הפעלות ביום</label><input id="maxRunsPerDay" type="number" min="0" max="20"></div>
            <div class="field"><label for="activeRunMaxMinutes">מקסימום זמן ריצה</label><input id="activeRunMaxMinutes" type="number" min="5" max="1440"></div>
            <div class="field"><label for="eveningCheckTime">בדיקת ערב</label><input id="eveningCheckTime" type="time"></div>
            <div class="field"><label for="waterCheckTime">בדיקת מים</label><input id="waterCheckTime" type="time"></div>
            <div class="switch-row"><span>Dry Run — ללא הפעלה בפועל</span><input id="dryRun" type="checkbox"></div>
          </div>
        </article>

        <article class="card settings-card section">
          <h2>תוכנית ניקוי</h2>
          <div class="fields">
            <div class="field"><label for="primaryMode">מצב ראשי</label><select id="primaryMode"><option value="cleangenius">CleanGenius</option><option value="shortcut">Shortcut</option></select></div>
            <div class="field"><label for="cleanGeniusMode">עומק CleanGenius</label><select id="cleanGeniusMode"><option value="1">Routine</option><option value="2">Deep</option></select></div>
            <div class="field"><label for="cleanGeniusRooms">Room IDs</label><input id="cleanGeniusRooms" type="text" placeholder="2,3,4,7,8"></div>
            <div class="field"><label for="cleanGeniusLabel">שמות חדרים</label><input id="cleanGeniusLabel" type="text"></div>
            <div class="field"><label for="shortcutName">שם Shortcut ראשי</label><input id="shortcutName" type="text"></div>
            <div class="field"><label for="shortcutId">Shortcut ID ראשי</label><input id="shortcutId" type="text"></div>
            <div class="field"><label for="fallbackShortcutName">Fallback Shortcut</label><input id="fallbackShortcutName" type="text"></div>
            <div class="field"><label for="fallbackShortcutId">Fallback Shortcut ID</label><input id="fallbackShortcutId" type="text"></div>
          </div>

          <div class="editor-divider"></div>
          <div class="room-editor-head">
            <div>
              <h3>הגדרות ניקוי לכל חדר</h3>
              <p>בחר סוג ניקוי, עוצמת שאיבה ומספר מעברים לכל חדר.</p>
            </div>
            <button class="btn" onclick="addRoomProfile()">＋ הוסף חדר</button>
          </div>
          <div id="todayPlanSummary" class="today-plan-summary">טוען את התוכנית להיום…</div>
          <div id="roomProfileRows" class="room-profile-grid"></div>

          <div class="editor-divider"></div>
          <div class="room-editor-head">
            <div>
              <h3>סדר הניקוי לפי יום</h3>
              <p>סמן את החדרים והזן מספר סדר. מספר נמוך ינוקה קודם.</p>
            </div>
          </div>
          <div id="weeklyPlanGrid" class="week-grid"></div>
          <div id="settingsState" class="settings-state">כל ההגדרות שמורות</div>
        </article>

        <article class="card settings-card section">
          <details>
            <summary>הגדרות מתקדמות</summary>
            <div class="fields section">
              <div class="field"><label for="timezone">Timezone</label><input id="timezone" type="text"></div>
              <div class="field"><label for="waterEmptyCodes">קודי חוסר מים</label><input id="waterEmptyCodes" type="text"></div>
              <div class="field"><label for="githubOwner">GitHub Owner</label><input id="githubOwner" type="text"></div>
              <div class="field"><label for="githubRepo">GitHub Repo</label><input id="githubRepo" type="text"></div>
              <div class="field"><label for="githubWorkflow">Workflow</label><input id="githubWorkflow" type="text"></div>
              <div class="field"><label for="githubRef">Git Ref</label><input id="githubRef" type="text"></div>
              <div class="field"><label for="workerPublicUrl">Worker Public URL</label><input id="workerPublicUrl" type="url"></div>
            </div>
          </details>
          <div class="settings-actions">
            <button class="btn brand" onclick="saveSettings()">שמור הגדרות</button>
            <button class="btn" onclick="resetSettings()">חזור לערכי Cloudflare</button>
            <button class="btn" onclick="waterCheck()">בדיקת מים עכשיו</button>
          </div>
          <p class="note">סיסמת Dreame, טוקני Telegram ו־GitHub וקוד הגישה אינם מוצגים בממשק.</p>
        </article>
      </section>
    </main>

    <nav class="bottom-nav" aria-label="ניווט ראשי">
      <button id="nav-home" class="nav-btn active" onclick="showTab('home')"><span class="nav-icon">⌂</span><span>בית</span></button>
      <button id="nav-history" class="nav-btn" onclick="showTab('history')"><span class="nav-icon">◷</span><span>היסטוריה</span></button>
      <button id="nav-settings" class="nav-btn" onclick="showTab('settings')"><span class="nav-icon">⚙</span><span>הגדרות</span></button>
    </nav>
  </div>

  <div id="toast" class="toast" role="status" aria-live="polite"></div>

<script>
  const TOKEN_KEY = "dreame-x40-dashboard-token";
  const $ = (id) => document.getElementById(id);
  let data = null;
  let refreshTimer = null;
  let nativeCapturePollTimer = null;
  let debugEnabled = false;
  let lastRefreshAt = null;
  let latestServerSettings = null;
  let roomProfilesDraft = [];
  let weeklyPlanDraft = {};
  let settingsDirty = false;
  let settingsLoaded = false;
  const apiCalls = [];

  function token() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function safeText(value, fallback) {
    if (value === null || value === undefined || value === "") return fallback || "—";
    return String(value);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function fmt(iso) {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat("he-IL", {dateStyle:"short",timeStyle:"short"}).format(new Date(iso));
    } catch { return String(iso); }
  }

  function nowTime() {
    return new Intl.DateTimeFormat("he-IL", {hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date());
  }

  function recordApi(method, path, status, durationMs) {
    apiCalls.unshift({at:nowTime(),method:method,path:path,status:status,durationMs:durationMs});
    apiCalls.splice(12);
    if (debugEnabled) renderApiLog();
  }

  async function api(path, options) {
    options = options || {};
    const started = Date.now();
    const method = options.method || "GET";
    const headers = Object.assign(
      {"X-Webhook-Token":token()},
      options.body ? {"Content-Type":"application/json"} : {},
      options.headers || {}
    );
    let response;
    try {
      response = await fetch(path, Object.assign({}, options, {headers:headers}));
      const text = await response.text();
      let payload;
      try { payload = text ? JSON.parse(text) : {}; }
      catch (_) { payload = {text:text}; }
      recordApi(method,path,response.status,Date.now()-started);
      if (!response.ok) throw new Error(payload.error || payload.text || "HTTP " + response.status);
      return payload;
    } catch (err) {
      if (!response) recordApi(method,path,"NETWORK",Date.now()-started);
      throw err;
    }
  }

  function toast(message, kind) {
    const el = $("toast");
    el.textContent = message;
    el.className = "toast show" + (kind === "bad" ? " bad" : "");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function(){ el.className = "toast"; }, 3200);
  }

  async function login() {
    const value = $("tokenInput").value.trim();
    if (!value) return;
    localStorage.setItem(TOKEN_KEY,value);
    try {
      await refresh(false);
      $("login").classList.add("hidden");
      $("app").classList.remove("hidden");
      setDebug(false);
      startPolling();
    } catch (err) {
      localStorage.removeItem(TOKEN_KEY);
      $("loginError").textContent = "הכניסה נכשלה: " + err.message;
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    clearInterval(refreshTimer);
    clearInterval(nativeCapturePollTimer);
    location.reload();
  }

  function showTab(tab) {
    ["home","history","settings"].forEach(function(name){
      $("view-" + name).classList.toggle("hidden",name !== tab);
      $("nav-" + name).classList.toggle("active",name === tab);
    });
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function stateLabel(person) {
    if (person && person.state === "home") return "בבית";
    if (person && person.state === "away") return "בחוץ";
    return "לא ידוע";
  }

  function setPresenceUi(prefix, person) {
    const state = person && person.state || "unknown";
    const badge = $(prefix + "Badge");
    badge.textContent = stateLabel(person);
    badge.className = "chip " + (state === "home" ? "ok" : state === "away" ? "warn" : "");
    $(prefix + "Time").textContent = "עודכן: " + fmt(person && person.updatedAt);
    $(prefix + "Home").className = state === "home" ? "active-home" : "";
    $(prefix + "Away").className = state === "away" ? "active-away" : "";
  }

  function runSummary(d) {
    const active = Boolean(d.runInfo && d.runInfo.active);
    const actual = Boolean(d.runInfo && d.runInfo.actualRun);
    const runs = d.runInfo && d.runInfo.date === (d.localTime && d.localTime.date)
      ? Number(d.runInfo.count || 0) : 0;
    if (active && actual) return {title:"הרובוט מנקה עכשיו",sub:"ההפעלה אושרה על ידי הרובוט",kind:"ok",state:"פעיל",runs:runs};
    if (active) return {title:"הניקוי בתהליך הפעלה",sub:"הפקודה נשלחה וממתינה לאישור",kind:"warn",state:"ממתין",runs:runs};
    if (runs > 0) return {title:"הניקיון הושלם היום",sub:"הרובוט מוכן להפעלה נוספת",kind:"ok",state:"הושלם",runs:runs};
    return {title:"מוכן לניקוי",sub:"לא בוצעה הפעלה היום",kind:"ok",state:"מוכן",runs:runs};
  }

  function currentStage(d) {
    return safeText(
      d.runInfo && (d.runInfo.currentStage || d.runInfo.stage || d.runInfo.phase) ||
      d.robotStatus && (d.robotStatus.currentStage || d.robotStatus.stage) ||
      d.lastDecision && d.lastDecision.stage,
      d.runInfo && d.runInfo.actualRun ? "ניקוי פעיל" : d.runInfo && d.runInfo.active ? "ממתין להתחלה" : "לא פעיל"
    );
  }

  function currentLocation(d) {
    return safeText(
      d.runInfo && (d.runInfo.currentRoom || d.runInfo.location) ||
      d.robotStatus && (d.robotStatus.currentRoom || d.robotStatus.location) ||
      d.lastDecision && d.lastDecision.location,
      "לא דווח"
    );
  }

  function roomNames(config) {
    const label = safeText(config.cleanGeniusLabel,"").trim();
    if (label) return label.split(/[,،|/]+/).map(function(x){return x.trim();}).filter(Boolean);
    const ids = safeText(config.cleanGeniusRooms,"").trim();
    if (ids) return ids.split(",").map(function(x){return "חדר " + x.trim();}).filter(Boolean);
    return ["החדרים שבתוכנית"];
  }

  function renderWater(d) {
    const w = d.waterInfo;
    if (!w || !w.checkedAt) {
      $("waterState").textContent = "טרם נבדק";
      $("waterSub").textContent = "בדיקה מתוזמנת: " + safeText(d.config && d.config.waterCheckTime);
    } else if (w.status === "missing") {
      $("waterState").textContent = "חסר מים";
      $("waterSub").textContent = "נבדק: " + fmt(w.checkedAt);
    } else if (w.status === "ok") {
      $("waterState").textContent = "יש מים";
      $("waterSub").textContent = "נבדק: " + fmt(w.checkedAt);
    } else {
      $("waterState").textContent = "לא ידוע";
      $("waterSub").textContent = "נבדק: " + fmt(w.checkedAt);
    }
  }

  const PLAN_DAY_LABELS = {
    1:"שני",2:"שלישי",3:"רביעי",4:"חמישי",5:"שישי",6:"שבת",7:"ראשון"
  };

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value === undefined ? null : value));
  }

  function suctionLabel(value) {
    const labels = ["Quiet","Standard","Intense","Max"];
    return labels[Number(value)] || String(value);
  }

  function updateSettingsState() {
    const el = $("settingsState");
    if (!el) return;
    el.textContent = settingsDirty ? "יש שינויים שעדיין לא נשמרו" : "כל ההגדרות שמורות";
    el.className = "settings-state" + (settingsDirty ? " dirty" : "");
  }

  function markSettingsDirty() {
    if (!settingsLoaded) return;
    settingsDirty = true;
    updateSettingsState();
  }

  function updateRoomModeFields(card) {
    if (!card) return;
    const mode = card.querySelector('[data-rp="mode"]').value;
    card.querySelectorAll("[data-for-mode]").forEach(function(field){
      field.classList.toggle("hidden",field.getAttribute("data-for-mode") !== mode);
    });
  }

  function handleRoomModeChange(select) {
    updateRoomModeFields(select.closest("[data-room-id]"));
    markSettingsDirty();
  }

  function renderRoomPlanEditor() {
    const roomBox = $("roomProfileRows");
    const weekBox = $("weeklyPlanGrid");
    if (!roomBox || !weekBox) return;

    roomBox.innerHTML = "";
    if (!roomProfilesDraft.length) {
      roomBox.innerHTML = '<div class="note">לא הוגדרו חדרים. לחץ על “הוסף חדר” כדי להתחיל.</div>';
    }

    roomProfilesDraft.forEach(function(room){
      const id = Number(room.id);
      const card = document.createElement("div");
      card.className = "room-profile-card";
      card.dataset.roomId = String(id);
      card.innerHTML =
        '<div class="room-profile-top"><b>' + escapeHtml(room.name || ("חדר " + id)) +
        '</b><span class="chip">Room ID ' + escapeHtml(id) + '</span></div>' +
        '<div class="room-profile-fields">' +
        '<div class="field"><label>שם החדר</label><input data-rp="name" value="' + escapeHtml(room.name || "") + '"></div>' +
        '<div class="field"><label>סוג ניקוי</label><select data-rp="mode" onchange="handleRoomModeChange(this)">' +
        '<option value="cleangenius">CleanGenius</option><option value="vacuum">שאיבה בלבד</option></select></div>' +
        '<div class="field" data-for-mode="cleangenius"><label>עומק</label><select data-rp="geniusMode">' +
        '<option value="1">Routine</option><option value="2">Deep</option></select></div>' +
        '<div class="field" data-for-mode="vacuum"><label>עוצמת שאיבה</label><select data-rp="suction">' +
        '<option value="0">Quiet</option><option value="1">Standard</option>' +
        '<option value="2">Intense</option><option value="3">Max</option></select></div>' +
        '<div class="field" data-for-mode="vacuum"><label>מספר מעברים</label><select data-rp="repeats">' +
        '<option value="1">1</option><option value="2">2</option><option value="3">3</option></select></div>' +
        '<button class="btn danger" onclick="removeRoomProfile(' + id + ')">מחק</button>' +
        '</div>';
      roomBox.appendChild(card);

      card.querySelector('[data-rp="mode"]').value = room.mode || "cleangenius";
      card.querySelector('[data-rp="geniusMode"]').value = String(room.geniusMode || "1");
      card.querySelector('[data-rp="suction"]').value = String(room.suction !== undefined ? room.suction : 2);
      card.querySelector('[data-rp="repeats"]').value = String(room.repeats !== undefined ? room.repeats : 1);
      updateRoomModeFields(card);
    });

    weekBox.innerHTML = "";
    [7,1,2,3,4,5,6].forEach(function(day){
      const key = String(day);
      const plan = weeklyPlanDraft[key] || {
        enabled:true,
        rooms:roomProfilesDraft.map(function(room){ return Number(room.id); })
      };
      const selected = new Map();
      (plan.rooms || []).forEach(function(id,index){ selected.set(Number(id),index + 1); });

      const card = document.createElement("div");
      card.className = "day-plan";
      card.dataset.planDay = key;
      card.innerHTML =
        '<div class="day-plan-head"><b>' + PLAN_DAY_LABELS[day] + '</b>' +
        '<label><input type="checkbox" data-day-enabled ' + (plan.enabled !== false ? "checked" : "") + '>יום פעיל</label></div>';

      roomProfilesDraft.forEach(function(room){
        const id = Number(room.id);
        const item = document.createElement("div");
        item.className = "day-room";
        item.dataset.dayRoomId = String(id);
        item.innerHTML =
          '<input type="checkbox" data-day-room ' + (selected.has(id) ? "checked" : "") + '>' +
          '<span>' + escapeHtml(room.name || ("חדר " + id)) + '</span>' +
          '<input type="number" min="1" max="99" inputmode="numeric" data-day-order value="' +
          escapeHtml(selected.get(id) || "") + '" placeholder="סדר">';
        card.appendChild(item);
      });
      weekBox.appendChild(card);
    });
  }

  function collectRoomPlanSettings() {
    const profiles = [];
    document.querySelectorAll("#roomProfileRows [data-room-id]").forEach(function(card){
      profiles.push({
        id:Number(card.dataset.roomId),
        name:card.querySelector('[data-rp="name"]').value.trim(),
        enabled:true,
        mode:card.querySelector('[data-rp="mode"]').value,
        geniusMode:card.querySelector('[data-rp="geniusMode"]').value,
        suction:Number(card.querySelector('[data-rp="suction"]').value),
        repeats:Number(card.querySelector('[data-rp="repeats"]').value)
      });
    });

    const weekly = {};
    document.querySelectorAll("#weeklyPlanGrid [data-plan-day]").forEach(function(card){
      const rooms = [];
      card.querySelectorAll("[data-day-room-id]").forEach(function(row){
        if (!row.querySelector("[data-day-room]").checked) return;
        rooms.push({
          id:Number(row.dataset.dayRoomId),
          order:Number(row.querySelector("[data-day-order]").value) || 999
        });
      });
      rooms.sort(function(a,b){ return a.order - b.order || a.id - b.id; });
      weekly[String(card.dataset.planDay)] = {
        enabled:card.querySelector("[data-day-enabled]").checked,
        rooms:rooms.map(function(item){ return item.id; })
      };
    });

    roomProfilesDraft = profiles;
    weeklyPlanDraft = weekly;
    return {roomProfiles:profiles,weeklyPlan:weekly};
  }

  function addRoomProfile() {
    collectRoomPlanSettings();
    const idText = prompt("Room ID חדש:");
    if (idText === null) return;
    const id = Number(idText);
    if (!Number.isInteger(id) || id <= 0) return toast("Room ID לא תקין","bad");
    if (roomProfilesDraft.some(function(room){ return Number(room.id) === id; })) return toast("Room ID כבר קיים","bad");
    const name = prompt("שם החדר:","חדר " + id);
    if (name === null) return;
    roomProfilesDraft.push({id:id,name:name.trim() || ("חדר " + id),enabled:true,mode:"cleangenius",geniusMode:"1",suction:2,repeats:1});
    Object.keys(weeklyPlanDraft).forEach(function(key){
      if (weeklyPlanDraft[key] && Array.isArray(weeklyPlanDraft[key].rooms)) weeklyPlanDraft[key].rooms.push(id);
    });
    renderRoomPlanEditor();
    markSettingsDirty();
  }

  function removeRoomProfile(id) {
    if (!confirm("למחוק את החדר מהפרופילים ומכל ימי השבוע?")) return;
    collectRoomPlanSettings();
    roomProfilesDraft = roomProfilesDraft.filter(function(room){ return Number(room.id) !== Number(id); });
    Object.keys(weeklyPlanDraft).forEach(function(key){
      weeklyPlanDraft[key].rooms = (weeklyPlanDraft[key].rooms || []).filter(function(roomId){ return Number(roomId) !== Number(id); });
    });
    renderRoomPlanEditor();
    markSettingsDirty();
  }

  function renderTodayPlanSummary(todayPlan) {
    const el = $("todayPlanSummary");
    if (!el) return;
    const plan = Array.isArray(todayPlan) ? todayPlan : [];
    el.textContent = plan.length ? "התוכנית להיום: " + plan.map(function(room){
      if (room.mode === "vacuum") return room.name + " — שאיבה " + suctionLabel(room.suction) + " ×" + room.repeats;
      return room.name + " — CleanGenius " + (String(room.geniusMode) === "2" ? "Deep" : "Routine");
    }).join(" • ") : "אין תוכנית ניקוי פעילה להיום";
  }

  function fillSettings(s, force) {
    latestServerSettings = s || {};
    if (settingsDirty && !force) return;
    const ids = [
      "startTime","endTime","awayDelayMinutes","maxRunsPerDay","activeRunMaxMinutes",
      "eveningCheckTime","waterCheckTime","timezone","primaryMode","shortcutName","shortcutId",
      "cleanGeniusRooms","cleanGeniusMode","cleanGeniusLabel","fallbackShortcutName",
      "fallbackShortcutId","waterEmptyCodes","githubOwner","githubRepo","githubWorkflow",
      "githubRef","workerPublicUrl"
    ];
    ids.forEach(function(id){ if ($(id) && s[id] !== undefined) $(id).value = s[id]; });
    $("dryRun").checked = Boolean(s.dryRun);
    roomProfilesDraft = deepClone(Array.isArray(s.roomProfiles) ? s.roomProfiles : []);
    weeklyPlanDraft = deepClone(s.weeklyPlan && typeof s.weeklyPlan === "object" ? s.weeklyPlan : {});
    renderRoomPlanEditor();
    settingsLoaded = true;
    settingsDirty = false;
    updateSettingsState();
  }

  function renderHistory(history) {
    const rows = Array.isArray(history) ? history : [];
    $("historyRows").innerHTML = rows.length ? rows.map(function(event){
      return '<article class="event"><time class="event-time">' + escapeHtml(fmt(event.at)) +
        '</time><div><div class="event-title">' + escapeHtml(event.type || "אירוע") +
        '</div><div class="event-detail">' + escapeHtml(JSON.stringify(event.details || {})) +
        '</div></div></article>';
    }).join("") : '<article class="card card-body muted">אין אירועים להצגה</article>';
  }

  function renderNativeCapture(capture) {
    const card = $("nativeCaptureCard");
    if (!capture) {
      card.classList.add("hidden");
      if (nativeCapturePollTimer) { clearInterval(nativeCapturePollTimer); nativeCapturePollTimer = null; }
      return;
    }
    card.classList.remove("hidden");
    const state = capture.status || "idle";
    const pill = $("nativeCapturePill");
    const button = $("nativeCaptureBtn");
    const status = $("nativeCaptureStatus");
    pill.className = "chip " + (state === "recording" ? "bad" : state === "completed" ? "ok" : state === "failed" ? "bad" : "warn");
    if (state === "starting") {
      pill.textContent = "מתחיל"; button.textContent = "ממתין…"; button.disabled = true;
      status.textContent = "המאזין מתחבר ל־Dreame. עדיין אין להפעיל את החדר.";
    } else if (state === "recording") {
      pill.textContent = "מקליט"; button.textContent = "סיים הקלטה"; button.disabled = false; button.className = "btn danger";
      status.textContent = "אירועים שנקלטו: " + Number(capture.entryCount || 0);
    } else if (state === "stopping") {
      pill.textContent = "מסיים"; button.textContent = "מסיים…"; button.disabled = true;
      status.textContent = "נשלחה בקשת עצירה למאזין.";
    } else if (state === "completed") {
      pill.textContent = "הושלם"; button.textContent = "הקלטה חדשה"; button.disabled = false; button.className = "btn brand";
      status.textContent = "נשמרו " + Number(capture.entryCount || 0) + " אירועים";
    } else if (state === "failed") {
      pill.textContent = "נכשל"; button.textContent = "נסה שוב"; button.disabled = false; button.className = "btn brand";
      status.textContent = "שגיאה: " + safeText(capture.error,"לא ידוע");
    } else {
      pill.textContent = "לא פעיל"; button.textContent = "התחל הקלטה"; button.disabled = false; button.className = "btn brand";
      status.textContent = "ההקלטה פסיבית ואינה מפעילה את הרובוט.";
    }
    const hasResult = Boolean(capture.result);
    $("copyNativeCaptureBtn").classList.toggle("hidden",!hasResult);
    $("nativeCaptureDetails").classList.toggle("hidden",!hasResult);
    if (hasResult) $("nativeCaptureResult").textContent = JSON.stringify(capture.result,null,2);

    const shouldPoll = capture.active || state === "starting" || state === "stopping";
    if (shouldPoll && !nativeCapturePollTimer) {
      nativeCapturePollTimer = setInterval(function(){ refresh(false).catch(function(){}); },3000);
    } else if (!shouldPoll && nativeCapturePollTimer) {
      clearInterval(nativeCapturePollTimer); nativeCapturePollTimer = null;
    }
  }

  function renderApiLog() {
    $("apiLog").innerHTML = apiCalls.length ? apiCalls.slice(0,6).map(function(item){
      return escapeHtml(item.at + "  " + item.method + " " + item.path + "  " + item.status + "  " + item.durationMs + "ms");
    }).join("<br>") : "אין בקשות במושב הנוכחי";
  }

  function renderDebug(d, summary) {
    if (!debugEnabled || !d) return;
    const integrations = d.integrations || {};
    $("debugRobotState").textContent = summary.state;
    $("debugStage").textContent = currentStage(d);
    $("debugLocation").textContent = currentLocation(d);
    $("debugRuns").textContent = String(summary.runs);
    $("debugWorker").textContent = "200 OK";
    $("debugGithub").textContent = integrations.githubConfigured ? "מוגדר" : "לא מוגדר";
    $("debugWebhook").textContent = integrations.webhookTokenConfigured ? "מוגדר" : "לא מוגדר";
    $("debugRefresh").textContent = lastRefreshAt ? fmt(lastRefreshAt.toISOString()) : "—";
    $("debugLastCommand").textContent = data && data.lastDecision ? JSON.stringify(data.lastDecision,null,2) : "אין החלטה שמורה";
    $("rawJson").textContent = JSON.stringify(d,null,2);
    renderApiLog();
    renderNativeCapture(d.nativeCapture);
  }

  function render(d) {
    data = d;
    latestServerSettings = d.effectiveSettings || {};
    lastRefreshAt = new Date();
    const summary = runSummary(d);
    const config = d.config || d.effectiveSettings || {};

    $("connectionChip").className = "chip ok";
    $("connectionChip").innerHTML = '<i class="dot"></i> מחובר';
    $("clock").textContent = safeText(d.localTime && d.localTime.date,"") + " · " + safeText(d.localTime && d.localTime.time,"");
    $("lastUpdated").textContent = "עודכן עכשיו";
    $("heroTitle").textContent = summary.title;
    $("heroSub").textContent = summary.sub + (d.runInfo && d.runInfo.lastRunAt ? " · " + fmt(d.runInfo.lastRunAt) : "");
    $("runChip").className = "chip " + summary.kind;
    $("runChip").innerHTML = '<i class="dot"></i> ' + escapeHtml(summary.state);

    $("stageValue").textContent = currentStage(d);
    $("stageSub").textContent = d.runInfo && d.runInfo.actualRun ? "הרובוט אישר שהניקוי פעיל" : "לפי מצב ההפעלה האחרון";
    $("locationValue").textContent = currentLocation(d);
    renderWater(d);

    $("runCount").textContent = "הפעלות היום: " + summary.runs;
    const todayPlan = Array.isArray(config.todayPlan) ? config.todayPlan : [];
    if (todayPlan.length) {
      $("planName").textContent = "התוכנית להיום";
      $("planDescription").textContent = todayPlan.map(function(room){ return room.name; }).join(" ← ");
      $("planModeChip").textContent = todayPlan.length + " חדרים";
      $("roomsList").innerHTML = todayPlan.map(function(room,index){
        const detail = room.mode === "vacuum"
          ? "שאיבה " + suctionLabel(room.suction) + " ×" + room.repeats
          : "CleanGenius " + (String(room.geniusMode) === "2" ? "Deep" : "Routine");
        return '<span class="room">' + (index + 1) + '. ' + escapeHtml(room.name) + ' · ' + escapeHtml(detail) + '</span>';
      }).join("");
    } else {
      $("planName").textContent = safeText(config.cleanGeniusLabel,config.shortcutName || "תוכנית הניקוי הראשית");
      $("planDescription").textContent = config.primaryMode === "shortcut" ? "הפעלה באמצעות Shortcut" : "תוכנית CleanGenius לפי החדרים שהוגדרו";
      $("planModeChip").textContent = config.primaryMode === "shortcut" ? "Shortcut" : config.cleanGeniusMode === "2" ? "CleanGenius · עמוק" : "CleanGenius · רגיל";
      $("roomsList").innerHTML = roomNames(config).map(function(room){return '<span class="room">' + escapeHtml(room) + '</span>';}).join("");
    }
    $("windowValue").textContent = safeText(config.startTime) + "–" + safeText(config.endTime);
    $("awayDelayValue").textContent = safeText(config.awayDelayMinutes,"0") + " דקות";
    $("maxRunsValue").textContent = safeText(config.maxRunsPerDay,"—");
    renderTodayPlanSummary(todayPlan);

    setPresenceUi("naor",d.naor);
    setPresenceUi("wife",d.wife);
    const skipped = d.skipInfo && d.skipInfo.date === (d.localTime && d.localTime.date);
    $("skipBtn").textContent = skipped ? "בטל דילוג" : "דלג היום";
    $("skipBtn").className = skipped ? "btn brand" : "btn warn";

    fillSettings(d.effectiveSettings || {});
    renderHistory(d.history);
    renderDebug(d,summary);
  }

  async function refresh(showToast) {
    $("connectionChip").className = "chip warn";
    $("connectionChip").innerHTML = '<i class="dot"></i> מעדכן…';
    try {
      const d = await api("/api/dashboard");
      render(d);
      if (showToast) toast("הנתונים עודכנו");
      return d;
    } catch (err) {
      $("connectionChip").className = "chip bad";
      $("connectionChip").innerHTML = '<i class="dot"></i> מנותק';
      if (showToast) toast("הרענון נכשל: " + err.message,"bad");
      throw err;
    }
  }

  function startPolling() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(function(){ refresh(false).catch(function(){}); },20000);
  }

  function setDebug(enabled) {
    debugEnabled = Boolean(enabled);
    $("debugSwitch").setAttribute("aria-checked",debugEnabled ? "true" : "false");
    $("debugPanel").classList.toggle("hidden",!debugEnabled);
    if (debugEnabled && data) renderDebug(data,runSummary(data));
    if (!debugEnabled && nativeCapturePollTimer && !(data && data.nativeCapture && data.nativeCapture.active)) {
      clearInterval(nativeCapturePollTimer); nativeCapturePollTimer = null;
    }
  }

  function toggleDebug() {
    setDebug(!debugEnabled);
    toast(debugEnabled ? "מצב דיבוג הופעל למושב הנוכחי" : "מצב דיבוג נסגר");
  }

  async function doAction(path, message, options) {
    options = options || {};
    $("lastActionPublic").textContent = message + "…";
    try {
      const result = await api(path,Object.assign({method:"POST"},options));
      $("lastActionPublic").textContent = "הפעולה נשלחה בהצלחה";
      toast("הפעולה נשלחה");
      setTimeout(function(){ refresh(false).catch(function(){}); },1200);
      return result;
    } catch (err) {
      $("lastActionPublic").textContent = "הפעולה נכשלה: " + err.message;
      toast(err.message,"bad");
      throw err;
    }
  }

  async function runNow() {
    if (!confirm("להתחיל ניקוי עכשיו? הפעולה עוקפת נוכחות, שעות ודילוג יומי. Dry Run עדיין מכובד.")) return;
    await doAction("/api/run-now","מתחיל ניקוי");
  }
  async function stopDock() {
    if (!confirm("לעצור את הניקוי ולהחזיר את הרובוט לעמדה?")) return;
    await doAction("/api/stop-dock","עוצר ומחזיר לעמדה");
  }
  async function toggleSkip() { await doAction("/api/skip-toggle","מעדכן דילוג יומי"); }
  async function manualCheck() { await doAction("/api/check","בודק את תנאי ההפעלה"); }
  async function waterCheck() { await doAction("/api/water-check-now","מבצע בדיקת מים"); }

  async function setPresence(person,state) {
    const who = person === "naor" ? "נאור" : "בת הזוג";
    const label = state === "home" ? "בבית" : "בחוץ";
    if (state === "home" && !confirm("לסמן את " + who + " בבית? ניקוי פעיל עשוי להיעצר.")) return;
    await doAction("/api/presence/" + person,"מעדכן את " + who + " ל־" + label,{body:JSON.stringify({state:state})});
  }

  function readSettings() {
    const val = function(id){ return $(id).value.trim(); };
    const planSettings = collectRoomPlanSettings();
    return {
      startTime:val("startTime"),endTime:val("endTime"),
      awayDelayMinutes:Number(val("awayDelayMinutes")),maxRunsPerDay:Number(val("maxRunsPerDay")),
      activeRunMaxMinutes:Number(val("activeRunMaxMinutes")),dryRun:$("dryRun").checked,
      eveningCheckTime:val("eveningCheckTime"),waterCheckTime:val("waterCheckTime"),timezone:val("timezone"),
      primaryMode:val("primaryMode"),shortcutName:val("shortcutName"),shortcutId:val("shortcutId"),
      cleanGeniusRooms:val("cleanGeniusRooms"),cleanGeniusMode:val("cleanGeniusMode"),cleanGeniusLabel:val("cleanGeniusLabel"),
      roomProfiles:planSettings.roomProfiles,weeklyPlan:planSettings.weeklyPlan,
      fallbackShortcutName:val("fallbackShortcutName"),fallbackShortcutId:val("fallbackShortcutId"),
      waterEmptyCodes:val("waterEmptyCodes"),githubOwner:val("githubOwner"),githubRepo:val("githubRepo"),
      githubWorkflow:val("githubWorkflow"),githubRef:val("githubRef"),workerPublicUrl:val("workerPublicUrl")
    };
  }

  async function saveSettings() {
    try {
      await api("/api/settings",{method:"PUT",body:JSON.stringify(readSettings())});
      settingsDirty = false;
      updateSettingsState();
      toast("ההגדרות נשמרו");
      await refresh(false);
    } catch (err) { toast("השמירה נכשלה: " + err.message,"bad"); }
  }

  async function resetSettings() {
    if (!confirm("למחוק את כל השינויים ולחזור לערכי Cloudflare?")) return;
    await doAction("/api/settings/reset","מאפס הגדרות");
    settingsDirty = false;
    await refresh(false);
  }

  async function clearHistory() {
    if (!confirm("לנקות את היסטוריית האירועים?")) return;
    await doAction("/api/history/clear","מנקה היסטוריה");
  }

  async function toggleNativeCapture() {
    const capture = data && data.nativeCapture;
    if (capture && capture.active && !capture.stopRequested) {
      if (!confirm("לסיים את ההקלטה? הפעולה אינה עוצרת את הרובוט.")) return;
      await doAction("/api/native-capture/stop","מסיים הקלטה");
    } else {
      if (!confirm("להתחיל הקלטה פסיבית? לאחר שהמצב יהפוך למקליט, הפעל ידנית את החדר ב־Dreamehome.")) return;
      await doAction("/api/native-capture/start","מתחיל הקלטה");
    }
    await refresh(false);
  }

  async function copyNativeCaptureResult() {
    const result = data && data.nativeCapture && data.nativeCapture.result;
    if (!result) return toast("אין תוצאה להעתקה","bad");
    await copyText(JSON.stringify(result,null,2),"תוצאת ההקלטה הועתקה");
  }

  async function copyRawJson() {
    if (!data) return;
    await copyText(JSON.stringify(data,null,2),"ה־JSON הועתק");
  }

  async function copyText(text,successMessage) {
    try { await navigator.clipboard.writeText(text); toast(successMessage); }
    catch (_) { toast("לא ניתן להעתיק אוטומטית","bad"); }
  }

  $("tokenInput").addEventListener("keydown",function(event){ if (event.key === "Enter") login(); });
  ["input","change"].forEach(function(eventName){
    $("view-settings").addEventListener(eventName,function(event){
      if (event.target && event.target.matches("input,select,textarea")) markSettingsDirty();
    });
  });
  window.addEventListener("beforeunload",function(event){
    if (!settingsDirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  window.addEventListener("load",async function(){
    setDebug(false);
    if (!token()) return;
    try {
      await refresh(false);
      $("login").classList.add("hidden");
      $("app").classList.remove("hidden");
      startPolling();
    } catch (_) {
      localStorage.removeItem(TOKEN_KEY);
    }
  });
</script>
</body>
</html>`;
