// Progress belongs to an occurrence of a room, never to the room itself.
export function withStepIds(plan = []) {
  return plan.map((room, index) => ({
    ...room,
    stepId: room.stepId || `legacy-${index + 1}-${room.id}`,
  }));
}

export function upgradeLegacyRunInfo(runInfo) {
  if (!runInfo || Array.isArray(runInfo.completedStepIds)) return runInfo;
  const original = withStepIds(runInfo.originalRoomPlan?.length ? runInfo.originalRoomPlan : runInfo.roomPlan || []);
  const rawPlan = runInfo.roomPlan || [];
  const offset = rawPlan.length ? original.findIndex((s) => Number(s.id) === Number(rawPlan[0].id)) : -1;
  const plan = rawPlan.map((room, i) => ({ ...room,
    stepId: room.stepId || original[offset + i]?.stepId || `legacy-${i + 1}-${room.id}` }));
  const progress = runInfo.planProgress || {};
  const index = Number(progress.details?.phaseIndex);
  const valid = Number.isInteger(index) && index >= 0 && index < plan.length;
  const started = valid && progress.event === 'plan-phase-started';
  const finished = valid && progress.event === 'plan-phase-completed';
  const completed = started ? index : finished ? index + 1 : 0;
  const cursor = plan[completed] || null;
  const resume = original.filter((s) => Number(s.id) === Number(runInfo.resumeRoomId));
  return { ...runInfo, originalRoomPlan: original, roomPlan: plan,
    completedStepIds: plan.slice(0, completed).map((s) => s.stepId),
    currentStepId: started ? plan[index].stepId : null,
    resumeCursorStepId: cursor?.stepId ?? null,
    resumeStepId: runInfo.resumePending && resume.length === 1 ? resume[0].stepId : null };
}

export function initialStepProgress(plan, previous = {}, resuming = false) {
  return {
    resumeStepId: resuming ? plan[0]?.stepId ?? null : null,
    resumeCursorStepId: plan[0]?.stepId ?? null,
    currentStepId: null,
    completedStepIds: resuming ? previous.completedStepIds || [] : [],
  };
}

export function resolveStepResume(defaultPlan, runInfo = {}) {
  const fallback = withStepIds(defaultPlan);
  const fresh = { roomPlan: fallback, originalRoomPlan: fallback,
    resuming: false, resumeStepId: null, resumeRoomId: null, resumeRoomName: null };
  if (!runInfo.resumePending) return fresh;
  const saved = withStepIds(runInfo.originalRoomPlan?.length
    ? runInfo.originalRoomPlan : runInfo.roomPlan?.length ? runInfo.roomPlan : fallback);
  const stepId = runInfo.resumeStepId || runInfo.resumeCursorStepId;
  let index = stepId ? saved.findIndex((s) => s.stepId === stepId) : -1;
  // An old v28 cursor is safe to migrate only if that room occurs once.
  if (!stepId) {
    const matches = saved.map((s, i) => Number(s.id) === Number(runInfo.resumeRoomId) ? i : -1)
      .filter((i) => i >= 0);
    if (matches.length === 1) index = matches[0];
  }
  if (index < 0) return { ...fresh, invalidResume: true };
  const room = saved[index];
  return { roomPlan: saved.slice(index), originalRoomPlan: saved, resuming: true,
    resumeStepId: room.stepId, resumeRoomId: room.id, resumeRoomName: room.name };
}

export function applyStepEvent(runInfo, event, details = {}) {
  const plan = withStepIds(runInfo.roomPlan || []);
  const completedIds = new Set(runInfo.completedStepIds || []);
  if (event === "plan-completed") {
    if (plan.some((s) => !completedIds.has(s.stepId))) return { ignored: "steps_not_completed" };
    return { progress: { currentStepId: null, resumeCursorStepId: null, resumeStepId: null,
      completedStepIds: [], resumePending: false }, room: null, nextRoom: null };
  }
  if (!['plan-phase-started', 'plan-phase-completed'].includes(event)) {
    return { progress: {} };
  }
  const index = details.phaseIndex;
  if (!Number.isInteger(index) || index < 0 || index >= plan.length) return { ignored: "invalid_step_index" };
  const room = plan[index];
  const roomId = details.roomIds?.[0] ?? details.roomId;
  if ((details.stepId && details.stepId !== room.stepId) || Number(roomId) !== Number(room.id)) {
    return { ignored: "step_identity_mismatch" };
  }
  const firstPending = plan.find((s) => !completedIds.has(s.stepId));
  // Duplicate and delayed callbacks must not move the cursor backwards.
  if (completedIds.has(room.stepId)) return { ignored: "step_already_completed" };
  if (firstPending?.stepId !== room.stepId) return { ignored: "out_of_order_step" };
  const starting = event === 'plan-phase-started';
  if (!starting && runInfo.currentStepId !== room.stepId) return { ignored: "step_not_started" };
  const nextRoom = starting ? room : plan[index + 1] || null;
  if (!starting) completedIds.add(room.stepId);
  return { room, nextRoom, progress: {
    currentStepId: starting ? room.stepId : null,
    resumeCursorStepId: nextRoom?.stepId ?? null,
    resumeStepId: runInfo.resumePending ? nextRoom?.stepId ?? null : runInfo.resumeStepId ?? null,
    completedStepIds: [...completedIds],
  } };
}

export function interruptedStepState(runInfo) {
  const saved = withStepIds(runInfo.originalRoomPlan?.length
    ? runInfo.originalRoomPlan : runInfo.roomPlan || []);
  const stepId = runInfo.resumeCursorStepId || runInfo.currentStepId;
  let room = stepId ? saved.find((s) => s.stepId === stepId) : null;
  if (!stepId) {
    const matches = saved.filter((s) => Number(s.id) === Number(runInfo.resumeCursorRoomId || runInfo.currentRoomId));
    if (matches.length === 1) room = matches[0];
  }
  return { resumePending: Boolean(room), resumeStepId: room?.stepId ?? null,
    resumeRoomId: room?.id ?? null, resumeRoomName: room?.name ?? null,
    originalRoomPlan: saved };
}
