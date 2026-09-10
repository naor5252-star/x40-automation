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

// ONE ROOM = ONE PHASE / ONE ROBOT ACTION.
// Do not merge adjacent rooms even when they have identical settings.
// This keeps each room fully isolated: its own mode setup, its own
// segment command, its own lifecycle completion, then the next room.
function buildPhases(plan) {
  const phases = [];

  for (const room of plan) {
    const normalized = {
      id: Number(room.id),
      name: String(room.name || `חדר ${room.id}`),
      mode:
        String(room.mode).toLowerCase() === "vacuum"
          ? "vacuum"
          : "cleangenius",
      geniusMode:
        String(room.geniusMode) === "2" ? "2" : "1",
      suction: Math.max(
        0,
        Math.min(3, Number(room.suction ?? 2))
      ),
      repeats: Math.max(
        1,
        Math.min(3, Number(room.repeats ?? 1))
      ),
    };

    if (
      !Number.isInteger(normalized.id) ||
      normalized.id <= 0
    ) {
      continue;
    }

    phases.push({
      mode: normalized.mode,
      geniusMode: normalized.geniusMode,
      suction: normalized.suction,
      repeats: normalized.repeats,
      rooms: [normalized],
    });
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
const rawSub = await client.subscribe(device);
console.log("✅ SmartHost MQTT verifier connected");
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


function parseSmartHostFromFeatureValue(rawValue) {
  try {
    const parsed =
      typeof rawValue === "string"
        ? JSON.parse(rawValue)
        : rawValue;

    if (Array.isArray(parsed)) {
      const item = parsed.find(
        (x) => String(x?.k) === "SmartHost"
      );
      return item ? Number(item.v) : null;
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      String(parsed.k) === "SmartHost"
    ) {
      return Number(parsed.v);
    }
  } catch (err) {
    console.log(
      `⚠️ Could not parse SmartHost MQTT echo: ${err?.message || err}`
    );
  }

  return null;
}

function waitForSmartHostEcho(subscription, timeoutMs = 10000) {
  return new Promise((resolve) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      subscription.off("properties", onProperties);
    };

    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const onProperties = (changes) => {
      for (const change of changes || []) {
        if (
          Number(change?.siid) !== 4 ||
          Number(change?.piid) !== 50
        ) {
          continue;
        }

        const value =
          parseSmartHostFromFeatureValue(change.value);

        if (value !== null && Number.isFinite(value)) {
          finish(value);
          return;
        }
      }
    };

    const timer = setTimeout(
      () => finish(null),
      timeoutMs
    );

    subscription.on("properties", onProperties);
  });
}

async function writeSmartHostDirect(
  desiredMode,
  subscription,
  attempts = 2
) {
  const desired = Number(desiredMode);

  if (![0, 1, 2].includes(desired)) {
    throw new Error(
      `Invalid SmartHost mode: ${desiredMode}`
    );
  }

  const modeName =
    desired === 2
      ? "Deep"
      : desired === 1
        ? "Routine"
        : "Off";

  let explicitWrongEcho = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    console.log(
      `SmartHost request ${attempt}/${attempts}: ` +
      `${desired} (${modeName})`
    );

    const echoPromise =
      waitForSmartHostEcho(subscription, 10000);

    let acked = false;

    try {
      const result = await client.setProperties(
        String(device.did),
        [{
          siid: 4,
          piid: 50,
          value: JSON.stringify({
            k: "SmartHost",
            v: desired,
          }),
        }],
        { timeoutMs: 15000 }
      );

      const first =
        Array.isArray(result) ? result[0] : null;

      acked =
        !first ||
        first.code === undefined ||
        Number(first.code) === 0;

      console.log(
        `SmartHost HTTP result: ${JSON.stringify(result)}`
      );
    } catch (err) {
      if (isNoAck(err)) {
        console.log(
          "⚠️ SmartHost HTTP ACK unavailable; " +
          "waiting for MQTT echo."
        );
      } else {
        throw err;
      }
    }

    const echoed = await echoPromise;

    if (echoed === desired) {
      console.log(
        `✅ SmartHost MQTT verified=${echoed} (${modeName})`
      );
      return {
        requested: desired,
        verified: true,
        via: "mqtt",
      };
    }

    if (echoed !== null) {
      explicitWrongEcho = echoed;
      console.log(
        `⚠️ SmartHost MQTT echo=${echoed}, ` +
        `expected=${desired}`
      );
    } else if (acked) {
      console.log(
        `✅ SmartHost write ACKed as ${desired} (${modeName}); ` +
        "no MQTT echo was required."
      );
      return {
        requested: desired,
        verified: true,
        via: "http-ack",
      };
    } else {
      console.log(
        "⚠️ No SmartHost MQTT echo and no HTTP ACK."
      );
    }

    if (attempt < attempts) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  if (explicitWrongEcho !== null) {
    throw new Error(
      `SmartHost stayed at ${explicitWrongEcho}; ` +
      `requested ${desired}`
    );
  }

  console.log(
    `⚠️ SmartHost ${desired} (${modeName}) sent but unverified; ` +
    "continuing because X40 cloud ACK reads are unreliable."
  );

  return {
    requested: desired,
    verified: false,
    via: "unverified",
  };
}

