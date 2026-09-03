import { DreameClient } from "node-dreame";

const email = process.env.DREAME_EMAIL;
const password = process.env.DREAME_PASSWORD;
const region = (process.env.DREAME_REGION || "sg").trim();
const wantedDid = (process.env.DREAME_DEVICE_DID || "").trim();

const callbackUrl = (process.env.DREAME_CALLBACK_URL || "").trim();
const callbackToken = (process.env.DREAME_CALLBACK_TOKEN || "").trim();

const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();

const fallbackName =
  (process.env.DREAME_FALLBACK_SHORTCUT_NAME || "שאיבה בלבד").trim();
const fallbackId =
  (process.env.DREAME_FALLBACK_SHORTCUT_ID || "").trim();

const waterCodes = new Set(
  String(process.env.DREAME_WATER_EMPTY_CODES || "107,116")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter(Number.isFinite)
);

const phaseTimeoutMinutes = Math.max(
  10,
  Math.min(120, Number(process.env.DREAME_PLAN_PHASE_TIMEOUT_MINUTES || "75"))
);

let roomPlan;
try {
  roomPlan = JSON.parse(process.env.DREAME_ROOM_PLAN_JSON || "[]");
} catch {
  throw new Error("DREAME_ROOM_PLAN_JSON is invalid JSON");
}

if (!email || !password) throw new Error("Missing Dreame credentials");
if (!Array.isArray(roomPlan) || !roomPlan.length) throw new Error("Room plan is empty");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function israelTime() {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

async function sendTelegram(text) {
  if (!botToken || !chatId) return;
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    }
  );
  if (!response.ok) {
    console.log(
      `Telegram HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`
    );
  }
}

async function sendRunEvent(event, details = {}) {
  if (!callbackUrl || !callbackToken) return;
  try {
    const response = await fetch(
      callbackUrl.replace(/\/$/, "") + "/run-event",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Run-Callback-Token": callbackToken,
        },
        body: JSON.stringify({ event, details }),
      }
    );
    if (!response.ok) {
      console.log(
        `Run callback ${event} HTTP ${response.status}: ` +
        `${(await response.text()).slice(0, 200)}`
      );
    }
  } catch (err) {
    console.log(`Run callback ${event} failed: ${err?.message || err}`);
  }
}

function samePhase(a, b) {
  if (!a || !b || a.mode !== b.mode) return false;
  if (a.mode === "cleangenius") {
    return String(a.geniusMode) === String(b.geniusMode);
  }
  return (
    Number(a.suction) === Number(b.suction) &&
    Number(a.repeats) === Number(b.repeats)
  );
}

function buildPhases(plan) {
  const phases = [];
  for (const room of plan) {
    const normalized = {
      id: Number(room.id),
      name: String(room.name || `חדר ${room.id}`),
      mode: String(room.mode).toLowerCase() === "vacuum" ? "vacuum" : "cleangenius",
      geniusMode: String(room.geniusMode) === "2" ? "2" : "1",
      suction: Math.max(0, Math.min(3, Number(room.suction ?? 2))),
      repeats: Math.max(1, Math.min(3, Number(room.repeats ?? 1))),
    };
    if (!Number.isInteger(normalized.id) || normalized.id <= 0) continue;

    const last = phases.at(-1);
    if (last && samePhase(last, normalized)) {
      last.rooms.push(normalized);
    } else {
      phases.push({
        mode: normalized.mode,
        geniusMode: normalized.geniusMode,
        suction: normalized.suction,
        repeats: normalized.repeats,
        rooms: [normalized],
      });
    }
  }
  return phases;
}

function phaseLabel(phase) {
  const names = phase.rooms.map((r) => r.name).join(", ");
  if (phase.mode === "cleangenius") {
    return `CleanGenius ${phase.geniusMode === "2" ? "Deep" : "Routine"}: ${names}`;
  }
  const suctionNames = ["Quiet", "Standard", "Intense", "Max"];
  return `שאיבה בלבד ${suctionNames[phase.suction] || phase.suction} ×${phase.repeats}: ${names}`;
}

function isNoAck(err) {
  const code = err?.body?.code;
  const text = `${err?.name || ""} ${err?.message || ""}`;
  return (
    code === 80001 ||
    text.includes("80001") ||
    text.includes("Offline") ||
    text.includes("device offline")
  );
}

