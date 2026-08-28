import { DreameClient } from "node-dreame";

const mode = (process.argv[2] || "list").trim().toLowerCase();
const wantedName = (process.argv.slice(3).join(" ") || process.env.DREAME_SHORTCUT_NAME || "ניקוי עמוק").trim();

const email = process.env.DREAME_EMAIL;
const password = process.env.DREAME_PASSWORD;
const region = process.env.DREAME_REGION || "eu";
const wantedDid = (process.env.DREAME_DEVICE_DID || "").trim();

if (!email || !password) {
  console.error("Missing DREAME_EMAIL or DREAME_PASSWORD");
  process.exit(2);
}

if (!["list", "run"].includes(mode)) {
  console.error(`Unknown mode "${mode}". Use: list | run`);
  process.exit(2);
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
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return value;
  }
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

const client = new DreameClient({
  email,
  password,
  region,
});

console.log(`Logging in to DreameHome (${region})...`);
await client.login();

const devices = await client.getDevices({ timeoutMs: 25000 });
if (!devices.length) {
  throw new Error("No Dreame devices were returned by the account.");
}

console.log("\nDevices:");
devices.forEach((d, i) => {
  console.log(`[${i}] did=${d.did} model=${d.model ?? ""} name=${d.name ?? d.customName ?? ""}`);
});

let device;

if (wantedDid) {
  device = devices.find((d) => String(d.did) === wantedDid);
  if (!device) throw new Error(`DREAME_DEVICE_DID=${wantedDid} was not found in the account.`);
} else {
  device =
    devices.find((d) => String(d.model ?? "").includes("r2449")) ||
    devices.find((d) => /x40/i.test(String(d.name ?? d.customName ?? ""))) ||
    devices.find((d) => String(d.model ?? "").startsWith("dreame.vacuum.")) ||
    devices[0];
}

console.log(`\nSelected device: did=${device.did} model=${device.model ?? ""} name=${device.name ?? device.customName ?? ""}`);

const shortcuts = await readShortcutsWithRetry(client, device.did);

console.log("\nDreame shortcuts:");
for (const sc of shortcuts) {
  console.log(`  ${sc.id} -> ${sc.decodedName}`);
}

if (mode === "list") {
  console.log("\nLIST mode completed. Robot was NOT started.");
  process.exit(0);
}

const wanted = normalize(wantedName);

let target = shortcuts.find((sc) => normalize(sc.decodedName) === wanted);

if (!target) {
  const partial = shortcuts.filter((sc) =>
    normalize(sc.decodedName).includes(wanted) || wanted.includes(normalize(sc.decodedName))
  );
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