async function setSmartHost(mode) {
  return writeSmartHostDirect(mode, rawSub, 2);
}

async function setCleanMode(mode) {
  // Dreame writable clean-mode setting:
  // siid 2 / piid 6, 0=Sweeping, 2=SweepAndMop.
  await writeProperty(2, 6, Number(mode), `CleanMode=${mode}`);
}

async function setCleanGeniusSubMode(mode = 2) {
  // siid 28 / piid 5: 2=Vac+Mop, 3=MopAfterVac
  const value = Number(mode);
  if (![2, 3].includes(value)) {
    throw new Error(`Invalid CleanGenius sub-mode: ${mode}`);
  }
  await writeProperty(
    28, 5, value,
    `CleanGeniusSubMode=${value} (${value === 2 ? "Vac+Mop" : "MopAfterVac"})`
  );
}

async function setCustomizedCleaning(enabled) {
  // Dreame CUSTOMIZED_CLEANING: siid 4 / piid 26.
  // When enabled, the robot uses its saved per-room settings and can
  // ignore the mode/fan/water values sent by our room-plan runner.
  // Our WebUI is the source of truth, so disable that competing layer.
  const value = enabled ? 1 : 0;
  await writeProperty(
    4,
    26,
    value,
    `CustomizedCleaning=${value} (${enabled ? "On" : "Off"})`
  );
}


