import { DreameClient } from "node-dreame";

const email = process.env.DREAME_EMAIL;
const password = process.env.DREAME_PASSWORD;
const region = (process.env.DREAME_REGION || "sg").trim();
const wantedDid = (process.env.DREAME_DEVICE_DID || "").trim();

const callbackUrl = String(
  process.env.DREAME_CALLBACK_URL || ""
).replace(/\/+$/, "");

const callbackToken = String(
  process.env.DREAME_CALLBACK_TOKEN || ""
);

const sessionId = String(
  process.env.DREAME_CAPTURE_SESSION_ID || ""
);

const maxSeconds = Math.max(
  60,
  Math.min(
    1800,
    Number(process.env.DREAME_NATIVE_CAPTURE_MAX_SECONDS || "1200")
  )
);

if (!email || !password) {
  throw new Error("Missing Dreame credentials");
}
if (!callbackUrl || !callbackToken || !sessionId) {
  throw new Error("Missing capture callback configuration");
}

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function safeValue(value) {
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  let text;
  try {
    text =
      typeof value === "string"
        ? value
        : JSON.stringify(value);
  } catch {
    return "<unserializable>";
  }

  if (
    /https?:\/\//i.test(text) ||
    /(access[_-]?token|refresh[_-]?token|password|secret|ssid|bssid|localip|local_ip)/i.test(text)
  ) {
    return `<redacted len=${text.length}>`;
  }

  if (text.length > 500) {
    return `<redacted-large len=${text.length}>`;
  }

  return text;
}

const labels = {
  "2/1": "STATE",
  "2/2": "ERROR",
  "2/6": "CLEAN_MODE_SETTING",
  "3/2": "CHARGING_STATUS",
  "4/1": "TASK_STATUS",
  "4/4": "SUCTION",
  "4/5": "WATER",
  "4/18": "FAULTS_STR",
  "4/20": "RELOCATION_STATUS",
  "4/23": "CLEANING_MODE_MIRROR",
  "4/26": "CUSTOMIZED_CLEANING",
  "4/45": "AUTO_MOUNT_MOP",
  "4/50": "FEATURE_CONFIG/SmartHost",
  "4/52": "MOP_IN_STATION",
  "4/53": "MOP_PAD_INSTALLED",
  "4/63": "TASK_PROGRESS",
  "4/64": "DRYING_PROGRESS",
  "14/4": "STUCK_NOTIFICATION",
  "28/5": "CLEAN_GENIUS_SUB_MODE",
};

function decoded(siid, piid, raw) {
  const key = `${siid}/${piid}`;

  if (key === "4/23") {
    const packed = Number(raw);
    return Number.isFinite(packed)
      ? {
          packed,
          cleanModeLowBits: packed & 0x3,
        }
      : null;
  }

  if (key === "4/50") {
    try {
      const parsed =
        typeof raw === "string"
          ? JSON.parse(raw)
          : raw;

      if (Array.isArray(parsed)) {
        const item = parsed.find(
          (x) => x?.k === "SmartHost"
        );
        return item
          ? { SmartHost: Number(item.v) }
          : null;
      }

      if (parsed?.k === "SmartHost") {
        return {
          SmartHost: Number(parsed.v),
        };
      }
    } catch {}
  }

  return null;
}

async function postEvent(event, details = {}) {
  const response = await fetch(
    `${callbackUrl}/capture-event`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Capture-Callback-Token": callbackToken,
      },
      body: JSON.stringify({
        sessionId,
        event,
        ...details,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `capture callback failed: ${response.status} ${await response.text()}`
    );
  }

  return response.json().catch(() => ({}));
}

async function shouldStop() {
  try {
    const url =
      `${callbackUrl}/capture-control?sessionId=` +
      encodeURIComponent(sessionId);

    const response = await fetch(url, {
      headers: {
        "X-Capture-Callback-Token": callbackToken,
      },
    });

    if (!response.ok) {
      console.log(
        `capture control HTTP ${response.status}; continuing`
      );
      return false;
    }

    const data = await response.json();
    return Boolean(data.stopRequested);
  } catch (err) {
    console.log(
      `capture control unavailable: ${err?.message || err}`
    );
    return false;
  }
}

const client = new DreameClient({
  email,
  password,
  region,
});

await client.login();

const devices = await client.getDevices({
  timeoutMs: 25000,
});

if (!devices.length) {
  throw new Error("No Dreame devices found");
}

const device =
  (wantedDid &&
    devices.find(
      (d) => String(d.did) === wantedDid
    )) ||
  devices.find((d) =>
    /r2416|x40/i.test(
      `${d.model} ${d.name}`
    )
  ) ||
  devices[0];

const startedAt = Date.now();
const timeline = [];
const latest = new Map();
const propertyCounts = new Map();
let stopReason = "ui-stop";

function elapsed() {
  return (
    (Date.now() - startedAt) /
    1000
  ).toFixed(3);
}

function addTimeline(item) {
  timeline.push(item);

  if (timeline.length > 500) {
    timeline.splice(
      0,
      timeline.length - 500
    );
  }
}

