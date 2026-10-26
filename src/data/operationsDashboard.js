import dayjs from 'dayjs';

// Isolated preview data. Upstream aggregates are fixtures, not a port of all 26 source formulas.
export const DASHBOARD_KEY = 'mmos.operations.preview.v1';
export const BASELINE = 'MMOS1.0-WEEKLY-20261023-V1';
export const PREVIEW_DATE = '2026-10-23';
export const ACTORS = { PMO: '林晓彤', PM: '王然', 财务: '赵敏' };
export const PM_FIELDS = ['checked', 'subsidy', 'extra', 'deviation', 'measure', 'plan', 'staffPlan', 'note'];
const blank = value => value === null || value === undefined || value === '';
export function businessWeek(date) {
  const d = dayjs(date); const start = d.subtract((d.day() + 2) % 7, 'day');
  return [start.format('YYYY-MM-DD'), start.add(6, 'day').format('YYYY-MM-DD')];
}
export function periodRange(mode, date = PREVIEW_DATE) {
  const d = dayjs(date);
  return mode === 'week' ? businessWeek(date) : mode === 'month' ? [d.startOf('month').format('YYYY-MM-DD'), d.endOf('month').format('YYYY-MM-DD')] : [d.format('YYYY-MM-DD'), d.format('YYYY-MM-DD')];
}
export function datesBetween(start, end) {
  const dates = []; for (let d = dayjs(start); !d.isAfter(dayjs(end), 'day'); d = d.add(1, 'day')) dates.push(d.format('YYYY-MM-DD'));
  return dates;
}
export function canView(row, role, actor = ACTORS[role]) { return ['财务', 'PMO'].includes(role) || role === 'PM' && row.pm === actor; }
export function attentionReasons(row) {
  return [!row.confirmed && '核对量、费用及经营说明未人工确认',
    row.calcStatus === 'failed' && (row.calcError || '计算失败，当前显示上次成功结果'),
    row.result?.issue].filter(Boolean);
}
export function attentionRows(rows) {
  return rows.filter(row => attentionReasons(row).length > 0);
}
export function operationsTodos(state, role, actor = ACTORS[role]) {
  if (!['PM', 'PMO'].includes(role)) return [];
  return attentionRows(state.rows.filter(row => canView(row, role, actor)))
    .sort((a, b) => b.start.localeCompare(a.start) || a.name.localeCompare(b.name, 'zh-CN'));
}
export function calculateWeek(row) {
  if (blank(row.price)) return { value: null, cost: null, profit: null, rate: null, issue: '缺少项目计算单价，请维护上游计价规则' };
  let value;
  if (!blank(row.checked)) value = row.checked * row.price / 1.06;
  else if (row.pricing === '包月') {
    if (!(row.customerDays > 0)) return { value: null, cost: null, profit: null, rate: null, issue: '缺少有效的客户要求出勤天数' };
    value = row.autoVolume / 8 / row.customerDays * row.price;
  } else value = row.autoVolume * row.price / 1.06;
  const cost = row.internalCost + row.externalCost + (row.subsidy ?? 0) + (row.extra ?? 0);
  const profit = value - cost;
  return { value, cost, profit, rate: value === 0 ? null : profit / value, issue: value === 0 ? '产值为0，利润率无有效结果' : '' };
}