function observedSettingValue(siid, piid, rawValue) {
  if (Number(siid) === 4 && Number(piid) === 50) {
    return parseSmartHostFromFeatureValue(rawValue);
  }

  // X40 writes clean mode at 2/6, but mirrors actual mode at
  // 4/23 with capability bits. Low 2 bits are CleaningMode.
  if (Number(siid) === 4 && Number(piid) === 23) {
    const packed = Number(rawValue);
    return Number.isFinite(packed) ? (packed & 0x3) : null;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

function waitForSettingEcho(siid, piid, timeoutMs = 10000) {
  return new Promise((resolve) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      rawSub.off("properties", onProperties);
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const onProperties = (changes) => {
      for (const change of changes || []) {
        if (
          Number(change?.siid) !== Number(siid) ||
          Number(change?.piid) !== Number(piid)
        ) {
          continue;
        }

        const value = observedSettingValue(
          siid,
          piid,
          change.value
        );

        if (value !== null) {
          finish({ seen: true, value, via: "mqtt" });
          return;
        }
      }
    };

    const timer = setTimeout(
      () => finish({
        seen: false,
        value: null,
        via: "mqtt-timeout",
      }),
      timeoutMs
    );

    rawSub.on("properties", onProperties);
  });
}

async function readSettingBack(siid, piid) {
  try {
    const result = await client.getProperties(
      String(device.did),
      [{ siid, piid }],
      { timeoutMs: 10000 }
    );

    const item = Array.isArray(result)
      ? result.find(
          (x) =>
            Number(x?.siid) === Number(siid) &&
            Number(x?.piid) === Number(piid) &&
            (x?.code === undefined || Number(x.code) === 0)
        )
      : null;

    if (!item || item.value === undefined) {
      return {
        seen: false,
        value: null,
        via: "readback-empty",
      };
    }

    return {
      seen: true,
      value: observedSettingValue(siid, piid, item.value),
      via: "readback",
    };
  } catch (err) {
    console.log(
      `Setting readback ${siid}/${piid} unavailable: ` +
      `${err?.message || err}`
    );
    return {
      seen: false,
      value: null,
      via: "readback-unavailable",
    };
  }
}

async function setAndVerifyRobotSetting({
  siid,
  piid,
  desired,
  writeValue = desired,
  verifySiid = siid,
  verifyPiid = piid,
  label,
  attempts = 2,
}) {
  const expected = Number(desired);
  let lastObserved = null;
  let lastVia = "none";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    console.log(
      `VERIFY ${label} attempt ${attempt}/${attempts}: expected=${expected}`
    );

    // Attach before the write so a fast MQTT echo cannot be missed.
    const echoPromise = waitForSettingEcho(verifySiid, verifyPiid, 10000);

    try {
      const result = await client.setProperties(
        String(device.did),
        [{ siid, piid, value: writeValue }],
        { timeoutMs: 10000 }
      );
      console.log(
        `${label} write result: ${JSON.stringify(result)}`
      );
    } catch (err) {
      if (isNoAck(err)) {
        console.log(
          `${label}: no HTTP ACK; requiring actual-state verification.`
        );
      } else {
        throw err;
      }
    }

    const mqtt = await echoPromise;

    if (mqtt.seen) {
      lastObserved = mqtt.value;
      lastVia = mqtt.via;
      console.log(`${label} MQTT actual=${mqtt.value}`);

      if (Number(mqtt.value) === expected) {
        console.log(
          `STRICT CONFIG VERIFIED: ${label}=${expected} via MQTT`
        );
        return {
          label,
          desired: expected,
          actual: mqtt.value,
          verified: true,
          via: "mqtt",
        };
      }
    }

    // A write ACK alone is deliberately not sufficient. Read actual state.
    const readback = await readSettingBack(verifySiid, verifyPiid);

    if (readback.seen) {
      lastObserved = readback.value;
      lastVia = readback.via;
      console.log(`${label} readback actual=${readback.value}`);

      if (Number(readback.value) === expected) {
        console.log(
          `STRICT CONFIG VERIFIED: ${label}=${expected} via readback`
        );
        return {
          label,
          desired: expected,
          actual: readback.value,
          verified: true,
          via: "readback",
        };
      }
    }

    if (attempt < attempts) {
      await sleep(1200);
    }
  }

  console.log(
    `STRICT CONFIG FAILED: ${label}; expected=${expected}, ` +
    `actual=${lastObserved === null ? "unknown" : lastObserved}, ` +
    `via=${lastVia}`
  );

  return {
    label,
    desired: expected,
    actual: lastObserved,
    verified: false,
    via: lastVia,
  };
}

async function verifyCleanGeniusConfiguration(phase) {
  const desiredSmartHost = Number(phase.geniusMode);

  return [
    await setAndVerifyRobotSetting({
      siid: 4,
      piid: 26,
      desired: 0,
      label: "CustomizedCleaning",
    }),
    await setAndVerifyRobotSetting({
      siid: 2,
      piid: 6,
      desired: 2,
      verifySiid: 4,
      verifyPiid: 23,
      label: "CleanMode",
    }),
    await setAndVerifyRobotSetting({
      siid: 28,
      piid: 5,
      desired: 2,
      label: "CleanGeniusSubMode",
    }),
    await setAndVerifyRobotSetting({
      siid: 4,
      piid: 50,
      desired: desiredSmartHost,
      writeValue: JSON.stringify({
        k: "SmartHost",
        v: desiredSmartHost,
      }),
      label:
        desiredSmartHost === 2
          ? "SmartHost Deep"
          : "SmartHost Routine",
    }),
  ];
}

async function verifyVacuumConfiguration() {
  return [
    await setAndVerifyRobotSetting({
      siid: 4,
      piid: 26,
      desired: 0,
      label: "CustomizedCleaning",
    }),
    await setAndVerifyRobotSetting({
      siid: 4,
      piid: 50,
      desired: 0,
      writeValue: JSON.stringify({
        k: "SmartHost",
        v: 0,
      }),
      label: "SmartHost Off",
    }),
    await setAndVerifyRobotSetting({
      siid: 2,
      piid: 6,
      desired: 0,
      verifySiid: 4,
      verifyPiid: 23,
      label: "CleanMode Sweeping",
    }),
  ];
}

