import { DreameClient } from "node-dreame";

const email = process.env.DREAME_EMAIL;
const password = process.env.DREAME_PASSWORD;
const region = (process.env.DREAME_REGION || "sg").trim();
const wantedDid = (process.env.DREAME_DEVICE_DID || "").trim();
const captureSeconds = Math.max(
  60,
  Number(process.env.DREAME_CAPTURE_SECONDS || "150")
);

if (!email || !password) {
  throw new Error("Missing Dreame credentials");
}

const client = new DreameClient({ email, password, region });
await client.login();

const devices = await client.getDevices({ timeoutMs: 25000 });
if (!devices.length) throw new Error("No Dreame devices found");

const device =
  (wantedDid &&
    devices.find((d) => String(d.did) === wantedDid)) ||
  devices.find((d) => /r2416|x40/i.test(`${d.model} ${d.name}`)) ||
  devices[0];

const startedAt = Date.now();
const timeline = [];
const latest = new Map();

function elapsed() {
  return ((Date.now() - startedAt) / 1000).toFixed(3);
}

function labelFor(siid, piid) {
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
    "4/50": "FEATURE_CONFIG/SmartHost",
    "4/63": "TASK_PROGRESS",
    "4/64": "DRYING_PROGRESS",
    "14/4": "STUCK_NOTIFICATION",
    "28/5": "CLEAN_GENIUS_SUB_MODE",
  };
  return labels[`${siid}/${piid}`] || "";
}

function safeValue(value) {
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) return value;

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

  if (text.length > 300) {
    return `<redacted-large len=${text.length}>`;
  }

  return text;
}

function decoded(siid, piid, raw) {
  if (Number(siid) === 4 && Number(piid) === 23) {
    const packed = Number(raw);
    return Number.isFinite(packed)
      ? { packed, cleanModeLowBits: packed & 0x3 }
      : null;
  }

  if (Number(siid) === 4 && Number(piid) === 50) {
    try {
      const parsed =
        typeof raw === "string" ? JSON.parse(raw) : raw;

      if (Array.isArray(parsed)) {
        const x = parsed.find((v) => v?.k === "SmartHost");
        return x ? { SmartHost: Number(x.v) } : null;
      }

      if (parsed?.k === "SmartHost") {
        return { SmartHost: Number(parsed.v) };
      }
    } catch {}
  }

  return null;
}

console.log(`Device: ${device.name} | ${device.model}`);
console.log("");
console.log("NATIVE CLEANGENIUS CAPTURE - LISTEN ONLY");
console.log("---------------------------------------");
console.log("This script does NOT start or change the robot.");
console.log(`Listening for ${captureSeconds} seconds.`);
console.log("");
console.log("NOW in Dreamehome:");
console.log("1. Select ONLY the living room.");
console.log("2. Choose CleanGenius -> Deep.");
console.log("3. Start once.");
console.log("4. Let it mount/wash mops and leave the dock.");
console.log("5. You may stop it manually after capture.");
console.log("");
console.log("Captures device-side MQTT effects, not app HTTP traffic.");
console.log("Sensitive/large payloads are redacted.");
console.log("");

const sub = await client.subscribe(device);
console.log("MQTT connected; capture starts NOW.");

sub.on("properties", (changes) => {
  for (const p of changes || []) {
    const value = safeValue(p.value);
    const label = labelFor(p.siid, p.piid);
    const extra = decoded(p.siid, p.piid, p.value);

    latest.set(`${p.siid}/${p.piid}`, {
      t: elapsed(),
      label,
      value,
      decoded: extra,
    });

    const item = {
      t: elapsed(),
      kind: "property",
      siid: p.siid,
      piid: p.piid,
      label,
      value,
      decoded: extra,
    };
    timeline.push(item);

    console.log(
      `[+${item.t}s] PROP ${p.siid}/${p.piid}` +
      `${label ? ` ${label}` : ""}` +
      ` = ${JSON.stringify(value)}` +
      `${extra ? ` decoded=${JSON.stringify(extra)}` : ""}`
    );
  }
});

sub.on("event", (ev) => {
  const item = {
    t: elapsed(),
    kind: "event",
    siid: ev?.siid,
    eiid: ev?.eiid,
    arguments: safeValue(ev?.arguments ?? []),
  };
  timeline.push(item);
  console.log(
    `[+${item.t}s] EVENT ${item.siid}/${item.eiid} ` +
    `args=${JSON.stringify(item.arguments)}`
  );
});

sub.on("props", (push) => {
  const keys = Object.keys(push?.params || {});
  if (!keys.length) return;

  const item = {
    t: elapsed(),
    kind: "props-keys",
    keys,
  };
  timeline.push(item);

  console.log(
    `[+${item.t}s] PROPS keys=${JSON.stringify(keys)}`
  );
});

sub.on("error", (err) => {
  console.log(
    `[+${elapsed()}s] MQTT error: ${err?.message || err}`
  );
});

await new Promise((resolve) =>
  setTimeout(resolve, captureSeconds * 1000)
);

console.log("");
console.log("=== CAPTURE SUMMARY ===");
console.log(`Timeline entries: ${timeline.length}`);

for (const [key, item] of [...latest.entries()].sort()) {
  console.log(
    `LAST ${key}` +
    `${item.label ? ` ${item.label}` : ""}` +
    ` @ +${item.t}s = ${JSON.stringify(item.value)}` +
    `${item.decoded ? ` decoded=${JSON.stringify(item.decoded)}` : ""}`
  );
}

console.log("");
console.log("=== RELEVANT TIMELINE ===");

const relevant = new Set([
  "2/1","2/2","2/6","3/2","4/1","4/4","4/5",
  "4/18","4/20","4/23","4/26","4/50","4/63",
  "14/4","28/5",
]);

for (const item of timeline) {
  if (item.kind === "property") {
    if (!relevant.has(`${item.siid}/${item.piid}`)) continue;
  }
  console.log(JSON.stringify(item));
}

await sub.close().catch(() => {});
console.log("Capture finished successfully.");
