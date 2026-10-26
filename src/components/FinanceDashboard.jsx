import React from 'react';
import { Alert, Button, Card, DatePicker, Descriptions, Empty, Modal, Segmented, Select, Space, Spin, Table, Tabs, Tag } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, SwapOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { OperationsWorkbench } from './OperationsWorkbench';
import { loadRoleWorkspace, saveWorkspace } from '../data/financeWorkspace';
import { addFinanceDemo } from '../data/financeDemo';
import { FINANCE_LEDGER_STORAGE_KEY } from '../data/financeLedger';
import { journalRange, summarizeJournal } from '../data/financeDashboard';
import { shanghaiToday } from '../data/operationsComparison';
import './finance-dashboard.css';

const money = value => Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const colors = ['#3579F6', '#2FC6D4', '#7761F5', '#F5A442', '#72839F'];
const base = { color: colors, textStyle: { fontFamily: 'Inter, Microsoft YaHei, sans-serif', color: '#72839F' },
  tooltip: { confine: true, valueFormatter: value => `${money(value)} 元` },
  legend: { top: 0, icon: 'circle', itemWidth: 8, textStyle: { color: '#72839F' } },
  grid: { left: 14, right: 20, top: 42, bottom: 20, containLabel: true } };
const valueAxis = { type: 'value', name: '元', splitLine: { lineStyle: { color: '#EEF3FA' } } };

export function FinanceDashboard({ role, onRoleChange, onNavigate }) {
  if (role !== '财务') return null;
  return <Tabs className="finance-home-tabs" defaultActiveKey="cash" items={[
    { key: 'cash', label: '财务概览', children: <FinanceCashDashboard onRoleChange={onRoleChange} onNavigate={onNavigate} /> },
    { key: 'operations', label: '经营看板', children: <OperationsWorkbench role={role} onRoleChange={onRoleChange} /> },
  ]} />;
}

