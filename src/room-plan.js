function maybeJson(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}

function uniqInts(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0)
  )];
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
      suction: Math.max(0, Math.min(3, Number(item?.suction ?? 2))),
      repeats: Math.max(1, Math.min(3, Number(item?.repeats ?? 1))),
    });
  }
  return out.length ? out : fallback;
}

export function defaultWeeklyPlan(roomProfiles = []) {
  const rooms = roomProfiles.filter((r) => r.enabled !== false).map((r) => r.id);
  const result = {};
  for (let day = 1; day <= 7; day += 1) {
    result[String(day)] = { enabled: true, rooms: [...rooms] };
  }
  return result;
}

export function normalizeWeeklyPlan(raw, roomProfiles = []) {
  const parsed = maybeJson(raw);
  const fallback = defaultWeeklyPlan(roomProfiles);
  const source =
    parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed :
    raw && typeof raw === "object" && !Array.isArray(raw) ? raw :
    fallback;
  const valid = new Set(roomProfiles.map((r) => r.id));
  const out = {};

  for (let day = 1; day <= 7; day += 1) {
    const key = String(day);
    const item = source[key] || fallback[key];
    out[key] = {
      enabled: item?.enabled !== false,
      rooms: uniqInts(item?.rooms).filter((id) => valid.has(id)),
    };
  }
  return out;
}

export function resolveDayPlan(roomProfiles, weeklyPlan, weekday) {
  const day = weeklyPlan?.[String(weekday)];
  if (!day || day.enabled === false) return [];
  const byId = new Map(
    roomProfiles.filter((r) => r.enabled !== false).map((r) => [r.id, r])
  );
  return (day.rooms || [])
    .map((id) => byId.get(Number(id)))
    .filter(Boolean)
    .map((r) => ({
      id: r.id,
      name: r.name,
      mode: r.mode,
      geniusMode: r.geniusMode,
      suction: r.suction,
      repeats: r.repeats,
    }));
}

export function validateRoomProfiles(value) {
  if (!Array.isArray(value)) throw new Error("roomProfiles must be an array");
  const out = normalizeRoomProfiles(value, []);
  if (!out.length || out.length !== value.length) {
    throw new Error("Invalid or duplicate room profiles");
  }
  return out;
}

export function validateWeeklyPlan(value, roomProfiles) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("weeklyPlan must be an object");
  }
  const valid = new Set(roomProfiles.map((r) => r.id));
  const out = {};
  for (let day = 1; day <= 7; day += 1) {
    const key = String(day);
    const item = value[key] || { enabled: false, rooms: [] };
    if (!Array.isArray(item.rooms)) throw new Error(`weeklyPlan.${key}.rooms invalid`);
    const rooms = uniqInts(item.rooms);
    if (rooms.some((id) => !valid.has(id))) throw new Error(`weeklyPlan.${key} unknown room`);
    out[key] = { enabled: item.enabled !== false, rooms };
  }
  return out;
}
