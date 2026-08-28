export class PresenceState {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/check") {
      return Response.json(await this.checkAndMaybeRun("scheduled_check"));
    }

    if (path === "/status") {
      const state = await this.getState();
      return Response.json(state);
    }

    const m = path.match(/^\/presence\/(naor|wife)$/);
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

      await this.ctx.storage.put(`presence:${m[1]}`, {
        state: body.state,
        updatedAt: new Date().toISOString(),
      });

      const result = await this.checkAndMaybeRun("presence_update");
      return Response.json(result);
    }

    return new Response("Not found", { status: 404 });
  }

  async getState() {
    const [naor, wife, lastRunDate] = await Promise.all([
      this.ctx.storage.get("presence:naor"),
      this.ctx.storage.get("presence:wife"),
      this.ctx.storage.get("lastRunDate"),
    ]);

    return {
      naor: naor ?? { state: "unknown" },
      wife: wife ?? { state: "unknown" },
      lastRunDate: lastRunDate ?? null,
      israelTime: this.israelNow(),
    };
  }

  israelNow() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(new Date());

    const x = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return {
      date: `${x.year}-${x.month}-${x.day}`,
      time: `${x.hour}:${x.minute}:${x.second}`,
      hour: Number(x.hour),
      minute: Number(x.minute),
    };
  }

  async checkAndMaybeRun(reason) {
    const state = await this.getState();
    const now = this.israelNow();

    const bothAway =
      state.naor?.state === "away" &&
      state.wife?.state === "away";

    const inWindow =
      (now.hour > 10 || (now.hour === 10 && now.minute >= 0)) &&
      now.hour < 15;

    const alreadyRanToday = state.lastRunDate === now.date;

    const result = {
      reason,
      bothAway,
      inWindow,
      alreadyRanToday,
      israelTime: now,
      action: "none",
    };

    if (!bothAway || !inWindow || alreadyRanToday) {
      return { ...result, state };
    }

    // Stage 1 = dry run. Stage 2 will replace this with a call to the
    // Dreame cloud adapter / Cloudflare Container.
    if (this.env.DRY_RUN !== "false") {
      await this.ctx.storage.put("lastRunDate", now.date);
      return { ...result, action: "dry_run_would_start_dreame", state };
    }

    if (!this.env.DREAME_TRIGGER_URL) {
      return { ...result, action: "blocked_missing_DREAME_TRIGGER_URL", state };
    }

    const response = await fetch(this.env.DREAME_TRIGGER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.env.DREAME_TRIGGER_TOKEN ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command: "start_clean" }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Dreame trigger failed: ${response.status} ${text}`);
    }

    await this.ctx.storage.put("lastRunDate", now.date);
    return { ...result, action: "dreame_started", state };
  }
}

export default {
  async fetch(request, env) {
    const token = request.headers.get("X-Webhook-Token");
    if (!env.WEBHOOK_TOKEN || token !== env.WEBHOOK_TOKEN) {
      return new Response("Unauthorized", { status: 401 });
    }

    const id = env.PRESENCE.idFromName("home");
    const stub = env.PRESENCE.get(id);
    return stub.fetch(request);
  },

  async scheduled(_controller, env, _ctx) {
    const id = env.PRESENCE.idFromName("home");
    const stub = env.PRESENCE.get(id);
    await stub.fetch("https://internal/check");
  },
};