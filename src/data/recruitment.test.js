import test from 'node:test';
import assert from 'node:assert/strict';
import { recruitmentActor, seedRecruitment, reduceRecruitment, reconcileRecruitment, validateSubmission, exclusiveValues, FIELDS, EXPERIENCE_SOURCE, canSee } from './recruitment.js';
const now = '2026-11-11T03:00:00Z', pm = recruitmentActor('PM'), manager = recruitmentActor('招聘经理');
const ctx = { projects: [{ projectNo: 'p1', projectName: '项目一', pm: '王然', approved: true, status: '项目暂停' }], trials: [{ key: 't1', projectNo: 'p1', status: '试标中' }], departments: [{ id: 'dept-3-4', name: '人事运营与薪酬部', status: '启用' }], positions: [{ id: 'pos1', name: '数据标注员', manager: '王然', status: '启用' }, { id: 'pos2', name: '人事专员', manager: '人事负责人', departmentId: 'dept-3-4', status: '启用' }], locations: [{ id: 'loc1', name: '线上', status: '在用' }], reviewers: [], recruiters: [{ id: 'hr1', name: '苏晴', departmentName: '人才开发部', active: true, enabled: true }, { id: 'hr2', name: '何珊', departmentName: '人才开发部', active: true, enabled: true }] };
const seed = () => seedRecruitment(ctx, now);
const pending = s => s.records.find(r => r.status === '待审批');
let request = 0;
const act = (state, actor, action, payload = {}, context = ctx, time = now) => reduceRecruitment(state, actor, action, { requestId: `test-${++request}`, ...payload }, context, time);
test('31题完整，经验源同名选项保留，不限双向互斥', () => {
  assert.equal(FIELDS.length, 31); assert.equal(EXPERIENCE_SOURCE.length, 11);
  assert.deepEqual(exclusiveValues(['本科'], ['本科', '不限']), ['不限']);
  assert.deepEqual(exclusiveValues(['不限'], ['不限', '本科']), ['本科']);
});
test('提报审批驳回重提通过分配改派保留同一需求、首次时间、快照和回写事件顺序', () => {
  let s = seed(); const row = pending(s), id = row.id, first = row.firstSubmittedAt;
  s = act(s, manager, 'reject', { id, version: 1, reason: '补全要求' }).state;
  s = act(s, pm, 'resubmit', { id, version: 1, form: { ...row.form, headcount: 9 } }).state;
  s = act(s, manager, 'approve', { id, version: 2 }).state;
  s = act(s, manager, 'assign', { rows: [{ id, version: 2 }], hrId: 'hr1' }).state;
  s = act(s, manager, 'reassign', { rows: [{ id, version: 2, hrId: 'hr1' }], hrId: 'hr2' }).state;
  const r = s.records.find(x => x.id === id);
  assert.equal(r.firstSubmittedAt, first); assert.equal(r.status, '进行中'); assert.equal(r.versions.length, 2); assert.equal(r.hr.id, 'hr2');
  assert.deepEqual(r.tasks.map(t => t.action), ['创建飞书记录', '更新审批同步结果', '机器人追加记录批注', '更新提报内容', '更新审批同步结果', '更新对接招聘HR', '更新对接招聘HR']);
  assert.ok(r.tasks.every(t => t.state === '待回写')); assert.equal(r.externalRecordId, '');
});
test('状态、当前版本、原申请人和招聘经理权限均校验', () => {
  const s = seed(), r = pending(s);
  assert.throws(() => act(s, pm, 'approve', { id: r.id, version: 1 }), /权限/);
  assert.throws(() => act(s, manager, 'reject', { id: r.id, version: 1, reason: '  ' }), /原因/);
  assert.throws(() => act(s, manager, 'approve', { id: r.id, version: 0 }), /版本/);
  assert.throws(() => act(s, pm, 'submit', { id: r.id, form: r.form }), /已有记录/);
  assert.equal(canSee(r, { ...pm, id: 'other' }), false);
  assert.equal(canSee(r, { ...manager, enabled: false }), false);
  const passed = act(s, manager, 'approve', { id: r.id, version: 1 }).state;
  assert.throws(() => act(passed, manager, 'reject', { id: r.id, version: 1, reason: '迟到审批' }), /状态/);
});
test('截止当天有效、北京时间次日结束，禁止新处理，无外部记录停止创建', () => {
  const s = seed(), r = pending(s); r.form.deadline = '2026-11-11';
  assert.equal(reconcileRecruitment(s, ctx, '2026-11-11T15:59:59Z').records.find(x => x.id === r.id).status, '待审批');
  const ended = reconcileRecruitment(s, ctx, '2026-11-11T16:00:00Z').records.find(x => x.id === r.id);
  assert.equal(ended.status, '已结束'); assert.equal(ended.tasks[0].state, '已停止回写');
  assert.throws(() => act(s, manager, 'approve', { id: r.id, version: 1 }, ctx, '2026-11-11T16:00:00Z'), /到期/);
});
test('最终验收未全额开票不结束，暂停可提交，试标失败仅结束对应试标', () => {
  const s = seed(), r = pending(s); r.trialId = 't1';
  const c = structuredClone(ctx); c.projects[0].finalAccepted = true;
  assert.equal(reconcileRecruitment(s, c, now).records.find(x => x.id === r.id).status, '待审批');
  c.projects[0].allInvoiced = true;
  assert.equal(reconcileRecruitment(s, c, now).records.find(x => x.id === r.id).status, '已结束');
  c.projects[0].allInvoiced = false; c.trials[0].status = '试标失败';
  assert.equal(reconcileRecruitment(s, c, now).records.find(x => x.id === r.id).status, '已结束');
  assert.ok(reconcileRecruitment(s, c, now).records.some(x => x.status === '待分配'));
});
test('批量独立结果、无效 HR 拒绝，重复请求幂等', () => {
  const s = seed(), valid = s.records.find(r => r.status === '待分配'), invalid = pending(s);
  const payload = { requestId: 'batch-fixed', rows: [{ id: valid.id, version: 1 }, { id: invalid.id, version: 1 }], hrId: 'hr1' };
  const result = act(s, manager, 'assign', payload);
  assert.deepEqual(result.result.results.map(r => r.success), [true, false]);
  assert.deepEqual(act(result.state, manager, 'assign', payload).result, result.result);
  assert.throws(() => act(s, manager, 'assign', { ...payload, hrId: 'invalid' }), /在职/);
});
test('职能本部门岗位、条件字段清空、必填及选项日期人数链接验证', () => {
  const form = pending(seed()).form;
  for (const patch of [{ headcount: 1.5 }, { deadline: '2026-02-30' }, { overview: 'javascript:alert(1)' }, { majors: ['不限', '文学类'] }, { priority: '无效值' }, { ownerId: 'other' }]) assert.throws(() => validateSubmission({ ...form, ...patch }, pm, ctx, now));
  const a = recruitmentActor('部门经理');
  const validated = validateSubmission({ ...form, ownerId: 'dept-3-4', positionId: 'pos2' }, a, ctx, now);
  assert.equal(validated.form.overview, ''); assert.equal(validated.form.security, ''); assert.equal(validated.ownerType, 'department');
});
test('已结束且有外部关联保留待补写事实，重复提交跨截止返回原需求', () => {
  let s = seed(), r = pending(s); r.externalRecordId = 'record-existing'; r.form.deadline = '2026-11-10';
  const ended = reconcileRecruitment(s, ctx, now).records.find(x => x.id === r.id);
  assert.equal(ended.tasks[0].state, '待回写');
  const f = pending(seed()).form; const created = act(s, pm, 'submit', { form: f, requestId: 'create-fixed' });
  const again = act(created.state, pm, 'submit', { form: f, requestId: 'create-fixed' }, ctx, '2027-01-01T00:00:00Z');
  assert.equal(again.result.id, created.result.id); assert.equal(again.state.records.find(x => x.id === again.result.id).status, '已结束');
});
test('回写失败按单一步骤重试，不重建任务或改变业务状态', () => {
  const s = seed(), r = pending(s); r.tasks[0].state = '回写失败';
  const out = act(s, pm, 'retry', { id: r.id, taskId: r.tasks[0].id });
  const changed = out.state.records.find(x => x.id === r.id);
  assert.equal(changed.status, '待审批'); assert.equal(changed.tasks.length, 1); assert.equal(changed.tasks[0].state, '待回写');
  assert.equal(changed.tasks[0].id, r.tasks[0].id);
  assert.throws(() => act(s, { ...pm, id: 'other' }, 'retry', { id: r.id, taskId: r.tasks[0].id }), /无权/);
});
