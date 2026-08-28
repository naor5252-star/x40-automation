import { DreameClient } from "node-dreame";

const mode = (process.argv[2] || "list").trim().toLowerCase();
const wantedName = (process.argv.slice(3).join(" ") || process.env.DREAME_SHORTCUT_NAME || "ניקוי עמוק").trim();

const email = process.env.DREAME_EMAIL;
const password = process.env.DREAME_PASSWORD;
const configuredRegion = (process.env.DREAME_REGION || "auto").trim().toLowerCase();
const wantedDid = (process.env.DREAME_DEVICE_DID || "").trim();

if (!email || !password) {
  console.error("Missing DREAME_EMAIL or DREAME_PASSWORD");
  process.exit(2);
}

if (!["list", "run"].includes(mode)) {
  console.error(`Unknown mode "${mode}". Use: list | run`);
  process.exit(2);
}

const ALL_REGIONS = ["sg", "eu", "de", "us", "in", "ru", "tw", "cn"];

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
    const decoded = Buffer.from(value, "base64").toString("utf8");
    // Base64 decoding any string can technically "succeed"; prefer decoded
    // only when it contains printable content.
    if (decoded && !decoded.includes("\uFFFD")) return decoded;
  } catch {}
  return value;
}

function parseShortcuts(raw) {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch (e) {
      throw new Error(`Property 4-48 is not valid JSON: ${String(e)}`);
    }
  }

  if (!Array.isArray(value)) {
    throw new Error(`Unexpected 4-48 payload: ${JSON.stringify(value).slice(0, 500)}`);
  }

  return value.map((sc) => ({
    ...sc,
    decodedName: decodeShortcutName(sc.name),
  }));
}

async function discoverClientAndDevices() {
  const regions = configuredRegion === "auto" ? ALL_REGIONS : [configuredRegion];

  console.log(`Region mode: ${configuredRegion}`);
  console.log(`Regions to try: ${regions.join(", ")}`);

  const failures = [];

  for (const region of regions) {
    console.log(`\n=== Trying Dreame region: ${region} ===`);
    try {
      const client = new DreameClient({ email, password, region });
      await client.login();
      const devices = await client.getDevices({ timeoutMs: 25000 });

      console.log(`Region ${region}: ${devices.length} device(s)`);

      if (devices.length > 0) {
        console.log(`✅ Found Dreame device(s) in region "${region}"`);
        return { client, devices, region };
      }

      failures.push(`${region}: login OK, 0 devices`);
    } catch (err) {
      const msg = err?.message || String(err);
      console.warn(`Region ${region}: ${msg}`);
      failures.push(`${region}: ${msg}`);
    }

    // Small pause to avoid hammering Dreame auth endpoints.
    await new Promise((r) => setTimeout(r, 1200));
  }

  console.error("\n❌ No devices found in any attempted Dreame region.");
  console.error("Results:");
  failures.forEach((x) => console.error(`  - ${x}`));
  console.error(`
If Dreamehome shows the X40 but every region returns 0 devices:
1. Make sure DREAME_EMAIL is the SAME Dreamehome account that owns/sees the robot.
2. If the account was created with "Sign in with Apple" or Google, set a
   Dreame password in Dreamehome Account & Security, then use that exact
   account email + password in GitHub Secrets.
3. Do not create a second email/password account just for this automation,
   because it can authenticate successfully while owning zero devices.
`);
  process.exit(4);
}

async function readShortcutsWithRetry(client, did) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      console.log(`Reading Dreame shortcuts (4-48), attempt ${attempt}/4...`);
      const result = await client.getProperties(
        String(did),
        [{ siid: 4, piid: 48 }],
        { timeoutMs: 25000 }
      );

      const prop = result.find((x) => x.siid === 4 && x.piid === 48) ?? result[0];
      if (!prop) throw new Error("No result returned for property 4-48.");
      if (prop.code && prop.code !== 0) throw new Error(`Dreame property 4-48 returned code ${prop.code}.`);
      if (prop.value === undefined || prop.value === null) throw new Error("Property 4-48 returned no value.");

      return parseShortcuts(prop.value);
    } catch (err) {
      lastErr = err;
      console.warn(`Attempt ${attempt} failed: ${err?.message || err}`);
      if (attempt < 4) {
        const waitMs = attempt * 4000;
        console.log(`Waiting ${waitMs / 1000}s before retry...`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  }
  throw lastErr;
}

const { client, devices, region } = await discoverClientAndDevices();

console.log("\nDevices:");
devices.forEach((d, i) => {
  console.log(`[${i}] did=${d.did} model=${d.model ?? ""} name=${d.name ?? ""} online=${d.online}`);
});

let device;

if (wantedDid) {
  device = devices.find((d) => String(d.did) === wantedDid);
  if (!device) throw new Error(`DREAME_DEVICE_DID=${wantedDid} was not found in region ${region}.`);
} else {
  device =
    devices.find((d) => /r2449/i.test(String(d.model ?? ""))) ||
    devices.find((d) => /x40/i.test(String(d.name ?? ""))) ||
    devices.find((d) => String(d.model ?? "").startsWith("dreame.vacuum.")) ||
    devices[0];
}

console.log(`\n✅ Selected region: ${region}`);
console.log(`Selected device: did=${device.did} model=${device.model ?? ""} name=${device.name ?? ""}`);

const shortcuts = await readShortcutsWithRetry(client, device.did);

console.log("\nDreame shortcuts:");
for (const sc of shortcuts) {
  console.log(`  ${sc.id} -> ${sc.decodedName}`);
}

if (mode === "list") {
  console.log("\n✅ LIST mode completed. Robot was NOT started.");
  process.exit(0);
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

if (!target) {
  console.error(`\nCould not uniquely find shortcut: "${wantedName}"`);
  console.error("Available shortcuts are printed above.");
  process.exit(3);
}

console.log(`\nStarting shortcut: "${target.decodedName}" (id=${target.id})`);

const action = {
  siid: 4,
  aiid: 1,
  in: [
    { piid: 1, value: 25 },
    { piid: 10, value: String(target.id) },
  ],
};

const response = await client.callAction(String(device.did), action, { timeoutMs: 25000 });
console.log("Dreame action response:", JSON.stringify(response));
console.log(`\n✅ Command sent for shortcut "${target.decodedName}".`);
