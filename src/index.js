import { dashboardHtml } from "./dashboard.js";
import {
  buildDefaultRoomProfiles,
  normalizeRoomProfiles,
  normalizeWeeklyPlan,
  resolveDayPlan,
  validateRoomProfiles,
  validateWeeklyPlan,
} from "./room-plan.js";

const DEFAULT_PUBLIC_URL = "https://x40-automation.naor-5252.workers.dev";

export class PresenceState {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.runtimeSettings = {};
  }

  async loadSettings(force = false) {
    if (force || !this.runtimeSettingsLoaded) {
      this.runtimeSettings =
        (await this.ctx.storage.get("runtimeSettings")) || {};
      this.runtimeSettingsLoaded = true;
    }
    return this.runtimeSettings;
  }

  hasOverride(key) {
    return Object.prototype.hasOwnProperty.call(
      this.runtimeSettings || {},
      key
    );
  }

  value(key, envKey, fallback) {
    if (this.hasOverride(key)) return this.runtimeSettings[key];
    const envValue = this.env?.[envKey];
    return envValue === undefined || envValue === null || envValue === ""
      ? fallback
      : envValue;
  }

  numberValue(key, envKey, fallback) {
    const n = Number(this.value(key, envKey, fallback));
    return Number.isFinite(n) ? n : Number(fallback);
  }

  boolValue(key, envKey, fallback) {
    const value = this.value(key, envKey, fallback);
    if (typeof value === "boolean") return value;
    if (value === undefined || value === null || value === "") {
      return Boolean(fallback);
    }
    return String(value).toLowerCase() === "true";
  }

  dayListValue(key, envKey, fallback = [2, 4]) {
    const raw = this.value(key, envKey, fallback);
    const values = Array.isArray(raw)
      ? raw
      : String(raw ?? "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);

    return [...new Set(
      values
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    )].sort((a, b) => a - b);
  }

  effectiveConfig() {
    const primaryMode = String(
      this.value("primaryMode", "DREAME_PRIMARY_MODE", "cleangenius")
    ).toLowerCase();

    const cleanGeniusMode = String(
      this.value("cleanGeniusMode", "DREAME_CLEAN_GENIUS_MODE", "1")
    );

    const baseRoomIds = String(
      this.value(
        "cleanGeniusRooms",
        "DREAME_CLEAN_GENIUS_ROOMS",
        "2,3,4,7,8"
      )
    );
    const baseRoomLabels = String(
      this.value(
        "cleanGeniusLabel",
        "DREAME_CLEAN_GENIUS_LABEL",
        "סלון, חדר שינה ראשי 3, חדר שינה ראשי 2, משרד, מסדרון"
      )
    );

    const roomProfiles = normalizeRoomProfiles(
      this.value("roomProfiles", "DREAME_ROOM_PROFILES_JSON", null),
      buildDefaultRoomProfiles(
        baseRoomIds,
        baseRoomLabels,
        cleanGeniusMode
      )
    );

    const weeklyPlan = normalizeWeeklyPlan(
      this.value("weeklyPlan", "DREAME_WEEKLY_PLAN_JSON", null),
      roomProfiles
    );

    return {
      timezone: String(
        this.value("timezone", "TIMEZONE", "Asia/Jerusalem")
      ),
      startTime: String(
        this.value("startTime", "START_TIME", "10:00")
      ),
      endTime: String(
        this.value("endTime", "END_TIME", "15:00")
      ),
      eveningCheckTime: String(
        this.value("eveningCheckTime", "EVENING_CHECK_TIME", "22:00")
      ),
      waterCheckTime: String(
        this.value("waterCheckTime", "WATER_CHECK_TIME", "22:00")
      ),
      awayDelayMinutes: this.numberValue(
        "awayDelayMinutes",
        "AWAY_DELAY_MINUTES",
        10
      ),
      maxRunsPerDay: this.numberValue(
        "maxRunsPerDay",
        "MAX_RUNS_PER_DAY",
        1
      ),
      activeRunMaxMinutes: this.numberValue(
        "activeRunMaxMinutes",
        "ACTIVE_RUN_MAX_MINUTES",
        240
      ),
      dryRun: this.boolValue("dryRun", "DRY_RUN", true),
      wifeOnlyDays: this.dayListValue(
        "wifeOnlyDays",
        "WIFE_ONLY_DAYS",
        [2, 4]
      ),

      roomProfiles,
      weeklyPlan,

      primaryMode,
      shortcutName: String(
        this.value("shortcutName", "DREAME_SHORTCUT_NAME", "ניקוי עמוק")
      ),
      shortcutId: String(
        this.value("shortcutId", "DREAME_SHORTCUT_ID", "")
      ),

      cleanGeniusRooms: String(
        this.value(
          "cleanGeniusRooms",
          "DREAME_CLEAN_GENIUS_ROOMS",
          "2,3,4,7,8"
        )
      ),
      cleanGeniusMode,
      cleanGeniusLabel: String(
        this.value(
          "cleanGeniusLabel",
          "DREAME_CLEAN_GENIUS_LABEL",
          "סלון, חדר שינה ראשי 3, חדר שינה ראשי 2, משרד, מסדרון"
        )
      ),

      fallbackShortcutName: String(
        this.value(
          "fallbackShortcutName",
          "DREAME_FALLBACK_SHORTCUT_NAME",
          "שאיבה בלבד"
        )
      ),
      fallbackShortcutId: String(
        this.value(
          "fallbackShortcutId",
          "DREAME_FALLBACK_SHORTCUT_ID",
          ""
        )
      ),
      waterEmptyCodes: String(
        this.value(
          "waterEmptyCodes",
          "DREAME_WATER_EMPTY_CODES",
          "107,116"
        )
      ),

      githubOwner: String(
        this.value("githubOwner", "GITHUB_OWNER", "")
      ),
      githubRepo: String(
        this.value("githubRepo", "GITHUB_REPO", "")
      ),
      githubWorkflow: String(
        this.value("githubWorkflow", "GITHUB_WORKFLOW", "dreame.yml")
      ),
      githubRef: String(
        this.value("githubRef", "GITHUB_REF", "main")
      ),
      workerPublicUrl: String(
        this.value(
          "workerPublicUrl",
          "WORKER_PUBLIC_URL",
          DEFAULT_PUBLIC_URL
        )
      ),
    };
  }

  primaryMode() {
    return this.effectiveConfig().primaryMode;
  }

  cleanGeniusModeName() {
    return this.effectiveConfig().cleanGeniusMode === "2"
      ? "Deep"
      : "Routine";
  }

  async appendEvent(type, details = {}) {
    try {
      const history =
        (await this.ctx.storage.get("eventHistory")) || [];
      history.unshift({
        at: new Date().toISOString(),
        localTime: this.localNow(),
        type,
        details,
      });
      await this.ctx.storage.put(
        "eventHistory",
        history.slice(0, 120)
      );
    } catch (err) {
      console.log("history write failed:", err?.message || err);
    }
  }

  async saveDecision(result) {
    await this.ctx.storage.put("lastDecision", {
      ...result,
      savedAt: new Date().toISOString(),
    });
    return result;
  }

  async fetch(request) {
    await this.loadSettings();

    const url = new URL(request.url);

    if (url.pathname === "/status") {
      return Response.json(await this.getState(), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (url.pathname === "/api/dashboard" && request.method === "GET") {
      return Response.json(await this.getDashboardData(), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (url.pathname === "/api/settings" && request.method === "PUT") {
      return this.updateSettings(request);
    }

    if (
      url.pathname === "/api/settings/reset" &&
      request.method === "POST"
    ) {
      await this.ctx.storage.delete("runtimeSettings");
      this.runtimeSettings = {};
      this.runtimeSettingsLoaded = true;
      await this.appendEvent("settings_reset", {});
      return Response.json({
        ok: true,
        settings: this.effectiveConfig(),
      });
    }

    if (
      url.pathname === "/api/history/clear" &&
      request.method === "POST"
    ) {
      await this.ctx.storage.delete("eventHistory");
      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/check" && request.method === "POST") {
      const result = await this.checkAndMaybeRun("dashboard_check");
      await this.appendEvent("dashboard_check", {
        action: result.action,
      });
      return Response.json(result);
    }

    if (
      url.pathname === "/api/water-check-now" &&
      request.method === "POST"
    ) {
      const result = await this.checkWaterStatus(true);
      await this.appendEvent("water_check_manual", {
        action: result.action,
      });
      return Response.json(result);
    }

    if (
      url.pathname === "/api/run-now" &&
      request.method === "POST"
    ) {
      return Response.json(await this.forceRunNow());
    }

    if (
      url.pathname === "/api/stop-dock" &&
      request.method === "POST"
    ) {
      return Response.json(await this.forceStopAndDock("dashboard"));
    }

    if (
      url.pathname === "/api/skip-toggle" &&
      request.method === "POST"
    ) {
      return Response.json(await this.toggleSkip("dashboard"));
    }

    const apiPresence = url.pathname.match(
      /^\/api\/presence\/(naor|wife)$/
    );
    if (apiPresence && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }
      return Response.json(
        await this.updatePresence(
          apiPresence[1],
          body?.state,
          "dashboard"
        )
      );
    }

    if (url.pathname === "/check") {
      return Response.json(
        await this.checkAndMaybeRun("manual_check")
      );
    }

    if (url.pathname === "/evening-check") {
      return Response.json(await this.checkEveningReminder());
    }

    if (url.pathname === "/water-check") {
      return Response.json(await this.checkWaterStatus(false));
    }

    if (
      url.pathname === "/trigger-test" &&
      request.method === "POST"
    ) {
      try {
        const result = await this.dispatchGitHub();
        return Response.json({
          action: "github_test_dispatched",
          ...result,
        });
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

    if (
      url.pathname === "/run-event" &&
      request.method === "POST"
    ) {
      return this.handleRunEvent(request);
    }

    if (
      url.pathname === "/water-event" &&
      request.method === "POST"
    ) {
      return this.handleWaterEvent(request);
    }

    if (
      url.pathname === "/skip-today" &&
      request.method === "POST"
    ) {
      return Response.json(await this.toggleSkip("widget"));
    }

    const m = url.pathname.match(/^\/presence\/(naor|wife)$/);
    if (m && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }
      return Response.json(
        await this.updatePresence(m[1], body?.state, "shortcut")
      );
    }

    return new Response("Not found", { status: 404 });
  }

  async handleRunEvent(request) {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const token = request.headers.get("X-Run-Callback-Token");
    const runInfo = await this.ctx.storage.get("runInfo");

    if (
      !token ||
      !runInfo?.callbackToken ||
      token !== runInfo.callbackToken
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    const event = String(body?.event || "");

    if (event === "fallback-used") {
      const updated = {
        ...runInfo,
        fallbackUsed: true,
        fallbackUsedAt: new Date().toISOString(),
      };
      await this.ctx.storage.put("runInfo", updated);
      await this.appendEvent("run_fallback_used", {});
      return Response.json({ ok: true, event });
    }

    if (
      event === "primary-active" ||
      event === "fallback-active"
    ) {
      const updated = {
        ...runInfo,
        actualRun: true,
        actualRunAt:
          runInfo.actualRunAt || new Date().toISOString(),
        ...(event === "fallback-active"
          ? { fallbackUsed: true }
          : {}),
      };
      await this.ctx.storage.put("runInfo", updated);
      await this.appendEvent("run_active", { event });
      return Response.json({ ok: true, event });
    }

    if (event.startsWith("plan-")) {
      const details =
        body?.details && typeof body.details === "object"
          ? body.details
          : {};

      const completed = event === "plan-completed";
      const aborted = event === "plan-aborted";
      const fallback = event === "plan-fallback";

      const updated = {
        ...runInfo,
        active:
          completed || aborted
            ? false
            : runInfo.active,
        fallbackUsed:
          fallback ? true : Boolean(runInfo.fallbackUsed),
        completedAt:
          completed
            ? new Date().toISOString()
            : runInfo.completedAt,
        abortedAt:
          aborted
            ? new Date().toISOString()
            : runInfo.abortedAt,
        planProgress: {
          event,
          details,
          at: new Date().toISOString(),
        },
      };

      await this.ctx.storage.put("runInfo", updated);
      await this.appendEvent(event, details);
      return Response.json({ ok: true, event });
    }

    return new Response("Unknown event", { status: 400 });
  }

  async handleWaterEvent(request) {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const token = request.headers.get("X-Water-Callback-Token");
    const checkInfo =
      await this.ctx.storage.get("waterCheckInfo");

    if (
      !token ||
      !checkInfo?.callbackToken ||
      token !== checkInfo.callbackToken
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    const allowed = new Set(["ok", "missing", "unknown"]);
    const status = allowed.has(String(body?.status))
      ? String(body.status)
      : "unknown";

    const waterInfo = {
      date: this.localNow().date,
      status,
      waterMissing: Boolean(body?.waterMissing),
      waterStatusKnown: Boolean(body?.waterStatusKnown),
      codes: Array.isArray(body?.codes)
        ? body.codes.slice(0, 20)
        : [],
      checkedAt: body?.checkedAt || new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      readError: body?.readError || null,
    };

    await this.ctx.storage.put("waterInfo", waterInfo);
    await this.ctx.storage.put("waterCheckInfo", {
      ...checkInfo,
      callbackReceivedAt: new Date().toISOString(),
      callbackToken: null,
    });
    await this.appendEvent("water_result", {
      status,
      codes: waterInfo.codes,
      readError: waterInfo.readError,
    });

    return Response.json({ ok: true, waterInfo });
  }

  async updatePresence(person, state, source) {
    if (!["home", "away"].includes(state)) {
      return {
        action: "invalid_presence",
        error: "state must be home or away",
      };
    }

    const presenceKey = `presence:${person}`;
    const previousPresence =
      await this.ctx.storage.get(presenceKey);

    await this.ctx.storage.put(presenceKey, {
      state,
      updatedAt: new Date().toISOString(),
      source,
    });

    await this.appendEvent("presence", {
      person,
      state,
      source,
    });

    let returnHome = null;
    if (
      state === "home" &&
      previousPresence?.state !== "home"
    ) {
      returnHome = await this.stopIfActive(person);
    }

    const check =
      await this.checkAndMaybeRun("presence_update");

    return returnHome
      ? { ...check, returnHome }
      : check;
  }

  async toggleSkip(source = "dashboard") {
    const now = this.localNow();
    const existing = await this.ctx.storage.get("skipInfo");
    const skippedToday = existing?.date === now.date;

    if (skippedToday) {
      await this.ctx.storage.delete("skipInfo");

      let notification = { ok: false };
      try {
        const github = await this.dispatchGitHub(
          "skip-day-cancel-notify"
        );
        notification = { ok: true, github };
      } catch (err) {
        notification = {
          ok: false,
          error: err?.message || String(err),
        };
      }

      await this.appendEvent("skip_cancelled", {
        source,
        notificationOk: notification.ok,
      });

      return {
        action: "skip_cancelled",
        skipInfo: null,
        notification,
        localTime: now,
      };
    }

    const skipInfo = {
      date: now.date,
      skippedAt: new Date().toISOString(),
      source,
    };

    await this.ctx.storage.put("skipInfo", skipInfo);

    let notification = { ok: false };
    try {
      const github = await this.dispatchGitHub(
        "skip-day-notify"
      );
      notification = { ok: true, github };
    } catch (err) {
      notification = {
        ok: false,
        error: err?.message || String(err),
      };
    }

    await this.appendEvent("day_skipped", {
      source,
      notificationOk: notification.ok,
    });

    return {
      action: "day_skipped",
      skipInfo,
      notification,
      localTime: now,
    };
  }

  async stopIfActive(returnedBy) {
    const runInfo = await this.ctx.storage.get("runInfo");

    if (!runInfo?.active || !runInfo?.lastRunAt) {
      return {
        action: "no_active_cleaning_run",
        returnedBy,
      };
    }

    if (
      runInfo?.presenceMode === "wife_only" &&
      returnedBy !== "wife"
    ) {
      await this.appendEvent("return_home_ignored", {
        returnedBy,
        presenceMode: runInfo.presenceMode,
      });

      return {
        action: "return_home_ignored_wife_only_day",
        returnedBy,
        presenceMode: runInfo.presenceMode,
      };
    }

    const maxActiveMinutes =
      this.effectiveConfig().activeRunMaxMinutes;

    const lastRunMs = Date.parse(runInfo.lastRunAt);
    const ageMinutes = Number.isFinite(lastRunMs)
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
      github = await this.dispatchGitHub(
        "stop-and-dock",
        returnedBy
      );
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

    await this.appendEvent("return_home_stop", {
      returnedBy,
    });

    return {
      action: "stop_and_dock_dispatched",
      returnedBy,
      github,
    };
  }

  async forceStopAndDock(source = "dashboard") {
    let github;
    try {
      github = await this.dispatchGitHub(
        "stop-and-dock",
        source
      );
    } catch (err) {
      const result = {
        action: "stop_dispatch_failed",
        error: err?.message || String(err),
      };
      await this.appendEvent("dashboard_stop_failed", result);
      return result;
    }

    const runInfo = await this.ctx.storage.get("runInfo");
    if (runInfo) {
      await this.ctx.storage.put("runInfo", {
        ...runInfo,
        active: false,
        stopRequestedAt: new Date().toISOString(),
        stoppedBy: source,
      });
    }

    const result = {
      action: "stop_and_dock_dispatched",
      source,
      github,
    };
    await this.appendEvent("dashboard_stop", {});
    return result;
  }

  async forceRunNow() {
    const now = this.localNow();
    const config = this.effectiveConfig();
    const roomPlan = resolveDayPlan(
      config.roomProfiles,
      config.weeklyPlan,
      now.weekday
    );
    const existing = await this.ctx.storage.get("runInfo");
    const runInfo =
      existing?.date === now.date
        ? existing
        : { date: now.date, count: 0 };

    if (!roomPlan.length) {
      const result = {
        action: "no_plan_today",
        forced: true,
        localTime: now,
      };
      await this.appendEvent("dashboard_run_no_plan", {});
      return result;
    }

    if (config.dryRun) {
      const result = {
        action: "dry_run_would_dispatch",
        forced: true,
        localTime: now,
        primaryMode: config.primaryMode,
      };
      await this.appendEvent("dashboard_run_dry", {});
      return result;
    }

    const callbackToken =
      crypto.randomUUID() + "-" + crypto.randomUUID();
    const callbackUrl = config.workerPublicUrl;

    let github;
    try {
      github = await this.dispatchGitHub(
        "smart-run",
        "",
        { callbackToken, callbackUrl, roomPlan }
      );
    } catch (err) {
      const result = {
        action: "github_dispatch_failed",
        forced: true,
        error: err?.message || String(err),
      };
      await this.appendEvent("dashboard_run_failed", result);
      return result;
    }

    await this.ctx.storage.put("runInfo", {
      date: now.date,
      count: Number(runInfo.count || 0) + 1,
      lastRunAt: new Date().toISOString(),
      active: true,
      actualRun: false,
      fallbackUsed: false,
      callbackToken,
      roomPlan,
      forced: true,
    });

    await this.appendEvent("dashboard_run_now", {
      primaryMode: config.primaryMode,
    });

    return {
      action: "github_workflow_dispatched",
      forced: true,
      localTime: now,
      github,
    };
  }

  async getState() {
    const [
      naor,
      wife,
      runInfo,
      eveningInfo,
      skipInfo,
      waterInfo,
      lastDecision,
    ] = await Promise.all([
      this.ctx.storage.get("presence:naor"),
      this.ctx.storage.get("presence:wife"),
      this.ctx.storage.get("runInfo"),
      this.ctx.storage.get("eveningInfo"),
      this.ctx.storage.get("skipInfo"),
      this.ctx.storage.get("waterInfo"),
      this.ctx.storage.get("lastDecision"),
    ]);

    const config = this.effectiveConfig();
    const now = this.localNow();
    const wifeOnlyDay = config.wifeOnlyDays.includes(now.weekday);
    const todayPlan = resolveDayPlan(
      config.roomProfiles,
      config.weeklyPlan,
      now.weekday
    );


    return {
      naor: naor ?? { state: "unknown" },
      wife: wife ?? { state: "unknown" },
      runInfo: runInfo ?? null,
      eveningInfo: eveningInfo ?? null,
      skipInfo: skipInfo ?? null,
      waterInfo: waterInfo ?? null,
      lastDecision: lastDecision ?? null,
      config: {
        timezone: config.timezone,
        startTime: config.startTime,
        endTime: config.endTime,
        eveningCheckTime: config.eveningCheckTime,
        waterCheckTime: config.waterCheckTime,
        awayDelayMinutes: config.awayDelayMinutes,
        maxRunsPerDay: config.maxRunsPerDay,
        activeRunMaxMinutes: config.activeRunMaxMinutes,
        dryRun: config.dryRun,
        wifeOnlyDays: config.wifeOnlyDays,
        presenceModeToday: wifeOnlyDay ? "wife_only" : "both",
        roomProfiles: config.roomProfiles,
        weeklyPlan: config.weeklyPlan,
        todayPlan,


        primaryMode: config.primaryMode,
        shortcutName:
          config.primaryMode === "cleangenius"
            ? `CleanGenius ${this.cleanGeniusModeName()}`
            : config.shortcutName,
        shortcutIdConfigured: Boolean(config.shortcutId),

        cleanGeniusRooms: config.cleanGeniusRooms,
        cleanGeniusMode: config.cleanGeniusMode,
        cleanGeniusLabel: config.cleanGeniusLabel,

        fallbackShortcutName:
          config.fallbackShortcutName,
        fallbackShortcutIdConfigured:
          Boolean(config.fallbackShortcutId),
        waterEmptyCodes: config.waterEmptyCodes,
      },
      localTime: now,
    };
  }

  async getDashboardData() {
    const [state, history] = await Promise.all([
      this.getState(),
      this.ctx.storage.get("eventHistory"),
    ]);

    const config = this.effectiveConfig();

    return {
      ...state,
      effectiveSettings: config,
      overrides: this.runtimeSettings || {},
      integrations: {
        githubConfigured: Boolean(
          config.githubOwner &&
          config.githubRepo &&
          this.env.GITHUB_DISPATCH_TOKEN
        ),
        githubTokenConfigured:
          Boolean(this.env.GITHUB_DISPATCH_TOKEN),
        webhookTokenConfigured:
          Boolean(this.env.WEBHOOK_TOKEN),
        widgetTokenConfigured:
          Boolean(this.env.WIDGET_TOKEN),
        github: {
          owner: config.githubOwner,
          repo: config.githubRepo,
          workflow: config.githubWorkflow,
          ref: config.githubRef,
        },
        workerPublicUrl: config.workerPublicUrl,
      },
      history: Array.isArray(history)
        ? history.slice(0, 80)
        : [],
    };
  }

  localNow() {
    const timezone = this.effectiveConfig().timezone;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hour12: false,
    }).formatToParts(new Date());

    const x = Object.fromEntries(
      parts.map((p) => [p.type, p.value])
    );

    const weekdayMap = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4,
      Fri: 5, Sat: 6, Sun: 7,
    };

    return {
      date: `${x.year}-${x.month}-${x.day}`,
      time: `${x.hour}:${x.minute}:${x.second}`,
      minuteOfDay:
        Number(x.hour) * 60 + Number(x.minute),
      weekday: weekdayMap[x.weekday] || null,
      weekdayShort: x.weekday || null,
    };
  }

  parseClock(value, fallback) {
    const text = String(value || fallback);
    const m = text.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) throw new Error(`Invalid time: ${text}`);

    const hour = Number(m[1]);
    const minute = Number(m[2]);
    if (
      !Number.isInteger(hour) ||
      !Number.isInteger(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      throw new Error(`Invalid time: ${text}`);
    }

    return hour * 60 + minute;
  }

  validateSettings(input) {
    const source =
      input && typeof input === "object" ? input : {};

    const out = {};

    const time = (key) => {
      if (!(key in source)) return;
      const value = String(source[key] || "").trim();
      this.parseClock(value, "00:00");
      out[key] = value.padStart(5, "0");
    };

    const number = (key, min, max) => {
      if (!(key in source)) return;
      const value = Number(source[key]);
      if (
        !Number.isFinite(value) ||
        value < min ||
        value > max
      ) {
        throw new Error(
          `${key} must be between ${min} and ${max}`
        );
      }
      out[key] = value;
    };

    const string = (key, max = 300) => {
      if (!(key in source)) return;
      const value = String(source[key] ?? "").trim();
      if (value.length > max) {
        throw new Error(`${key} is too long`);
      }
      out[key] = value;
    };

    time("startTime");
    time("endTime");
    time("eveningCheckTime");
    time("waterCheckTime");

    number("awayDelayMinutes", 0, 240);
    number("maxRunsPerDay", 0, 20);
    number("activeRunMaxMinutes", 5, 1440);

    if ("dryRun" in source) {
      out.dryRun = Boolean(source.dryRun);
    }

    if ("wifeOnlyDays" in source) {
      if (!Array.isArray(source.wifeOnlyDays)) {
        throw new Error("wifeOnlyDays must be an array");
      }
      const days = [...new Set(source.wifeOnlyDays.map(Number))];
      if (!days.every((day) => Number.isInteger(day) && day >= 1 && day <= 7)) {
        throw new Error("Invalid wifeOnlyDays");
      }
      out.wifeOnlyDays = days.sort((a, b) => a - b);
    }

    if ("roomProfiles" in source) {
      out.roomProfiles =
        validateRoomProfiles(source.roomProfiles);
    }

    if ("weeklyPlan" in source) {
      const profiles =
        out.roomProfiles ||
        this.effectiveConfig().roomProfiles;
      out.weeklyPlan =
        validateWeeklyPlan(
          source.weeklyPlan,
          profiles
        );
    }


    if ("timezone" in source) {
      const timezone = String(source.timezone || "").trim();
      try {
        new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
        }).format(new Date());
      } catch {
        throw new Error("Invalid timezone");
      }
      out.timezone = timezone;
    }

    if ("primaryMode" in source) {
      const mode = String(source.primaryMode).toLowerCase();
      if (!["cleangenius", "shortcut"].includes(mode)) {
        throw new Error("Invalid primaryMode");
      }
      out.primaryMode = mode;
    }

    if ("cleanGeniusMode" in source) {
      const mode = String(source.cleanGeniusMode);
      if (!["1", "2"].includes(mode)) {
        throw new Error("Invalid cleanGeniusMode");
      }
      out.cleanGeniusMode = mode;
    }

    if ("cleanGeniusRooms" in source) {
      const rooms = String(source.cleanGeniusRooms || "")
        .replace(/\s+/g, "");
      if (
        !rooms ||
        !rooms
          .split(",")
          .every((x) => /^\d+$/.test(x) && Number(x) > 0)
      ) {
        throw new Error("Invalid cleanGeniusRooms");
      }
      out.cleanGeniusRooms = rooms;
    }

    if ("waterEmptyCodes" in source) {
      const codes = String(source.waterEmptyCodes || "")
        .replace(/\s+/g, "");
      if (
        !codes ||
        !codes
          .split(",")
          .every((x) => /^\d+$/.test(x))
      ) {
        throw new Error("Invalid waterEmptyCodes");
      }
      out.waterEmptyCodes = codes;
    }

    string("shortcutName", 100);
    string("shortcutId", 100);
    string("cleanGeniusLabel", 500);
    string("fallbackShortcutName", 100);
    string("fallbackShortcutId", 100);

    string("githubOwner", 100);
    string("githubRepo", 100);
    string("githubWorkflow", 150);
    string("githubRef", 150);

    if ("workerPublicUrl" in source) {
      const url = String(
        source.workerPublicUrl || ""
      ).trim().replace(/\/+$/, "");
      if (!/^https:\/\//i.test(url)) {
        throw new Error(
          "workerPublicUrl must start with https://"
        );
      }
      out.workerPublicUrl = url;
    }

    return out;
  }

  async updateSettings(request) {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    try {
      const patch = this.validateSettings(body);
      const current =
        (await this.ctx.storage.get("runtimeSettings")) ||
        {};
      const updated = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };

      await this.ctx.storage.put(
        "runtimeSettings",
        updated
      );
      this.runtimeSettings = updated;
      this.runtimeSettingsLoaded = true;

      await this.appendEvent("settings_updated", {
        keys: Object.keys(patch),
      });

      return Response.json({
        ok: true,
        overrides: updated,
        settings: this.effectiveConfig(),
      });
    } catch (err) {
      return Response.json(
        {
          ok: false,
          error: err?.message || String(err),
        },
        { status: 400 }
      );
    }
  }

  async dispatchGitHub(
    mode = "smart-run",
    returnedBy = "",
    extra = {}
  ) {
    const config = this.effectiveConfig();

    const owner = config.githubOwner;
    const repo = config.githubRepo;
    const workflow = config.githubWorkflow;
    const ref = config.githubRef;
    const token = this.env.GITHUB_DISPATCH_TOKEN;

    if (!owner || !repo || !token) {
      throw new Error("Missing GitHub configuration.");
    }

    const endpoint =
      `https://api.github.com/repos/${encodeURIComponent(owner)}` +
      `/${encodeURIComponent(repo)}/actions/workflows/` +
      `${encodeURIComponent(workflow)}/dispatches`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent":
          "dreame-x40-cloudflare-worker",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref,
        inputs: {
          mode,
          returned_by: returnedBy,
          callback_url:
            String(extra.callbackUrl || ""),
          callback_token:
            String(extra.callbackToken || ""),
          ran_today:
            String(Boolean(extra.ranToday)),
          fallback_used:
            String(Boolean(extra.fallbackUsed)),
          primary_mode: config.primaryMode,

          shortcut_name: config.shortcutName,
          shortcut_id: config.shortcutId,

          clean_genius_rooms:
            config.cleanGeniusRooms,
          clean_genius_mode:
            config.cleanGeniusMode,
          clean_genius_label:
            config.cleanGeniusLabel,

          fallback_shortcut_name:
            config.fallbackShortcutName,
          fallback_shortcut_id:
            config.fallbackShortcutId,
          water_empty_codes:
            config.waterEmptyCodes,
          room_plan_json:
            JSON.stringify(extra.roomPlan || []),
        },
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `GitHub dispatch failed: ${response.status} ${text}`
      );
    }

    return {
      ok: true,
      status: response.status,
      mode,
      primaryMode: config.primaryMode,
      cleanGeniusRooms:
        config.cleanGeniusRooms,
      cleanGeniusMode:
        config.cleanGeniusMode,
      fallbackShortcutConfigured:
        Boolean(config.fallbackShortcutId),
    };
  }

  async checkWaterStatus(force = false) {
    const now = this.localNow();
    const config = this.effectiveConfig();
    const target = this.parseClock(
      config.waterCheckTime,
      "22:00"
    );

    const delta = now.minuteOfDay - target;
    if (!force && (delta < 0 || delta >= 10)) {
      return {
        action: "outside_water_check_window",
        localTime: now,
      };
    }

    const previous =
      await this.ctx.storage.get("waterCheckInfo");

    if (
      !force &&
      previous?.date === now.date &&
      previous?.dispatched
    ) {
      return {
        action: "water_check_already_dispatched",
        localTime: now,
      };
    }

    const callbackToken =
      crypto.randomUUID() + "-" + crypto.randomUUID();

    let github;
    try {
      github = await this.dispatchGitHub(
        "water-check",
        "",
        {
          callbackToken,
          callbackUrl: config.workerPublicUrl,
        }
      );
    } catch (err) {
      return {
        action: "water_check_dispatch_failed",
        error: err?.message || String(err),
        localTime: now,
      };
    }

    const scheduledAlreadyRan =
      previous?.date === now.date &&
      previous?.dispatched === true;

    await this.ctx.storage.put("waterCheckInfo", {
      date: now.date,
      dispatched: force
        ? scheduledAlreadyRan
        : true,
      dispatchedAt: force
        ? previous?.dispatchedAt || null
        : new Date().toISOString(),
      manualDispatchedAt: force
        ? new Date().toISOString()
        : previous?.manualDispatchedAt || null,
      callbackToken,
    });

    return {
      action: force
        ? "water_check_manual_dispatched"
        : "water_check_dispatched",
      localTime: now,
      github,
    };
  }

  async checkEveningReminder() {
    const now = this.localNow();
    const config = this.effectiveConfig();
    const target = this.parseClock(
      config.eveningCheckTime,
      "22:00"
    );

    const delta = now.minuteOfDay - target;
    if (delta < 0 || delta >= 10) {
      return {
        action: "outside_evening_window",
        localTime: now,
      };
    }

    const eveningInfo =
      await this.ctx.storage.get("eveningInfo");

    if (
      eveningInfo?.date === now.date &&
      eveningInfo?.sent
    ) {
      return {
        action: "evening_already_dispatched",
        localTime: now,
      };
    }

    const runInfo = await this.ctx.storage.get("runInfo");
    const todayRun =
      runInfo?.date === now.date ? runInfo : null;

    const ranToday = Boolean(
      todayRun &&
      (
        (todayRun.count || 0) > 0 ||
        todayRun.actualRun
      )
    );

    const fallbackUsed =
      Boolean(todayRun?.fallbackUsed);

    let github;
    try {
      github = await this.dispatchGitHub(
        "evening-check",
        "",
        { ranToday, fallbackUsed }
      );
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

    await this.appendEvent("evening_check", {
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
    const config = this.effectiveConfig();
    const roomPlan = resolveDayPlan(
      config.roomProfiles,
      config.weeklyPlan,
      now.weekday
    );

    const skippedToday = state.skipInfo?.date === now.date;
    const wifeOnlyDay = config.wifeOnlyDays.includes(now.weekday);
    const presenceMode = wifeOnlyDay ? "wife_only" : "both";

    const bothAway =
      state.naor?.state === "away" &&
      state.wife?.state === "away";

    const awayDelayMs = config.awayDelayMinutes * 60 * 1000;
    const nowMs = Date.now();

    const naorAwayLongEnough =
      state.naor?.state === "away" &&
      Number.isFinite(Date.parse(state.naor.updatedAt)) &&
      nowMs - Date.parse(state.naor.updatedAt) >= awayDelayMs;

    const wifeAwayLongEnough =
      state.wife?.state === "away" &&
      Number.isFinite(Date.parse(state.wife.updatedAt)) &&
      nowMs - Date.parse(state.wife.updatedAt) >= awayDelayMs;

    const presenceSatisfied = wifeOnlyDay
      ? wifeAwayLongEnough
      : bothAway && naorAwayLongEnough && wifeAwayLongEnough;

    const requiredAwayLongEnough = wifeOnlyDay
      ? wifeAwayLongEnough
      : naorAwayLongEnough && wifeAwayLongEnough;

    const start = this.parseClock(config.startTime, "10:00");
    const end = this.parseClock(config.endTime, "15:00");
    const inWindow = now.minuteOfDay >= start && now.minuteOfDay < end;
    const maxRuns = config.maxRunsPerDay;

    const runInfo = state.runInfo?.date === now.date
      ? state.runInfo
      : { date: now.date, count: 0 };

    const result = {
      reason,
      bothAway,
      wifeOnlyDay,
      presenceMode,
      presenceSatisfied,
      requiredPeople: wifeOnlyDay ? ["wife"] : ["naor", "wife"],
      awayLongEnough: requiredAwayLongEnough,
      naorAwayLongEnough,
      wifeAwayLongEnough,
      inWindow,
      runsToday: Number(runInfo.count || 0),
      maxRunsPerDay: maxRuns,
      skippedToday,
      localTime: now,
      action: "none",
      primaryMode: config.primaryMode,
      roomPlan,
      planRooms: roomPlan.map((room) => room.id),
    };

    if (skippedToday) {
      return this.saveDecision({
        ...result,
        action: "skipped_today",
        skipInfo: state.skipInfo,
      });
    }

    if (
      roomPlan.length === 0 ||
      !presenceSatisfied ||
      !inWindow ||
      Number(runInfo.count || 0) >= maxRuns
    ) {
      return this.saveDecision(result);
    }

    if (config.dryRun) {
      return this.saveDecision({
        ...result,
        action: "dry_run_would_dispatch",
        cleanGeniusRooms: config.cleanGeniusRooms,
        cleanGeniusMode: config.cleanGeniusMode,
      });
    }

    const callbackToken = crypto.randomUUID() + "-" + crypto.randomUUID();

    let github;
    try {
      github = await this.dispatchGitHub("smart-run", "", {
        callbackToken,
        callbackUrl: config.workerPublicUrl,
        roomPlan,
      });
    } catch (err) {
      return this.saveDecision({
        ...result,
        action: "github_dispatch_failed",
        error: err?.message || String(err),
      });
    }

    await this.ctx.storage.put("runInfo", {
      date: now.date,
      count: Number(runInfo.count || 0) + 1,
      lastRunAt: new Date().toISOString(),
      active: true,
      actualRun: false,
      fallbackUsed: false,
      callbackToken,
      roomPlan,
      presenceMode,
      wifeOnlyDay,
    });

    await this.appendEvent("smart_run_dispatched", {
      reason,
      primaryMode: config.primaryMode,
      rooms: config.cleanGeniusRooms,
      presenceMode,
      wifeOnlyDay,
    });

    return this.saveDecision({
      ...result,
      action: "github_workflow_dispatched",
      github,
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (
      request.method === "GET" &&
      (url.pathname === "/" ||
       url.pathname === "/dashboard")
    ) {
      return new Response(dashboardHtml, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
        },
      });
    }

    const webhookToken =
      request.headers.get("X-Webhook-Token");
    const widgetToken =
      request.headers.get("X-Widget-Token");

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
      Boolean(
        request.headers.get(
          "X-Run-Callback-Token"
        )
      );

    const waterCallbackCandidate =
      request.method === "POST" &&
      url.pathname === "/water-event" &&
      Boolean(
        request.headers.get(
          "X-Water-Callback-Token"
        )
      );

    if (
      !webhookAuthorized &&
      !widgetAuthorized &&
      !runCallbackCandidate &&
      !waterCallbackCandidate
    ) {
      return new Response("Unauthorized", {
        status: 401,
      });
    }

    const id = env.PRESENCE.idFromName("home");
    return env.PRESENCE.get(id).fetch(request);
  },

  async scheduled(_controller, env, _ctx) {
    const id = env.PRESENCE.idFromName("home");
    const stub = env.PRESENCE.get(id);

    await stub.fetch("https://internal/check");
    await stub.fetch(
      "https://internal/evening-check"
    );
    await stub.fetch(
      "https://internal/water-check"
    );
  },
};