async function abortForUnverifiedConfiguration(
  phase,
  phaseIndex,
  checks
) {
  const failed = checks.filter((x) => !x.verified);
  const room = phase.rooms[0];

  const outcome = {
    kind: "config-unverified",
    reason: "configuration-unverified",
    roomId: room?.id ?? null,
    roomName: room?.name || null,
    failed: failed.map((x) => ({
      label: x.label,
      desired: x.desired,
      actual: x.actual,
      via: x.via,
    })),
  };

  console.log(
    "Refusing to start room because configuration was not verified: " +
    JSON.stringify(outcome)
  );

  await sendRunEvent("plan-aborted", {
    phaseIndex,
    label: phaseLabel(phase),
    outcome,
  });

  await sendTelegram(
    [
      "⚠️ החדר לא הופעל — הגדרות הרובוט לא אומתו",
      `חדר: ${room?.name || room?.id || "לא ידוע"}`,
      ...failed.map(
        (x) =>
          `${x.label}: רצוי ${x.desired}, ` +
          `בפועל ${x.actual === null ? "לא התקבל" : x.actual}`
      ),
      "לא נשלחה פקודת ניקוי לחדר.",
      `🕐 שעה: ${israelTime()}`,
    ].join("\n")
  );

  return outcome;
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

  let cancelExternal = () => {};

  const promise = new Promise((resolve) => {
    let settled = false;
    let startedSeen = false;
    let timer = null;

    const done = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      vacuum.off("taskLifecycle", onLifecycle);
      vacuum.off("change", onChange);
      resolve(result);
    };

    cancelExternal = (reason = "cancelled") => {
      done({ kind: "cancelled", reason, phaseIndex });
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

    timer = setTimeout(() => {
      done({
        kind: "timeout",
        phaseIndex,
        timeoutMinutes: phaseTimeoutMinutes,
      });
    }, timeoutMs);

    vacuum.on("taskLifecycle", onLifecycle);
    vacuum.on("change", onChange);
  });

  promise.cancel = (reason) => cancelExternal(reason);
  return promise;
}


function createRuntimeConfigMonitor(phase) {
  const desired = phase.mode === "cleangenius"
    ? {
        customizedCleaning: 0,
        cleanMode: 2,
        cleanGeniusSubMode: 2,
        smartHost: Number(phase.geniusMode),
      }
    : {
        customizedCleaning: 0,
        cleanMode: 0,
        smartHost: 0,
      };

  const observed = {
    customizedCleaning: null,
    cleanMode: null,
    cleanGeniusSubMode: null,
    smartHost: null,
  };

  const seenAt = {};
  const runtimeStartedAt = { value: null };

  const update = (key, value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;

    observed[key] = n;
    seenAt[key] = Date.now();

    const expected = desired[key];
    console.log(
      `RUNTIME CONFIG ${key}: actual=${n}` +
      `${expected === undefined ? "" : ` expected=${expected}`}`
    );
  };

  const onProperties = (changes) => {
    for (const change of changes || []) {
      const siid = Number(change?.siid);
      const piid = Number(change?.piid);

      if (siid === 4 && piid === 26) {
        update("customizedCleaning", change.value);
        continue;
      }

      if (siid === 4 && piid === 23) {
        const packed = Number(change.value);
        if (Number.isFinite(packed)) {
          console.log(
            `RUNTIME CONFIG cleaningMode packed=${packed} lowBits=${packed & 0x3}`
          );
          update("cleanMode", packed & 0x3);
        }
        continue;
      }

      if (siid === 28 && piid === 5) {
        update("cleanGeniusSubMode", change.value);
        continue;
      }

      if (siid === 4 && piid === 50) {
        const value =
          parseSmartHostFromFeatureValue(change.value);
        if (value !== null) {
          update("smartHost", value);
        }
      }
    }
  };

  rawSub.on("properties", onProperties);

  return {
    desired,
    observed,
    seenAt,

    markRuntimeStart() {
      runtimeStartedAt.value = Date.now();
    },

    snapshot() {
      return {
        desired: { ...desired },
        observed: { ...observed },
        runtimeStartedAt: runtimeStartedAt.value,
      };
    },

    close() {
      rawSub.off("properties", onProperties);
    },
  };
}

