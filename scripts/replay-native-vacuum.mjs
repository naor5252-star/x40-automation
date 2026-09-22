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
  smartHost: null,
  mopPadInstalled: null,
  taskStatus: null,
};

const stateSequence = [];

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
        observed.cleanMode =
          packed & 0x3;
        console.log(
          `NATIVE REPLAY CleanMode=${observed.cleanMode} packed=${packed}`
        );
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
        observed.mopPadInstalled = n;
        console.log(
          `NATIVE REPLAY MopPadInstalled=${n}`
        );
      }
    }
  }
});

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
  state12GraceMs = 15000
) {
  return new Promise((resolve) => {
    let settled = false;
    let state1Since = null;
    let state12Since = null;

    const startedAt = Date.now();

    const timer = setInterval(() => {
      if (settled) return;

      const state =
        observed.miotState;

      if (
        observed.cleanMode === 2
      ) {
        finish({
          kind: "wrong-mode",
          reason: "clean-mode-2",
        });
        return;
      }

      if (
        observed.mopPadInstalled === 1
      ) {
        finish({
          kind: "wrong-mode",
          reason: "mop-pad-installed",
        });
        return;
      }

      if (state === 17) {
        finish({
          kind: "wrong-mode",
          reason: "return-install-mop",
        });
        return;
      }

      if (state === 12) {
        state1Since = null;

        if (state12Since === null) {
          state12Since = Date.now();
        }

        if (
          Date.now() - state12Since >=
          state12GraceMs
        ) {
          finish({
            kind: "wrong-mode",
            reason:
              "persistent-vacuum-and-mop",
          });
        }

        return;
      }

      state12Since = null;

      if (state === 1) {
        if (state1Since === null) {
          state1Since = Date.now();
        }

        if (
          Date.now() - state1Since >=
          stableMs
        ) {
          finish({
            kind: "verified",
            reason:
              "stable-native-vacuum-state",
            stableMs,
          });
        }

        return;
      }

      state1Since = null;

      if (
        Date.now() - startedAt >= timeoutMs
      ) {
        finish({
          kind: "timeout",
          reason:
            "native-vacuum-state-not-observed",
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
          stateSequence:
            [...stateSequence],
        },
      });
    }
  });
}

console.log(
  `Device: ${device.name} | ${device.model}`
);

console.log(
  "=== NATIVE VACUUM REPLAY PROFILE ==="
);

console.log(
  JSON.stringify(
    {
      roomId: 7,
      roomName:
        "חדר שינה ראשי 2",
      capturedReference: {
        miotState: 1,
        smartHost: 0,
        mopPadInstalled: 0,
        taskStatus: 18,
      },
      replayStrategy: [
        "CustomizedCleaning=0",
        "SmartHost=0",
        "CleanMode=0",
        "NO AutoMountMop write",
        "START_CUSTOM selected-room via cleanSegments([7])",
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
  // Match the native run's effective configuration, but deliberately
  // do NOT touch 4/45 AutoMountMop. The native capture never changed it.
  await writeBestEffort(
    4,
    26,
    0,
    "CustomizedCleaning=0"
  );

  await sleep(250);

  await writeBestEffort(
    4,
    50,
    JSON.stringify({
      k: "SmartHost",
      v: 0,
    }),
    "SmartHost=0"
  );

  await sleep(250);

  await writeBestEffort(
    2,
    6,
    0,
    "CleanMode=0 (Sweeping)"
  );

  await sleep(800);

  console.log(
    "Starting native-profile replay for room 7. " +
    "No AutoMountMop command is being sent."
  );

  // Arm verification BEFORE the command so the first state=1 push
  // cannot be missed.
  const verifyPromise =
    waitForNativeVacuumMode();

  const result =
    await vacuum.cleanSegments(
      [7],
      {
        repeats: 1,
        fan: 2,
      }
    );

  console.log(
    `NATIVE REPLAY cleanSegments result: ${JSON.stringify(result)}`
  );

  const verification =
    await verifyPromise;

  console.log(
    "NATIVE REPLAY RESULT: " +
    JSON.stringify(
      verification
    )
  );

  if (
    verification.kind !==
    "verified"
  ) {
    await cancelWrongMode(
      verification.reason ||
      verification.kind
    );

    await postEvent("failed", {
      error:
        "Replay did not enter verified vacuum-only mode",
      verification,
    });

    process.exitCode = 2;
  } else {
    await postEvent("verified", {
      verification,
      note:
        "Robot left running. Replay verified stable MiotState=1.",
    });

    console.log(
      "✅ Native-profile replay verified: stable MiotState=1."
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
}
