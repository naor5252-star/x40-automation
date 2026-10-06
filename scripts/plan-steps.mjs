export function buildPhases(plan) {
  const phases = [];

  for (const room of plan) {
    const normalized = {
      stepId: room.stepId || `legacy-${phases.length + 1}-${room.id}`,
      id: Number(room.id),
      name: String(room.name || `חדר ${room.id}`),
      mode:
        String(room.mode).toLowerCase() === "vacuum"
          ? "vacuum"
          : "cleangenius",
      geniusMode:
        String(room.geniusMode) === "2" ? "2" : "1",
      suction: Math.max(
        0,
        Math.min(3, Number(room.suction ?? 2))
      ),
      repeats: Math.max(
        1,
        Math.min(3, Number(room.repeats ?? 1))
      ),
    };

    if (
      !Number.isInteger(normalized.id) ||
      normalized.id <= 0
    ) {
      throw new Error("Invalid room in step sequence");
    }

    phases.push({
      stepId: normalized.stepId,
      mode: normalized.mode,
      geniusMode: normalized.geniusMode,
      suction: normalized.suction,
      repeats: normalized.repeats,
      rooms: [normalized],
    });
  }

  return phases;
}
