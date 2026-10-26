import React from 'react';
import { Alert, Badge, Button, Card, DatePicker, Descriptions, Empty, Form, Input, InputNumber, Modal, Segmented, Select, Space, Spin, Table, Tabs, Tag, Tooltip, message } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, BarChartOutlined, InfoCircleOutlined, SettingOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { ACTORS, BASELINE, PREVIEW_DATE, REPORT_FIELDS, aggregate, attentionReasons, attentionRows, businessWeek, canView, chartProjects, datesBetween, filterRows, periodRange, persistPreview, summarize, updateReport, validateChart } from '../data/operationsDashboard';
import { buildComparison, shanghaiToday } from '../data/operationsComparison';
import './operations-workbench.css';
import { useOperationsPreview } from '../hooks/useOperationsPreview';

const money = n => n === null || n === undefined ? '—' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number = n => n === null || n === undefined || n === '' ? '—' : typeof n === 'number' ? n.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : n;
const percent = n => n === null || n === undefined ? '—' : `${(n * 100).toFixed(2)}%`;
const modes = [{ value: 'default', label: '默认5正5负' }, { value: 'positive', label: '仅正利润' }, { value: 'negative', label: '仅负利润' }, { value: 'custom', label: '自选项目' }];
const metricLabels = { value: '合计产值', cost: '合计成本', profit: '合计利润' };
const tones = { value: '#3579F6', cost: '#15B88A', profit: '#7761F5' };
const comparisonRange = range => range?.join(' 至 ');
function Comparison({ metric, comparison, onOpen }) {
  const { periods, metrics } = comparison, result = metrics[metric];
  if (periods.status === 'hidden') return null;
  const tooltip = periods.status === 'ready' ? <div className="ops-comparison-tooltip">
    <div>本期：{comparisonRange(periods.current)}</div><div>金额：{money(result.current.amount)} 元</div>
    <div>上期：{comparisonRange(periods.previous)}</div><div>金额：{money(result.previous.amount)} 元</div>
    {result.delta !== undefined && <div>差额：{result.delta > 0 ? '+' : result.delta < 0 ? '−' : ''}{money(Math.abs(result.delta))} 元</div>}
    <div>{result.status === 'ready' ? '点击查看比较明细及涉及周报' : '点击查看缺失、计算状态及涉及周报'}</div>
  </div> : result.text;
  return <div className="ops-comparison" data-metric={metric}>
    <span className="ops-comparison-label">{periods.label}</span>
    <Tooltip title={tooltip} trigger={['hover', 'focus']}>
      <button type="button" className={`ops-comparison-value is-${result.tone}`} aria-label={`${metricLabels[metric]}${periods.label}：${result.text}，查看说明`} onClick={() => onOpen(metric)}>
        {result.direction > 0 ? <ArrowUpOutlined /> : result.direction < 0 ? <ArrowDownOutlined /> : null}<span>{result.text}</span><InfoCircleOutlined />
      </button>
    </Tooltip>
    {result.unconfirmed && <button type="button" className="ops-unconfirmed-link" onClick={() => onOpen(metric)}>含未确认数据</button>}
  </div>;
}
function ComparisonDetail({ metric, comparison, onClose, onReport }) {
  const { periods, metrics } = comparison, result = metrics[metric];
  const priority = row => row.reason ? 0 : row.confirmed ? 2 : 1;
  const rows = periods.status === 'ready' ? ['current', 'previous'].flatMap(period => result[period].entries.map(entry => ({ ...entry, id: `${period}-${entry.key}`, period: period === 'current' ? '本期' : '上期' }))).sort((a, b) => priority(a) - priority(b)) : [];
  return <Modal className="ops-detail-modal" title={`${metricLabels[metric]} · ${periods.label}`} open onCancel={onClose} width={880} footer={<Button onClick={onClose}>关闭</Button>}>
    <Alert showIcon type={result.status === 'ready' ? result.unconfirmed ? 'warning' : 'info' : 'warning'} title={result.text} description={result.unconfirmed ? '含未确认数据，可点击下方周报核对；相关周报全部确认后提示自动消除。' : periods.status === 'ready' ? '主指标保留原统计范围；此处仅展示环比的两期日期与金额。缺失或计算中的金额不计为0。' : undefined} />
    {periods.status === 'ready' && <>
      <Descriptions className="ops-comparison-periods" size="small" bordered column={1} items={[
        { key: 'current', label: '本期', children: `${comparisonRange(periods.current)} · ${money(result.current.amount)} 元` },
        { key: 'previous', label: '上期', children: `${comparisonRange(periods.previous)} · ${money(result.previous.amount)} 元` },
        { key: 'delta', label: '金额差额', children: result.delta === undefined ? '—' : `${result.delta > 0 ? '+' : result.delta < 0 ? '−' : ''}${money(Math.abs(result.delta))} 元` },
      ]} />
      <Table size="small" rowKey="id" dataSource={rows} scroll={{ x: 650 }} pagination={{ defaultPageSize: 6, showTotal: total => `共 ${total} 条比较记录` }} columns={[
        { title: '期间', dataIndex: 'period', width: 60 },
        { title: '项目 / 业务周', width: 250, render: (_, r) => <div>{r.row ? <Button type="link" className="ops-project-link" onClick={() => onReport(r.key)}>{r.name}</Button> : r.name}<div className="ops-small ops-muted">{r.start} 至 {r.end}</div></div> },
        { title: '期间金额（元）', dataIndex: 'amount', align: 'right', width: 150, render: money },
        { title: '状态 / 原因', render: (_, r) => r.reason || <Tag color={r.confirmed ? 'success' : 'warning'}>{r.confirmed ? '已人工确认' : '未提交确认'}</Tag> },
      ]} />
      <p className="ops-chart-note">分别汇总两期实际业务，包含新增项目及已结束项目仍发生的业务；项目与PM筛选、查看权限保持一致。部分周的金额按现有预览工作日历分摊。</p>
    </>}
  </Modal>;
}
const chartBase = { animationDuration: 250, textStyle: { fontFamily: 'Inter, Microsoft YaHei, sans-serif', color: '#72839F' }, tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#E7EFF9', textStyle: { color: '#192A46', fontSize: 12 }, confine: true }, grid: { top: 55, bottom: 70, left: 16, right: 20, containLabel: true }, legend: { top: 6, icon: 'circle', itemWidth: 8, textStyle: { color: '#5E718F', fontSize: 12 } }, yAxis: { type: 'value', splitLine: { lineStyle: { color: '#EEF3FA', type: 'dashed' } } } };
function Status({ row }) { return <Space size={4} wrap><Tag color={row.confirmed ? 'success' : 'warning'}>{row.confirmed ? '已人工确认' : '未提交确认'}</Tag>{row.calcStatus === 'failed' ? <Tag color="error">计算失败 · 旧结果</Tag> : row.result?.value === null ? <Tag color="error">数据缺失</Tag> : <Tag color="blue">有计算结果</Tag>}</Space>; }
function ProjectChart({ title, subtitle, type, projects, role, onProject }) {
  const [config, setConfig] = React.useState({ mode: 'default', ids: [] }), [open, setOpen] = React.useState(false), [draft, setDraft] = React.useState([]), [configError, setConfigError] = React.useState('');
  const [manager, setManager] = React.useState('all');
  const candidates = projects.filter(p => manager === 'all' || p.pm === manager);
  React.useEffect(() => { setConfig({ mode: 'default', ids: [] }); setOpen(false); }, [role]);
  const visible = chartProjects(projects, config);
  const selectMode = mode => { if (mode === 'custom') { setDraft(config.ids); setManager('all'); setConfigError(''); setOpen(true); } else setConfig({ mode, ids: [] }); };
  const save = () => { try { validateChart(draft, projects.map(p => p.id), role); setConfig({ mode: 'custom', ids: draft }); setOpen(false); } catch (e) { setConfigError(e.message); } };
  const series = type === 'rate' ? [
    { name: '正利润率', color: '#F5A442', matches: rate => rate > 0 },
    { name: '负利润率', color: '#F06570', matches: rate => rate < 0 },
    { name: '零利润率', color: '#72839F', matches: rate => rate === 0 },
  ].map(({ matches, ...s }, index) => ({ ...s, type: 'bar', stack: 'rate', barMaxWidth: 30,
    data: visible.map(p => p.rate !== null && matches(p.rate) ? p.rate * 100 : null),
    itemStyle: { color: s.color, borderRadius: index === 1 ? [0, 0, 4, 4] : [4, 4, 0, 0] },
    markLine: index === 2 ? { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: '#9EACC0', type: 'solid' }, label: { show: false } } : undefined,
  })) : [
    { name: '产值', color: '#3579F6', data: visible.map(p => p.value) }, { name: '成本', color: '#15B88A', data: visible.map(p => p.cost) }, { name: '正利润', color: '#F5A442', data: visible.map(p => p.profit > 0 ? p.profit : 0) }, { name: '负利润', color: '#F06570', data: visible.map(p => p.profit < 0 ? p.profit : 0) },
  ].map(s => ({ ...s, type: 'bar', stack: 'amount', barMaxWidth: 30, itemStyle: { color: s.color } }));
  const option = { ...chartBase, legend: { ...chartBase.legend, ...(type === 'rate' ? { data: ['正利润率', '负利润率'] } : {}) }, xAxis: { type: 'category', data: visible.map(p => p.name), axisTick: { show: false }, axisLine: { lineStyle: { color: '#E7EFF9' } }, axisLabel: { interval: 0, rotate: 28, fontSize: 10, formatter: v => v.length > 8 ? `${v.slice(0, 8)}…` : v } }, yAxis: { ...chartBase.yAxis, name: type === 'rate' ? '%' : '元', axisLabel: { formatter: type === 'rate' ? '{value}%' : value => Math.abs(value) >= 10000 ? `${value / 10000}万` : value } }, tooltip: { ...chartBase.tooltip, valueFormatter: v => v === null ? '无有效结果' : type === 'rate' ? `${Number(v).toFixed(2)}%` : `¥ ${money(v)}` }, series };
  return <Card className="ops-chart" title={<div><h2>{title}</h2><p>{subtitle}</p></div>} extra={<Space size={6}><Tag variant="filled">{visible.length} / 10</Tag>{<Select aria-label={`${title}模式`} value={config.mode} options={modes} onChange={selectMode} style={{ width: 138 }} />}{config.mode === 'custom' && <Button aria-label={`配置${title}项目`} icon={<SettingOutlined />} onClick={() => selectMode('custom')} />}</Space>}>
    {visible.length ? <ReactECharts option={option} notMerge style={{ height: 315 }} onEvents={{ click: event => { if (event.componentType === 'series' && visible[event.dataIndex]) onProject(visible[event.dataIndex].id); } }} /> : <Empty description="当前筛选范围没有可展示的项目" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
    <p className="ops-chart-note">{type === 'rate' ? '正利润率黄色，负利润率红色；纵轴随实际比例自适应，无有效比例显示为缺失，不记作0%。' : '堆叠仅用于比较，柱高不是经营合计；点击柱形可查看项目周报。'}</p>
    {visible.some(p => p.issues.length) && <div className="ops-chart-note warning">含未确认或不完整结果，具体原因见项目周报。</div>}
    <Modal title={`配置${title}项目`} open={open} onCancel={() => setOpen(false)} onOk={save} okText="应用配置" cancelText="取消">
      <p>最多10个项目。此图配置独立生效，不改变期间合计、趋势和周报列表。</p>
      <label className="ops-config-label">按项目经理筛选</label>
      <Select aria-label={`${title}项目经理筛选`} value={manager} onChange={setManager} showSearch optionFilterProp="label" options={[{ value: 'all', label: '全部项目经理' }, ...[...new Set(projects.map(p => p.pm))].map(value => ({ value, label: value }))]} style={{ width: '100%', marginBottom: 12 }} />
      <Select aria-label={`${title}选择项目`} mode="multiple" value={draft} onChange={setDraft} options={candidates.map(p => ({ value: p.id, label: `${p.name} · ${p.pm}` }))} labelRender={({ value }) => { const p = projects.find(p => p.id === value); return p ? `${p.name} · ${p.pm}` : value; }} style={{ width: '100%' }} placeholder="搜索并选择项目" optionFilterProp="label" />
      <p className="ops-chart-note">项目经理筛选仅缩小本弹窗的候选项目，已选项目保留，可跨经理组合。当前候选 {candidates.length} 个。</p>
      <p className={draft.length > 10 ? 'ops-negative' : 'ops-muted'}>已选 {draft.length} / 10</p>{configError && <Alert type="error" showIcon title={configError} />}
    </Modal>
  </Card>;
}
function Trend({ rows: authorizedRows, range, projects, role }) {
  const [grain, setGrain] = React.useState('day');
  // null means all authorized projects, including newly added ones; [] means none.
  const [selection, setSelection] = React.useState(null), [draft, setDraft] = React.useState(null), [open, setOpen] = React.useState(false);
  const allowed = new Set(projects.map(p => p.id));
  const selectedIds = selection === null ? [...allowed] : selection.filter(id => allowed.has(id));
  const draftIds = draft === null ? [...allowed] : draft.filter(id => allowed.has(id));
  const selected = new Set(selectedIds);
  const rows = authorizedRows.filter(row => selected.has(row.projectId));
  const configure = () => { setDraft(selection); setOpen(true); };
  const apply = () => { setSelection(draft === null ? null : draftIds); setOpen(false); };
  const scope = selection === null ? `${role === 'PM' ? '本人' : '公司'}全部 ${selectedIds.length} 个项目` : `已选 ${selectedIds.length} / ${projects.length} 个项目`;
  const buckets = new Map();
  datesBetween(...range).forEach(date => {
    const key = grain === 'day' ? date : grain === 'week' ? businessWeek(date)[0] : date.slice(0, 7);
    const bucket = buckets.get(key); if (bucket) bucket.end = date; else buckets.set(key, { key, start: date, end: date });
  });
  const points = [...buckets.values()].map(b => ({ ...b, totals: summarize(aggregate(rows.filter(r => r.start <= b.end && r.end >= b.start), [b.start, b.end])) }));
  const option = { ...chartBase, grid: { ...chartBase.grid, bottom: 25 }, xAxis: { type: 'category', data: points.map(p => grain === 'day' ? p.key.slice(5) : grain === 'week' ? `${p.key.slice(5)} 起` : p.key), boundaryGap: false, axisLine: { lineStyle: { color: '#E7EFF9' } }, axisTick: { show: false } }, yAxis: { ...chartBase.yAxis, name: '元', axisLabel: { formatter: n => Math.abs(n) >= 10000 ? `${n / 10000}万` : n } }, tooltip: { ...chartBase.tooltip, valueFormatter: n => `¥ ${money(n)}` }, series: Object.keys(metricLabels).map(key => ({ name: metricLabels[key], type: 'line', smooth: false, symbolSize: 6, connectNulls: false, data: points.map(p => p.totals.valid ? p.totals[key] : null), itemStyle: { color: tones[key] }, lineStyle: { width: 2 } })) };
  return <Card className="ops-chart ops-trend" title={<div><h2>经营趋势</h2><p>{scope} · {points.length} 个时间点</p></div>} extra={<Space wrap size={8}><Segmented aria-label="趋势粒度" value={grain} onChange={setGrain} options={[{ value: 'day', label: '日' }, { value: 'week', label: '周' }, { value: 'month', label: '月' }]} /><Button icon={<SettingOutlined />} onClick={configure}>配置项目</Button></Space>}>
    {rows.length ? <ReactECharts option={option} notMerge style={{ height: 245 }} /> : <Empty description={selectedIds.length ? '所选项目在当前期间暂无周报数据' : '尚未选择趋势项目，请点击“配置项目”选择'} image={Empty.PRESENTED_IMAGE_SIMPLE} />}
    <p className="ops-chart-note">日期范围：{range.join(' 至 ')}。项目范围在本图独立配置，不受顶部项目、PM筛选影响。</p>
    <p className="ops-chart-note">按周核对有效量均摊值，非实际值。示例工作日历待替换为公司日历。{points.some(p => p.totals.incomplete) ? '含未确认、缺失或旧结果，当前曲线为可计算部分。' : ''}</p>
    <Modal title="配置经营趋势项目" open={open} onCancel={() => setOpen(false)} onOk={apply} okText="应用配置" cancelText="取消" width={600}>
      <p>{role === 'PM' ? '可选择本人负责的项目，默认全部选中。' : '可选择公司授权范围内的项目，默认全部选中。'}本次选择仅改变经营趋势图。</p>
      <div className="ops-trend-selection-actions"><Space><Button size="small" onClick={() => setDraft(null)}>全选</Button><Button size="small" onClick={() => setDraft([])}>清空</Button></Space><span>已选 {draftIds.length} / {projects.length} 个项目</span></div>
      <Select aria-label="经营趋势选择项目" mode="multiple" value={draftIds} onChange={setDraft} options={projects.map(p => ({ value: p.id, label: `${p.name} · ${p.pm}` }))} style={{ width: '100%' }} placeholder="搜索并选择项目" optionFilterProp="label" maxTagCount="responsive" allowClear />
      <p className="ops-chart-note">支持多选，不设10个项目限制。点击“应用配置”后生效；取消保留原选择。配置在本次页面会话内有效。</p>
    </Modal>
  </Card>;
}
function ReportEditor({ row, state, role, kind, onClose, onSaved }) {
  const [form] = Form.useForm(), [saving, setSaving] = React.useState(false), [error, setError] = React.useState('');
  const submit = async () => {
    try {
      const values = await form.validateFields(); setSaving(true); setError('');
      const next = updateReport(state, row.key, values, role, kind, dayjs().format('YYYY-MM-DD HH:mm:ss'), row.revision);
      persistPreview(state, next); onSaved(next); message.success(kind === 'annotation' ? '批注已保存' : '周补充已保存，经营数据已更新'); onClose();
    } catch (e) { if (!e.errorFields) setError(e.message); } finally { setSaving(false); }
  };
  const label = key => REPORT_FIELDS.find(([k]) => k === key)?.[1];
  return <Modal title={kind === 'annotation' ? 'PMO批注' : `${role === 'PMO' ? '代填' : '填写'}周补充`} open onCancel={onClose} onOk={submit} confirmLoading={saving} okText="保存" cancelText="取消" width={760} destroyOnHidden>
    <div className="ops-edit-context"><strong>{row.name}</strong><span>{row.start} 至 {row.end} · PM {row.pm}</span><small>首次提交：{row.submittedAt || '首次成功提交后自动记录'} · 实际操作人：{role} {ACTORS[role]}</small></div>
    {kind !== 'annotation' && <Alert type="info" showIcon title={`自动参考量 ${number(row.autoVolume)}；${row.pricing === '包月' ? '包月核对量单位待确认，本预览保留原公式分支' : row.pricing === '计件' ? '核对量单位：件' : '核对量单位：小时（包天单价已换为小时价）'}。无费用请明确填写0。`} />}
    <Form form={form} layout="vertical" initialValues={row} className="ops-edit-form">
      {kind === 'annotation' ? <Form.Item name="annotation" label="批注列（由PMO填写）"><Input.TextArea rows={5} /></Form.Item> : <>
        <div className="ops-form-grid">{['checked', 'subsidy', 'extra'].map(key => <Form.Item key={key} name={key} label={label(key)} rules={[{ required: true, message: '请填写数字，无发生请填0' }]}><InputNumber aria-label={label(key)} style={{ width: '100%' }} controls={false} /></Form.Item>)}</div>
        {['deviation', 'measure', 'plan', 'staffPlan', 'note'].map(key => <Form.Item key={key} name={key} label={label(key)} rules={['deviation', 'measure'].includes(key) ? [{ required: true, whitespace: true, message: '请填写说明；无风险也需要说明' }] : []}><Input.TextArea rows={key === 'deviation' || key === 'measure' ? 2 : 1} /></Form.Item>)}
        {row.annotation && <Alert type="info" title="PMO批注（只读）" description={row.annotation} />}
      </>}
    </Form>{error && <Alert type="error" showIcon title={error} />}
  </Modal>;
}
function ReportDetail({ row, role, state, onClose, onEdit }) {
  const result = row.result || {}; const merged = { ...row, ...result };
  const items = (start, end) => REPORT_FIELDS.slice(start, end).map(([key, label]) => ({ key, label, children: key === 'rate' ? percent(merged[key]) : number(merged[key]) }));
  const finance = state.finance.filter(f => f.projectId === row.projectId && f.date >= row.start && f.date <= row.end);
  const amount = kind => finance.filter(f => f.kind === kind).reduce((sum, f) => sum + f.amount, 0);
  const invoiced = amount('invoiced'), received = amount('received');
  return <Modal className="ops-detail-modal" title={<div>{row.name}<div className="ops-muted ops-small">{row.start} 至 {row.end} · {row.weekId}</div></div>} open onCancel={onClose} width={960} footer={<Space>{role === 'PMO' && <Button onClick={() => onEdit('annotation')}>编辑批注</Button>}{role !== '财务' && <Button type="primary" onClick={() => onEdit('report')}>编辑周补充</Button>}<Button onClick={onClose}>关闭</Button></Space>}>
    <Status row={row} />{(result.issue || row.calcStatus === 'failed') && <Alert style={{ marginTop: 12 }} type="warning" showIcon title={row.calcStatus === 'failed' ? row.calcError : result.issue} />}
    <Tabs items={[
      { key: 'operation', label: '经营数据', children: <><Descriptions size="small" bordered column={{ xs: 1, sm: 2 }} items={items(0, 11)} /><h3>产出与经营结果</h3><Descriptions size="small" bordered column={{ xs: 1, sm: 2 }} items={items(20, 32)} /><p className="ops-muted">试标成本已包含在外部作业费用中，不再次计入合计成本。自动量不代表人工确认。</p></> },
      { key: 'attendance', label: '人员与出勤', children: <><Descriptions size="small" bordered column={{ xs: 1, sm: 2 }} items={items(11, 20)} /><p className="ops-muted">保留源字段名称与统计语义；周人数不累加为月度唯一人数。</p></> },
      { key: 'notes', label: '计划与说明', children: <Descriptions size="small" bordered column={1} items={items(32, 38)} /> },
      { key: 'finance', label: '开票与回款', children: <><Alert type="info" title="独立的模拟财务来源，按业务发生日期统计；不由周报产值反推。" /><Descriptions style={{ marginTop: 16 }} bordered column={{ xs: 1, sm: 2 }} items={[{ key: 'inv', label: '已开票', children: money(invoiced) }, { key: 'uninv', label: '未开票', children: money(amount('uninvoiced')) }, { key: 'received', label: '实际回款', children: money(received) }, { key: 'status', label: '回款状态', children: invoiced ? <Tag color={received >= invoiced ? 'success' : 'warning'}>{received >= invoiced ? '已回款' : received > 0 ? '部分回款' : '待回款'}</Tag> : '暂无已开票记录' }]} /><p className="ops-muted">维护仍在原财务业务模块完成。此处仅展示本周项目级汇总。</p></> },
      { key: 'audit', label: '操作记录', children: <><Descriptions size="small" column={1} items={[{ key: 'baseline', label: '计算基线', children: BASELINE }, { key: 'time', label: '上次成功计算', children: row.updatedAt }, { key: 'rev', label: '当前输入版本', children: row.revision }]} /><Table size="small" rowKey={r => `${r.time}-${r.action}`} pagination={{ pageSize: 5 }} dataSource={row.audit} locale={{ emptyText: '尚无人工操作记录，当前为初始模拟数据' }} columns={[{ title: '实际操作者', render: (_, r) => `${r.role} · ${r.actor}` }, { title: '时间', dataIndex: 'time' }, { title: '操作', dataIndex: 'action' }, { title: '结果', dataIndex: 'result' }]} /></> },
    ]} />
  </Modal>;
}

export function OperationsWorkbench({ role, onRoleChange, focusReportKey, onReportFocused }) {
  const { state, setState, error, reload } = useOperationsPreview();
  const [today, setToday] = React.useState(shanghaiToday), [comparisonMetric, setComparisonMetric] = React.useState(null);
  React.useEffect(() => { const timer = window.setInterval(() => setToday(shanghaiToday()), 60000); return () => window.clearInterval(timer); }, []);
  const [tab, setTab] = React.useState('dashboard'), [period, setPeriod] = React.useState('week'), [anchor, setAnchor] = React.useState(() => dayjs(shanghaiToday())), [custom, setCustom] = React.useState([dayjs(PREVIEW_DATE).startOf('month'), dayjs(PREVIEW_DATE)]), [pm, setPm] = React.useState('all'), [project, setProject] = React.useState('all'), [status, setStatus] = React.useState('all'), [detail, setDetail] = React.useState(null), [editor, setEditor] = React.useState(null), [info, setInfo] = React.useState(false), [query, setQuery] = React.useState('');
  React.useEffect(() => { setPm('all'); setProject('all'); setDetail(null); setEditor(null); setComparisonMetric(null); }, [role]);
  React.useEffect(() => {
    if (!state || !focusReportKey) return;
    const row = state.rows.find(r => r.key === focusReportKey && canView(r, role));
    if (row) { setPeriod('week'); setAnchor(dayjs(row.start)); setProject(row.projectId); setPm('all'); setTab('reports'); setStatus('all'); setDetail(row.key); }
    else message.warning('该周报已不存在或当前身份无权查看');
    onReportFocused?.();
  }, [state, role, focusReportKey, onReportFocused]);
  if (!state) return error ? <Alert type="error" title="预览数据读取失败" description={error} action={<Button onClick={reload}>重试读取</Button>} /> : <Spin description="正在读取经营数据"><div style={{ height: 300 }} /></Spin>;
  const range = period === 'custom' ? custom.map(d => d.format('YYYY-MM-DD')) : periodRange(period, anchor.format('YYYY-MM-DD'));
  const authorized = state.projects.filter(p => canView(p, role));
  const rows = filterRows(state, role, { pm, project, range }); const projects = aggregate(rows, range); const totals = summarize(projects);
  const allScoped = filterRows(state, role, { pm, project });
  const comparison = buildComparison(state, role, { mode: period, anchor: anchor.format('YYYY-MM-DD'), today, pm, project });
  const quickTotals = ['day', 'week', 'month'].map(mode => { const r = periodRange(mode, today); return { mode, total: summarize(aggregate(allScoped.filter(row => row.start <= r[1] && row.end >= r[0]), r)) }; });
  const filteredRows = rows.filter(r => (status === 'all' || status === 'unconfirmed' && !r.confirmed || status === 'issue' && (r.result?.issue || r.calcStatus === 'failed')) && (!query || `${r.name}${r.weekId}${r.pm}`.toLowerCase().includes(query.toLowerCase())));
  const currentDetail = state.rows.find(r => r.key === detail && canView(r, role));
  const currentEditor = editor && state.rows.find(r => r.key === editor.row.key && canView(r, role));
  const showProject = id => { const row = rows.find(r => r.projectId === id); if (row) setDetail(row.key); };
  const issueRows = attentionRows(rows);
  const column = (key, title, render) => ({ key, dataIndex: key, title, width: 120, render });
  const columns = [
    { title: '项目 / PM', key: 'name', fixed: 'left', width: 220, render: (_, r) => <div><Button type="link" className="ops-project-link" onClick={() => setDetail(r.key)}>{r.name}</Button><div className="ops-muted ops-small">{r.pm} · {r.pricing}</div></div> },
    { title: '业务周', key: 'week', width: 185, render: (_, r) => <span className="ops-small">{r.start} — {r.end.slice(5)}</span> }, { title: '确认 / 计算状态', key: 'status', width: 245, render: (_, r) => <Status row={r} /> },
    column('autoVolume', '自动参考量', number), column('checked', '核对有效量', number), ...['value', 'cost', 'profit'].map(key => ({ title: metricLabels[key], key, width: 145, align: 'right', render: (_, r) => <span className={key === 'profit' && r.result?.profit < 0 ? 'ops-negative' : ''}>{money(r.result?.[key])}</span> })),
    { title: '利润率', key: 'rate', width: 110, align: 'right', render: (_, r) => percent(r.result?.rate) }, { title: '关键偏差', key: 'deviation', dataIndex: 'deviation', width: 240, ellipsis: true, render: v => v || '未填写' },
    { title: '操作', key: 'actions', width: role === '财务' ? 75 : 145, fixed: 'right', render: (_, r) => <Space size={4}><Button type="link" size="small" onClick={() => setDetail(r.key)}>详情</Button>{role !== '财务' && <Button type="link" size="small" onClick={() => setEditor({ row: r, kind: 'report' })}>{r.confirmed ? '修改' : '周补充'}</Button>}</Space> },
  ];
  return <div className="ops-workbench">
    <header className="ops-page-heading"><div><p className="eyebrow">MMOS 2.0 · 项目经营</p><h1>工作台</h1><p>{role === '财务' ? '公司全部项目 · 可查看PMO全部经营视图、图表与详细周报。' : '从经营结果到周报核对，掌握每个项目的投入与产出。'}</p></div><Space wrap><Tag color="blue">交互预览 · 模拟数据</Tag><Select aria-label="经营看板演示身份" value={role} onChange={onRoleChange} options={Object.entries(ACTORS).map(([value, name]) => ({ value, label: `${value} · ${name}` }))} style={{ width: 158 }} /><Button icon={<InfoCircleOutlined />} onClick={() => setInfo(true)}>预览说明</Button></Space></header>
    {error && <Alert type="error" showIcon title="读取失败，当前保留上次成功结果" description={error} action={<Button onClick={reload}>重试</Button>} />}
    <div className="ops-toolbar"><Space wrap size={10}><Segmented aria-label="统计周期" value={period} onChange={setPeriod} options={[{ value: 'day', label: '当日' }, { value: 'week', label: '当周' }, { value: 'month', label: '当月' }, { value: 'custom', label: '自定义' }]} />{period === 'custom' ? <DatePicker.RangePicker aria-label="自定义统计日期" value={custom} allowClear={false} onChange={value => value && setCustom(value)} /> : <DatePicker aria-label="统计日期" value={anchor} allowClear={false} picker={period === 'month' ? 'month' : 'date'} onChange={value => value && setAnchor(value)} />}<Select aria-label="经营项目筛选" value={project} showSearch optionFilterProp="label" onChange={setProject} style={{ width: 200 }} options={[{ value: 'all', label: '全部授权项目' }, ...authorized.map(p => ({ value: p.id, label: p.name }))]} />{role !== 'PM' && <Select aria-label="经营PM筛选" value={pm} onChange={setPm} options={[{ value: 'all', label: '全部PM' }, ...[...new Set(authorized.map(p => p.pm))].map(value => ({ value, label: value }))]} style={{ width: 125 }} />}</Space><span className="ops-scope">{range.join(' 至 ')} · {projects.length} 个项目</span></div>
    <Tabs activeKey={tab} onChange={setTab} className="ops-main-tabs" items={[
      { key: 'dashboard', label: <span><BarChartOutlined /> 经营看板</span>, children: <>
        <div className="ops-demo-comparisons"><span>环比模拟示例</span>{authorized.filter(p => p.demoLabel).map(p => <Button key={p.id} size="small" onClick={() => { setProject(p.id); setPm('all'); setPeriod('week'); setAnchor(dayjs('2026-10-26')); }}>{p.demoLabel}</Button>)}<span className="ops-muted">新增27条周报，点击查看2026-10-26所在周；也可切换当月。</span></div>
        <div className="ops-brief"><span><Badge status="processing" /> 当前范围经营测算</span><span>{role === 'PM' ? '仅本人负责项目' : '全部授权项目'} · 金额单位：元 · 不作为最终财务核算利润</span></div>
        <div className="ops-kpis">{Object.entries(metricLabels).map(([key, label]) => <Card key={key} className={`ops-kpi ops-kpi-${key}`}><div className="ops-kpi-label">{label}<span className="ops-kpi-symbol" style={{ color: tones[key] }}>{key === 'value' ? '¥' : key === 'cost' ? <ArrowDownOutlined /> : <ArrowUpOutlined />}</span></div><strong className={key === 'profit' && totals.profit < 0 ? 'ops-negative' : ''}>{totals.valid ? <><small>¥</small> {money(totals[key])}</> : '—'}</strong><div className="ops-kpi-bottom"><span>{totals.incomplete ? '可计算部分 · 非完整合计' : totals.count ? `${totals.count}个项目合计` : '当前范围无数据'}</span><Comparison metric={key} comparison={comparison} onOpen={setComparisonMetric} /></div></Card>)}</div>
        <div className="ops-period-summary">{quickTotals.map(({ mode, total }) => <div key={mode}><span>{{ day: '当日', week: '当周', month: '当月' }[mode]}<small> {today}</small></span><p>产值 <b>{total.valid ? money(total.value) : '—'}</b> · 成本 <b>{total.valid ? money(total.cost) : '—'}</b> · 利润 <b className={total.profit < 0 ? 'ops-negative' : ''}>{total.valid ? money(total.profit) : '—'}</b></p><small>{total.incomplete ? '含不完整或未确认结果' : '已计算'} · 按当前项目与PM范围</small></div>)}</div>
        {role !== '财务' && totals.incomplete && <Alert className="ops-alert" showIcon type="warning" title={`当前 ${projects.length} 个项目中，${projects.filter(p => p.issues.length).length} 个存在未确认、缺失或旧结果。合计与趋势显示可计算部分。`} action={<Button size="small" onClick={() => { setTab('reports'); setStatus('issue'); }}>查看异常</Button>} />}
        <Trend key={role} rows={filterRows(state, role, { range })} range={range} projects={authorized} role={role} />
        <div className="ops-comparison-grid"><ProjectChart title="项目金额对比" subtitle="默认按利润金额取5个正利润及5个亏损项目" type="amount" projects={projects} role={role} onProject={showProject} /><ProjectChart title="项目利润率" subtitle="默认项目与金额图一致，保留真实正负比例" type="rate" projects={projects} role={role} onProject={showProject} /></div>
        {role !== '财务' && <Card className="ops-attention" title={<div><h2>待核对事项 <Tag>{issueRows.length}</Tag></h2><p>明确责任人与异常内容，处理后保留业务记录</p></div>} extra={<Button type="link" onClick={() => { setTab('reports'); setStatus('all'); }}>查看全部周报</Button>}>
          {issueRows.length ? issueRows.slice(0, 4).map(r => <div className="ops-attention-row" key={r.key}><span className="ops-attention-dot" /><div><strong>{r.name}</strong><p>PM {r.pm} · {r.start} · {attentionReasons(r).join('；')}</p></div><Button onClick={() => setDetail(r.key)}>查看处理</Button></div>) : <Empty description="当前范围没有待核对事项" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          <p className="ops-chart-note">待核对事项同步至对应PM与PMO的待办列表，处理后自动更新；本预览未发送外部通知。上人计划每周五10:00提醒，无提交截止。</p>
        </Card>}
      </> },
      { key: 'reports', label: <span>详细周报 <Badge count={rows.length} color="#72839F" overflowCount={999} /></span>, children: <Card className="ops-reports"><div className="ops-report-toolbar"><div><h2>项目周报</h2><p>{rows.length} 条授权范围内记录，不受对比图10项目限制。38项交付字段可在详情中查看。</p></div><Space wrap><Input.Search aria-label="搜索周报" placeholder="项目、PM或周报编号" allowClear value={query} onChange={e => setQuery(e.target.value)} style={{ width: 220 }} /><Select aria-label="周报状态筛选" value={status} onChange={setStatus} style={{ width: 145 }} options={[{ value: 'all', label: '全部状态' }, { value: 'unconfirmed', label: '未提交确认' }, { value: 'issue', label: '数据或计算异常' }]} /></Space></div><Table rowKey="key" columns={columns} dataSource={filteredRows} scroll={{ x: 1770 }} pagination={{ defaultPageSize: 10, showSizeChanger: true, showTotal: total => `共 ${total} 条` }} locale={{ emptyText: <Empty description="当前筛选下暂无周报，调整日期或筛选条件后重试" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }} /><p className="ops-chart-note">历史周仅修改已有记录。首次提交日期由系统记录并固化，试标与计算结果只读，不增加审批步骤。</p></Card> },
    ]} />
    {comparisonMetric && <ComparisonDetail metric={comparisonMetric} comparison={comparison} onClose={() => setComparisonMetric(null)} onReport={key => { setComparisonMetric(null); setDetail(key); }} />}
    {currentDetail && <ReportDetail row={currentDetail} role={role} state={state} onClose={() => setDetail(null)} onEdit={kind => setEditor({ row: currentDetail, kind })} />}
    {currentEditor && <ReportEditor key={`${editor.row.key}-${editor.kind}`} row={editor.row} state={state} role={role} kind={editor.kind} onClose={() => setEditor(null)} onSaved={setState} />}
    <Modal title="经营看板交互预览说明" open={info} onCancel={() => setInfo(false)} footer={<Button type="primary" onClick={() => setInfo(false)}>知道了</Button>} width={680}>
      <p>依据本地《经营看板开发交付文档》2026-10-23待确认稿。本预览使用独立模拟数据，原样例覆盖2026-09-04至2026-10-29，新增环比示例覆盖2026-08-28至2026-10-29；今天按北京时间判断。填报保存在当前浏览器，不修改真实业务。</p>
      <ul><li>可切换PMO、PM、财务，测试筛选、两张对比图、详细周报、周补充和PMO批注。</li><li>图表配置本次会话内各自生效；仅正/负预览按利润金额排序，并列保留示例顺序。这些展示选择不作为已确认业务规则。</li><li>周产值、总成本和利润沿用冻结核心公式，已有上游汇总使用模拟值。未实现完整26公式迁移、生产权限、后台重算与通知服务。</li><li>示例工作日历用于演示分摊；实际公司日历待接入。包月跨期分配及月度唯一人数未定时不造数。环比已按2026-10-26确认的18项规则实现；缺少历史周报时提示数据不完整。</li><li>财务汇总使用独立模拟业务记录，不以周产值推导，也不在此修改财务台账。</li></ul>
    </Modal>
  </div>;
}