export function createPreview() {
  const names = ['星河智能客服项目', '海外内容审核产线', '语音质检专项', '数学 OCR 试标项目', '多语种语音采集', '零售数据标注项目', '广告文案改写', '自动驾驶图像标注', '金融语义评测', '短视频内容理解', '医疗文本清洗', '跨境语料审核', '知识问答评测', '包月语音服务'];
  const ratios = [.46, .59, .68, .77, .83, .92, 1.12, 1.28, 1.45, 1.76, 2.4, 1.15, 1, .72];
  const projects = names.map((name, i) => ({ id: `demo-ops-${i + 1}`, name, pm: ['王然', '陈默', '林晓彤'][i % 3], pricing: i === 13 ? '包月' : ['计件', '包时', '包天'][i % 3], price: i === 12 ? null : i === 13 ? 18000 : [2.12, 53, 42.4][i % 3], mainProject: name.replace(/项目|专项|产线/g, ''), mentor: i % 3 === 0 ? '赵子涵' : '—' }));
  const rows = [];
  for (let w = 0; w < 8; w++) {
    const start = dayjs('2026-09-04').add(w * 7, 'day').format('YYYY-MM-DD'); const end = dayjs(start).add(6, 'day').format('YYYY-MM-DD');
    projects.forEach((p, i) => {
      const autoVolume = i === 13 ? 800 : p.pricing === '计件' ? (15000 + i * 850) * (1 + w * .045) : (620 + i * 45) * (1 + w * .045);
      const unsubmitted = i % 4 === 0 && w === 7;
      const checked = unsubmitted || i === 13 ? null : i === 11 ? 0 : Math.round(autoVolume * .97 * 100) / 100;
      const approximate = (checked ?? autoVolume) * (p.price ?? 2.12) / 1.06;
      const totalBase = i === 11 ? 1800 : i === 13 ? 60000 : approximate * ratios[i];
      const row = { key: `${p.id}-${start}`, projectId: p.id, name: p.name, pm: p.pm, main: p.id, mainName: p.mainProject, mentor: p.mentor, pricing: p.pricing, price: p.price,
        weekId: `WEEK-${w + 1}-${String(i + 1).padStart(3, '0')}`, start, end, submittedAt: unsubmitted ? '' : `${start} 10:20:00`, confirmed: !unsubmitted && i !== 13,
        checked, autoVolume, subsidy: unsubmitted ? null : 200, extra: unsubmitted ? null : 100, internalCost: totalBase * .7, externalCost: totalBase * .3, trialCost: 120,
        customerDays: 22, deviation: unsubmitted ? '' : ratios[i] > 1 ? '新批次难度增加，复核耗时高于预计，当前利润为负。' : '本周交付与质量正常，无新增风险。', measure: unsubmitted ? '' : ratios[i] > 1 ? '复盘错误样本，优化作业指引，跟进下周人效。' : '持续抽检，按计划交付。', plan: '', staffPlan: i % 2 ? '下周保持现有人员配置' : '', note: '', annotation: i === 6 ? '请跟进返工工时，下周同步优化效果。' : '',
        seniorPmDays: 1, pmDays: 5, assistantDays: 3, seniorAssistantDays: 0, qaDays: 4, fulltimeDays: 30 + i, offlineDays: 5, onlineDays: 2, externalHours: 160 + i * 8, workers: 12 + i, inspectors: 2 + i % 3,
        // Explicit sample calendar and source-date allocations; replace with actual upstream records in production.
        workDates: datesBetween(start, end).filter(d => ![0, 6].includes(dayjs(d).day())), updatedAt: `${start} 11:00:00`, revision: 0, audit: [], calcStatus: 'ready' };
      row.result = calculateWeek(row);
      if (i === 9 && w === 7) { row.calcStatus = 'failed'; row.calcError = '模拟上游计算服务暂不可用；保留上次成功结果'; }
      rows.push(row);
    });
  }
  const finance = projects.flatMap((p, i) => [
    { projectId: p.id, date: '2026-10-23', kind: 'invoiced', amount: 24000 + i * 1400 },
    { projectId: p.id, date: '2026-10-23', kind: 'uninvoiced', amount: 6000 + i * 400 },
    { projectId: p.id, date: '2026-10-23', kind: 'received', amount: i % 3 === 0 ? 0 : i % 3 === 1 ? 12000 : 24000 + i * 1400 },
  ]);
  return { version: 1, revision: 0, projects, rows, finance };
}
export function loadPreview() {
  const raw = localStorage.getItem(DASHBOARD_KEY);
  if (!raw) return supplementComparisonDemo(createPreview());
  const data = JSON.parse(raw);
  if (data.version !== 1 || !Array.isArray(data.rows) || !Array.isArray(data.projects)) throw new Error('本地预览数据格式不匹配，请保留数据并联系维护人员。');
  return supplementComparisonDemo(data);
}

