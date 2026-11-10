import React from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Empty, Input, Select, Table, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getDeliveryLineChanges } from '../data/hrTransfers';
import { getHrView, subscribeHr } from '../data/hrWorkspace';
import { displayText } from '../data/displayText';
import { PersonDetail } from './HrDirectory';
import './hr-workspace.css';

const shown = value => displayText(value) || '待核对';
const dateText = value => value && dayjs(value).isValid() ? dayjs(value).format('YYYY-MM-DD HH:mm') : '待核对';
const dateOnlyText = value => value && dayjs(value).isValid() && dayjs(value).format('YYYY-MM-DD') === value ? value : '待核对';
const options = values => [...new Set(values.filter(Boolean))].map(value => ({ value, label: value }));
const statusTag = value => <Tag color={{ 待审批: 'processing', 审批中: 'processing', 通过: 'success', 已通过: 'success', 驳回: 'error', 已驳回: 'error', 已失效: 'default' }[value]}>{shown(value)}</Tag>;
const projectKey = (row, side) => row[`${side}ProjectId`] || row[`${side}ProjectNo`] || row[`${side}ProjectName`] || '';
const projectCell = (row, side) => <>
  {shown(row[`${side}ProjectName`])}
  <span className="hr-cell-note">项目编号 {shown(row[`${side}ProjectNo`])}</span>
  {!row[`${side}ProjectNo`] && row[`${side}ProjectId`] && <span className="hr-cell-note">项目标识 {shown(row[`${side}ProjectId`])}</span>}
</>;

