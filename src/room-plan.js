function maybeJson(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}

export function buildDefaultRoomProfiles(roomIdsText, labelsText, geniusMode = "1") {
  const ids = String(roomIdsText || "2,3,4,7,8")
    .split(",").map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  const labels = String(labelsText || "").split(",").map((x) => x.trim());

  return ids.map((id, i) => ({
    id,
    name: labels[i] || `חדר ${id}`,
    enabled: true,
    mode: "cleangenius",
    geniusMode: String(geniusMode) === "2" ? "2" : "1",
    suction: 2,
    repeats: 1,
  }));
}

export function normalizeRoomProfiles(raw, fallback = []) {
  const parsed = maybeJson(raw);
  const source = Array.isArray(parsed) ? parsed :
    Array.isArray(raw) ? raw : fallback;
  const seen = new Set();
  const out = [];

  for (const item of source || []) {
    const id = Number(item?.id);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: String(item?.name || `חדר ${id}`).trim().slice(0, 100),
      enabled: item?.enabled !== false,
      mode: String(item?.mode).toLowerCase() === "vacuum" ? "vacuum" : "cleangenius",
      geniusMode: String(item?.geniusMode) === "2" ? "2" : "1",
      suction: boundedInt(item?.suction ?? 2, 0, 3, 2),
      repeats: boundedInt(item?.repeats ?? 1, 1, 3, 1),
    });
  }
  return out.length ? out : fallback;
}

const STEP_ID = /^[A-Za-z0-9_-]{1,80}$/;
export const MAX_STEPS_PER_DAY = 60;

function stepFromRoom(room, day, index, value = {}) {
  return {
    stepId: String(value.stepId || `day-${day}-step-${index + 1}`),
    roomId: room.id,
    mode: value.mode === "vacuum" ? "vacuum" : value.mode === "cleangenius" ? "cleangenius" : room.mode,
    geniusMode: String(value.geniusMode ?? room.geniusMode) === "2" ? "2" : "1",
    suction: boundedInt(value.suction ?? room.suction, 0, 3, 2),
    repeats: boundedInt(value.repeats ?? room.repeats, 1, 3, 1),
  };
}

function boundedInt(value, low, high, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(low, Math.min(high, Math.round(n))) : fallback;
}

export function defaultWeeklyPlan(roomProfiles = []) {
  const rooms = roomProfiles.filter((r) => r.enabled !== false);
  const result = {};
  for (let day = 1; day <= 7; day += 1) {
    result[String(day)] = { enabled: true, steps: rooms.map((r, i) => stepFromRoom(r, day, i)) };
  }
  return result;
}

export function normalizeWeeklyPlan(raw, roomProfiles = []) {
  const parsed = maybeJson(raw);
  const fallback = defaultWeeklyPlan(roomProfiles);
  const source = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  const byId = new Map(roomProfiles.map((r) => [r.id, r]));
  const out = {};
  for (let day = 1; day <= 7; day += 1) {
    const key = String(day);
    const item = source[key] || fallback[key];
    // Convert old room lists without sorting or de-duplicating occurrences.
    const values = Array.isArray(item.steps) ? item.steps :
      (Array.isArray(item.rooms) ? item.rooms : []).map((roomId) => ({ roomId }));
    const seen = new Set();
    const steps = [];
    values.forEach((value, i) => {
      const room = byId.get(Number(value?.roomId));
      if (!room) return;
      const step = stepFromRoom(room, key, i, value);
      if (!STEP_ID.test(step.stepId) || seen.has(step.stepId)) step.stepId = `day-${key}-migrated-${i + 1}`;
      while (seen.has(step.stepId)) step.stepId += "x";
      seen.add(step.stepId);
      steps.push(step);
    });
    out[key] = { enabled: item.enabled !== false, steps };
  }
  return out;
}

export function resolveDayPlan(roomProfiles, weeklyPlan, weekday) {
  const day = normalizeWeeklyPlan(weeklyPlan, roomProfiles)[String(weekday)];
  if (!day || day.enabled === false) return [];
  const byId = new Map(roomProfiles.filter((r) => r.enabled !== false).map((r) => [r.id, r]));
  return day.steps.filter((s) => byId.has(s.roomId)).map((s) => ({
    id: s.roomId, name: byId.get(s.roomId).name,
    stepId: s.stepId, mode: s.mode, geniusMode: s.geniusMode, suction: s.suction, repeats: s.repeats,
  }));
}

export function validateRoomProfiles(value) {
  if (!Array.isArray(value)) throw new Error("roomProfiles must be an array");
  const out = normalizeRoomProfiles(value, []);
  if (!out.length || out.length !== value.length) throw new Error("Invalid or duplicate room profiles");
  return out;
}

export function validateWeeklyPlan(value, roomProfiles) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("weeklyPlan must be an object");
  const valid = new Set(roomProfiles.map((r) => r.id));
  for (let day = 1; day <= 7; day += 1) {
    const item = value[String(day)];
    if (!item) continue;
    const steps = "steps" in item ? item.steps :
      Array.isArray(item.rooms) ? item.rooms.map((roomId) => ({ roomId })) : null;
    if (!Array.isArray(steps)) throw new Error(`weeklyPlan.${day}.steps must be an array`);
    if (steps.length > MAX_STEPS_PER_DAY) throw new Error(`ניתן לשמור עד ${MAX_STEPS_PER_DAY} שלבים ביום`);
    const seen = new Set();
    for (const step of steps) {
      if (!step || !Number.isInteger(Number(step.roomId)) || !valid.has(Number(step.roomId))) {
        throw new Error(`weeklyPlan.${day} unknown room`);
      }
      if ("steps" in item) {
        if (typeof step.stepId !== "string" || !STEP_ID.test(step.stepId) || seen.has(step.stepId)) {
          throw new Error(`weeklyPlan.${day} invalid or duplicate stepId`);
        }
        seen.add(step.stepId);
        if (!["vacuum", "cleangenius"].includes(step.mode)) throw new Error("Invalid step cleaning mode");
        if (!["1", "2"].includes(String(step.geniusMode))) throw new Error("Invalid step CleanGenius depth");
        for (const [key, low, high] of [["suction",0,3],["repeats",1,3]]) {
          if (!Number.isInteger(Number(step[key])) || Number(step[key]) < low || Number(step[key]) > high) {
            throw new Error(`Invalid step ${key}`);
          }
        }
      }
    }
  }
  // Keep the old API convention: omitted days are disabled, not auto-filled.
  const complete = {};
  for (let day = 1; day <= 7; day += 1) complete[day] = value[day] || { enabled: false, steps: [] };
  return normalizeWeeklyPlan(complete, roomProfiles);
}
