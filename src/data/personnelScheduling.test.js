import test from 'node:test';
import assert from 'node:assert/strict';
import { createHrSeed, mergeHrOutputFacts } from './hrWorkspace.js';
import { ensureScheduling, reconcileScheduling, reduceScheduling, ownerAt, mergeSchedulingFacts, schedulingContext, staffingView, schedulingPersonDetails, calendarDays } from './personnelScheduling.js';
const day = '2026-11-17', w = 'pm-wang-ran', l = 'pm-lin-xiaotong', c = 'pm-chen-mo';
const p = 'hr-transfer-fulltime', intern = 'hr-transfer-intern', target = 'DEMO-TRANSFER-LXT-01', own = 'DEMO-TRANSFER-WR-01';
const seed = () => reconcileScheduling(createHrSeed(day), day);
let serial = 0;
const act = (s, type, payload, pmId = w, date = day, role = 'PM') => reduceScheduling(s, { role, pmId }, type, { requestId: 'test-' + ++serial, ...payload }, s.revision, date);
const last = s => s.scheduling.batches.at(-1).results[0];
const request = (s, kind = 'loan', start = day, end = '2026-11-19') => act(s, 'request.create', { personId: p, kind, start, end, targetId: target }, l);
const agree = (s, date = day) => act(s, 'request.decide', { id: s.scheduling.requests.at(-1).id, approve: true }, w, date);
const person = (s, id = p) => s.people.find(p => p.id === id);