function FinanceCashDashboard({ onRoleChange, onNavigate }) {
  const [state, setState] = React.useState(null), [error, setError] = React.useState('');
  const [period, setPeriod] = React.useState('recent'), [payer, setPayer] = React.useState('all'), [grain, setGrain] = React.useState('month');
  const [today, setToday] = React.useState(shanghaiToday), [custom, setCustom] = React.useState(() => [dayjs(shanghaiToday()).startOf('month'), dayjs(shanghaiToday())]);
  const [drill, setDrill] = React.useState(null), [detail, setDetail] = React.useState(null), [help, setHelp] = React.useState(false);
  const reload = React.useCallback(() => {
    try {
      const raw = localStorage.getItem(FINANCE_LEDGER_STORAGE_KEY);
      if (raw) { const stored = JSON.parse(raw); if (!Array.isArray(stored?.journal) || !Array.isArray(stored?.invoices)) throw new Error('日记账本地数据格式异常，请保留数据并核对'); }
      const current = loadRoleWorkspace('财务', shanghaiToday().slice(0, 7));
      const next = current.demoDataVersion ? current : saveWorkspace(current, addFinanceDemo(current), '初始化模拟测试数据');
      setState(next); setError('');
    } catch (e) { setError(e.message); }
  }, []);
  React.useEffect(() => {
    reload();
    const storage = event => { if (!event.key || event.key === FINANCE_LEDGER_STORAGE_KEY) reload(); };
    window.addEventListener('storage', storage); window.addEventListener('mmos:finance-updated', reload);
    const timer = window.setInterval(() => setToday(shanghaiToday()), 60000);
    return () => { window.removeEventListener('storage', storage); window.removeEventListener('mmos:finance-updated', reload); window.clearInterval(timer); };
  }, [reload]);
  const range = period === 'custom' ? custom.map(d => d.format('YYYY-MM-DD')) : journalRange(period, today);
  const data = React.useMemo(() => summarizeJournal(state?.journal || [], { range, payer, grain }), [state, range?.[0], range?.[1], payer, grain]);
  const inspect = (title, predicate) => { setDetail(null); setDrill({ title, predicate }); };
  const rows = drill ? data.rows.filter(drill.predicate) : [];
  const current = data.rows.find(row => row.key === detail);
  const columns = [
    { title: '日期', dataIndex: 'date', width: 115 }, { title: '摘要', dataIndex: 'summary', width: 220 }, { title: '收付款人', dataIndex: 'payer', width: 160 },
    { title: '收入（元）', dataIndex: 'income', align: 'right', width: 130, render: money }, { title: '支出（元）', dataIndex: 'expense', align: 'right', width: 130, render: money },
    { title: '关联情况', width: 140, render: (_, row) => row.allocationIssue ? <Tag color="error">关联待核对</Tag> : <Tag color={row.unlinked ? 'warning' : 'success'}>{row.unlinked ? `未关联 ${money(row.unlinked)}` : '已全部关联'}</Tag> },
    { title: '操作', width: 95, fixed: 'right', render: (_, row) => <Button type="link" onClick={() => { if (!drill) setDrill({ title: '收支记录明细', predicate: () => true }); setDetail(row.key); }}>查看明细</Button> },
  ];
  const chart = (title, subtitle, option, available, onClick) => <Card className="finance-chart" title={<div><h2>{title}</h2><p>{subtitle}</p></div>}>
    {available ? <ReactECharts option={option} notMerge style={{ height: 280 }} onEvents={{ click: onClick }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前范围暂无记录" />}
  </Card>;
  const trend = { ...base, tooltip: { ...base.tooltip, trigger: 'axis' }, xAxis: { type: 'category', data: data.trends.map(p => p.date) }, yAxis: valueAxis,
    series: [{ name: '实际收入', type: 'bar', barMaxWidth: 24, data: data.trends.map(p => p.income) }, { name: '实际支出', type: 'bar', barMaxWidth: 24, data: data.trends.map(p => p.expense) }, { name: '收支净额', type: 'line', data: data.trends.map(p => p.net), symbolSize: 6 }] };
  const pie = values => ({ ...base, legend: { ...base.legend, type: 'scroll', top: 'bottom' }, series: [{ type: 'pie', radius: ['42%', '67%'], center: ['50%', '43%'], label: { formatter: '{b}\n{d}%' }, data: values }] });
  const topPayers = data.incomePayers.slice(0, 5);
  const ranking = { ...base, grid: { ...base.grid, left: 0 }, xAxis: valueAxis, yAxis: { type: 'category', inverse: true, data: topPayers.map(p => p.name), axisLabel: { width: 110, overflow: 'truncate' } }, series: [{ name: '实际收入', type: 'bar', barMaxWidth: 22, data: topPayers.map(p => p.value) }] };
  return <div className="finance-dashboard">
    <header className="finance-dashboard-heading"><div><p className="eyebrow">MMOS 2.0 · 资金收支</p><h1>财务工作台</h1><p>从日记账查看实际收支、业务关联和资金流向。</p></div><Space wrap><Tag color="blue">本地模拟数据</Tag><Select aria-label="财务工作台身份" value="财务" onChange={onRoleChange} options={[{ value: '财务', label: '财务 · 赵敏' }, { value: 'PMO', label: 'PMO · 林晓彤' }, { value: 'PM', label: 'PM · 王然' }]} /><Button onClick={() => setHelp(true)}>统计口径</Button><Button type="primary" onClick={() => onNavigate('finance-journal')}>打开日记账</Button></Space></header>
    {error && <Alert type="error" showIcon title="日记账读取失败" description={`${error}。当前数据可能不是最新状态。`} action={<Button onClick={reload}>重试</Button>} />}
    {!state ? !error && <Spin description="正在读取日记账"><div style={{ height: 200 }} /></Spin> : <>
      <Card className="finance-filters"><Space wrap><Segmented aria-label="财务统计期间" value={period} onChange={value => { setPeriod(value); setDrill(null); }} options={[{ value: 'month', label: '本月' }, { value: 'recent', label: '近3个月' }, { value: 'year', label: '本年' }, { value: 'all', label: '全部' }, { value: 'custom', label: '自定义' }]} />{period === 'custom' && <DatePicker.RangePicker aria-label="财务自定义日期" value={custom} allowClear={false} onChange={value => value && setCustom(value)} />}<Select aria-label="收付款人筛选" value={payer} showSearch optionFilterProp="label" onChange={value => { setPayer(value); setDrill(null); }} style={{ width: 200 }} options={[{ value: 'all', label: '全部收付款人' }, ...[...new Set((state?.journal || []).filter(r => !r.opening).map(r => r.payer).filter(Boolean))].map(value => ({ value, label: value }))]} /></Space><div className="finance-range">{range ? range.join(' 至 ') : '全部已登记日期'} · {data.totals.count} 条有效收支</div></Card>
      <div className="finance-summary-note">收支净额＝收入－支出，不等同经营利润或账户余额。金额单位：元；期初记录不计入收支。</div>
      {!!data.excluded.length && <Alert type="warning" showIcon title={`${data.excluded.length} 条日期或金额异常记录未计入；以下为有效记录汇总`} action={<Button size="small" onClick={() => setHelp(true)}>查看口径</Button>} />}
      <div className="finance-cash-kpis">{[
        { key: 'income', title: '实际收入', icon: <ArrowDownOutlined />, color: colors[0], note: `${data.rows.filter(r => r.income > 0).length} 笔收款`, filter: r => r.income > 0 },
        { key: 'expense', title: '实际支出', icon: <ArrowUpOutlined />, color: colors[1], note: `${data.rows.filter(r => r.expense > 0).length} 笔付款`, filter: r => r.expense > 0 },
        { key: 'net', title: '收支净额', icon: <SwapOutlined />, color: colors[2], note: '期间实际收入减实际支出', filter: () => true },
      ].map(item => <Card key={item.key}><div className="finance-kpi-title">{item.title}<span style={{ color: item.color }}>{item.icon}</span></div><strong style={{ color: item.key === 'net' && data.totals.net < 0 ? '#BC374A' : undefined }}>¥ {money(data.totals[item.key])}</strong><div className="finance-kpi-footer"><span>{item.note}</span><Button type="link" size="small" aria-label={`查看${item.title}记录`} onClick={() => inspect(item.title, item.filter)}>查看记录</Button></div></Card>)}</div>
      <Card className="finance-chart" title={<div><h2>实际收支趋势</h2><p>按日记账日期汇总，点击图形查看原始记录。</p></div>} extra={<Segmented aria-label="财务趋势粒度" value={grain} onChange={setGrain} options={[{ value: 'day', label: '日' }, { value: 'month', label: '月' }]} />}>
        {data.rows.length ? <ReactECharts option={trend} notMerge style={{ height: 280 }} onEvents={{ click: event => { if (event.componentType === 'series') inspect(`${event.name} · ${event.seriesName}`, row => (grain === 'day' ? row.date : row.date.slice(0, 7)) === event.name && (event.seriesName === '实际收入' ? row.income > 0 : event.seriesName === '实际支出' ? row.expense > 0 : true)); } }} /> : <Empty description="当前范围暂无收支记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
      </Card>
      <div className="finance-visual-grid">
        {chart('支出业务构成', '按关联金额拆分，未关联部分单独列出。', pie(data.expenseTypes), data.expenseTypes.length, e => e.componentType === 'series' && inspect(e.name, r => r.expense > 0 && (e.name === '关联待核对' ? r.allocationIssue : e.name === '未关联支出' ? r.unlinked > 0 : !r.allocationIssue && (r.allocations || []).some(a => (a.type || '其他已关联') === e.name))))}
        {chart('付款人收入排行', '前5位付款人，按整笔实际收入汇总。', ranking, topPayers.length, e => e.componentType === 'series' && inspect(e.name, r => r.income > 0 && (r.payer || '未填写付款人') === e.name))}
      </div>
      <Card className="finance-journal-table" title="收支明细" extra={<span>{data.rows.length} 条记录</span>}><Table rowKey="key" columns={columns} dataSource={data.rows} pagination={{ defaultPageSize: 6, showSizeChanger: true }} scroll={{ x: 1090 }} locale={{ emptyText: '当前范围暂无收支记录' }} /></Card>
    </>}
    <Modal title={current ? current.summary : drill?.title} open={!!drill} onCancel={() => { setDrill(null); setDetail(null); }} width={1000} footer={<Space>{current && <Button onClick={() => setDetail(null)}>返回筛选记录</Button>}<Button onClick={() => onNavigate('finance-journal')}>打开日记账</Button><Button onClick={() => { setDrill(null); setDetail(null); }}>关闭</Button></Space>}>
      {current ? <><Descriptions bordered column={{ xs: 1, sm: 2 }} items={[{ key: 'date', label: '日期', children: current.date }, { key: 'payer', label: '收付款人', children: current.payer || '未填写' }, { key: 'income', label: '实际收入', children: money(current.income) }, { key: 'expense', label: '实际支出', children: money(current.expense) }, { key: 'linked', label: '已关联', children: current.allocationIssue ? '待核对' : money(current.linked) }, { key: 'unlinked', label: '未关联', children: current.allocationIssue ? '待核对' : money(current.unlinked) }, { key: 'note', label: '备注', children: current.note || '—' }]} /><Table style={{ marginTop: 16 }} rowKey={(_, index) => index} dataSource={Array.isArray(current.allocations) ? current.allocations : []} pagination={false} columns={[{ title: '关联类型', dataIndex: 'type' }, { title: '关联对象', dataIndex: 'name' }, { title: '分配金额', dataIndex: 'amount', render: value => Number.isFinite(Number(value)) ? money(value) : '无效金额' }]} /></> : <><p>以下展示命中的整笔日记账记录；分类金额以记录内对应的关联分配金额为准。</p><Table rowKey="key" dataSource={rows} columns={columns} pagination={{ defaultPageSize: 6 }} scroll={{ x: 1090 }} /></>}
    </Modal>
    <Modal title="财务概览统计口径" open={help} onCancel={() => setHelp(false)} footer={<Button onClick={() => setHelp(false)}>关闭</Button>}>
      <p>仅使用本地日记账已登记的实际收入、实际支出及业务关联。开票金额、审批金额、周报产值不作为实际收支。期初尚未确认，暂不展示账户余额。</p>
      <p>期间按日记账日期筛选；本月、近3个月、本年截至北京时间今天。「全部」包括所有已登记日期。趋势只展示有记录的时间点，无记录不代表已核实零业务。</p>
      <p>同一笔交易只计入收支一次；分类图按每条关联分配金额拆分，剩余金额列为未关联。关联超额或无效时整笔分类列为待核对，仍保留有效实际收支。</p>
      <p>参考飞书「月开票报表」「营收支出月报」的指标、趋势和明细布局，未导入或修改飞书记录。本页为本地模拟预览，非实时财务报表。</p>
      {!!data.excluded.length && <ul>{data.excluded.map((row, i) => <li key={row.key || i}>{row.summary || row.key || '未命名记录'}：{row.reason}</li>)}</ul>}
    </Modal>
  </div>;
}