function recordProperty(p) {
  const key = `${p.siid}/${p.piid}`;
  const value = safeValue(p.value);
  const extra = decoded(
    p.siid,
    p.piid,
    p.value
  );

  propertyCounts.set(
    key,
    Number(propertyCounts.get(key) || 0) + 1
  );

  const item = {
    t: elapsed(),
    kind: "property",
    siid: Number(p.siid),
    piid: Number(p.piid),
    label: labels[key] || "",
    value,
    decoded: extra,
  };

  latest.set(key, item);
  addTimeline(item);

  console.log(
    `[+${item.t}s] PROP ${key}` +
      `${item.label ? ` ${item.label}` : ""}` +
      ` = ${JSON.stringify(value)}` +
      `${extra ? ` decoded=${JSON.stringify(extra)}` : ""}`
  );
}

function stateSequence() {
  return timeline
    .filter(
      (x) =>
        x.kind === "property" &&
        x.siid === 2 &&
        x.piid === 1
    )
    .map((x) => Number(x.value))
    .filter(Number.isFinite);
}

function lastNumber(key) {
  const item = latest.get(key);
  if (!item) return null;

  if (
    item.decoded?.SmartHost !== undefined
  ) {
    return Number(
      item.decoded.SmartHost
    );
  }

  const n = Number(item.value);
  return Number.isFinite(n) ? n : null;
}

function buildProfile() {
  const mirror = latest.get("4/23");
  const cleanModeMirror =
    mirror?.decoded?.cleanModeLowBits ??
    null;

  return {
    roomId: 7,
    roomName: "חדר שינה ראשי 2",
    intent: "vacuum-only",
    observed: {
      stateSequence: stateSequence(),
      cleanModeSetting: lastNumber("2/6"),
      cleanModeMirror,
      customizedCleaning: lastNumber("4/26"),
      smartHost: lastNumber("4/50"),
      suction: lastNumber("4/4"),
      water: lastNumber("4/5"),
      cleanGeniusSubMode: lastNumber("28/5"),
      autoMountMop: lastNumber("4/45"),
      mopInStation: lastNumber("4/52"),
      mopPadInstalled: lastNumber("4/53"),
      taskStatus: lastNumber("4/1"),
    },
  };
}

let sub = null;

try {
  console.log(
    `Device: ${device.name} | ${device.model}`
  );
  console.log(
    "NATIVE VACUUM CAPTURE - LISTEN ONLY"
  );
  console.log(
    "This recorder does NOT start/change the robot."
  );
  console.log(
    "It captures robot-side MQTT/MIoT effects from the Dreamehome action."
  );
  console.log(
    "It does NOT intercept the Dreamehome app's encrypted HTTPS request."
  );

  sub = await client.subscribe(device);

  sub.on("properties", (changes) => {
    for (const p of changes || []) {
      recordProperty(p);
    }
  });

  sub.on("event", (ev) => {
    const item = {
      t: elapsed(),
      kind: "event",
      siid: Number(ev?.siid),
      eiid: Number(ev?.eiid),
      arguments: safeValue(
        ev?.arguments ?? []
      ),
    };

    addTimeline(item);

    console.log(
      `[+${item.t}s] EVENT ` +
      `${item.siid}/${item.eiid} ` +
      `args=${JSON.stringify(item.arguments)}`
    );
  });

  sub.on("props", (push) => {
    const keys = Object.keys(
      push?.params || {}
    );
    if (!keys.length) return;

    addTimeline({
      t: elapsed(),
      kind: "props-keys",
      keys,
    });
  });

  sub.on("error", (err) => {
    console.log(
      `MQTT error: ${err?.message || err}`
    );
  });

  await postEvent("started", {
    device: {
      name: device.name,
      model: device.model,
    },
    maxSeconds,
  });

  const deadline =
    Date.now() + maxSeconds * 1000;

  let lastHeartbeatAt = 0;

  while (Date.now() < deadline) {
    if (await shouldStop()) {
      stopReason = "ui-stop";
      break;
    }

    if (
      Date.now() - lastHeartbeatAt >=
      10000
    ) {
      lastHeartbeatAt = Date.now();

      await postEvent("heartbeat", {
        elapsedSeconds:
          Math.round(
            (Date.now() - startedAt) /
              1000
          ),
        entries: timeline.length,
        stateSequence: stateSequence(),
      }).catch((err) =>
        console.log(
          `heartbeat failed: ${err?.message || err}`
        )
      );
    }

    await sleep(2000);
  }

  if (Date.now() >= deadline) {
    stopReason = "max-duration";
  }

  const profile = buildProfile();

  const summary = {
    sessionId,
    stoppedAt:
      new Date().toISOString(),
    stopReason,
    durationSeconds:
      Math.round(
        (Date.now() - startedAt) /
          1000
      ),
    entries: timeline.length,
    propertyCounts:
      Object.fromEntries(
        [...propertyCounts.entries()].sort()
      ),
    profile,
    timeline,
  };

  console.log(
    "=== NATIVE VACUUM CAPTURE RESULT ==="
  );
  console.log(
    JSON.stringify(summary, null, 2)
  );

  await postEvent("completed", {
    result: summary,
  });

  console.log(
    "Capture finished successfully."
  );
} catch (err) {
  console.error(
    err?.stack || err?.message || err
  );

  await postEvent("failed", {
    error: err?.message || String(err),
  }).catch(() => {});

  process.exitCode = 1;
} finally {
  if (sub) {
    await sub.close().catch(() => {});
  }
}