test('migration preserves original relations, legacy records and is idempotent', () => {
  const s = seed(); assert.deepEqual(reconcileScheduling(s, day), s);
  assert.ok(s.scheduling.legacy.available.length); assert.equal(s.scheduling.requests.length, 0);
  assert.deepEqual(person(s).projectIds, [own]); assert.equal(s.scheduling.exceptions.length, 1);
});
test('publish, edit and withdraw preserve management and project links', () => {
  let s = seed(); s = act(s, 'release.publish', { personId: p, date: '2026-11-19' });
  assert.ok(last(s).success); assert.deepEqual(person(s).projectIds, [own]); assert.equal(ownerAt(s, p, day), w);
  s = act(s, 'release.withdraw', { personId: p }); assert.ok(last(s).success); assert.equal(s.scheduling.releases.find(r => r.personId === p).status, '已撤回');
});
test('partial batch keeps valid result and rejects unauthorized employee', () => {
  let s = act(seed(), 'release.publish', { date: day, items: [{ personId: p }, { personId: 'hr-available-lin' }] });
  assert.deepEqual(s.scheduling.batches.at(-1).results.map(r => r.success), [true, false]);
  assert.deepEqual(person(s).projectIds, [own]);
});
test('loan waits for original PM; same line and cross line follow same approval', () => {
  let s = request(seed()); assert.equal(s.scheduling.requests.at(-1).status, '待确认');
  assert.equal(ownerAt(s, p, day), w); assert.deepEqual(person(s).projectIds, [own]);
  const wrong = act(s, 'request.decide', { id: s.scheduling.requests.at(-1).id, approve: true }, l); assert.equal(last(wrong).success, false);
  s = agree(s); assert.equal(s.scheduling.requests.at(-1).status, '借调中'); assert.equal(ownerAt(s, p, day), w);
  for (const [pmId, targetId] of [[l, target], [c, 'DEMO-TRANSFER-CM-01']]) {
    let t = act(seed(), 'request.create', { personId: p, kind: 'move', start: day, targetId }, pmId);
    assert.equal(t.scheduling.requests.at(-1).status, '待确认');
    assert.equal(ownerAt(t, p, day), w);
    assert.deepEqual(person(t).projectIds, [own]);
    t = agree(t); assert.equal(ownerAt(t, p, day), pmId);
  }
});
test('denial requires a reason and records failure without approval', () => {
  let s = request(seed()); const id = s.scheduling.requests.at(-1).id;
  s = act(s, 'request.decide', { id, approve: false, reason: ' ' }); assert.equal(last(s).success, false);
  s = act(s, 'request.decide', { id, approve: false, reason: '现项目交付未完成' }); assert.equal(s.scheduling.requests.at(-1).status, '已拒绝');
});
test('loan inclusive dates, expiry and duplicate reconciliation', () => {
  let s = agree(request(seed())); const lastDay = reconcileScheduling(s, '2026-11-19'); assert.equal(lastDay.scheduling.requests.at(-1).status, '借调中');
  s = reconcileScheduling(s, '2026-11-20'); assert.equal(s.scheduling.requests.at(-1).status, '已到期结束'); assert.equal(ownerAt(s, p, '2026-11-20'), w);
  assert.deepEqual(reconcileScheduling(s, '2026-11-21'), s);
});
test('early return needs no second approval and covers return day only', () => {
  let s = agree(request(seed())); const id = s.scheduling.requests.at(-1).id;
  s = act(s, 'request.return', { id }, l); assert.equal(s.scheduling.requests.at(-1).status, '已提前归还');
  assert.equal(s.scheduling.checks.find(f => f.id === 'work-lincheng-support').result, '核实一致');
  s = mergeSchedulingFacts(s, [{ id: 'next-day', version: 1, personId: p, projectId: target, date: '2026-11-18', hours: 3, validated: true, ownerPmId: w, projectPmId: l }], '2026-11-18');
  assert.equal(s.scheduling.checks.find(f => f.id === 'next-day').result, '待补办');
});
test('scheduled move edits directly, does not execute old date, and switches owner only at new date', () => {
  let s = agree(request(seed(), 'move', '2026-11-19')); const id = s.scheduling.requests.at(-1).id;
  s = act(s, 'request.edit', { id, start: '2026-11-21', targetId: target }, l); assert.ok(last(s).success);
  assert.equal(ownerAt(reconcileScheduling(s, '2026-11-19'), p, '2026-11-19'), w);
  s = reconcileScheduling(s, '2026-11-21'); assert.equal(ownerAt(s, p, '2026-11-21'), l); assert.equal(s.scheduling.requests.at(-1).status, '已生效');
  assert.deepEqual(person(s).projectIds, [target]);
});
test('direct cancellation retains withdrawn release and never executes scheduled move', () => {
  let s = agree(request(seed(), 'move', '2026-11-19')); const id = s.scheduling.requests.at(-1).id;
  s = act(s, 'release.withdraw', { personId: p }); s = act(s, 'request.cancel', { id }, l);
  s = reconcileScheduling(s, '2026-11-22'); assert.equal(ownerAt(s, p, '2026-11-22'), w);
  assert.equal(s.scheduling.releases.find(r => r.personId === p).status, '已撤回');
});
test('confirmation conflicts cannot overwrite existing loan', () => {
  let s = agree(request(seed())); const t = act(s, 'request.create', { personId: p, kind: 'loan', start: '2026-11-18', end: '2026-11-21', targetId: 'DEMO-TRANSFER-CM-01' }, c);
  assert.equal(last(t).success, false); assert.equal(t.scheduling.requests.length, 1);
});
test('a nonoverlapping later loan is allowed', () => {
  let s = agree(request(seed())); s = request(s, 'loan', '2026-11-20', '2026-11-22'); assert.ok(last(s).success);
});
test('already planned management change cannot be bypassed by a later loan from the old owner', () => {
  let s = agree(request(seed(), 'move', '2026-11-19'));
  s = request(s, 'loan', '2026-11-20', '2026-11-22'); assert.equal(last(s).success, false);
});
test('past normal application rejected; historical exception supports closed project without reopening', () => {
  let s = seed(); s = request(s, 'loan', '2026-11-16'); assert.equal(last(s).success, false);
  const e = s.scheduling.exceptions[0]; s.projects.find(x => x.id === target).ended = true;
  s = act(s, 'request.create', { personId: p, exceptionId: e.id, kind: 'loan', start: day, end: day, targetId: target }, l, '2026-11-20');
  assert.ok(last(s).success); s = agree(s, '2026-11-20'); assert.equal(s.scheduling.requests.at(-1).status, '已到期结束');
  assert.equal(s.projects.find(x => x.id === target).ended, true); assert.deepEqual(person(s).projectIds, [own]);
});
test('exception can supplement unreleased person, remains open until original PM approves', () => {
  let s = act(seed(), 'release.withdraw', { personId: p }); const e = s.scheduling.exceptions[0];
  s = act(s, 'request.create', { personId: p, exceptionId: e.id, kind: 'loan', start: day, end: day, targetId: target }, l);
  assert.equal(s.scheduling.exceptions[0].status, '已发起待确认'); s = agree(s);
  assert.equal(s.scheduling.exceptions[0].status, '已复检关闭'); assert.equal(s.scheduling.releases.find(r => r.personId === p).status, '已撤回');
});
test('partial coverage keeps uncovered dates open and preserves original hours', () => {
  let s = mergeSchedulingFacts(seed(), [{ id: 'second', version: 1, personId: p, projectId: target, date: '2026-11-18', hours: 4, validated: true, ownerPmId: w, projectPmId: l }], '2026-11-18');
  const e = s.scheduling.exceptions[0];
  s = act(s, 'request.create', { personId: p, exceptionId: e.id, kind: 'loan', start: day, end: day, targetId: target }, l, '2026-11-18'); s = agree(s, '2026-11-18');
  assert.equal(s.scheduling.exceptions[0].status, '待补办'); assert.deepEqual(s.scheduling.exceptions[0].openFacts, ['second']);
  assert.equal(s.scheduling.facts.find(f => f.id === 'second').hours, 4);
});
test('historical formal supplement separates business date from real approval time', () => {
  let s = seed(); const e = s.scheduling.exceptions[0];
  s = act(s, 'request.create', { personId: p, exceptionId: e.id, kind: 'move', start: day, targetId: target }, l, '2026-11-23'); s = agree(s, '2026-11-23');
  const r = s.scheduling.requests.at(-1); assert.equal(r.businessEffectiveDate, day); assert.ok(r.approvedAt.includes('T')); assert.equal(ownerAt(s, p, day), l);
});
test('future intern rest preserves relationships until due date then removes all projects', () => {
  let s = seed(); person(s, intern).projectIds.push(target);
  // Existing owner fixture remains the releasing PM; snapshot all project relations.
  s = act(s, 'rest.create', { personId: intern, date: '2026-11-19' }); assert.ok(last(s).success); assert.equal(person(s, intern).projectIds.length, 2);
  s = reconcileScheduling(s, '2026-11-19'); assert.deepEqual(person(s, intern).projectIds, []); assert.equal(ownerAt(s, intern, '2026-11-19'), null);
  assert.equal(s.scheduling.rests.at(-1).formerPmName, '王然');
});
test('public intern claim immediately reserves future restoration without former PM confirmation', () => {
  let s = act(seed(), 'rest.create', { personId: intern, date: day }); const id = s.scheduling.rests.at(-1).id;
  s = act(s, 'rest.claim', { id, targetId: target, date: '2026-11-21' }, l); assert.equal(s.scheduling.rests.at(-1).status, '已提取待恢复');
  const t = act(s, 'rest.claim', { id, targetId: 'DEMO-TRANSFER-CM-01', date: '2026-11-20' }, c); assert.equal(last(t).success, false);
  s = reconcileScheduling(s, '2026-11-21'); assert.equal(ownerAt(s, intern, '2026-11-21'), l); assert.equal(s.scheduling.rests.at(-1).restDays, 4);
});
test('same-day release and claim creates zero rest days', () => {
  let s = act(seed(), 'rest.create', { personId: intern, date: day }); s = act(s, 'rest.claim', { id: s.scheduling.rests.at(-1).id, targetId: target, date: day }, l);
  assert.equal(s.scheduling.rests.at(-1).restDays, 0);
});
test('legacy public pool intern with no owner history can be claimed', () => {
  let s = seed(); const r = s.scheduling.rests.find(r => r.personId === 'hr-transfer-pool');
  delete s.scheduling.owners[r.personId];
  s = act(s, 'rest.claim', { id: r.id, targetId: target, date: day }, l);
  assert.ok(last(s).success); assert.equal(ownerAt(s, r.personId, day), l);
});
test('late three-hour fact restores intern early and stops original plan from overwriting real project', () => {
  let s = act(seed(), 'rest.create', { personId: intern, date: day }); const id = s.scheduling.rests.at(-1).id;
  s = act(s, 'rest.claim', { id, targetId: target, date: '2026-11-21' }, l);
  s = mergeSchedulingFacts(s, [{ id: 'early', version: 1, personId: intern, projectId: 'DEMO-TRANSFER-CM-01', date: '2026-11-19', hours: 3, validated: true, projectPmId: c }], '2026-11-23');
  const r = s.scheduling.rests.at(-1); assert.equal(r.resume, '2026-11-19'); assert.equal(r.restDays, 2); assert.equal(ownerAt(s, intern, '2026-11-23'), c);
  assert.deepEqual(person(s, intern).projectIds, ['DEMO-TRANSFER-CM-01']); assert.equal(r.corrections.length, 1);
  assert.deepEqual(reconcileScheduling(s, '2026-11-24'), s);
});
test('unclaimed intern recovers from output; prior date output cannot end future rest', () => {
  let s = act(seed(), 'rest.create', { personId: intern, date: '2026-11-18' });
  s = mergeSchedulingFacts(s, [{ id: 'previous', version: 1, personId: intern, projectId: own, date: day, hours: 3, validated: true, projectPmId: w }]);
  assert.equal(s.scheduling.rests.at(-1).status, '待开始');
  s = mergeSchedulingFacts(s, [{ id: 'work', version: 1, personId: intern, projectId: own, date: '2026-11-19', hours: 3, validated: true, projectPmId: w }], '2026-11-19');
  assert.equal(s.scheduling.rests.at(-1).status, '已恢复');
});
test('withdrawn attendance re-evaluates interval and preserves correction evidence', () => {
  let s = act(seed(), 'rest.create', { personId: intern, date: day });
  const f = { id: 'withdraw', version: 1, personId: intern, projectId: own, date: '2026-11-18', hours: 3, validated: true, projectPmId: w };
  s = mergeSchedulingFacts(s, [f], '2026-11-18'); s = mergeSchedulingFacts(s, [{ ...f, version: 2, withdrawn: true }], '2026-11-19');
  assert.equal(s.scheduling.rests.at(-1).resume, null); assert.equal(s.scheduling.rests.at(-1).status, '调休中'); assert.equal(s.scheduling.sourceHistory.length, 1);
  assert.equal(s.scheduling.rests.at(-1).corrections.length, 2);
});
test('unknown historical PM stays unverified and is not routed using current owner', () => {
  let s = mergeSchedulingFacts(seed(), [{ id: 'unknown-history', version: 1, personId: p, projectId: target, date: '2026-11-12', hours: 3, validated: true }]);
  assert.equal(s.scheduling.checks.find(f => f.id === 'unknown-history').result, '待核实'); assert.equal(s.scheduling.exceptions.length, 1);
});
test('assistant authorization, delegation audit, and readonly role enforcement', () => {
  let s = seed(); assert.throws(() => schedulingContext(s, 'PA', l), /授权/);
  s = act(s, 'release.publish', { personId: p, date: day }, w, day, 'PA'); assert.ok(last(s).success);
  assert.ok(s.scheduling.audit.some(a => a.actor === '梁禾' && a.representedPmId === w)); assert.ok(s.scheduling.notices.some(n => n.text.includes('梁禾代您')));
  assert.throws(() => act(s, 'release.publish', { personId: p, date: day }, w, day, 'PMO'), /仅可查看/);
});
test('stale revision and duplicate request IDs do not repeat business actions', () => {
  const s = seed(); const ctx = { role: 'PM', pmId: w }; const payload = { personId: p, date: day, requestId: 'idempotent' };
  const t = reduceScheduling(s, ctx, 'release.publish', payload, s.revision, day);
  assert.throws(() => reduceScheduling(t, ctx, 'release.publish', payload, s.revision, day), /数据已更新/);
  const u = reduceScheduling(t, ctx, 'release.publish', payload, t.revision, day); assert.equal(u.scheduling.batches.length, t.scheduling.batches.length);
});
test('source adapter preserves full-time multiple project output and does not assign PM', () => {
  const s = seed(); const t = mergeHrOutputFacts(s, [{ id: 'external-output', personId: p, projectId: target, date: day, hours: 4, validated: true }], {}, day);
  assert.deepEqual(person(t).projectIds, person(s).projectIds); assert.equal(t.outputs.find(f => f.id === 'external-output').hours, 4);
});
test('PM cannot read hidden legacy staff or other PM historical output through detail', () => {
  const s = seed(), ctx = { role: 'PM', pmId: w }, v = staffingView(s, ctx, day);
  const hidden = s.scheduling.releases.find(r => r.ownerId !== w && r.status === '已撤回');
  if (hidden) { assert.ok(!v.people.some(p => p.id === hidden.personId)); assert.throws(() => schedulingPersonDetails(s, ctx, hidden.personId), /无权/); }
  const publicPerson = s.scheduling.releases.find(r => r.ownerId === l && r.status === '已发布');
  const d = schedulingPersonDetails(s, ctx, publicPerson.personId); assert.ok(d.view.projects.every(p => p.pm === '王然'));
});