const client = new DreameClient({ email, password, region });
await client.login();

const devices = await client.getDevices({ timeoutMs: 25000 });
if (!devices.length) throw new Error("No Dreame devices found");

const device =
  (wantedDid && devices.find((d) => String(d.did) === wantedDid)) ||
  devices.find((d) => /r2416|x40/i.test(`${d.model} ${d.name}`)) ||
  devices[0];

const vacuum = client.getVacuum(device);
const phases = buildPhases(roomPlan);
if (!phases.length) throw new Error("No valid phases in room plan");

console.log(`✅ Device: ${device.name} | ${device.model}`);
phases.forEach((p, i) => console.log(`${i + 1}. ${phaseLabel(p)}`));

await vacuum.watch();
try {
  await vacuum.refresh();
} catch (err) {
  console.log(`⚠️ Initial refresh unavailable: ${err?.message || err}`);
}

async function writeProperty(siid, piid, value, label) {
  try {
    const result = await client.setProperties(
      String(device.did),
      [{ siid, piid, value }],
      { timeoutMs: 15000 }
    );
    console.log(`${label}: ${JSON.stringify(result)}`);
  } catch (err) {
    if (isNoAck(err)) {
      console.log(`⚠️ ${label} no HTTP ACK; continuing.`);
      return;
    }
    throw err;
  }
}

async function setSmartHost(mode) {
  await writeProperty(
    4,
    50,
    JSON.stringify({ k: "SmartHost", v: Number(mode) }),
    `SmartHost=${mode}`
  );
}

async function setCleanMode(mode) {
  // Dreame writable clean-mode setting:
  // siid 2 / piid 6, 0=Sweeping, 2=SweepAndMop.
  await writeProperty(2, 6, Number(mode), `CleanMode=${mode}`);
}

async function sendShortcut(name, id) {
  if (!id) throw new Error(`Shortcut ID missing for "${name}"`);
  try {
    const result = await client.callAction(
      String(device.did),
      {
        siid: 4,
        aiid: 1,
        in: [
          { piid: 1, value: 25 },
          { piid: 10, value: String(id) },
        ],
      },
      { timeoutMs: 20000 }
    );
    console.log(`Shortcut "${name}": ${JSON.stringify(result)}`);
  } catch (err) {
    if (isNoAck(err)) {
      console.log(`⚠️ No HTTP ACK for "${name}"; command may still execute.`);
      return;
    }
    throw err;
  }
}

async function fallbackForWater(phaseIndex) {
  await sendRunEvent("fallback-used", {
    reason: "clean-water",
    phaseIndex,
  });

  await sendTelegram(
    [
      "💧 חסרים מים במהלך תוכנית החדרים",
      `➡️ עובר ל־fallback: ${fallbackName}`,
      `🕐 שעה: ${israelTime()}`,
    ].join("\n")
  );

  try {
    await vacuum.cancelCurrentJob();
  } catch (err) {
    console.log(`Cancel before fallback: ${err?.message || err}`);
  }

  await sleep(1500);
  await setSmartHost(0);
  await setCleanMode(0);
  await sendShortcut(fallbackName, fallbackId);

  await sendRunEvent("fallback-active", {
    reason: "clean-water",
    phaseIndex,
  });
  await sendRunEvent("plan-fallback", {
    phaseIndex,
    fallbackName,
  });

  return { kind: "fallback" };
}

function waitForPhaseResult(phase, phaseIndex) {
  const armedAt = Date.now();
  const timeoutMs = phaseTimeoutMinutes * 60 * 1000;

  return new Promise((resolve) => {
    let settled = false;
    let startedSeen = false;

    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      vacuum.off("taskLifecycle", onLifecycle);
      vacuum.off("change", onChange);
      resolve(result);
    };

    const onLifecycle = (event) => {
      console.log(
        `taskLifecycle phase=${event?.phase} reason=${event?.reason || ""}`
      );

      if (event?.phase === "started") {
        startedSeen = true;
        return;
      }

      if (
        event?.phase === "completed" &&
        (startedSeen || Date.now() - armedAt > 10000)
      ) {
        done({ kind: "completed", record: event.record || null });
        return;
      }

      if (
        event?.phase === "aborted" &&
        (startedSeen || Date.now() - armedAt > 5000)
      ) {
        done({
          kind: "aborted",
          reason: event.reason || "unknown",
          faults: event.faults || [],
        });
      }
    };

    const onChange = (state) => {
      const errorCode = Number(state?.errorCode);
      if (
        phase.mode === "cleangenius" &&
        Number.isFinite(errorCode) &&
        waterCodes.has(errorCode)
      ) {
        done({ kind: "water", errorCode });
      }
    };

    const timer = setTimeout(() => {
      done({
        kind: "timeout",
        phaseIndex,
        timeoutMinutes: phaseTimeoutMinutes,
      });
    }, timeoutMs);

    vacuum.on("taskLifecycle", onLifecycle);
    vacuum.on("change", onChange);
  });
}

