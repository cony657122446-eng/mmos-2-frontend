import dayjs from 'dayjs';
import { businessWeek, canView, filterRows, periodRange } from './operationsDashboard.js';

const metrics = ['value', 'cost', 'profit'];
const finite = value => typeof value === 'number' && Number.isFinite(value);
const iso = date => dayjs(date).format('YYYY-MM-DD');
const shift = (date, days) => iso(dayjs(date).add(days, 'day'));
const money = value => Math.abs(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function shanghaiToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// Rule 1–5: selecting a date never makes that date "today". The clock is separate.
export function comparisonPeriods(mode, anchor, today = shanghaiToday()) {
  if (mode === 'custom') return { status: 'hidden' };
  const selected = periodRange(mode, anchor);
  if (selected[0] > today) return { status: 'future', text: '期间未开始', label: '环比' };
  if (mode === 'day') {
    if (selected[0] === today) return { status: 'waiting', text: '待当日结束', label: '日环比' };
    return { status: 'ready', label: '日环比', current: selected, previous: selected.map(d => shift(d, -1)) };
  }
  const isCurrent = selected[0] <= today && selected[1] >= today;
  let current = selected;
  let label = mode === 'week' ? '周环比' : '月环比';
  let partial = false;
  if (isCurrent && selected[0] === today) {
    current = periodRange(mode, shift(today, -1));
    label = mode === 'week' ? '上周环比' : '上月环比';
  } else if (isCurrent) {
    current = [selected[0], shift(today, -1)];
    partial = true;
    label += ' · 截至昨日';
  }
  const priorFull = periodRange(mode, shift(current[0], -1));
  const previous = mode === 'week' ? current.map(d => shift(d, -7)) : [priorFull[0], partial
    ? iso(dayjs(priorFull[0]).date(Math.min(dayjs(current[1]).date(), dayjs(priorFull[1]).date())))
    : priorFull[1]];
  return { status: 'ready', label, current, previous, partial, fallback: isCurrent && selected[0] === today };
}

export function formatComparison(metric, current, previous) {
  if (!finite(current) || !finite(previous)) return { text: '数据不完整', tone: 'neutral', direction: 0, status: 'incomplete' };
  const delta = current - previous;
  const direction = Math.sign(delta);
  const tone = !direction ? 'flat' : metric === 'cost' ? 'neutral' : direction > 0 ? 'positive' : 'negative';
  const change = `${delta > 0 ? '增加' : '减少'}${money(delta)}元`;
  let text, rate = null;
  if (!direction) text = '持平';
  else if (previous === 0) text = `${current > 0 ? '新增' : '减少'}${money(delta)}元`;
  else if (metric === 'profit' && previous < 0) {
    text = current > 0 ? `扭亏为盈，${change}` : current === 0 ? `盈亏平衡，${change}` : `${delta > 0 ? '减亏' : '增亏'}${money(delta)}元`;
  } else if (metric === 'profit' && current < 0 && previous > 0) text = `由盈转亏，${change}`;
  else if (previous < 0) text = change;
  else {
    rate = delta / previous * 100;
    const rounded = Math.round((Math.abs(rate) + Number.EPSILON) * 10) / 10;
    text = rounded === 0 ? `小幅${delta > 0 ? '增长' : '下降'}` : `${delta > 0 ? '+' : '−'}${rounded.toFixed(1)}%`;
  }
  return { status: 'ready', text, rate, delta, direction, tone };
}

function rowAmounts(row, range) {
  const fullWeek = range[0] <= row.start && range[1] >= row.end;
  let share = 1, allocationIssue = '';
  if (!fullWeek) {
    if (row.pricing === '包月') allocationIssue = '包月日/月分配规则待确认';
    else if (!row.workDates?.length) allocationIssue = '公司工作日历缺失或无工作日';
    else share = row.workDates.filter(d => d >= range[0] && d <= range[1]).length / row.workDates.length;
  }
  // Preserve the preview's cost formula, independently of a missing output price.
  // Optional manual expenses use the existing null=>0 convention; required upstream costs do not.
  const costInputs = [row.internalCost, row.externalCost, row.subsidy ?? 0, row.extra ?? 0];
  const cost = costInputs.every(finite) ? costInputs.reduce((a, b) => a + b, 0) : null;
  const value = finite(row.result?.value) ? row.result.value : null;
  const amounts = { value, cost, profit: value !== null && cost !== null ? value - cost : null };
  return Object.fromEntries(metrics.map(metric => {
    const pending = ['pending', 'calculating', 'stale', 'loading'].includes(row.calcStatus);
    const failed = row.calcStatus === 'failed';
    const issue = allocationIssue || (!row.result ? '无计算结果' : !finite(amounts[metric])
      ? metric === 'cost' ? '成本来源数据缺失' : metric === 'profit' ? '产值或成本缺失，无法计算利润' : row.result?.issue || '产值来源数据缺失' : '');
    const status = pending ? 'calculating' : failed || issue ? 'incomplete' : 'ready';
    return [metric, { status, amount: status === 'ready' ? amounts[metric] * share : null,
      reason: pending ? '源数据已修改，等待重新计算' : failed ? row.calcError || '计算失败' : issue }];
  }));
}

function sumPeriod(rows, projects, range) {
  const entries = rows.filter(r => r.start <= range[1] && r.end >= range[0]).map(row => ({ row, key: row.key, name: row.name, start: row.start, end: row.end, confirmed: row.confirmed, amounts: rowAmounts(row, range) }));
  // Missing weekly records are not zero. Only explicit lifecycle bounds can establish
  // that no business was expected; a later row still counts even after project closure.
  for (const project of projects) {
    const start = project.businessStart && project.businessStart > range[0] ? project.businessStart : range[0];
    const end = project.businessEnd && project.businessEnd < range[1] ? project.businessEnd : range[1];
    if (start > end) continue;
    for (let week = businessWeek(start)[0]; week <= end; week = shift(week, 7)) {
      if (entries.some(e => e.row?.projectId === project.id && e.start <= week && e.end >= shift(week, 6))) continue;
      entries.push({ key: `missing-${project.id}-${week}`, name: project.name, start: week, end: shift(week, 6), amounts: Object.fromEntries(metrics.map(metric => [metric, { status: 'incomplete', amount: null, reason: '缺少该业务周记录，不能视为0' }])) });
    }
  }
  return Object.fromEntries(metrics.map(metric => {
    const issues = entries.filter(e => e.amounts[metric].status !== 'ready');
    const status = !projects.length && !entries.length ? 'empty' : issues.some(e => e.amounts[metric].status === 'calculating') ? 'calculating' : issues.length ? 'incomplete' : 'ready';
    return [metric, { status, amount: status === 'ready' ? entries.reduce((sum, e) => sum + e.amounts[metric].amount, 0) : null,
      entries: entries.map(e => ({ ...e, ...e.amounts[metric] })), unconfirmed: entries.filter(e => e.row && !e.confirmed && e.amounts[metric].status === 'ready') }];
  }));
}

export function buildComparison(state, role, { mode, anchor, today = shanghaiToday(), project = 'all', pm = 'all' }) {
  const periods = comparisonPeriods(mode, anchor, today);
  if (periods.status !== 'ready') return { periods, metrics: Object.fromEntries(metrics.map(metric => [metric, { ...periods, tone: 'neutral', direction: 0 }])) };
  const rows = filterRows(state, role, { project, pm });
  const projects = state.projects.filter(p => canView(p, role) && (project === 'all' || p.id === project) && (pm === 'all' || p.pm === pm));
  const current = sumPeriod(rows, projects, periods.current), previous = sumPeriod(rows, projects, periods.previous);
  return { periods, metrics: Object.fromEntries(metrics.map(metric => {
    const a = current[metric], b = previous[metric];
    const statuses = [a.status, b.status];
    const status = statuses.includes('calculating') ? 'calculating' : statuses.includes('incomplete') ? 'incomplete' : statuses.includes('empty') ? 'empty' : 'ready';
    const display = status === 'ready' ? formatComparison(metric, a.amount, b.amount) : { status, tone: 'neutral', direction: 0, text: { calculating: '计算中', incomplete: '数据不完整', empty: '暂无数据' }[status] };
    return [metric, { ...display, current: a, previous: b, unconfirmed: status === 'ready' && (a.unconfirmed.length > 0 || b.unconfirmed.length > 0) }];
  })) };
}