async function writeSmartHostBestEffort(mode) {
  const desired = Number(mode);
  const name =
    desired === 2
      ? "Deep"
      : desired === 1
        ? "Routine"
        : "Off";

  try {
    const result = await client.setProperties(
      String(device.did),
      [{
        siid: 4,
        piid: 50,
        value: JSON.stringify({
          k: "SmartHost",
          v: desired,
        }),
      }],
      { timeoutMs: 10000 }
    );

    console.log(
      `SmartHost=${desired} (${name}) write: ${JSON.stringify(result)}`
    );
  } catch (err) {
    if (isNoAck(err)) {
      console.log(
        `SmartHost=${desired} (${name}) no HTTP ACK; ` +
        "continuing to runtime verification."
      );
      return;
    }
    throw err;
  }
}

async function applyPhaseConfigurationBestEffort(phase) {
  if (phase.mode === "cleangenius") {
    console.log(
      "Applying CleanGenius configuration before start " +
      "(ACK is not required at this stage)."
    );

    await setCustomizedCleaning(false);
    await sleep(300);
    await setCleanMode(2);
    await setCleanGeniusSubMode(2);
    await writeSmartHostBestEffort(
      Number(phase.geniusMode)
    );
    await sleep(500);
    return;
  }

  console.log(
    "Applying vacuum-only configuration before start " +
    "(ACK is not required at this stage)."
  );

  await setCustomizedCleaning(false);
  await sleep(250);
  await writeSmartHostBestEffort(0);
  await setCleanMode(0);
  await sleep(500);
}

async function verifyRuntimeConfiguration(
  phase,
  monitor,
  timeoutMs = 25000
) {
  const deadline = Date.now() + timeoutMs;

  const strictKeys =
    phase.mode === "cleangenius"
      ? ["customizedCleaning", "smartHost"]
      : ["customizedCleaning", "cleanMode", "smartHost"];

  const diagnosticKeys =
    phase.mode === "cleangenius"
      ? ["cleanMode", "cleanGeniusSubMode"]
      : [];

  while (Date.now() < deadline) {
    const snap = monitor.snapshot();

    const strictKnown = strictKeys.every(
      (key) => snap.observed[key] !== null
    );

    const strictMatch =
      strictKnown &&
      strictKeys.every(
        (key) =>
          Number(snap.observed[key]) ===
          Number(snap.desired[key])
      );

    if (strictMatch) {
      const diagnostic = Object.fromEntries(
        diagnosticKeys.map((key) => [key, snap.observed[key]])
      );

      console.log(
        "RUNTIME CONFIG VERIFIED: authoritative settings match. " +
        JSON.stringify({ strictKeys, diagnostic })
      );

      return {
        kind: "verified",
        desired: snap.desired,
        observed: snap.observed,
        strictKeys,
        diagnosticKeys,
      };
    }

    await sleep(500);
  }

  const snap = monitor.snapshot();

  const mismatches = strictKeys
    .filter(
      (key) =>
        snap.observed[key] !== null &&
        Number(snap.observed[key]) !== Number(snap.desired[key])
    )
    .map((key) => ({
      key,
      desired: snap.desired[key],
      actual: snap.observed[key],
    }));

  const unknown = strictKeys.filter(
    (key) => snap.observed[key] === null
  );

  const diagnostic = Object.fromEntries(
    diagnosticKeys.map((key) => [key, snap.observed[key]])
  );

  if (mismatches.length) {
    console.log(
      "RUNTIME CONFIG MISMATCH (authoritative settings): " +
      JSON.stringify({ mismatches, unknown, diagnostic })
    );

    return {
      kind: "mismatch",
      desired: snap.desired,
      observed: snap.observed,
      mismatches,
      unknown,
      strictKeys,
      diagnosticKeys,
    };
  }

  console.log(
    "RUNTIME CONFIG PARTIALLY VERIFIED: " +
    JSON.stringify({
      strictKeys,
      desired: snap.desired,
      observed: snap.observed,
      unknown,
      diagnostic,
    })
  );

  // X40/r2416a may not echo every persistent setting. Also, during
  // CleanGenius Deep it can move through different cleaning phases, so
  // cleanMode=0 is allowed to later become cleanMode=2 without aborting.
  return {
    kind: unknown.length ? "partial" : "verified",
    desired: snap.desired,
    observed: snap.observed,
    unknown,
    strictKeys,
    diagnosticKeys,
  };
}


