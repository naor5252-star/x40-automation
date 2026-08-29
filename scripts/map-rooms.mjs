import { DreameClient } from "node-dreame";

const email = process.env.DREAME_EMAIL;
const password = process.env.DREAME_PASSWORD;
const region = (process.env.DREAME_REGION || "sg").trim();
const wantedDid = (process.env.DREAME_DEVICE_DID || "").trim();

if (!email || !password) {
  throw new Error("Missing DREAME_EMAIL or DREAME_PASSWORD");
}

const client = new DreameClient({ email, password, region });
await client.login();

const devices = await client.getDevices({ timeoutMs: 25000 });
if (!devices.length) throw new Error("No Dreame devices found");

const device =
  (wantedDid && devices.find((d) => String(d.did) === wantedDid)) ||
  devices.find((d) => /r2416|r2449|x40/i.test(`${d.model} ${d.name}`)) ||
  devices[0];

console.log(`✅ Device: ${device.name} | ${device.model} | did=${device.did}`);
console.log("🗺️ Fetching current map and room/segment metadata...");

const vacuum = client.getVacuum(device);

let data = null;
let source = "current-map";

try {
  data = await vacuum.fetchCurrentMap();
} catch (err) {
  console.log(`⚠️ fetchCurrentMap failed: ${err?.message || err}`);
}

if (!data) {
  source = "saved-map";
  console.log("Trying saved map list...");
  try {
    const list = await vacuum.fetchSavedMapList();
    if (list?.maps?.length) {
      const active =
        list.maps.find((m) => m.mapId === list.activeMapId) ||
        list.maps[0];
      data = active?.data || null;
      if (active) {
        console.log(
          `Saved map: id=${active.mapId} name=${active.name ?? "(unnamed)"}`
        );
      }
    }
  } catch (err) {
    console.log(`⚠️ fetchSavedMapList failed: ${err?.message || err}`);
  }
}

if (!data) {
  throw new Error(
    "Could not fetch map data. Open the Dreamehome X40 map screen and rerun this workflow."
  );
}

const segments = Array.isArray(data.segments) ? data.segments : [];

console.log("");
console.log("==============================================");
console.log(`ROOM MAP (${source})`);
console.log("==============================================");

if (!segments.length) {
  console.log("No segments were decoded from the map.");
  console.log("Map keys:", Object.keys(data).join(", "));
  process.exit(2);
}

for (const seg of [...segments].sort((a, b) => Number(a.id) - Number(b.id))) {
  const name =
    typeof seg.name === "string" && seg.name.trim()
      ? seg.name.trim()
      : `(unnamed room ${seg.id})`;

  const neighbours = Array.isArray(seg.neighbours)
    ? seg.neighbours.join(",")
    : "";

  console.log(
    `ROOM_ID=${seg.id} | NAME=${name} | ACTIVE=${Boolean(seg.active)} | NEIGHBOURS=${neighbours}`
  );
}

console.log("==============================================");
console.log("");
console.log("Copy the ROOM_ID lines back to ChatGPT.");
