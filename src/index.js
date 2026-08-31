export class PresenceState {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/status") {
      return Response.json(await this.getState(), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (url.pathname === "/check") {
      return Response.json(await this.checkAndMaybeRun("manual_check"));
    }

    if (url.pathname === "/evening-check") {
      return Response.json(await this.checkEveningReminder());
    }

    if (url.pathname === "/trigger-test" && request.method === "POST") {
      try {
        const result = await this.dispatchGitHub();
        return Response.json({ action: "github_test_dispatched", ...result });
      } catch (err) {
        return Response.json(
          {
            action: "github_dispatch_failed",
            error: err?.message || String(err),
          },
          { status: 502 }
        );
      }
    }

    if (url.pathname === "/run-event" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }

      const token = request.headers.get("X-Run-Callback-Token");
      const runInfo = await this.ctx.storage.get("runInfo");

      if (!token || !runInfo?.callbackToken || token !== runInfo.callbackToken) {
        return new Response("Unauthorized", { status: 401 });
      }

      const event = String(body?.event || "");

      if (event === "fallback-used") {
        await this.ctx.storage.put("runInfo", {
          ...runInfo,
          fallbackUsed: true,
          fallbackUsedAt: new Date().toISOString(),
        });
        return Response.json({ ok: true, event });
      }

      if (event === "primary-active" || event === "fallback-active") {
        await this.ctx.storage.put("runInfo", {
          ...runInfo,
          actualRun: true,
          actualRunAt: runInfo.actualRunAt || new Date().toISOString(),
          ...(event === "fallback-active" ? { fallbackUsed: true } : {}),
        });
        return Response.json({ ok: true, event });
      }

      return new Response("Unknown event", { status: 400 });
    }

    const m = url.pathname.match(/^\/presence\/(naor|wife)$/);
    if (m && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }

      if (!["home", "away"].includes(body.state)) {
        return new Response("state must be home or away", { status: 400 });
      }

      const presenceKey = `presence:${m[1]}`;
      const previousPresence = await this.ctx.storage.get(presenceKey);

      await this.ctx.storage.put(presenceKey, {
        state: body.state,
        updatedAt: new Date().toISOString(),
      });

      let returnHome = null;
      if (body.state === "home" && previousPresence?.state !== "home") {
        returnHome = await this.stopIfActive(m[1]);
      }

      const check = await this.checkAndMaybeRun("presence_update");
      return Response.json(
        returnHome ? { ...check, returnHome } : check
      );
    }

    return new Response("Not found", { status: 404 });
  }

  async stopIfActive(returnedBy) {
    const runInfo = await this.ctx.storage.get("runInfo");

    if (!runInfo?.active || !runInfo?.lastRunAt) {
      return {
        action: "no_active_cleaning_run",
        returnedBy,
      };
    }

    const maxActiveMinutes = Number(
      this.env.ACTIVE_RUN_MAX_MINUTES || "240"
    );
    const lastRunMs = Date.parse(runInfo.lastRunAt);
    const ageMinutes =
      Number.isFinite(lastRunMs)
        ? (Date.now() - lastRunMs) / 60000
        : Number.POSITIVE_INFINITY;

    if (ageMinutes > maxActiveMinutes) {
      await this.ctx.storage.put("runInfo", {
        ...runInfo,
        active: false,
        activeExpiredAt: new Date().toISOString(),
      });

      return {
        action: "active_run_expired",
        returnedBy,
        ageMinutes: Math.round(ageMinutes),
      };
    }

    let github;
    try {
      github = await this.dispatchGitHub("stop-and-dock", returnedBy);
    } catch (err) {
      return {
        action: "stop_dispatch_failed",
        returnedBy,
        error: err?.message || String(err),
      };
    }

    await this.ctx.storage.put("runInfo", {
      ...runInfo,
      active: false,
      stopRequestedAt: new Date().toISOString(),
      stoppedBy: returnedBy,
    });

    return {
      action: "stop_and_dock_dispatched",
      returnedBy,
      github,
    };
  }

  primaryMode() {
    return (this.env.DREAME_PRIMARY_MODE || "cleangenius").toLowerCase();
  }

  cleanGeniusModeName() {
    return String(this.env.DREAME_CLEAN_GENIUS_MODE || "1") === "2"
      ? "Deep"
      : "Routine";
  }

  async getState() {
    const [naor, wife, runInfo, eveningInfo] = await Promise.all([
      this.ctx.storage.get("presence:naor"),
      this.ctx.storage.get("presence:wife"),
      this.ctx.storage.get("runInfo"),
      this.ctx.storage.get("eveningInfo"),
    ]);

    const primaryMode = this.primaryMode();

    return {
      naor: naor ?? { state: "unknown" },
      wife: wife ?? { state: "unknown" },
      runInfo: runInfo ?? null,
      eveningInfo: eveningInfo ?? null,
      config: {
        timezone: this.env.TIMEZONE || "Asia/Jerusalem",
        startTime: this.env.START_TIME || "10:00",
        endTime: this.env.END_TIME || "15:00",
        eveningCheckTime: this.env.EVENING_CHECK_TIME || "22:00",
        awayDelayMinutes: Number(this.env.AWAY_DELAY_MINUTES || "10"),
        maxRunsPerDay: Number(this.env.MAX_RUNS_PER_DAY || "1"),
        activeRunMaxMinutes: Number(
          this.env.ACTIVE_RUN_MAX_MINUTES || "240"
        ),
        dryRun: this.env.DRY_RUN !== "false",

        primaryMode,
        shortcutName:
          primaryMode === "cleangenius"
            ? `CleanGenius ${this.cleanGeniusModeName()}`
            : this.env.DREAME_SHORTCUT_NAME || "ניקוי עמוק",

        cleanGeniusRooms:
          this.env.DREAME_CLEAN_GENIUS_ROOMS || "2,3,4,7,8",
        cleanGeniusMode:
          this.env.DREAME_CLEAN_GENIUS_MODE || "1",
        cleanGeniusLabel:
          this.env.DREAME_CLEAN_GENIUS_LABEL ||
          "סלון, חדר שינה ראשי 3, חדר שינה ראשי 2, משרד, מסדרון",

        fallbackShortcutName:
          this.env.DREAME_FALLBACK_SHORTCUT_NAME || "שאיבה בלבד",
        fallbackShortcutIdConfigured:
          Boolean(this.env.DREAME_FALLBACK_SHORTCUT_ID),
        waterEmptyCodes:
          this.env.DREAME_WATER_EMPTY_CODES || "107,116",
      },
      localTime: this.localNow(),
    };
  }

  localNow() {
    const timezone = this.env.TIMEZONE || "Asia/Jerusalem";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(new Date());

    const x = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return {
      date: `${x.year}-${x.month}-${x.day}`,
      time: `${x.hour}:${x.minute}:${x.second}`,
      minuteOfDay: Number(x.hour) * 60 + Number(x.minute),
    };
  }

  parseClock(value, fallback) {
    const text = String(value || fallback);
    const m = text.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) throw new Error(`Invalid time: ${text}`);
    return Number(m[1]) * 60 + Number(m[2]);
  }

  async dispatchGitHub(mode = "smart-run", returnedBy = "", extra = {}) {
    const owner = this.env.GITHUB_OWNER;
    const repo = this.env.GITHUB_REPO;
    const workflow = this.env.GITHUB_WORKFLOW || "dreame.yml";
    const ref = this.env.GITHUB_REF || "main";
    const token = this.env.GITHUB_DISPATCH_TOKEN;

    if (!owner || !repo || !token) {
      throw new Error("Missing GitHub configuration.");
    }

    const primaryMode = this.primaryMode();

    const endpoint =
      `https://api.github.com/repos/${encodeURIComponent(owner)}` +
      `/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "dreame-x40-cloudflare-worker",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref,
        inputs: {
          mode,
          returned_by: returnedBy,
          callback_url: String(extra.callbackUrl || ""),
          callback_token: String(extra.callbackToken || ""),
          ran_today: String(Boolean(extra.ranToday)),
          fallback_used: String(Boolean(extra.fallbackUsed)),
          primary_mode: primaryMode,

          shortcut_name:
            this.env.DREAME_SHORTCUT_NAME || "ניקוי עמוק",
          shortcut_id:
            String(this.env.DREAME_SHORTCUT_ID || ""),

          clean_genius_rooms:
            this.env.DREAME_CLEAN_GENIUS_ROOMS || "2,3,4,7,8",
          clean_genius_mode:
            this.env.DREAME_CLEAN_GENIUS_MODE || "1",
          clean_genius_label:
            this.env.DREAME_CLEAN_GENIUS_LABEL ||
            "סלון, חדר שינה ראשי 3, חדר שינה ראשי 2, משרד, מסדרון",

          fallback_shortcut_name:
            this.env.DREAME_FALLBACK_SHORTCUT_NAME || "שאיבה בלבד",
          fallback_shortcut_id:
            String(this.env.DREAME_FALLBACK_SHORTCUT_ID || ""),
          water_empty_codes:
            this.env.DREAME_WATER_EMPTY_CODES || "107,116",
        },
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`GitHub dispatch failed: ${response.status} ${text}`);
    }

    return {
      ok: true,
      status: response.status,
      mode,
      primaryMode,
      cleanGeniusRooms:
        this.env.DREAME_CLEAN_GENIUS_ROOMS || "2,3,4,7,8",
      cleanGeniusMode:
        this.env.DREAME_CLEAN_GENIUS_MODE || "1",
      fallbackShortcutConfigured:
        Boolean(this.env.DREAME_FALLBACK_SHORTCUT_ID),
    };
  }

  async checkEveningReminder() {
    const now = this.localNow();
    const target = this.parseClock(
      this.env.EVENING_CHECK_TIME,
      "22:00"
    );

    const delta = now.minuteOfDay - target;
    if (delta < 0 || delta >= 10) {
      return {
        action: "outside_evening_window",
        localTime: now,
      };
    }

    const eveningInfo = await this.ctx.storage.get("eveningInfo");
    if (eveningInfo?.date === now.date && eveningInfo?.sent) {
      return {
        action: "evening_already_dispatched",
        localTime: now,
      };
    }

    const runInfo = await this.ctx.storage.get("runInfo");
    const todayRun = runInfo?.date === now.date ? runInfo : null;

    const ranToday = Boolean(
      todayRun && ((todayRun.count || 0) > 0 || todayRun.actualRun)
    );
    const fallbackUsed = Boolean(todayRun?.fallbackUsed);

    let github;
    try {
      github = await this.dispatchGitHub("evening-check", "", {
        ranToday,
        fallbackUsed,
      });
    } catch (err) {
      return {
        action: "evening_dispatch_failed",
        error: err?.message || String(err),
        localTime: now,
      };
    }

    await this.ctx.storage.put("eveningInfo", {
      date: now.date,
      sent: true,
      sentAt: new Date().toISOString(),
      ranToday,
      fallbackUsed,
    });

    return {
      action: "evening_check_dispatched",
      ranToday,
      fallbackUsed,
      localTime: now,
      github,
    };
  }

  async checkAndMaybeRun(reason) {
    const state = await this.getState();
    const now = this.localNow();

    const bothAway =
      state.naor?.state === "away" &&
      state.wife?.state === "away";

    const awayDelayMs =
      Number(this.env.AWAY_DELAY_MINUTES || "10") * 60 * 1000;
    const nowMs = Date.now();

    const naorAwayLongEnough =
      state.naor?.state === "away" &&
      Number.isFinite(Date.parse(state.naor.updatedAt)) &&
      nowMs - Date.parse(state.naor.updatedAt) >= awayDelayMs;

    const wifeAwayLongEnough =
      state.wife?.state === "away" &&
      Number.isFinite(Date.parse(state.wife.updatedAt)) &&
      nowMs - Date.parse(state.wife.updatedAt) >= awayDelayMs;

    const start = this.parseClock(this.env.START_TIME, "10:00");
    const end = this.parseClock(this.env.END_TIME, "15:00");
    const inWindow = now.minuteOfDay >= start && now.minuteOfDay < end;

    const maxRuns = Number(this.env.MAX_RUNS_PER_DAY || "1");
    const runInfo =
      state.runInfo?.date === now.date
        ? state.runInfo
        : { date: now.date, count: 0 };

    const result = {
      reason,
      bothAway,
      awayLongEnough: naorAwayLongEnough && wifeAwayLongEnough,
      inWindow,
      runsToday: runInfo.count,
      maxRunsPerDay: maxRuns,
      localTime: now,
      action: "none",
      primaryMode: this.primaryMode(),
    };

    if (
      !bothAway ||
      !naorAwayLongEnough ||
      !wifeAwayLongEnough ||
      !inWindow ||
      runInfo.count >= maxRuns
    ) {
      return result;
    }

    if (this.env.DRY_RUN !== "false") {
      return {
        ...result,
        action: "dry_run_would_dispatch",
        cleanGeniusRooms:
          this.env.DREAME_CLEAN_GENIUS_ROOMS || "2,3,4,7,8",
        cleanGeniusMode:
          this.env.DREAME_CLEAN_GENIUS_MODE || "1",
      };
    }

    const callbackToken =
      crypto.randomUUID() + "-" + crypto.randomUUID();
    const callbackUrl =
      this.env.WORKER_PUBLIC_URL ||
      "https://x40-automation.naor-5252.workers.dev";

    let github;
    try {
      github = await this.dispatchGitHub("smart-run", "", {
        callbackToken,
        callbackUrl,
      });
    } catch (err) {
      return {
        ...result,
        action: "github_dispatch_failed",
        error: err?.message || String(err),
      };
    }

    await this.ctx.storage.put("runInfo", {
      date: now.date,
      count: runInfo.count + 1,
      lastRunAt: new Date().toISOString(),
      active: true,
      actualRun: false,
      fallbackUsed: false,
      callbackToken,
    });

    return {
      ...result,
      action: "github_workflow_dispatched",
      github,
    };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const webhookToken = request.headers.get("X-Webhook-Token");
    const widgetToken = request.headers.get("X-Widget-Token");

    const webhookAuthorized =
      Boolean(env.WEBHOOK_TOKEN) &&
      webhookToken === env.WEBHOOK_TOKEN;

    const widgetAuthorized =
      request.method === "GET" &&
      url.pathname === "/status" &&
      Boolean(env.WIDGET_TOKEN) &&
      widgetToken === env.WIDGET_TOKEN;

    const runCallbackCandidate =
      request.method === "POST" &&
      url.pathname === "/run-event" &&
      Boolean(request.headers.get("X-Run-Callback-Token"));

    if (!webhookAuthorized && !widgetAuthorized && !runCallbackCandidate) {
      return new Response("Unauthorized", { status: 401 });
    }

    const id = env.PRESENCE.idFromName("home");
    return env.PRESENCE.get(id).fetch(request);
  },

  async scheduled(_controller, env, _ctx) {
    const id = env.PRESENCE.idFromName("home");
    const stub = env.PRESENCE.get(id);
    await stub.fetch("https://internal/check");
    await stub.fetch("https://internal/evening-check");
  },
};
