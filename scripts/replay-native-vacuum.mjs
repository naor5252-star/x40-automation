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

if (!email || !password) {
  throw new Error("Missing Dreame credentials");
}
if (!callbackUrl || !callbackToken || !sessionId) {
  throw new Error("Missing replay callback configuration");
}

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function isNoAck(err) {
  const code = err?.body?.code;
  const text =
    `${err?.name || ""} ${err?.message || ""}`;

  return (
    code === 80001 ||
    text.includes("80001") ||
    text.includes("device offline") ||
    text.includes("Offline")
  );
}

function parseSmartHost(raw) {
  try {
    const parsed =
      typeof raw === "string"
        ? JSON.parse(raw)
        : raw;

    if (Array.isArray(parsed)) {
      const item = parsed.find(
        (x) => String(x?.k) === "SmartHost"
      );
      return item
        ? Number(item.v)
        : null;
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      String(parsed.k) === "SmartHost"
    ) {
      return Number(parsed.v);
    }
  } catch {}

  return null;
}

async function postEvent(event, details = {}) {
  const response = await fetch(
    `${callbackUrl}/native-replay-event`,
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
      `replay callback failed: ${response.status} ${await response.text()}`
    );
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

const vacuum = client.getVacuum(device);

await vacuum.watch();
const rawSub = await client.subscribe(device);

try {
  await vacuum.refreshFromCloud();
} catch (err) {
  console.log(
    `Initial cloud refresh unavailable: ${err?.message || err}`
  );
}

const observed = {
  miotState: null,
  cleanMode: null,
  cleanModePacked: null,
  smartHost: null,
  mopHandlingPulse: null,
  taskStatus: null,
  taskStep: null,
  suction: null,
  wetness: null,
};

const stateSequence = [];
const packedSequence = [];

function rememberState(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return;

  observed.miotState = n;

  if (
    stateSequence[stateSequence.length - 1] !== n
  ) {
    stateSequence.push(n);
    console.log(
      `NATIVE REPLAY MiotState=${n}`
    );
  }
}

vacuum.on("change", (state) => {
  if (
    state?.miotStateRaw !== null &&
    state?.miotStateRaw !== undefined &&
    state?.miotStateRaw !== ""
  ) {
    rememberState(
      state.miotStateRaw
    );
  }

  if (
    state?.cleaningModeRaw !== null &&
    state?.cleaningModeRaw !== undefined &&
    state?.cleaningModeRaw !== ""
  ) {
    const packed = Number(state.cleaningModeRaw);
    if (Number.isFinite(packed)) {
      observed.cleanModePacked = packed;
      observed.cleanMode = packed & 3;
      if (packedSequence[packedSequence.length - 1] !== packed) {
        packedSequence.push(packed);
        console.log(
          `X40 REPLAY CleaningModePacked=${packed} lowBits=${packed & 3}`
        );
      }
    }
  }
});

rawSub.on("properties", (changes) => {
  for (const change of changes || []) {
    const siid = Number(change?.siid);
    const piid = Number(change?.piid);

    if (
      change?.value === null ||
      change?.value === undefined ||
      change?.value === ""
    ) {
      continue;
    }

    if (siid === 2 && piid === 1) {
      rememberState(change.value);
      continue;
    }

    if (siid === 4 && piid === 1) {
      const n = Number(change.value);
      if (Number.isFinite(n)) {
        observed.taskStatus = n;
        console.log(
          `NATIVE REPLAY TaskStatus=${n}`
        );
      }
      continue;
    }

    if (siid === 4 && piid === 23) {
      const packed = Number(change.value);
      if (Number.isFinite(packed)) {
        observed.cleanModePacked = packed;
        observed.cleanMode = packed & 3;
        if (packedSequence[packedSequence.length - 1] !== packed) {
          packedSequence.push(packed);
        }
        console.log(
          `X40 REPLAY CleaningModePacked=${packed} lowBits=${packed & 3}`
        );
      }
      continue;
    }

    if (siid === 4 && piid === 4) {
      const n = Number(change.value);
      if (Number.isFinite(n)) {
        observed.suction = n;
        console.log(`X40 REPLAY Suction=${n}`);
      }
      continue;
    }

    if (siid === 28 && piid === 1) {
      const n = Number(change.value);
      if (Number.isFinite(n)) {
        observed.wetness = n;
        console.log(`X40 REPLAY Wetness=${n}`);
      }
      continue;
    }

    if (siid === 4 && piid === 7) {
      const n = Number(change.value);
      if (Number.isFinite(n)) {
        observed.taskStep = n;
        console.log(`X40 REPLAY TaskStep=${n}`);
      }
      continue;
    }

    if (siid === 4 && piid === 50) {
      const value =
        parseSmartHost(change.value);

      if (
        value !== null &&
        Number.isFinite(value)
      ) {
        observed.smartHost = value;
        console.log(
          `NATIVE REPLAY SmartHost=${value}`
        );
      }
      continue;
    }

    if (siid === 4 && piid === 53) {
      const n = Number(change.value);
      if (Number.isFinite(n)) {
        observed.mopHandlingPulse = n;
        console.log(
          `X40 REPLAY MopHandlingPulse=${n}`
        );
      }
    }
  }
});

async function readNativeProfileSnapshot(label) {
  const props = [
    { siid: 4, piid: 10 },
    { siid: 4, piid: 26 },
    { siid: 2, piid: 6 },
    { siid: 4, piid: 50 },
    { siid: 4, piid: 53 },
  ];

  try {
    const result = await client.getProperties(
      String(device.did),
      props,
      { timeoutMs: 12000 }
    );

    const snapshot = {};

    for (const item of result || []) {
      const key = `${item?.siid}/${item?.piid}`;

      if (
        item?.value === null ||
        item?.value === undefined
      ) {
        snapshot[key] = null;
        continue;
      }

      if (key === "4/50") {
        snapshot[key] = {
          raw:
            typeof item.value === "string"
              ? item.value.slice(0, 1500)
              : item.value,
          smartHost:
            parseSmartHost(item.value),
        };
        continue;
      }

      if (key === "4/10") {
        try {
          snapshot[key] =
            typeof item.value === "string"
              ? JSON.parse(item.value)
              : item.value;
        } catch {
          snapshot[key] =
            String(item.value).slice(0, 2000);
        }
        continue;
      }

      snapshot[key] = item.value;
    }

    console.log(
      `NATIVE PROFILE SNAPSHOT ${label}: ` +
      JSON.stringify(snapshot)
    );

    return snapshot;
  } catch (err) {
    console.log(
      `NATIVE PROFILE SNAPSHOT ${label} unavailable: ` +
      `${err?.message || err}`
    );

    return {
      error:
        err?.message ||
        String(err),
    };
  }
}

async function writeBestEffort(
  siid,
  piid,
  value,
  label
) {
  try {
    const result =
      await client.setProperties(
        String(device.did),
        [{ siid, piid, value }],
        { timeoutMs: 10000 }
      );

    console.log(
      `${label}: ${JSON.stringify(result)}`
    );
  } catch (err) {
    if (isNoAck(err)) {
      console.log(
        `${label}: no HTTP ACK; continuing with runtime verification.`
      );
      return;
    }

    throw err;
  }
}

async function tryReadPackedCleaningMode() {
  const cached = Number(vacuum.state?.cleaningModeRaw);
  if (Number.isFinite(cached)) {
    observed.cleanModePacked = cached;
    observed.cleanMode = cached & 3;
    console.log(`Packed mode from cached state: ${cached}`);
    return cached;
  }

  try {
    const result = await client.getProperties(
      String(device.did),
      [{ siid: 4, piid: 23 }],
      { timeoutMs: 10000 }
    );

    const prop = (result || []).find(
      (x) => Number(x?.siid) === 4 && Number(x?.piid) === 23
    );
    const value = Number(prop?.value);
    if (Number.isFinite(value)) {
      observed.cleanModePacked = value;
      observed.cleanMode = value & 3;
      console.log(`Packed mode from direct read: ${value}`);
      return value;
    }
  } catch (err) {
    console.log(
      `Packed mode read unavailable: ${err?.message || err}`
    );
  }

  return null;
}

function encodeVacuumForLiftableMop(raw) {
  // Current Tasshack/ioBroker logic for self-wash + liftable mop devices:
  // display Vacuum=0 is encoded as wire low bits 2. Preserve every upper bit.
  const base = Number.isFinite(Number(raw)) ? (Number(raw) >>> 0) : 0;
  return ((base & ~3) | 2) >>> 0;
}

async function cancelWrongMode(reason) {
  console.log(
    `NATIVE REPLAY SAFETY CANCEL: ${reason}`
  );

  try {
    await vacuum.cancelCurrentJob();
  } catch (err) {
    console.log(
      `cancelCurrentJob: ${err?.message || err}`
    );
  }

  await sleep(700);

  try {
    await vacuum.goHome();
  } catch (err) {
    console.log(
      `goHome: ${err?.message || err}`
    );
  }
}

function waitForNativeVacuumMode(
  timeoutMs = 90000,
  stableMs = 8000,
  state12GraceMs = 12000
) {
  return new Promise((resolve) => {
    let settled = false;
    let state1Since = null;
    let state12Since = null;
    const startedAt = Date.now();

    const timer = setInterval(() => {
      if (settled) return;

      const state = observed.miotState;

      // These states were absent from the user's real Dreamehome
      // vacuum-only capture and are directly mop/dock related.
      if (state === 9 || state === 17 || state === 20) {
        finish({
          kind: "wrong-mode",
          reason: `mop-related-state-${state}`,
        });
        return;
      }

      if (state === 12) {
        state1Since = null;
        if (state12Since === null) {
          state12Since = Date.now();
          console.log(
            `X40 REPLAY MiotState=12; allowing ${state12GraceMs}ms transition grace.`
          );
        }
        if (Date.now() - state12Since >= state12GraceMs) {
          finish({
            kind: "wrong-mode",
            reason: "persistent-state-12",
          });
        }
        return;
      }

      state12Since = null;

      if (state === 1) {
        if (state1Since === null) {
          state1Since = Date.now();
          console.log(
            `X40 REPLAY MiotState=1; requiring ${stableMs}ms stability.`
          );
        }
        if (Date.now() - state1Since >= stableMs) {
          finish({
            kind: "verified",
            reason: "stable-native-vacuum-state",
            stableMs,
          });
        }
        return;
      }

      state1Since = null;

      if (Date.now() - startedAt >= timeoutMs) {
        finish({
          kind: "timeout",
          reason: "native-vacuum-state-not-observed",
        });
      }
    }, 250);

    function finish(result) {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      resolve({
        ...result,
        observed: {
          ...observed,
          stateSequence: [...stateSequence],
          packedSequence: [...packedSequence],
        },
      });
    }
  });
}


console.log(
  `Device: ${device.name} | ${device.model}`
);

console.log(
  "=== X40 EXACT VACUUM REPLAY v24 ==="
);

console.log(
  JSON.stringify(
    {
      roomId: 7,
      roomName: "חדר שינה ראשי 2",
      strategy: [
        "CustomizedCleaning=0",
        "SmartHost=0",
        "Suction 4/4=2",
        "Wetness 28/1=16",
        "Packed CleaningMode 4/23: Vacuum display 0 -> wire low bits 2",
        "CleanRoute=1",
        "150ms between pre-start writes",
        "RAW START_CUSTOM selects [[7,1,2,0,1]]",
        "NO node-dreame cleanSegments helper",
        "Require stable MiotState=1",
      ],
    },
    null,
    2
  )
);

const initialState =
  Number(
    vacuum.state?.miotStateRaw
  );

if (
  Number.isFinite(initialState) &&
  ![2, 6, 8, 13].includes(initialState)
) {
  throw new Error(
    `Robot is not idle/docked (MiotState=${initialState})`
  );
}

await postEvent("started", {
  device: {
    name: device.name,
    model: device.model,
  },
  profile: {
    roomId: 7,
    roomName:
      "חדר שינה ראשי 2",
    expectedMiotState: 1,
    expectedSmartHost: 0,
    expectedMopPadInstalled: 0,
  },
});

try {
  const currentPacked =
    await tryReadPackedCleaningMode();

  const vacuumPacked =
    encodeVacuumForLiftableMop(currentPacked);

  console.log(
    `X40 PACKED MODE current=${currentPacked ?? "unknown"} ` +
    `-> vacuumRaw=${vacuumPacked} lowBits=${vacuumPacked & 3}`
  );

  // Disable stored per-room mop settings for this test. Then re-send the
  // next-job properties immediately before the raw START_CUSTOM command.
  await writeBestEffort(4, 26, 0, "CustomizedCleaning=0");
  await sleep(150);

  await writeBestEffort(
    4, 50,
    JSON.stringify({ k: "SmartHost", v: 0 }),
    "SmartHost=0"
  );
  await sleep(150);

  await writeBestEffort(4, 4, 2, "Suction=2");
  await sleep(150);

  // X40 uses the 1..32 wetness property. The current X40 reference
  // implementation re-sends it before custom room starts even for Vacuum.
  await writeBestEffort(28, 1, 16, "Wetness=16");
  await sleep(150);

  // Important: on liftable-mop devices display Vacuum=0 maps to wire
  // low bits=2. Preserve any existing upper compound bits.
  await writeBestEffort(
    4, 23, vacuumPacked,
    `CleaningModePacked=${vacuumPacked} (display Vacuum)`
  );
  await sleep(150);

  await writeBestEffort(
    4, 50,
    JSON.stringify({ k: "CleanRoute", v: 1 }),
    "CleanRoute=1"
  );
  await sleep(150);

  const payload = JSON.stringify({
    selects: [[7, 1, 2, 0, 1]],
  });

  console.log(
    `RAW START_CUSTOM payload=${payload}`
  );

  const verifyPromise =
    waitForNativeVacuumMode();

  try {
    const result = await client.callAction(
      String(device.did),
      {
        siid: 4,
        aiid: 1,
        in: [
          { piid: 1, value: 18 },
          { piid: 10, value: payload },
        ],
      },
      { timeoutMs: 20000 }
    );

    console.log(
      `RAW START_CUSTOM ACK: ${JSON.stringify(result)}`
    );
  } catch (err) {
    if (isNoAck(err)) {
      console.log(
        "RAW START_CUSTOM: no HTTP ACK; waiting for MQTT state."
      );
    } else {
      throw err;
    }
  }

  const verification = await verifyPromise;

  console.log(
    "X40 EXACT REPLAY RESULT: " +
    JSON.stringify(verification)
  );

  if (verification.kind !== "verified") {
    await cancelWrongMode(
      verification.reason || verification.kind
    );

    await postEvent("failed", {
      error:
        "X40 exact replay did not enter verified vacuum-only mode",
      verification,
      command: {
        packedBefore: currentPacked,
        packedVacuum: vacuumPacked,
        startPayload: payload,
      },
    });

    process.exitCode = 2;
  } else {
    await postEvent("verified", {
      verification,
      command: {
        packedBefore: currentPacked,
        packedVacuum: vacuumPacked,
        startPayload: payload,
      },
      note:
        "X40 exact replay verified stable MiotState=1. Robot left running.",
    });

    console.log(
      "✅ X40 EXACT REPLAY VERIFIED: stable MiotState=1."
    );
  }

} catch (err) {
  console.error(
    err?.stack ||
    err?.message ||
    err
  );

  await postEvent("failed", {
    error:
      err?.message ||
      String(err),
    observed: {
      ...observed,
      stateSequence:
        [...stateSequence],
    },
  }).catch(() => {});

  process.exitCode = 1;
} finally {
  await rawSub.close().catch(() => {});
  await vacuum.unwatch().catch(() => {});
}
