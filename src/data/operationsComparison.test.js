import test from 'node:test';
import assert from 'node:assert/strict';
import { buildComparison, comparisonPeriods, formatComparison, shanghaiToday } from './operationsComparison.js';
import { calculateWeek, createPreview, updateReport } from './operationsDashboard.js';

test('北京时间跨日，不依赖浏览器所在时区', () => {
  assert.equal(shanghaiToday(new Date('2026-10-25T16:01:00Z')), '2026-10-26');
  assert.equal(shanghaiToday(new Date('2026-10-25T15:59:00Z')), '2026-10-25');
});
test('历史日与前一自然日比较；今天等待结束；未来与自定义不算', () => {
  assert.deepEqual(comparisonPeriods('day', '2026-10-25', '2026-10-26').previous, ['2026-10-24', '2026-10-24']);
  assert.equal(comparisonPeriods('day', '2026-10-26', '2026-10-26').text, '待当日结束');
  assert.equal(comparisonPeriods('day', '2026-10-27', '2026-10-26').status, 'future');
  assert.equal(comparisonPeriods('custom', '2026-10-26', '2026-10-26').status, 'hidden');
});
test('未结束业务周截至昨天，周五至周日对上周五至周日', () => {
  const p = comparisonPeriods('week', '2026-10-26', '2026-10-26');
  assert.deepEqual(p.current, ['2026-10-23', '2026-10-25']);
  assert.deepEqual(p.previous, ['2026-10-16', '2026-10-18']);
  assert.match(p.label, /截至昨日/);
});
test('历史周完整比较；新周首日明确回退上一完整周', () => {
  const p = comparisonPeriods('week', '2026-10-23', '2026-10-23');
  assert.deepEqual(p.current, ['2026-10-16', '2026-10-22']);
  assert.deepEqual(p.previous, ['2026-10-09', '2026-10-15']);
  assert.equal(p.label, '上周环比');
  const historical = comparisonPeriods('week', '2026-10-20', '2026-10-26');
  assert.deepEqual(historical.current, p.current);
  assert.equal(historical.label, '周环比');
});
test('当月同进度、短月允许天数不同、闰年2月正确', () => {
  assert.deepEqual(comparisonPeriods('month', '2026-10-26', '2026-10-26').previous, ['2026-09-01', '2026-09-25']);
  const march = comparisonPeriods('month', '2026-03-31', '2026-03-31');
  assert.deepEqual(march.current, ['2026-03-01', '2026-03-30']);
  assert.deepEqual(march.previous, ['2026-02-01', '2026-02-28']);
  assert.deepEqual(comparisonPeriods('month', '2028-03-31', '2028-03-31').previous, ['2028-02-01', '2028-02-29']);
});
test('历史月按整月比较，月初跨年回退两完整月', () => {
  const p = comparisonPeriods('month', '2027-01-01', '2027-01-01');
  assert.deepEqual(p.current, ['2026-12-01', '2026-12-31']);
  assert.deepEqual(p.previous, ['2026-11-01', '2026-11-30']);
  assert.equal(p.label, '上月环比');
  assert.deepEqual(comparisonPeriods('month', '2026-03-01', '2026-10-26').current, ['2026-03-01', '2026-03-31']);
});
test('零基期不显示百分比，缺失绝不当零', () => {
  for (const metric of ['value', 'cost', 'profit']) {
    assert.equal(formatComparison(metric, 0, 0).text, '持平');
    assert.equal(formatComparison(metric, 120, 0).text, '新增120.00元');
    assert.equal(formatComparison(metric, -120, 0).text, '减少120.00元');
    assert.equal(formatComparison(metric, 1, null).status, 'incomplete');
    assert.equal(formatComparison(metric, NaN, 2).status, 'incomplete');
  }
});
test('负利润减亏增亏、扭亏、盈亏平衡及由盈转亏均不显示百分比', () => {
  for (const [current, previous, text] of [
    [-50000, -100000, '减亏50,000.00元'], [-150000, -100000, '增亏50,000.00元'],
    [50000, -100000, '扭亏为盈，增加150,000.00元'], [0, -100000, '盈亏平衡，增加100,000.00元'],
    [-50000, 100000, '由盈转亏，减少150,000.00元'], [-100000, -100000, '持平'],
  ]) {
    const result = formatComparison('profit', current, previous);
    assert.equal(result.text, text); assert.equal(result.rate, null);
  }
});
test('负产值/成本基期仅显示金额，成本无红绿好坏判断', () => {
  assert.equal(formatComparison('value', -60000, -100000).text, '增加40,000.00元');
  assert.equal(formatComparison('cost', -160000, -100000).text, '减少60,000.00元');
  assert.equal(formatComparison('cost', 100000, -100000).tone, 'neutral');
  assert.equal(formatComparison('cost', 50, 100).tone, 'neutral');
  assert.equal(formatComparison('profit', -50000, -100000).tone, 'positive');
  assert.equal(formatComparison('profit', -150000, -100000).tone, 'negative');
});
test('原始金额计算、百分比一位，微小增长/下降不变成持平', () => {
  assert.equal(formatComparison('value', 112.3456, 100).text, '+12.3%');
  assert.equal(formatComparison('value', 87.6544, 100).text, '−12.3%');
  assert.equal(formatComparison('value', 100.03, 100).text, '小幅增长');
  assert.equal(formatComparison('value', 99.97, 100).text, '小幅下降');
  assert.equal(formatComparison('value', 0, 100).text, '−100.0%');
  assert.equal(formatComparison('value', 400, 100).text, '+300.0%');
  assert.equal(formatComparison('value', 100, 100).tone, 'flat');
});

