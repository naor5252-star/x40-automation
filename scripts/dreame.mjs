import { DreameClient } from "node-dreame";

const mode = (process.argv[2] || "capture").trim().toLowerCase();
const wantedName = (process.argv[3] || process.env.DREAME_SHORTCUT_NAME || "ניקוי עמוק").trim();
const argShortcutId = (process.argv[4] || process.env.DREAME_SHORTCUT_ID || "").trim();

const email = process.env.DREAME_EMAIL;
const password = process.env.DREAME_PASSWORD;
const configuredRegion = (process.env.DREAME_REGION || "sg").trim().toLowerCase();
const wantedDid = (process.env.DREAME_DEVICE_DID || "").trim();
const captureSeconds = Math.max(30, Number(process.env.DREAME_CAPTURE_SECONDS || "150"));

if (!email || !password) {
  throw new Error("Missing DREAME_EMAIL or DREAME_PASSWORD");
}

function normalize(s) {
  return String(s ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("he-IL");
}

function decodeShortcutName(value) {
  if (typeof value !== "string") return String(value ?? "");
  try {
    const buf = Buffer.from(value, "base64");
    const decoded = buf.toString("utf8");
    if (decoded && !decoded.includes("\uFFFD")) return decoded;
  } catch {}
  return value;
}

function parseShortcuts(raw) {
  let value = raw;
  if (typeof value === "string") value = JSON.parse(value);
  if (!Array.isArray(value)) {
    throw new Error(`Unexpected 4-48 payload: ${JSON.stringify(value).slice(0, 500)}`);
  }
  return value.map((sc) => ({
    ...sc,
    decodedName: decodeShortcutName(sc.name),
  }));
}

async function connect() {
  const regions = configuredRegion === "auto"
    ? ["sg", "eu", "de", "us", "in", "ru", "tw", "cn"]
    : [configuredRegion];

  for (const region of regions) {
    console.log(`Trying region ${region}...`);
    try {
      const client = new DreameClient({ email, password, region });
      await client.login();
      const devices = await client.getDevices({ timeoutMs: 25000 });
      console.log(`Region ${region}: ${devices.length} device(s)`);
      if (devices.length) return { client, devices, region };
    } catch (e) {
      console.log(`Region ${region} failed: ${e?.message || e}`);
    }
  }
  throw new Error("No Dreame devices found.");
}

const { client, devices, region } = await connect();

console.log("\nDevices:");
devices.forEach((d, i) =>
  console.log(`[${i}] did=${d.did} model=${d.model} name=${d.name} online=${d.online}`)
);

let device;
if (wantedDid) {
  device = devices.find((d) => String(d.did) === wantedDid);
} else {
  device =
    devices.find((d) => /r2416|r2449/i.test(String(d.model))) ||
    devices.find((d) => /x40/i.test(String(d.name))) ||
    devices.find((d) => String(d.model).startsWith("dreame.vacuum.")) ||
    devices[0];
}
if (!device) throw new Error("Could not select Dreame device.");

console.log(`\n✅ Region: ${region}`);
console.log(`✅ Device: ${device.name} | ${device.model} | did=${device.did}`);

async function printAndFind(raw, source) {
  const shortcuts = parseShortcuts(raw);
  console.log(`\nShortcuts captured from ${source}:`);
  for (const sc of shortcuts) {
    console.log(`  id=${sc.id} | state=${sc.state ?? "?"} | ${sc.decodedName}`);
  }

  const wanted = normalize(wantedName);
  let target = shortcuts.find((sc) => normalize(sc.decodedName) === wanted);
  if (!target) {
    const partial = shortcuts.filter((sc) => {
      const n = normalize(sc.decodedName);
      return n.includes(wanted) || wanted.includes(n);
    });
    if (partial.length === 1) target = partial[0];
  }

  if (target) {
    console.log("\n===============================================");
    console.log(`✅ FOUND SHORTCUT: ${target.decodedName}`);
    console.log(`✅ FOUND_SHORTCUT_ID=${target.id}`);
    console.log("===============================================");
    return target;
  }

  console.log(`Wanted shortcut "${wantedName}" not found in this payload.`);
  return null;
}

if (mode === "capture") {
  console.log(`
CAPTURE MODE
------------
GitHub is now listening to the X40 over Dreame MQTT.

During the next ${captureSeconds} seconds:
1. Open Dreamehome on your iPhone.
2. Open the X40 shortcut list.
3. Start "${wantedName}" once manually.
4. As soon as the robot reacts, you may stop/pause it in the app.

We are looking specifically for an MQTT properties_changed event:
  siid=4, piid=48
`);

  const sub = await client.subscribe(device);
  console.log(`✅ MQTT connected. Topic: ${sub.topic}`);
  console.log("👉 NOW trigger the shortcut in Dreamehome.");

  let done = false;

  const finish = async (code) => {
    if (done) return;
    done = true;
    await sub.close().catch(() => {});
    process.exit(code);
  };

  sub.on("properties", async (changes) => {
    for (const p of changes) {
      if (p.siid === 4 && p.piid === 48) {
        console.log("\n🎯 Received property 4-48 via MQTT.");
        try {
          const target = await printAndFind(p.value, "MQTT 4-48");
          if (target) await finish(0);
        } catch (e) {
          console.log(`Could not parse 4-48: ${e?.message || e}`);
          console.log("Raw 4-48:", JSON.stringify(p.value));
        }
      }
    }
  });

  sub.on("error", (err) => {
    console.log("MQTT error:", err?.message || err);
  });

  // Log only relevant raw MIoT messages, not the full potentially noisy stream.
  sub.on("message", (msg) => {
    const method = msg?.data?.method;
    if (method === "properties_changed") {
      const params = Array.isArray(msg?.data?.params) ? msg.data.params : [];
      const interesting = params.filter((p) => p?.siid === 4 && p?.piid === 48);
      if (interesting.length) {
        console.log("Raw relevant MQTT event:", JSON.stringify({
          method,
          params: interesting,
        }));
      }
    }
  });

  setTimeout(async () => {
    if (done) return;
    console.log(`
❌ Capture timeout: no 4-48 update was received.

Try again and, while the listener is running, either:
- start "${wantedName}", or
- edit that shortcut in Dreamehome, make a harmless change, save it,
  then change it back after capture.

Changing/saving a shortcut is more likely to force Dreame to publish 4-48.
`);
    await finish(5);
  }, captureSeconds * 1000);

} else if (mode === "list") {
  console.log("\nLIST mode: trying HTTP property 4-48 once...");
  try {
    const result = await client.getProperties(
      String(device.did),
      [{ siid: 4, piid: 48 }],
      { timeoutMs: 15000 }
    );
    const prop = result.find((x) => x.siid === 4 && x.piid === 48) ?? result[0];
    if (!prop || prop.value == null) throw new Error("No 4-48 value returned.");
    await printAndFind(prop.value, "HTTP 4-48");
  } catch (e) {
    console.log(`HTTP list failed: ${e?.message || e}`);
    console.log('Use mode="capture" instead; 80001 is expected on some healthy Dreame devices.');
    process.exit(6);
  }

} else if (mode === "run-id") {
  if (!argShortcutId) {
    throw new Error("run-id requires shortcut_id (workflow input or DREAME_SHORTCUT_ID).");
  }

  console.log(`\n▶️ Starting "${wantedName}" using shortcut id=${argShortcutId}`);

  const action = {
    siid: 4,
    aiid: 1,
    in: [
      { piid: 1, value: 25 },
      { piid: 10, value: String(argShortcutId) },
    ],
  };

  try {
    const result = await client.callAction(String(device.did), action, { timeoutMs: 20000 });
    console.log("✅ Dreame ACK:", JSON.stringify(result));
  } catch (e) {
    const bodyCode = e?.body?.code;
    if (bodyCode === 80001 || String(e?.message || "").includes("80001") || String(e?.name || "").includes("Offline")) {
      console.log(`
⚠️ Dreame returned 80001/no HTTP ACK.
This does NOT prove the command failed. On these devices the command can execute
while the cloud-side ACK waiter times out. Check the robot/Dreamehome state.
`);
      process.exit(0);
    }
    throw e;
  }

} else {
  throw new Error(`Unknown mode "${mode}". Use capture | list | run-id`);
}