// Additive demo fixtures: existing projects, user edits and audit trails are never replaced.
export function supplementComparisonDemo(state) {
  const template = createPreview().rows[0];
  const cases = [
    { id: 'demo-mom-growth', name: '环比示例·智能文本标注', pm: '王然', demoLabel: '利润增长', ratio: w => .76 - w * .015, volume: w => 12000 + w * 900 },
    { id: 'demo-mom-decline', name: '环比示例·语音数据质检', pm: '陈默', demoLabel: '利润下降', ratio: w => .55 + w * .025, volume: w => 18000 - w * 400 },
    { id: 'demo-mom-recovery', name: '环比示例·图像返工优化', pm: '王然', demoLabel: '亏损收窄', ratio: w => 1.65 - w * .045, volume: () => 15000 },
  ];
  const extraProjects = cases.map(({ id, name, pm, demoLabel }) => ({ id, name, pm, demoLabel, pricing: '计件', price: 2.12, mainProject: name, mentor: '—', businessStart: '2026-08-28' }));
  const extraRows = cases.flatMap(p => Array.from({ length: 9 }, (_, w) => {
    const start = dayjs('2026-08-28').add(w * 7, 'day').format('YYYY-MM-DD'), end = dayjs(start).add(6, 'day').format('YYYY-MM-DD');
    const checked = p.volume(w), cost = checked * 2 * p.ratio(w);
    const row = { ...template, key: `${p.id}-${start}`, projectId: p.id, name: p.name, main: p.id, mainName: p.name, pm: p.pm, mentor: '—',
      weekId: `DEMO-MOM-${p.id.split('-').at(-1)}-${start}`, start, end, submittedAt: `${start} 10:20:00`, updatedAt: `${start} 11:00:00`,
      checked, autoVolume: checked, price: 2.12, pricing: '计件', internalCost: cost * .7, externalCost: cost * .3, subsidy: 0, extra: 0,
      confirmed: true, calcStatus: 'ready', revision: 0, audit: [], annotation: '', plan: '', staffPlan: '',
      deviation: `${p.demoLabel}模拟场景，供环比交互测试使用。`, measure: '模拟周报已完成核对，可进入详情修改并观察环比变化。', note: '新增完整历史模拟数据；非真实业务记录。',
      workDates: datesBetween(start, end).filter(d => ![0, 6].includes(dayjs(d).day())) };
    return { ...row, result: calculateWeek(row) };
  }));
  const projectIds = new Set(state.projects.map(p => p.id)), rowKeys = new Set(state.rows.map(r => r.key));
  return { ...state, projects: [...state.projects, ...extraProjects.filter(p => !projectIds.has(p.id))], rows: [...state.rows, ...extraRows.filter(r => !rowKeys.has(r.key))] };
}
export function filterRows(state, role, { project = 'all', pm = 'all', range } = {}) {
  return state.rows.filter(r => canView(r, role) && (project === 'all' || r.projectId === project) && (pm === 'all' || r.pm === pm) && (!range || r.start <= range[1] && r.end >= range[0]));
}
export function rowSlice(row, range) {
  const result = row.result;
  if (!result || result.value === null) return { value: null, cost: null, profit: null, rate: null, issue: result?.issue || '无计算结果' };
  const fullWeek = range[0] <= row.start && range[1] >= row.end;
  if (fullWeek) return { ...result, issue: row.calcStatus === 'failed' ? '计算失败，保留旧结果' : result.issue };
  if (row.pricing === '包月') return { value: null, cost: null, profit: null, rate: null, issue: '包月日/月分配规则待确认' };
  if (!row.workDates.length) return { value: null, cost: null, profit: null, rate: null, issue: '公司工作日历缺失或无工作日' };
  const share = row.workDates.filter(d => d >= range[0] && d <= range[1]).length / row.workDates.length;
  // Demo source cost dates use this same explicit calendar, independently of manual costs.
  const value = result.value * share, cost = result.cost * share, profit = value - cost;
  return { value, cost, profit, rate: value === 0 ? null : profit / value, issue: row.calcStatus === 'failed' ? '计算失败，保留旧结果' : result.issue };
}
export function aggregate(rows, range) {
  const grouped = new Map();
  for (const row of rows) {
    const item = grouped.get(row.projectId) || { id: row.projectId, name: row.name, pm: row.pm, value: 0, cost: 0, profit: 0, count: 0, issues: [] };
    const v = rowSlice(row, range);
    if (v.value !== null) { item.value += v.value; item.cost += v.cost; item.profit += v.profit; item.count++; }
    if (v.issue) item.issues.push(v.issue);
    if (!row.confirmed) item.issues.push('人工内容未确认');
    grouped.set(row.projectId, item);
  }
  return [...grouped.values()].map(x => ({ ...x, value: x.count ? x.value : null, cost: x.count ? x.cost : null, profit: x.count ? x.profit : null, rate: x.count && x.value !== 0 ? x.profit / x.value : null, issues: [...new Set(x.issues)] }));
}
export function summarize(projects) {
  return { value: projects.reduce((s, p) => s + (p.value ?? 0), 0), cost: projects.reduce((s, p) => s + (p.cost ?? 0), 0), profit: projects.reduce((s, p) => s + (p.profit ?? 0), 0), count: projects.length, valid: projects.filter(p => p.value !== null).length, incomplete: projects.some(p => p.issues.length) };
}
export function chartProjects(projects, config = { mode: 'default', ids: [] }) {
  const positive = projects.filter(p => p.profit > 0).sort((a, b) => b.profit - a.profit);
  const negative = projects.filter(p => p.profit !== null && p.profit < 0).sort((a, b) => a.profit - b.profit);
  if (config.mode === 'default') return [...positive.slice(0, 5), ...negative.slice(0, 5)];
  if (config.mode === 'custom') return config.ids.map(id => projects.find(p => p.id === id)).filter(Boolean);
  // Preview-only ordering for positive/negative modes, not a finalized business ranking rule.
  return (config.mode === 'positive' ? positive : negative).slice(0, 10);
}
export function validateChart(ids, allowed, role) {
  if (!['PM', 'PMO', '财务'].includes(role)) throw new Error('当前身份无权限配置图表');
  if (ids.length > 10) throw new Error('每张图最多选择10个项目，原配置已保留');
  if (new Set(ids).size !== ids.length || ids.some(id => !allowed.includes(id))) throw new Error('包含重复或无权限项目，原配置已保留');
}
export function updateReport(state, key, patch, role, kind = 'report', now = new Date().toISOString(), expectedRevision) {
  const row = state.rows.find(r => r.key === key);
  if (!row || !canView(row, role)) throw new Error('无权访问此项目周报');
  if (role === '财务' || kind === 'annotation' && role !== 'PMO') throw new Error('当前身份没有此项编辑权限');
  if (expectedRevision !== undefined && row.revision !== expectedRevision) throw new Error('记录已更新，请重新打开后核对修改内容');
  const allowed = kind === 'annotation' ? ['annotation'] : PM_FIELDS;
  if (Object.keys(patch).some(k => !allowed.includes(k))) throw new Error('不能编辑系统字段或其他角色字段');
  const next = { ...row, ...patch };
  if (kind === 'report') {
    for (const k of ['checked', 'subsidy', 'extra']) if (blank(next[k]) || typeof next[k] !== 'number' || !Number.isFinite(next[k])) throw new Error('核对有效量、项目补贴、额外成本均须填写数字；无费用请填0');
    if (!next.deviation?.trim() || !next.measure?.trim()) throw new Error('请填写关键偏差及针对性应对措施，无风险也需说明');
    next.confirmed = true; next.submittedAt = row.submittedAt || now;
    next.result = calculateWeek(next); next.calcStatus = 'ready'; next.updatedAt = now;
  }
  next.revision = row.revision + 1;
  next.audit = [{ actor: ACTORS[role], role, time: now, action: kind === 'annotation' ? '保存PMO批注' : role === 'PMO' ? 'PMO代填周报' : '提交周补充', fields: Object.keys(patch), result: '成功' }, ...row.audit];
  return { ...state, revision: state.revision + 1, rows: state.rows.map(r => r.key === key ? next : r) };
}
export function persistPreview(previous, next) {
  const stored = localStorage.getItem(DASHBOARD_KEY);
  if (stored && JSON.parse(stored).revision !== previous.revision) throw new Error('另一个页面已更新预览数据，请重新载入后核对；本次输入已保留');
  localStorage.setItem(DASHBOARD_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('mmos:operations-updated'));
}
export const REPORT_FIELDS = [
  ['name', '项目名称'], ['submittedAt', '提交日期'], ['main', '主项目'], ['mainName', '主项目名称'], ['pm', 'PM'], ['mentor', '带教PM'], ['pricing', '计价方式'], ['price', '项目单价（元）'], ['weekId', 'WEEK_ID'], ['start', '开始时间'], ['end', '结束时间'],
  ['seniorPmDays', '中级项目经理出勤人天'], ['pmDays', '项目经理出勤人天'], ['assistantDays', '项目助理出勤人天'], ['seniorAssistantDays', '高级项目助理'], ['qaDays', '质控组长（QA）出勤人天'], ['fulltimeDays', '全职（已缴社保）出勤人天'], ['offlineDays', '线下实习生出勤人天'], ['onlineDays', '线上实习生出勤人天'], ['externalHours', '外部人员出勤时长'],
  ['externalCost', '本周外部人员作业发生费用（元）'], ['trialCost', '本周外部试标成本（如有）'], ['subsidy', '本周项目补贴发生费用（元）'], ['extra', '本周额外成本计算（元）'], ['cost', '合计成本发生（元）'], ['autoVolume', '项目产出有效量级'], ['checked', '核对有效量'], ['value', '本周有效产值预估（元）'], ['profit', '本周收支利润预估（元）'], ['rate', '利润率（%）'], ['workers', '现有作业人数'], ['inspectors', '现有质检人数（包含项目助理）'],
  ['deviation', '关键偏差（人员、质量、交付、亏损维度上存在的问题）'], ['measure', '针对性应对措施'], ['plan', '下周计划（完成量）'], ['staffPlan', '下周上人计划'], ['note', '补充备注'], ['annotation', '批注列（由PMO填写）'],
];