const options = { mode: 'week', anchor: '2026-10-26', today: '2026-10-26', project: 'demo-ops-1' };
const currentRow = state => state.rows.find(r => r.projectId === 'demo-ops-1' && r.start === '2026-10-23');
test('主指标范围不改：周环比独立对比截止昨天；未确认参与且可追溯两期周报', () => {
  const state = createPreview(), before = JSON.stringify(state);
  const result = buildComparison(state, 'PMO', options);
  assert.equal(result.metrics.value.status, 'ready');
  assert.equal(result.metrics.value.unconfirmed, true);
  assert.equal(result.metrics.value.current.entries[0].key, currentRow(state).key);
  assert.equal(result.metrics.value.current.amount, currentRow(state).result.value / 5);
  assert.equal(JSON.stringify(state), before);
});
test('周报保存确认后重算环比并去掉提示，无需修改比较逻辑', () => {
  const state = createPreview(), row = currentRow(state);
  const next = updateReport(state, row.key, { checked: 19000, subsidy: 0, extra: 0, deviation: '无偏差', measure: '跟进' }, 'PMO');
  assert.equal(buildComparison(next, 'PMO', options).metrics.profit.unconfirmed, false);
  assert.notEqual(buildComparison(next, 'PMO', options).metrics.profit.current.amount, buildComparison(state, 'PMO', options).metrics.profit.current.amount);
});
test('缺少产值单价只阻止产值和利润，成本仍有环比；旧存储也适用', () => {
  const state = createPreview();
  const result = buildComparison(state, 'PMO', { ...options, project: 'demo-ops-13' });
  assert.equal(result.metrics.value.status, 'incomplete');
  assert.equal(result.metrics.profit.status, 'incomplete');
  assert.equal(result.metrics.cost.status, 'ready');
  assert.ok(result.metrics.value.current.entries.some(e => e.reason.includes('单价')));
});
test('缺少成本不影响有效产值；成本和利润缺失不补0', () => {
  const state = createPreview(); currentRow(state).internalCost = null;
  const result = buildComparison(state, 'PMO', options);
  assert.equal(result.metrics.value.status, 'ready');
  assert.equal(result.metrics.cost.status, 'incomplete');
  assert.equal(result.metrics.profit.current.amount, null);
});
test('零产值导致利润率无定义不阻止金额环比', () => {
  const result = buildComparison(createPreview(), 'PMO', { ...options, project: 'demo-ops-12' });
  assert.equal(result.metrics.value.text, '持平');
  assert.equal(result.metrics.profit.status, 'ready');
});
test('两期任一期重算中抑制旧结果，成功后恢复；失败抑制环比', () => {
  for (const start of ['2026-10-16', '2026-10-23']) {
    const state = createPreview(), row = state.rows.find(r => r.projectId === options.project && r.start === start);
    row.calcStatus = 'calculating';
    const busy = buildComparison(state, 'PMO', options);
    assert.equal(busy.metrics.value.text, '计算中');
    assert.equal(busy.metrics.value.delta, undefined);
    row.calcStatus = 'failed'; row.calcError = '上游连接失败';
    assert.equal(buildComparison(state, 'PMO', options).metrics.value.text, '数据不完整');
    row.calcStatus = 'ready';
    assert.equal(buildComparison(state, 'PMO', options).metrics.value.status, 'ready');
  }
});
test('全部项目不采用完整项目子集，缺失仅遮蔽受影响指标', () => {
  const state = createPreview();
  const result = buildComparison(state, 'PMO', { ...options, project: 'all' });
  assert.equal(result.metrics.value.status, 'incomplete');
  assert.equal(result.metrics.cost.status, 'incomplete'); // failed and unresolved monthly allocation
  assert.equal(result.metrics.value.current.amount, null);
});
test('历史缺失周报不能被当成0，也不能伪造新增', () => {
  const state = createPreview();
  state.rows = state.rows.filter(r => !(r.projectId === options.project && r.start === '2026-10-16'));
  const result = buildComparison(state, 'PMO', options);
  assert.equal(result.metrics.value.status, 'incomplete');
  assert.match(result.metrics.value.previous.entries[0].reason, /缺少该业务周/);
});
test('月度中间一周缺失也被检出；无范围权限不泄露数据', () => {
  const state = createPreview(); state.rows = state.rows.filter(r => r.start !== '2026-09-18');
  const result = buildComparison(state, 'PMO', { ...options, mode: 'month' });
  assert.equal(result.metrics.value.status, 'incomplete');
  const denied = buildComparison(state, 'PM', { ...options, project: 'demo-ops-2' });
  assert.equal(denied.metrics.value.status, 'empty');
  assert.equal(denied.metrics.value.current.entries.length, 0);
});
test('相同项目和PM权限过滤应用于两期，财务可查看', () => {
  for (const role of ['PM', 'PMO', '财务']) {
    const result = buildComparison(createPreview(), role, { ...options, pm: '王然' });
    assert.equal(result.metrics.value.status, 'ready');
    for (const side of ['current', 'previous']) assert.ok(result.metrics.value[side].entries.every(e => e.row.pm === '王然'));
  }
});
test('有明确业务起止时新/结束项目不是交集筛选，结束后实际费用仍计入', () => {
  const state = createPreview();
  state.projects = state.projects.slice(0, 2);
  state.projects[0].businessStart = '2026-10-23';
  state.projects[1].businessEnd = '2026-10-22';
  state.rows = state.rows.filter(r => state.projects.some(p => p.id === r.projectId) && (r.projectId !== 'demo-ops-1' || r.start >= '2026-10-23'));
  const ended = state.rows.find(r => r.projectId === 'demo-ops-2' && r.start === '2026-10-23');
  ended.checked = 0; ended.result = calculateWeek(ended);
  const result = buildComparison(state, 'PMO', { ...options, project: 'all' });
  assert.equal(result.metrics.value.status, 'ready');
  assert.equal(result.metrics.cost.current.entries.length, 2);
  assert.ok(result.metrics.cost.current.entries.find(e => e.key === ended.key).amount > 0);
  assert.equal(buildComparison(state, 'PMO', options).metrics.value.previous.amount, 0);
  assert.match(buildComparison(state, 'PMO', options).metrics.value.text, /新增/);
});
test('整体环比先汇总金额，不平均项目百分比', () => {
  const state = createPreview(); state.projects = state.projects.slice(0, 2);
  state.rows = state.rows.filter(r => state.projects.some(p => p.id === r.projectId));
  for (const row of state.rows) {
    row.result = { value: row.projectId === 'demo-ops-1' ? row.start === '2026-10-23' ? 200 : 100 : 1000 };
  }
  const result = buildComparison(state, 'PMO', { ...options, project: 'all' });
  assert.equal(result.metrics.value.text, '+9.1%');
});
test('没有公司日历或包月分摊规则时不伪造日月环比', () => {
  const state = createPreview(); currentRow(state).workDates = [];
  assert.equal(buildComparison(state, 'PMO', options).metrics.value.status, 'incomplete');
  assert.equal(buildComparison(state, 'PMO', { ...options, project: 'demo-ops-14' }).metrics.value.status, 'incomplete');
  assert.equal(buildComparison(state, 'PMO', { ...options, project: 'demo-ops-14', anchor: '2026-10-16' }).metrics.value.status, 'ready');
});
