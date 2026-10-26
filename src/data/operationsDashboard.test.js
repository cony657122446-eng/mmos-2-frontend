import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregate, businessWeek, calculateWeek, canView, chartProjects, createPreview, filterRows, PM_FIELDS, REPORT_FIELDS, rowSlice, summarize, updateReport, validateChart, persistPreview } from './operationsDashboard.js';

test('业务周周五起至周四，周四与下一周五边界正确', () => {
  assert.deepEqual(businessWeek('2026-10-22'), ['2026-10-16', '2026-10-22']);
  assert.deepEqual(businessWeek('2026-10-23'), ['2026-10-23', '2026-10-29']);
});
test('38项交付字段不含父记录、周期及其他排除列', () => {
  assert.equal(REPORT_FIELDS.length, 38); assert.equal(new Set(REPORT_FIELDS.map(([k]) => k)).size, 38); assert.equal(PM_FIELDS.length, 8);
  assert.ok(!REPORT_FIELDS.some(([, label]) => ['父记录', '父记录 2', '周期'].includes(label)));
});
test('核对0有效，空量回退；试标不重复计入总成本，费用不除税', () => {
  const row = { price: 10.6, checked: 100, pricing: '计件', autoVolume: 200, internalCost: 300, externalCost: 100, subsidy: 10, extra: 20, trialCost: 50 };
  assert.deepEqual(calculateWeek(row), { value: 1000, cost: 430, profit: 570, rate: .57, issue: '' });
  assert.equal(calculateWeek({ ...row, checked: null }).value, 2000);
  assert.equal(calculateWeek({ ...row, checked: 0 }).value, 0);
  assert.equal(calculateWeek({ ...row, checked: 0 }).rate, null);
});
test('包月空核对分支不除1.06，有核对分支按原式除税', () => {
  const row = { price: 16000, checked: null, pricing: '包月', autoVolume: 160, customerDays: 20, internalCost: 100, externalCost: 0 };
  assert.equal(calculateWeek(row).value, 16000);
  assert.equal(calculateWeek({ ...row, checked: 1 }).value, 16000 / 1.06);
  assert.equal(calculateWeek({ ...row, customerDays: 0 }).value, null);
});
test('包天查找价不重复除8；缺价不作为0', () => {
  const row = createPreview().rows.find(r => r.pricing === '包天');
  assert.equal(calculateWeek(row).value, row.checked * row.price / 1.06);
  assert.equal(calculateWeek({ ...row, price: null }).value, null);
});
test('PM列表、汇总、图表与详情同一范围，财务和PMO可见全部', () => {
  const state = createPreview(); const rows = filterRows(state, 'PM');
  assert.ok(rows.length > 0 && rows.every(r => r.pm === '王然'));
  assert.equal(filterRows(state, '财务').length, state.rows.length);
  for (const filters of [{}, { pm: '陈默' }, { range: ['2026-10-23', '2026-10-29'] }, { project: state.projects[0].id }]) {
    assert.deepEqual(filterRows(state, '财务', filters), filterRows(state, 'PMO', filters));
  }
  assert.equal(canView(state.rows.find(r => r.pm === '陈默'), 'PM'), false);
  assert.equal(filterRows(state, 'PM', { pm: '陈默' }).length, 0);
});
test('默认取利润最高5正、亏损最大5负，不跨类补足；真实比例低于-100%', () => {
  const state = createPreview(), range = ['2026-10-23', '2026-10-29'];
  const projects = aggregate(filterRows(state, 'PMO', { range }), range); const picked = chartProjects(projects);
  assert.equal(picked.filter(p => p.profit > 0).length, 5); assert.equal(picked.filter(p => p.profit < 0).length, 5);
  assert.ok(picked.some(p => p.rate < -1));
  assert.equal(chartProjects(projects.filter(p => p.profit > 0).slice(0, 2)).length, 2);
});
test('对比选择不改变全项目合计，非法11项和越权配置拒绝', () => {
  const state = createPreview(), range = ['2026-10-23', '2026-10-29']; const projects = aggregate(filterRows(state, 'PMO', { range }), range);
  const before = summarize(projects); chartProjects(projects, { mode: 'custom', ids: [projects[0].id] }); assert.deepEqual(summarize(projects), before);
  assert.throws(() => validateChart(projects.slice(0, 11).map(p => p.id), projects.map(p => p.id), 'PMO'), /10/);
  assert.throws(() => validateChart(['outside'], projects.map(p => p.id), 'PM'), /无权限/);
  assert.doesNotThrow(() => validateChart([projects[0].id], projects.map(p => p.id), '财务'));
  assert.throws(() => validateChart(['outside'], projects.map(p => p.id), '财务'), /无权限/);
  assert.throws(() => validateChart([], [], '访客'), /无权限/);
});
test('日均摊使用显式工作日历，无日历不改用自然日，包月局部不造数', () => {
  const state = createPreview(); const row = state.rows[0];
  assert.equal(rowSlice(row, [row.start, row.start]).value, row.result.value / row.workDates.length);
  assert.equal(rowSlice({ ...row, workDates: [] }, [row.start, row.start]).value, null);
  const monthly = state.rows.find(r => r.pricing === '包月'); assert.equal(rowSlice(monthly, [monthly.start, monthly.start]).value, null);
});
test('未确认、缺失、计算失败均标记不完整，计算失败保留成功结果', () => {
  const state = createPreview(), range = ['2026-10-23', '2026-10-29']; const rows = filterRows(state, 'PMO', { range });
  assert.equal(summarize(aggregate(rows, range)).incomplete, true);
  const failed = rows.find(r => r.calcStatus === 'failed'); assert.equal(rowSlice(failed, range).value, failed.result.value);
});
const patch = { checked: 1000, subsidy: 0, extra: 0, deviation: '无新增风险', measure: '持续跟踪', plan: '', staffPlan: '', note: '' };
test('PMO代填保留实际操作者，同周不增记录，首次提交日期固化', () => {
  const state = createPreview(); const row = state.rows.find(r => !r.confirmed && r.pricing !== '包月');
  const next = updateReport(state, row.key, patch, 'PMO', 'report', '2026-10-23 12:00:00', row.revision);
  const changed = next.rows.find(r => r.key === row.key); assert.equal(next.rows.length, state.rows.length); assert.equal(changed.confirmed, true); assert.equal(changed.audit[0].actor, '林晓彤'); assert.equal(changed.submittedAt, '2026-10-23 12:00:00');
  const again = updateReport(next, row.key, { ...patch, extra: 100 }, 'PMO', 'report', '2026-10-24 12:00:00');
  const result = again.rows.find(r => r.key === row.key); assert.equal(result.submittedAt, changed.submittedAt); assert.equal(result.result.cost, changed.result.cost + 100);
});
test('非法字段、越权、财务修改及缺必填拒绝且原数据不变', () => {
  const state = createPreview(), row = state.rows.find(r => r.pm !== '王然'); const before = JSON.stringify(state);
  assert.throws(() => updateReport(state, row.key, patch, 'PM'), /无权/);
  assert.throws(() => updateReport(state, row.key, patch, '财务'), /权限/);
  assert.throws(() => updateReport(state, row.key, { ...patch, submittedAt: 'other' }, 'PMO'), /系统字段/);
  assert.throws(() => updateReport(state, row.key, { ...patch, deviation: ' ' }, 'PMO'), /关键偏差/);
  assert.throws(() => updateReport(state, row.key, { ...patch, checked: null }, 'PMO'), /数字/);
  assert.equal(JSON.stringify(state), before);
});
test('批注独立保存，不覆盖PM输入或人工确认，PM不可写批注', () => {
  const state = createPreview(), row = state.rows.find(r => !r.confirmed && r.pm === '王然');
  const next = updateReport(state, row.key, { annotation: '请及时核对' }, 'PMO', 'annotation'); const changed = next.rows.find(r => r.key === row.key);
  assert.equal(changed.deviation, row.deviation); assert.equal(changed.confirmed, false); assert.equal(changed.submittedAt, row.submittedAt);
  assert.throws(() => updateReport(state, row.key, { annotation: 'x' }, 'PM', 'annotation'), /权限/);
  assert.throws(() => updateReport(state, row.key, { annotation: 'x' }, '财务', 'annotation'), /权限/);
});
test('旧版本编辑拒绝，保存失败不破坏原数据', () => {
  const state = createPreview(), row = state.rows[0]; assert.throws(() => updateReport(state, row.key, patch, 'PMO', 'report', 'now', 99), /已更新/);
  const next = updateReport(state, row.key, patch, 'PMO'); globalThis.localStorage = { getItem: () => JSON.stringify(state), setItem: () => { throw new Error('存储空间不足'); } };
  assert.throws(() => persistPreview(state, next), /空间不足/); assert.equal(state.rows[0].revision, 0);
  globalThis.localStorage = { getItem: () => JSON.stringify({ revision: 99 }), setItem: () => assert.fail('不应写入') };
  assert.throws(() => persistPreview(state, next), /另一个页面/); delete globalThis.localStorage;
});