async function cancelForRuntimeMismatch(
  phase,
  phaseIndex,
  verification
) {
  const room = phase.rooms[0];

  console.log(
    "Cancelling room due to explicit runtime configuration mismatch."
  );

  try {
    await vacuum.cancelCurrentJob();
  } catch (err) {
    console.log(
      `Cancel after runtime mismatch: ${err?.message || err}`
    );
  }

  const outcome = {
    kind: "config-mismatch",
    reason: "runtime-configuration-mismatch",
    roomId: room?.id ?? null,
    roomName: room?.name || null,
    mismatches: verification.mismatches || [],
    unknown: verification.unknown || [],
    observed: verification.observed || {},
    desired: verification.desired || {},
  };

  await sendTelegram(
    [
      "⚠️ הופסק ניקוי בגלל אי־התאמה במצב הרובוט",
      `חדר: ${room?.name || room?.id || "לא ידוע"}`,
      ...(outcome.mismatches || []).map(
        (x) =>
          `${x.key}: רצוי ${x.desired}, בפועל ${x.actual}`
      ),
      `🕐 שעה: ${israelTime()}`,
    ].join("\n")
  );

  return outcome;
}


async function runPhase(phase, phaseIndex) {
  const ids = phase.rooms.map((r) => r.id);
  const label = phaseLabel(phase);

  console.log(
    `Phase ${phaseIndex + 1}/${phases.length}: ${label}`
  );

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

  // Important X40 behavior:
  // some configuration properties are not echoed until a real task
  // begins. Therefore we configure first, START the single room, and
  // only then judge the device's reported runtime state.
  const monitor = createRuntimeConfigMonitor(phase);
  let waitPromise = null;

  try {
    await applyPhaseConfigurationBestEffort(phase);

    // Arm lifecycle tracking before START_CUSTOM.
    waitPromise =
      waitForPhaseResult(phase, phaseIndex);

    // Mark immediately before issuing the start command so fast MQTT
    // state transitions are captured even if HTTP returns no ACK later.
    monitor.markRuntimeStart();

    if (phase.mode === "cleangenius") {
      console.log(
        `Starting CleanGenius ` +
        `${phase.geniusMode === "2" ? "Deep" : "Routine"} ` +
        `as Vac+Mop for room: ${ids.join(",")}`
      );

      const result = await vacuum.cleanSegments(ids);
      console.log(
        `CleanGenius cleanSegments: ${JSON.stringify(result)}`
      );
    } else {
      console.log(
        `Starting vacuum-only for room: ${ids.join(",")} ` +
        `fan=${phase.suction} repeats=${phase.repeats}`
      );

      const result = await vacuum.cleanSegments(ids, {
        repeats: phase.repeats,
        fan: phase.suction,
        water: 0,
      });

      console.log(
        `Vacuum-only cleanSegments: ${JSON.stringify(result)}`
      );
    }

    await sendRunEvent("primary-active", {
      phaseIndex,
      mode: phase.mode,
    });

    const verification =
      await verifyRuntimeConfiguration(
        phase,
        monitor,
        25000
      );

    console.log(
      "RUNTIME CONFIG RESULT: " +
      JSON.stringify(verification)
    );

    if (verification.kind === "mismatch") {
      waitPromise?.cancel?.("runtime-configuration-mismatch");

      return cancelForRuntimeMismatch(
        phase,
        phaseIndex,
        verification
      );
    }

    if (verification.kind === "partial") {
      console.log(
        "Runtime config has no explicit mismatch; " +
        "continuing despite missing X40 echoes."
      );
    }

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
  } finally {
    // Avoid a dangling 75-minute timeout when this phase exits early.
    waitPromise?.cancel?.("phase-finalized");
    monitor.close();
  }
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
  const room = phases[i].rooms[0];

  console.log(
    `ROOM ACTION ${i + 1}/${phases.length}: ` +
    `${room.name} (ID ${room.id})`
  );

  const outcome = await runPhase(phases[i], i);

  if (outcome.kind === "fallback") {
    finalOutcome = outcome;
    break;
  }

  if (outcome.kind !== "completed") {
    finalOutcome = outcome;
    break;
  }

  if (i < phases.length - 1) {
    console.log(
      "Room action completed; waiting 3s before next room."
    );
    await sleep(3000);
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

await rawSub.close().catch(() => {});
await vacuum.unwatch().catch(() => {});

if (
  finalOutcome.kind !== "completed" &&
  finalOutcome.kind !== "fallback"
) {
  process.exitCode = 1;
}
