import React from 'react';
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, CheckCircle2, Clock3, FileCheck2, FileText, ReceiptText, WalletCards } from 'lucide-react';
import { Button, Card, DatePicker, Segmented, Tooltip, Typography } from 'antd';
import { ArrowUpOutlined, CalendarOutlined, InfoCircleOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';

const { Text } = Typography;

const rangeData = {
  week: { metrics: [['项目总数','18','+2','较上周','blue',BriefcaseBusiness],['项目成本','¥ 386.4k','+8.2%','较上周','purple',WalletCards],['项目利润','¥ 142.8k','+12.6%','较上周','violet',ReceiptText],['待处理项目','07','3','今日到期','amber',Clock3]], stages:[12,4,6,3,18,5], range:'当周' },
  month: { metrics: [['项目总数','42','+6','较上月','blue',BriefcaseBusiness],['项目成本','¥ 1.42m','+14.8%','较上月','purple',WalletCards],['项目利润','¥ 518.6k','+18.4%','较上月','violet',ReceiptText],['待处理项目','16','5','本月到期','amber',Clock3]], stages:[27,8,9,7,26,11], range:'当月' },
  all: { metrics: [['项目总数','126','—','累计项目','blue',BriefcaseBusiness],['项目成本','¥ 8.64m','—','累计成本','purple',WalletCards],['项目利润','¥ 3.18m','—','累计利润','violet',ReceiptText],['待处理项目','09','—','当前待办','amber',Clock3]], stages:[36,14,12,9,41,14], range:'全部' }
};
const stages = [
  { label: '需求承接', value: 12, tone: 'blue' }, { label: '立项申请', value: 4, tone: 'purple' }, { label: '试标中', value: 6, tone: 'violet' }, { label: '报价中', value: 3, tone: 'indigo' }, { label: '项目运行', value: 18, tone: 'cyan' }, { label: '验收 / 开票', value: 5, tone: 'slate' },
];
const tasks = [
  { title: '审核立项申请', meta: '星河智能客服项目 · PMO', tone: 'purple', action: '去审核' },
  { title: '补充需求字段', meta: '海外内容审核产线 · 缺少计价方式', tone: 'blue', action: '去补充' },
  { title: '登记试标结果', meta: '零售数据标注项目 · 试标已结束', tone: 'violet', action: '去处理' },
  { title: '确认开票状态', meta: '语音质检专项 · 最终验收完成', tone: 'amber', action: '去跟进' },
];
const activities = [
  { title: '星河智能客服项目', detail: 'PMO 审核通过，进入试标中', time: '今天 09:42', from: '立项申请中', to: '试标中', tone: 'violet' },
  { title: '海外内容审核产线', detail: '需求字段补充完成，进入可承接', time: '昨天 16:18', from: '待补充', to: '待承接', tone: 'blue' },
  { title: '语音质检专项', detail: '完成最终验收，等待开票', time: '昨天 11:06', from: '验收中', to: '待开票', tone: 'amber' },
];

function businessWeekRange(date = dayjs()) {
  const current = dayjs(date);
  const daysSinceFriday = (current.day() + 2) % 7;
  const start = current.subtract(daysSinceFriday, 'day').startOf('day');
  return { start, end: start.add(6, 'day').endOf('day') };
}
function formatDateRange(start, end) { return `${start.format('M月D日')} — ${end.format('M月D日')}`; }
function getRangeLabel(kind, selectedWeek, selectedMonth, selectedDates) {
  if (kind === 'week') { const range = businessWeekRange(dayjs()); return formatDateRange(range.start, range.end); }
  if (kind === 'month') return dayjs().format('YYYY年M月');
  if (kind === 'custom' && selectedDates?.[0] && selectedDates?.[1]) return formatDateRange(selectedDates[0], selectedDates[1]);
  return '全部时间';
}

export function TimeRange({ value, onChange, selectedWeek, setSelectedWeek, selectedMonth, setSelectedMonth, selectedDates, setSelectedDates }) {
  const label = getRangeLabel(value, selectedWeek, selectedMonth, selectedDates);
  return <div className="time-range">
    <CalendarOutlined />
    <div className="time-range-controls">
      <Segmented size="small" value={value} onChange={onChange} options={[{ label: '当周', value: 'week' }, { label: '当月', value: 'month' }, { label: '自定义', value: 'custom' }, { label: '全部', value: 'all' }]} />
      {value === 'week' && <span className="range-picker range-readonly" aria-label="当前业务周">{label}</span>}
      {value === 'month' && <span className="range-picker range-readonly" aria-label="当前月份">{label}</span>}
      {value === 'custom' && <div className="custom-date-pickers" aria-label="自定义日期范围">
        <DatePicker className="range-picker custom-date-picker" size="small" value={selectedDates?.[0]} onChange={date => date && setSelectedDates([date, selectedDates?.[1] && selectedDates[1].isBefore(date, 'day') ? date : selectedDates?.[1] || date])} disabledDate={date => selectedDates?.[1] ? date.isAfter(selectedDates[1], 'day') : false} allowClear={false} format="M月D日" placeholder="开始日期" aria-label="开始日期" />
        <span className="custom-date-separator">至</span>
        <DatePicker className="range-picker custom-date-picker" size="small" value={selectedDates?.[1]} onChange={date => date && setSelectedDates([selectedDates?.[0] && selectedDates[0].isAfter(date, 'day') ? date : selectedDates?.[0] || date, date])} disabledDate={date => selectedDates?.[0] ? date.isBefore(selectedDates[0], 'day') : false} allowClear={false} format="M月D日" placeholder="结束日期" aria-label="结束日期" />
      </div>}
    </div>
  </div>
}
function MetricCard({ item }) { const Icon=item[5]; return <Card className="metric-card antd-metric-card" bordered={false}><div className={`metric-icon ${item[4]}`}><Icon size={18} /></div><div className="metric-body"><p>{item[0]}</p><strong>{item[1]}</strong><small><span className={item[4]}>{item[2]}</span> {item[3]}</small></div><span className="metric-corner" /></Card> }
function StageDistribution({ values }) { const max = Math.max(...values, 1); const option = { animationDuration: 360, grid: { left: 10, right: 10, top: 25, bottom: 28, containLabel: true }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#202747', borderWidth: 0, textStyle: { color: '#f7f8ff' }, formatter: params => { const point = params[0]; return `${point.name}<br/><strong>${point.value}</strong> 个项目`; } }, xAxis: { type: 'category', data: stages.map(stage => stage.label), axisLine: { lineStyle: { color: '#394362' } }, axisTick: { show: false }, axisLabel: { color: '#aab4ce', fontSize: 11, interval: 0 } }, yAxis: { type: 'value', min: 0, max: Math.ceil(max * 1.25), splitNumber: 4, axisLabel: { color: '#7d89a8', fontSize: 10 }, splitLine: { lineStyle: { color: '#2e3756', type: 'dashed' } } }, series: [{ type: 'bar', barMaxWidth: 28, barMinHeight: 5, data: values.map((value, index) => ({ value, itemStyle: { color: ['#66a9ca', '#8175df', '#9c80e8', '#718dd8', '#63b5b9', '#8793b8'][index], borderRadius: [5, 5, 1, 1] } })), label: { show: true, position: 'top', color: '#edf0ff', fontSize: 12, fontWeight: 700 } }] }; return <Card className="stage-panel antd-panel" bordered={false} title={<div><p className="panel-kicker">项目阶段分布</p><h2>项目现在走到哪一步</h2></div>} extra={<Button type="link" size="small" icon={<ArrowUpOutlined />} iconPosition="end">查看项目主库</Button>}><div className="chart-supporting-text"><Text type="secondary">柱高用于比较不同阶段的项目数量</Text><Tooltip title="数据随经营总览的当周、当月、全部筛选同步变化"><InfoCircleOutlined /></Tooltip></div><ReactECharts option={option} style={{ height: 250, width: '100%' }} opts={{ renderer: 'svg' }} aria-label="项目阶段数量柱状图" /></Card> }
function TaskQueue() { return <section className="panel task-panel"><div className="panel-heading"><div><p className="panel-kicker">待处理事项</p><h2>今天需要你处理</h2></div><span className="queue-count">07</span></div><div className="task-list">{tasks.map(task => <button className="task-item" key={task.title}><span className={`task-dot ${task.tone}`} /><span className="task-copy"><strong>{task.title}</strong><small>{task.meta}</small></span><span className="task-action">{task.action}</span><ArrowUpRight size={15} /></button>)}</div><button className="outline-button">打开全部待办 <ArrowUpRight size={15} /></button></section> }
function ActivityList() { return <section className="panel activity-panel"><div className="panel-heading"><div><p className="panel-kicker">最近动态</p><h2>项目状态变化</h2></div><button className="text-button">查看全部 <ArrowUpRight size={15} /></button></div><div className="activity-list">{activities.map(item => <div className="activity-item" key={item.title}><span className={`activity-icon ${item.tone}`}><CheckCircle2 size={15} /></span><div className="activity-copy"><strong>{item.title}</strong><p>{item.detail}</p><div className="activity-status"><span>{item.from}</span><i>→</i><b>{item.to}</b></div></div><time>{item.time}</time></div>)}</div></section> }

function getSelectedData(kind, selectedWeek, selectedMonth, selectedDates) {
  const sourceKind = kind === 'custom' ? 'week' : kind;
  const source = rangeData[sourceKind];
  let factor = 1;
  let label = source.range;
  if (kind === 'week') {
    const range = businessWeekRange(dayjs());
    factor = 1 + (((range.start.date() + range.start.month()) % 5) - 2) * 0.035;
    label = formatDateRange(range.start, range.end);
  } else if (kind === 'month') {
    const currentMonth = dayjs();
    factor = 1 + (((currentMonth.month() + currentMonth.year()) % 5) - 2) * 0.04;
    label = currentMonth.format('YYYY年M月');
  } else if (kind === 'custom' && selectedDates?.[0] && selectedDates?.[1]) {
    const days = selectedDates[1].diff(selectedDates[0], 'day') + 1;
    factor = Math.max(0.25, Math.min(2.5, days / 7));
    label = formatDateRange(selectedDates[0], selectedDates[1]);
  } else if (kind === 'all') label = '全部时间';
  const metrics = source.metrics.map(item => {
    const next = [...item];
    if (item[0] === '项目总数' || item[0] === '待处理项目') next[1] = String(Math.max(1, Math.round(Number(item[1]) * factor))).padStart(2, '0');
    if (item[0] === '项目成本' || item[0] === '项目利润') {
      const number = Number(item[1].replace(/[^0-9.]/g, ''));
      const suffix = item[1].includes('m') ? 'm' : 'k';
      next[1] = `¥ ${(number * factor).toFixed(suffix === 'm' ? 2 : 1)}${suffix}`;
    }
    return next;
  });
  return { ...source, metrics, stages: source.stages.map(value => Math.max(1, Math.round(value * factor))), range: label };
}

export function OverviewPage() {
  const [range, setRange] = React.useState('week');
  const [selectedWeek, setSelectedWeek] = React.useState(dayjs());
  const [selectedMonth, setSelectedMonth] = React.useState(dayjs());
  const [selectedDates, setSelectedDates] = React.useState([dayjs().subtract(6, 'day'), dayjs()]);
  const current = getSelectedData(range, selectedWeek, selectedMonth, selectedDates);
  const rangeLabel = getRangeLabel(range, selectedWeek, selectedMonth, selectedDates);
  const rangeHint = range === 'week' ? '当周按上周五至本周四统计' : range === 'month' ? '按自然月统计' : range === 'custom' ? '按所选起止日期统计' : '累计全部时间';
  return <div className="overview-page"><section className="page-heading overview-heading"><div><p className="eyebrow">项目 · 经营视图</p><h1>经营总览</h1><p className="subtitle">查看项目从需求承接到开票的整体经营情况。</p></div><TimeRange value={range} onChange={setRange} selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} selectedDates={selectedDates} setSelectedDates={setSelectedDates}/></section><section className="range-note"><CalendarDays size={15}/><span>当前查看：<strong>{rangeLabel}</strong></span><small>{rangeHint}</small></section><section className="metric-grid">{current.metrics.map(item=><MetricCard item={item} key={item[0]}/>)}</section><StageDistribution values={current.stages}/><section className="dashboard-grid overview-lower"><TaskQueue/><ActivityList/></section><section className="overview-foot"><div className="foot-card"><FileCheck2 size={18}/><div><strong>项目数据已更新</strong><span>{current.range}数据最后同步：今天 10:24</span></div></div><div className="foot-card"><WalletCards size={18}/><div><strong>项目经营指标</strong><span>成本与利润按当前时间范围汇总</span></div></div><div className="foot-card"><Clock3 size={18}/><div><strong>阶段停留提醒</strong><span>有 2 个项目在当前阶段超过 7 天</span></div></div></section></div>
}
