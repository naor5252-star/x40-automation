import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeWeeklyPlan, resolveDayPlan, validateWeeklyPlan } from '../src/room-plan.js';
import { initialStepProgress, applyStepEvent, resolveStepResume, interruptedStepState } from '../src/step-progress.js';
import { buildPhases } from '../scripts/plan-steps.mjs';
import { PresenceState } from '../src/index.js';
const profiles = [
  {id:7,name:'סלון',mode:'vacuum',suction:2,repeats:1,geniusMode:'1'},
  {id:1,name:'מטבח',mode:'cleangenius',geniusMode:'1',suction:1,repeats:2},
  {id:2,name:'חדר שינה',mode:'vacuum',suction:1,repeats:2,geniusMode:'1'},
];
const steps=[
  {stepId:'salon-vacuum',roomId:7,mode:'vacuum',geniusMode:'1',suction:2,repeats:1},
  {stepId:'kitchen-routine',roomId:1,mode:'cleangenius',geniusMode:'1',suction:1,repeats:1},
  {stepId:'salon-deep',roomId:7,mode:'cleangenius',geniusMode:'2',suction:3,repeats:1},
  {stepId:'bedroom-vacuum',roomId:2,mode:'vacuum',geniusMode:'1',suction:1,repeats:2},
  {stepId:'kitchen-vacuum',roomId:1,mode:'vacuum',geniusMode:'1',suction:2,repeats:1},
];
const weekly=validateWeeklyPlan({'1':{enabled:true,steps}},profiles);
const plan=resolveDayPlan(profiles,weekly,1);
function stateFixture() {
 const values=new Map();
 const ctx={storage:{get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v))}};
 const state=new PresenceState(ctx,{});
 state.localNow=()=>({date:'2026-10-05',weekday:1,time:'11:00',minuteOfDay:660});
 state.runtimeSettings={roomProfiles:profiles,weeklyPlan:weekly,maxRunsPerDay:3,startTime:'10:00',endTime:'15:00',awayDelayMinutes:0,dryRun:false};
 const get=()=>values.get('runInfo');
 const put=(v)=>values.set('runInfo',structuredClone(v));
 const seed={date:'2026-10-05',active:true,count:1,lastRunAt:new Date().toISOString(),callbackToken:'test-run-token',roomPlan:plan,originalRoomPlan:plan,...initialStepProgress(plan)};
 put(seed);
 state.dispatchGitHub=async(mode,source,extra)=>({mode,source,extra});
 state.syncElectraPresenceSafe=async()=>{};
 return {state,values,get,put,seed};
}
async function callback(f,event,index,token='test-run-token',extra={}) {
 const details=index===undefined?extra:{phaseIndex:index,stepId:f.get().roomPlan[index]?.stepId,roomIds:[f.get().roomPlan[index]?.id],...extra};
 return f.state.handleRunEvent(new Request('https://fixture.test/run-event',{method:'POST',headers:{'Content-Type':'application/json','X-Run-Callback-Token':token},body:JSON.stringify({event,details})}));
}
test('migration preserves room order and profiles across all seven days',()=>{
 const old={'1':{enabled:true,rooms:[7,1,2]},'2':{enabled:false,rooms:[1,7]},'3':{enabled:true,rooms:[]}};
 const migrated=normalizeWeeklyPlan(old,profiles);
 assert.deepEqual(migrated['1'].steps.map(s=>s.roomId),[7,1,2]);
 assert.deepEqual(resolveDayPlan(profiles,migrated,1).map(s=>[s.id,s.mode,s.suction,s.repeats]),[[7,'vacuum',2,1],[1,'cleangenius',1,2],[2,'vacuum',1,2]]);
 assert.deepEqual(resolveDayPlan(profiles,migrated,2),[]);
 assert.deepEqual(resolveDayPlan(profiles,migrated,3),[]);
 assert.equal(Object.keys(migrated).length,7);
 assert.deepEqual(normalizeWeeklyPlan(migrated,profiles),migrated);
});
test('old repeated room entries are not lost during migration',()=>{
 assert.deepEqual(normalizeWeeklyPlan({'1':{rooms:[7,1,7]}},profiles)['1'].steps.map(s=>s.roomId),[7,1,7]);
});
test('five occurrences execute as five isolated phases in the exact order',()=>{
 const phases=buildPhases(plan);
 assert.deepEqual(phases.map(p=>p.rooms[0].id),[7,1,7,2,1]);
 assert.deepEqual(phases.map(p=>p.stepId),steps.map(s=>s.stepId));
 assert.equal(phases[0].mode,'vacuum'); assert.equal(phases[2].mode,'cleangenius');assert.equal(phases[2].geniusMode,'2');
 const same=buildPhases([plan[0],{...plan[0],stepId:'second-pass'}]);assert.equal(same.length,2);
});
test('validation rejects unknown rooms, duplicate step IDs, invalid settings and excessive plans',()=>{
 for (const change of [{roomId:999},{stepId:'invalid value'},{mode:'mop'},{suction:NaN},{suction:1.5},{repeats:4}]) {
  assert.throws(()=>validateWeeklyPlan({'1':{steps:[{...steps[0],...change}]}},profiles));
 }
 assert.throws(()=>validateWeeklyPlan({'1':{steps:[steps[0],steps[0]]}},profiles));
 assert.throws(()=>validateWeeklyPlan({'1':{steps:Array.from({length:61},(_,i)=>({...steps[0],stepId:'s'+i}))}},profiles));
});
test('an interrupted third step resumes the second occurrence of the salon with its own settings',async()=>{
 const f=stateFixture();
 for(const i of [0,1]) {assert.equal((await callback(f,'plan-phase-started',i)).status,200);assert.equal((await callback(f,'plan-phase-completed',i)).status,200);}
 await callback(f,'plan-phase-started',2);
 assert.equal(f.get().currentStepId,'salon-deep');
 const stopped=await f.state.stopIfActive('wife');assert.equal(stopped.action,'stop_and_dock_dispatched');
 assert.equal(f.get().resumeStepId,'salon-deep');
 const resume=resolveStepResume(plan,f.get());
 assert.deepEqual(resume.roomPlan.map(s=>s.stepId),['salon-deep','bedroom-vacuum','kitchen-vacuum']);
 assert.equal(resume.roomPlan[0].geniusMode,'2');
 const late=await callback(f,'plan-phase-completed',2);assert.equal(late.status,409);assert.equal(f.get().resumeStepId,'salon-deep');
});
test('multiple stop/resume cycles preserve original occurrence identities and settings',async()=>{
 const f=stateFixture();await callback(f,'plan-phase-started',0);await callback(f,'plan-phase-completed',0);
 const partial={...f.get(),...interruptedStepState(f.get()),active:false};
 f.put(partial);let sent;
 f.state.dispatchGitHub=async(mode,source,extra)=>{sent=extra;return {ok:true};};
 await f.state.forceRunNow();
 assert.deepEqual(sent.roomPlan.map(s=>s.stepId),steps.slice(1).map(s=>s.stepId));
 const token=f.get().callbackToken;
 await callback(f,'plan-phase-started',0,token);await callback(f,'plan-phase-completed',0,token);
 await callback(f,'plan-phase-started',1,token);await f.state.stopIfActive('wife');
 assert.equal(f.get().resumeStepId,'salon-deep');
 assert.deepEqual(resolveStepResume(plan,f.get()).roomPlan.map(s=>s.stepId),steps.slice(2).map(s=>s.stepId));
});
test('resume uses a frozen snapshot after the saved plan is edited or reordered',()=>{
 const saved={resumePending:true,resumeStepId:'salon-deep',originalRoomPlan:plan};
 const edited=[{...plan[4],mode:'cleangenius'},plan[0]];
 const r=resolveStepResume(edited,saved);assert.deepEqual(r.roomPlan,plan.slice(2));
});
test('completion between rooms resumes the next step, not the finished room',async()=>{
 const f=stateFixture();await callback(f,'plan-phase-started',0);await callback(f,'plan-phase-completed',0);
 await f.state.stopIfActive('naor');assert.equal(f.get().resumeStepId,'kitchen-routine');
});
test('out-of-order, mismatched and delayed callbacks cannot skip or rewind steps',async()=>{
 const f=stateFixture();
 assert.equal((await callback(f,'plan-phase-started',2)).status,409);
 assert.equal((await callback(f,'plan-phase-started',0,'test-run-token',{stepId:'salon-deep'})).status,409);
 assert.equal((await callback(f,'plan-phase-completed',0)).status,409);
 await callback(f,'plan-phase-started',0);await callback(f,'plan-phase-completed',0);
 const cursor=f.get().resumeCursorStepId;
 const duplicate=await callback(f,'plan-phase-completed',0);assert.equal(duplicate.status,200);assert.equal(f.get().resumeCursorStepId,cursor);
 assert.equal((await callback(f,'plan-phase-started',0)).status,409);
 assert.equal((await callback(f,'plan-completed')).status,409);
});
test('only after all five physical completions is the overall plan complete',async()=>{
 const f=stateFixture();for(let i=0;i<5;i++){await callback(f,'plan-phase-started',i);await callback(f,'plan-phase-completed',i);}
 assert.equal((await callback(f,'plan-completed')).status,200);
 assert.equal(f.get().active,false);assert.equal(f.get().planCompletedInCycle,true);assert.equal(f.get().resumeStepId,null);
 assert.equal((await callback(f,'plan-completed')).status,200);
});
test('token and active-state checks reject stale runs',async()=>{
 const f=stateFixture();assert.equal((await callback(f,'plan-phase-started',0,'wrong-token')).status,401);
 f.put({...f.get(),date:'2026-10-04'});assert.equal((await callback(f,'plan-phase-started',0)).status,409);
});
test('new date discards the interrupted cursor, including HOME/AWAY transition across midnight',async()=>{
 const f=stateFixture();
 const old={...f.get(),date:'2026-10-04',active:false,resumePending:true,resumeStepId:'salon-deep',resumeRoomId:7,presenceResetArmed:true};
 const reset=f.state.normalizeRunInfoForToday(old,f.state.localNow());
 assert.equal(reset.resumeStepId,null);assert.equal(resolveStepResume(plan,reset).resuming,false);
 f.put(old);f.values.set('presence:wife',{state:'home'});f.state.checkAndMaybeRun=async()=>({action:'none'});
 await f.state.updatePresence('wife','away','fixture');assert.equal(f.get().resumeStepId,null);assert.equal(f.get().resumePending,false);
});
test('old v28 unique-room resume migrates safely',()=>{
 const old={resumePending:true,resumeRoomId:1,originalRoomPlan:[plan[0],plan[1],plan[3]].map(({stepId,...s})=>s)};
 assert.equal(resolveStepResume(plan,old).roomPlan[0].id,1);
 const ambiguous={resumePending:true,resumeRoomId:7,originalRoomPlan:plan.map(({stepId,...s})=>s)};
 assert.equal(resolveStepResume(plan,ambiguous).invalidResume,true);
});
test('manual and automatic dispatch register callback state before launching a job',async()=>{
 for(const mode of ['manual','automatic']) {
  const f=stateFixture();f.put({...f.get(),active:false,count:0});
  f.values.set('presence:naor',{state:'away',updatedAt:new Date(Date.now()-1000).toISOString()});
  f.values.set('presence:wife',{state:'away',updatedAt:new Date(Date.now()-1000).toISOString()});
  f.state.dispatchGitHub=async(m,source,extra)=>{
   assert.equal(f.get().active,true);assert.equal(f.get().callbackToken,extra.callbackToken);
   assert.equal((await callback(f,'plan-phase-started',0,extra.callbackToken)).status,200);
   return {ok:true};
  };
  if(mode==='manual') await f.state.forceRunNow(); else await f.state.checkAndMaybeRun('fixture');
  assert.equal(f.get().currentStepId,'salon-vacuum');
 }
});
test('dispatch failure preserves the interrupted cursor and does not consume an attempt',async()=>{
 const f=stateFixture();f.put({...f.get(),active:false,resumePending:true,resumeStepId:'salon-deep',count:1});
 f.state.dispatchGitHub=async()=>{throw new Error('fixture failure');};
 const r=await f.state.forceRunNow();assert.equal(r.action,'github_dispatch_failed');assert.equal(f.get().count,1);assert.equal(f.get().resumeStepId,'salon-deep');
});
test('wife-only days retain their existing presence policy',async()=>{
 const f=stateFixture();f.put({...f.get(),presenceMode:'wife_only'});
 assert.equal((await f.state.stopIfActive('naor')).action,'return_home_ignored_wife_only_day');assert.equal(f.get().active,true);
});
test('an in-flight v28 run can migrate its completed prefix during deployment',async()=>{
 const f=stateFixture();const legacy=structuredClone(f.seed);
 for(const k of ['resumeStepId','resumeCursorStepId','currentStepId','completedStepIds']) delete legacy[k];
 legacy.roomPlan=legacy.roomPlan.slice(0,3).map(({stepId,...s})=>s);
 legacy.originalRoomPlan=legacy.roomPlan;
 legacy.planProgress={event:'plan-phase-started',details:{phaseIndex:1}};
 legacy.currentRoomId=1;legacy.resumeCursorRoomId=1;
 f.put(legacy);
 const req=new Request('https://fixture.test/run-event',{method:'POST',headers:{'Content-Type':'application/json','X-Run-Callback-Token':'test-run-token'},body:JSON.stringify({event:'plan-phase-completed',details:{phaseIndex:1,roomIds:[1]}})});
 assert.equal((await f.state.handleRunEvent(req)).status,200);
 assert.equal(f.get().completedStepIds.length,2);
 assert.equal(f.get().resumeCursorStepId,'legacy-3-7');
});