export default function HrDeliveryLineChanges({ role = '人事', onNavigate }) {
  const allowed = ['人事', 'HR'].includes(role);
  const [view, setView] = React.useState({ role, rows: [], loading: true, error: '' });
  const [query, setQuery] = React.useState('');
  const [pm, setPm] = React.useState();
  const [project, setProject] = React.useState();
  const [status, setStatus] = React.useState();
  const [selectedKey, setSelectedKey] = React.useState('');
  const [personId, setPersonId] = React.useState('');
  const refresh = React.useCallback(() => {
    try { setView({ ...getDeliveryLineChanges(role), directory: allowed ? getHrView(role) : null, loading: false, error: '' }); }
    catch (error) { setView({ role, rows: [], loading: false, error: error.message || '记录读取失败' }); }
  }, [allowed, role]);
  React.useEffect(() => {
    refresh();
    return allowed ? subscribeHr(refresh) : undefined;
  }, [allowed, refresh]);

  if (!allowed) return <Alert type="warning" showIcon title="当前角色无权查看交付线变更记录" />;
  const records = view.role === role ? view.rows : [];
  const directory = view.role === role ? view.directory : null;
  const people = directory?.people || [];
  const projectOptions = [...new Map(records.flatMap(row => ['source', 'target'].map(side => ({
    value: projectKey(row, side),
    label: [row[`${side}ProjectName`] || '项目名称待核对', row[`${side}ProjectNo`] || row[`${side}ProjectId`]].filter(Boolean).join(' · '),
  }))).filter(option => option.value).map(option => [option.value, option])).values()];
  const queryText = displayText(query.trim()).toLowerCase();
  const rows = records.filter(row => {
    const searchable = [row.name, row.employeeNo, row.sourceProjectName, row.sourceProjectNo, row.sourceProjectId, row.targetProjectName, row.targetProjectNo, row.targetProjectId, row.sourcePmName, row.targetPmName, row.approvalNo, row.approvalId, row.sourceRecordNo, row.sourceRecordId].join(' ').toLowerCase();
    return searchable.includes(queryText) && (!project || [projectKey(row, 'source'), projectKey(row, 'target')].includes(project)) && (!pm || [row.sourcePmName, row.targetPmName].includes(pm)) && (!status || row.status === status);
  });
  const selected = records.find(row => row.key === selectedKey);
  const selectedPerson = people.find(person => person.id === personId);
  const personButton = row => <Button type="link" className="hr-name-link" disabled={!people.some(person => person.id === row.personId)} onClick={() => setPersonId(row.personId)}>{shown(row.name)}</Button>;
  const columns = [
    { title: '人员', key: 'person', width: 165, fixed: 'left', render: (_, row) => <>{personButton(row)}<span className="hr-cell-note">{shown(row.employeeNo)}</span></> },
    { title: '来源项目', key: 'sourceProject', width: 255, render: (_, row) => projectCell(row, 'source') },
    { title: '来源PM', dataIndex: 'sourcePmName', width: 125, render: shown },
    { title: '来源交付线', dataIndex: 'sourceLineName', width: 160, render: shown },
    { title: '目标项目', key: 'targetProject', width: 255, render: (_, row) => projectCell(row, 'target') },
    { title: '目标PM', dataIndex: 'targetPmName', width: 125, render: shown },
    { title: '目标交付线', dataIndex: 'targetLineName', width: 160, render: shown },
    { title: '申请时间', dataIndex: 'requestedAt', width: 165, render: dateText, sorter: (a, b) => String(a.requestedAt).localeCompare(String(b.requestedAt)) },
    { title: '审批状态', dataIndex: 'status', width: 115, render: statusTag },
    { title: '审批完成时间', dataIndex: 'completedAt', width: 165, render: dateText },
    { title: '生效日期', dataIndex: 'effectiveDate', width: 125, render: dateOnlyText },
    { title: '审批来源', key: 'source', width: 200, render: (_, row) => <>{shown(row.source)}<span className="hr-cell-note">来源记录 {shown(row.sourceRecordNo || row.sourceRecordId)}</span></> },
    { title: '审批编号', dataIndex: 'approvalNo', width: 180, render: shown },
    { title: '操作', key: 'actions', fixed: 'right', width: 90, render: (_, row) => <Button type="link" onClick={() => setSelectedKey(row.key)}>详情</Button> },
  ];
  return <div className="hr-page">
    <div className="hr-page-heading"><div><p className="eyebrow">人事变动</p><h1>交付线变更记录</h1><p className="subtitle">每条明细对应一名人员从来源项目到目标项目的变更。</p></div></div>
    <div className="hr-scope"><span>飞书审批接口待接入，当前展示审批记录快照。</span><span>历史记录缺失的信息显示为待核对</span></div>
    {view.error && <Alert type="error" showIcon title="交付线变更记录读取失败" description={view.error} action={<Button onClick={refresh}>重试</Button>} style={{ marginBottom: 16 }} />}
    <Card className="hr-table-card">
      <div className="hr-card-heading"><h2>项目关联变更明细 <span>{rows.length} 条</span></h2><Tag>只读记录</Tag></div>
      <div className="hr-filter-grid">
        <Input allowClear prefix={<SearchOutlined />} aria-label="搜索人员项目或审批编号" placeholder="姓名 / 项目名称、编号 / 审批编号" value={query} onChange={event => setQuery(event.target.value)} />
        <Select allowClear showSearch optionFilterProp="label" aria-label="筛选涉及项目" placeholder="全部来源及目标项目" value={project} onChange={setProject} options={projectOptions} />
        <Select allowClear showSearch optionFilterProp="label" aria-label="筛选项目经理" placeholder="全部项目经理" value={pm} onChange={setPm} options={options(records.flatMap(row => [row.sourcePmName, row.targetPmName]))} />
        <Select allowClear aria-label="筛选审批状态" placeholder="全部审批状态" value={status} onChange={setStatus} options={options(records.map(row => row.status))} />
        <Button onClick={() => { setQuery(''); setProject(undefined); setPm(undefined); setStatus(undefined); }}>重置筛选</Button>
      </div>
      <Table rowKey="key" columns={columns} dataSource={rows} loading={view.loading || view.role !== role} scroll={{ x: 2385 }} pagination={{ pageSize: 10, showSizeChanger: true, showTotal: total => `共 ${total} 条项目关联变更明细` }} locale={{ emptyText: <Empty description={records.length ? '暂无符合筛选条件的项目关联变更' : '暂无交付线变更记录'} /> }} />
    </Card>
    <Drawer title="交付线变更详情" open={!!selected} onClose={() => setSelectedKey('')} size={800} destroyOnHidden>
      {selected && <div className="hr-detail">
        <Descriptions title="人员与申请" bordered size="small" column={{ xs: 1, sm: 2 }} items={[
          { key: 'person', label: '姓名', children: personButton(selected) },
          { key: 'employeeNo', label: '员工编号', children: shown(selected.employeeNo) },
          { key: 'employeeType', label: '人员类型', children: shown(selected.employeeType) },
          { key: 'requester', label: '申请人', children: shown(selected.requesterName) },
        ]} />
        <Descriptions title="来源项目关联" bordered size="small" column={{ xs: 1, sm: 2 }} items={[
          ['项目名称', selected.sourceProjectName], ['项目编号', selected.sourceProjectNo], ['来源PM', selected.sourcePmName], ['来源交付线', selected.sourceLineName],
        ].map(([label, value]) => ({ key: label, label, children: shown(value) }))} />
        <Descriptions title="目标项目关联" bordered size="small" column={{ xs: 1, sm: 2 }} items={[
          ['项目名称', selected.targetProjectName], ['项目编号', selected.targetProjectNo], ['目标PM', selected.targetPmName], ['目标交付线', selected.targetLineName],
        ].map(([label, value]) => ({ key: label, label, children: shown(value) }))} />
        <Descriptions title="审批记录" bordered size="small" column={{ xs: 1, sm: 2 }} items={[
          { key: 'status', label: '审批状态', children: statusTag(selected.status) },
          { key: 'source', label: '审批来源', children: shown(selected.source) },
          { key: 'approvalNo', label: '审批编号', children: shown(selected.approvalNo) },
          { key: 'sourceRecordNo', label: '来源记录编号', children: shown(selected.sourceRecordNo) },
          { key: 'sourceRecordId', label: '来源记录标识', children: shown(selected.sourceRecordId) },
          { key: 'requestedAt', label: '申请时间', children: dateText(selected.requestedAt) },
          { key: 'completedAt', label: '审批完成时间', children: dateText(selected.completedAt) },
          { key: 'effectiveDate', label: '生效日期', span: 2, children: dateOnlyText(selected.effectiveDate) },
          { key: 'reason', label: '处理说明', span: 2, children: selected.reason || '暂无说明' },
          { key: 'url', label: '飞书审批', span: 2, children: selected.approvalUrl ? <a href={selected.approvalUrl} target="_blank" rel="noreferrer">查看飞书审批</a> : '待核对' },
        ]} />
      </div>}
    </Drawer>
    <PersonDetail person={selectedPerson} role={role} view={directory || {}} onClose={() => setPersonId('')} refresh={refresh} onNavigate={onNavigate} allowActions={false} readOnlyNote="人员资料按当前人事档案展示，变更前后的项目归属以审批记录为准。" />
  </div>;
}