async function runPhase(phase, phaseIndex) {
  const ids = phase.rooms.map((r) => r.id);
  const label = phaseLabel(phase);

  console.log(`▶️ Phase ${phaseIndex + 1}/${phases.length}: ${label}`);

  await sendRunEvent("plan-phase-started", {
    phaseIndex,
    phaseNumber: phaseIndex + 1,
    phaseCount: phases.length,
    label,
    roomIds: ids,
    mode: phase.mode,
  });

  if (
    phase.mode === "cleangenius" &&
    waterCodes.has(Number(vacuum.state?.errorCode))
  ) {
    return fallbackForWater(phaseIndex);
  }

  const waitPromise = waitForPhaseResult(phase, phaseIndex);

  if (phase.mode === "cleangenius") {
    await setCleanMode(2);
    await setSmartHost(Number(phase.geniusMode));
    await sleep(800);
    const result = await vacuum.cleanSegments(ids);
    console.log(`CleanGenius cleanSegments: ${JSON.stringify(result)}`);
  } else {
    await setSmartHost(0);
    await setCleanMode(0);
    await sleep(800);
    const result = await vacuum.cleanSegments(ids, {
      repeats: phase.repeats,
      fan: phase.suction,
      water: 0,
    });
    console.log(`Vacuum-only cleanSegments: ${JSON.stringify(result)}`);
  }

  await sendRunEvent("primary-active", {
    phaseIndex,
    mode: phase.mode,
  });

  const outcome = await waitPromise;

  if (outcome.kind === "water") {
    return fallbackForWater(phaseIndex);
  }

  if (outcome.kind !== "completed") {
    await sendRunEvent("plan-aborted", {
      phaseIndex,
      label,
      outcome,
    });

    await sendTelegram(
      [
        "⚠️ תוכנית החדרים הופסקה",
        `שלב: ${label}`,
        `סיבה: ${outcome.reason || outcome.kind}`,
        `🕐 שעה: ${israelTime()}`,
      ].join("\n")
    );
    return outcome;
  }

  await sendRunEvent("plan-phase-completed", {
    phaseIndex,
    phaseNumber: phaseIndex + 1,
    phaseCount: phases.length,
    label,
    roomIds: ids,
  });

  return outcome;
}

await sendRunEvent("plan-started", {
  phaseCount: phases.length,
  rooms: roomPlan,
});

await sendTelegram(
  [
    "🤖 תוכנית ניקיון לפי חדרים התחילה",
    ...phases.map((p, i) => `${i + 1}. ${phaseLabel(p)}`),
    `🕐 שעה: ${israelTime()}`,
  ].join("\n")
);

let finalOutcome = { kind: "completed" };

for (let i = 0; i < phases.length; i += 1) {
  const outcome = await runPhase(phases[i], i);

  if (outcome.kind === "fallback") {
    finalOutcome = outcome;
    break;
  }

  if (outcome.kind !== "completed") {
    finalOutcome = outcome;
    break;
  }
}

if (finalOutcome.kind === "completed") {
  await setSmartHost(0).catch(() => {});

  await sendRunEvent("plan-completed", {
    phaseCount: phases.length,
    rooms: roomPlan,
  });

  await sendTelegram(
    [
      "✅ תוכנית ניקיון החדרים הסתיימה",
      `חדרים: ${roomPlan.map((r) => r.name).join(", ")}`,
      `🕐 שעה: ${israelTime()}`,
    ].join("\n")
  );
}

await vacuum.unwatch().catch(() => {});

if (
  finalOutcome.kind !== "completed" &&
  finalOutcome.kind !== "fallback"
) {
  process.exitCode = 1;
}
