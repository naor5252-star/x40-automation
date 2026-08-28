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
      return Response.json(await this.getState());
    }

    if (path === "/trigger-test" && request.method === "POST") {
      let body = {};
      try { body = await request.json(); } catch {}
      const shortcutName = body.shortcut_name || this.env.DREAME_SHORTCUT_NAME || "ניקוי עמוק";
      const result = await this.dispatchGitHub(shortcutName, "run");
      return Response.json({
        action: "github_test_dispatched",
        shortcutName,
        github: result,
      });
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

    const x = Object.fromEntries(parts.map((p) => [p.type, p.value]));

    return {
      date: `${x.year}-${x.month}-${x.day}`,
      time: `${x.hour}:${x.minute}:${x.second}`,
      hour: Number(x.hour),
      minute: Number(x.minute),
    };
  }

  async dispatchGitHub(shortcutName, mode = "run") {
    const owner = this.env.GITHUB_OWNER;
    const repo = this.env.GITHUB_REPO;
    const workflow = this.env.GITHUB_WORKFLOW || "dreame.yml";
    const ref = this.env.GITHUB_REF || "main";
    const token = this.env.GITHUB_DISPATCH_TOKEN;

    if (!owner || !repo || !token) {
      throw new Error("Missing GITHUB_OWNER, GITHUB_REPO, or GITHUB_DISPATCH_TOKEN");
    }

    const endpoint =
      `https://api.github.com/repos/${encodeURIComponent(owner)}` +
      `/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "dreame-x40-cloudflare-worker",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref,
        inputs: {
          mode,
          shortcut_name: shortcutName,
        },
      }),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`GitHub workflow dispatch failed: ${response.status} ${text}`);
    }

    return {
      ok: true,
      status: response.status,
      workflow,
      ref,
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

    if (this.env.DRY_RUN !== "false") {
      return {
        ...result,
        action: "dry_run_would_dispatch_github",
        shortcutName: this.env.DREAME_SHORTCUT_NAME || "ניקוי עמוק",
        state,
      };
    }

    const shortcutName = this.env.DREAME_SHORTCUT_NAME || "ניקוי עמוק";
    const github = await this.dispatchGitHub(shortcutName, "run");

    // Mark the day only after GitHub accepted the dispatch.
    await this.ctx.storage.put("lastRunDate", now.date);

    return {
      ...result,
      action: "github_workflow_dispatched",
      shortcutName,
      github,
      state,
    };
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
