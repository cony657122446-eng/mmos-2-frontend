import React from 'react';
import { Alert, Button, Card, DatePicker, Descriptions, Drawer, Empty, Select, Space, Statistic, Table, Tabs, Tag, message } from 'antd';
import { ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import datePickerZhCN from 'antd/es/date-picker/locale/zh_CN';
import { beijingToday, getHrAttendanceView, hrAction } from '../data/hrWorkspace';
import { attendanceDays, previousMonth } from '../data/hrAttendance';
import { useHrFeature } from './useHrFeature';

const hours = value => value == null ? '未取得时长' : `${Number(value.toFixed(6))} 小时`;
const status = value => <Tag color={value === '已读取' ? 'success' : value === '部分数据待核对' ? 'warning' : 'default'}>{value}</Tag>;
const when = value => value?.length > 10 ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : value || '未读取';

export function HrAttendancePanel({ role, personId }) {
  const [month, setMonth] = React.useState(() => previousMonth(beijingToday()));
  const [selectedId, setSelectedId] = React.useState('');
  const [version, setVersion] = React.useState('latest'), [busy, setBusy] = React.useState(false);
  const { view, error, refresh } = useHrFeature(() => getHrAttendanceView(role, month, personId), [role, month, personId]);
  const hr = ['人事', 'HR'].includes(role);
  React.useEffect(() => { setSelectedId(''); setVersion('latest'); }, [role, month, personId]);
  const snapshot = version === 'original' ? view?.original : version === 'latest' ? view?.latest : view?.batches.find(batch => batch.id === version)?.snapshot;
  const rows = (view?.rows || []).map(row => {
    if (version === 'latest') return row;
    const daily = snapshot?.records.filter(item => item.personId === row.personId) || [];
    const issues = snapshot?.issues.filter(item => item.personId === row.personId) || [];
    const total = daily.length ? daily.reduce((sum, item) => sum + item.hours, 0) : null;
    return { ...row, daily, issues, hours: total, days: attendanceDays(total), readAt: snapshot?.readAt, coverageEnd: snapshot?.coverageEnd, status: !snapshot ? '未读取' : issues.length ? '部分数据待核对' : daily.length ? '已读取' : '未取得人员记录' };
  });
  const person = rows.find(row => row.personId === selectedId);
  const name = id => view?.rows.find(row => row.personId === id)?.name || '来源人员待核对';
  async function read() {
    setBusy(true);
    try {
      hrAction(role, 'attendance.read', { month, expectedRevision: view.revision, expectedMonthVersion: view.version });
      setVersion('latest'); refresh(); message.success('来源快照读取已完成，请查看完整性与差异');
    } catch (failure) { message.error(failure.message || '读取失败，已保留上次成功结果'); }
    finally { setBusy(false); }
  }
  const dailyColumns = [
    { title: '出勤日期', dataIndex: 'date', width: 130, sorter: (a, b) => a.date.localeCompare(b.date), defaultSortOrder: 'ascend' },
    { title: '飞书统计时长', dataIndex: 'hours', align: 'right', render: hours },
    { title: '来源原值', render: (_, row) => `${row.originalDuration} ${row.unit}` },
    { title: '读取处理', render: (_, row) => row.retained ? <Tag color="warning">保留上次成功值</Tag> : <Tag>本次有效来源</Tag> },
    { title: '来源记录', dataIndex: 'sourceId' },
  ];
  return <section className="hr-attendance-panel">
    <Alert type="info" showIcon title="月度出勤 = 飞书统计总小时数 ÷ 8，展示三位小数" description="北京时间每月1日19:00补卡截止，3日读取上月，周末不顺延；3日具体执行时刻待确认。当前使用来源快照，真实飞书读取与定时服务待接入。" />
    {error && <Alert type="error" title={error} action={<Button onClick={refresh}>重试</Button>} />}
    <Card className="hr-section hr-table-card">
      <div className="hr-card-heading"><div><h2>月度出勤</h2><p>点击出勤天数查看此人的每日明细。{hr && '同步和重读按整月执行，此处只显示本人的结果。'}</p></div><Space wrap><Button icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>{hr && <Button type="primary" icon={<SyncOutlined />} loading={busy} disabled={!view || month > beijingToday().slice(0, 7)} onClick={read}>{month === beijingToday().slice(0, 7) ? '同步本月出勤' : '重新读取该月'}</Button>}</Space></div>
      <div className="hr-filter-grid">
        <label className="hr-inline-field">月份<DatePicker aria-label="出勤月份" locale={datePickerZhCN} picker="month" format="YYYY-MM" placeholder="选择月份" allowClear={false} value={dayjs(`${month}-01`)} disabledDate={value => value.format('YYYY-MM') > beijingToday().slice(0, 7)} onChange={value => { if (value) setMonth(value.format('YYYY-MM')); }} /></label>
        <Select aria-label="查看出勤版本" value={version} onChange={setVersion} options={[{ value: 'latest', label: '当前成功版本' }, { value: 'original', label: '3日原始快照', disabled: !view?.original }, ...(view?.batches || []).filter(batch => batch.snapshot).map(batch => ({ value: batch.id, label: `${when(batch.readAt)} · ${batch.method} · v${batch.snapshot.version}` }))]} />
      </div>
      {snapshot ? <div className="hr-scope"><Space wrap><Tag color={snapshot.complete ? 'success' : 'warning'}>{snapshot.complete ? '来源批次校验通过' : '月份数据待核对'}</Tag><span>版本 {snapshot.version} · {snapshot.method}</span><span>读取时间 {when(snapshot.readAt)}</span><span>读取范围截至 {snapshot.coverageEnd || '待核对'}</span></Space></div> : <Alert type="info" title="该月尚未读取" description={hr ? '点击同步或重新读取后显示实际取得的来源记录。无来源快照的月份保留未读取状态。' : '等待人事同步或月度读取。'} />}
      {view?.latest?.lastError && <Alert type="error" title={`最近读取失败：${view.latest.lastError}`} description="继续展示上一次成功数据。" />}
      <Table rowKey="personId" loading={!view && !error} dataSource={rows} scroll={{ x: 650 }} pagination={false} locale={{ emptyText: <Empty description="暂无该人员的出勤信息" /> }} columns={[
        { title: '月度出勤天数', align: 'right', width: 165, render: (_, row) => row.hours == null ? <span className="hr-muted">未取得记录</span> : <Button type="link" className="hr-attendance-days" onClick={() => setSelectedId(row.personId)}>{row.days} 天</Button> },
        { title: '总小时数', dataIndex: 'hours', align: 'right', width: 150, render: hours },
        { title: '有效每日记录', render: (_, row) => `${row.daily.length} 条`, width: 130 },
        { title: '读取结果', dataIndex: 'status', render: status, width: 150 },
        { title: '操作', fixed: 'right', width: 120, render: (_, row) => <Button type="link" onClick={() => setSelectedId(row.personId)}>每日明细</Button> },
      ]} />
    </Card>
    <Card className="hr-section" title="读取记录与差异">
      <Tabs items={[
        { key: 'differences', label: '本版本差异', children: <Table rowKey={row => `${row.personId}:${row.date}`} size="small" scroll={{ x: 550 }} dataSource={snapshot?.changes || []} pagination={{ pageSize: 5 }} locale={{ emptyText: '本版本没有时长变化' }} columns={[{ title: '人员', render: (_, row) => name(row.personId) }, { title: '日期', dataIndex: 'date' }, { title: '此前小时数', dataIndex: 'before', align: 'right', render: hours }, { title: '本次小时数', dataIndex: 'after', align: 'right', render: hours }]} /> },
        { key: 'issues', label: `待核对 ${snapshot?.issues.length || 0}`, children: <Table rowKey="viewKey" size="small" dataSource={(snapshot?.issues || []).map((row, index) => ({ ...row, viewKey: `${snapshot.version}:${index}` }))} pagination={{ pageSize: 5 }} locale={{ emptyText: '本版本没有已识别异常' }} columns={[{ title: '人员', render: (_, row) => name(row.personId) }, { title: '日期', dataIndex: 'date' }, { title: '原因与处理', dataIndex: 'reason' }]} /> },
        { key: 'batches', label: '读取批次', children: <Table rowKey="id" size="small" scroll={{ x: 650 }} dataSource={view?.batches || []} pagination={{ pageSize: 5 }} locale={{ emptyText: '暂无读取批次' }} columns={[{ title: '读取时间（北京）', dataIndex: 'readAt', render: when }, { title: '方式', dataIndex: 'method' }, { title: '操作者', dataIndex: 'actor' }, { title: '结果', dataIndex: 'status' }, { title: '失败原因', dataIndex: 'error', render: value => value || '—' }]} /> },
      ]} />
    </Card>
    <Drawer title={person ? `${person.name} · ${month}每日出勤` : '每日出勤'} open={!!person} size={900} onClose={() => setSelectedId('')} destroyOnHidden>
      {person && <><div className="hr-attendance-summary"><Statistic title="月度出勤天数" value={person.hours == null ? '未读取' : person.days} suffix={person.hours == null ? '' : '天'} formatter={value => value} /><Statistic title="月度总小时数" value={person.hours == null ? '未读取' : Number(person.hours.toFixed(6))} /></div><Descriptions size="small" items={[{ key: 'result', label: '完整性', children: status(person.status) }, { key: 'at', label: '读取时间', children: when(person.readAt) }, { key: 'coverage', label: '范围截至', children: person.coverageEnd || '未读取' }, { key: 'formula', label: '换算口径', children: '月总小时数 ÷ 8' }]} />{person.issues.map((issue, index) => <Alert key={index} type="warning" title={`${issue.date || ''} ${issue.reason}`} />)}<Table rowKey="date" size="small" scroll={{ x: 780 }} dataSource={person.daily} columns={dailyColumns} pagination={{ pageSize: 12 }} locale={{ emptyText: '尚未取得有效每日时长，不能按0天处理' }} /></>}
    </Drawer>
  </section>;
}
