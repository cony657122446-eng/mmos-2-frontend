import React from 'react';
import { Alert, Button, Card, DatePicker, Descriptions, Drawer, Empty, Input, Select, Space, Table, Tag } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { HR_CHANGE_TYPES } from '../data/hrChanges';
import { getHrChangesView, subscribeHr } from '../data/hrWorkspace';
import { displayText } from '../data/displayText';
import { PersonDetail } from './HrDirectory';
import './hr-workspace.css';

function fieldText(value) {
  if (value === undefined || value === null || value === '') return '未记录';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return value.length ? value.map(fieldText).join('、') : '无';
  if (typeof value === 'object') return fieldText(value.name ?? value.label ?? value.value ?? [value.bank, value.cardNumber, value.branch].filter(Boolean).join(' · '));
  return displayText(String(value));
}

const dateText = value => value && dayjs(value).isValid() ? dayjs(value).format('YYYY-MM-DD HH:mm') : '未记录';
const choices = values => [...new Set(values.filter(Boolean))].map(value => ({ label: value, value }));
const statusTag = value => <Tag color={{ 已通过: 'success', 通过: 'success', 已关联: 'success', 待审批: 'processing', 审批中: 'processing', 已驳回: 'error', 驳回: 'error', 待核对: 'warning' }[value]}>{fieldText(value)}</Tag>;

export default function HrChangesPage({ page, role, onNavigate, focusRecord }) {
  const config = HR_CHANGE_TYPES.find(item => item.page === page);
  const [view, setView] = React.useState(null);
  const [error, setError] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState();
  const [association, setAssociation] = React.useState();
  const [range, setRange] = React.useState(null);
  const [selectedId, setSelectedId] = React.useState('');
  const [personId, setPersonId] = React.useState('');
  const [detailTab, setDetailTab] = React.useState('changes');
  const refresh = React.useCallback(() => {
    try {
      setView(getHrChangesView(role, config?.key));
      setError('');
    } catch (failure) {
      setView(null);
      setError(failure.message || '变动记录读取失败');
    }
  }, [role, config?.key]);
  React.useEffect(() => { refresh(); return subscribeHr(refresh); }, [refresh]);
  React.useEffect(() => {
    setPersonId('');
    setSelectedId(focusRecord?.id || '');
  }, [focusRecord]);

  if (!['人事', 'HR'].includes(role)) return <Alert type="warning" showIcon title="当前角色无权查看人事变动记录" />;
  const records = view?.role === role ? view.rows || [] : [];
  const personView = view?.personView || { people: [] };
  const selected = records.find(row => row.id === selectedId);
  const keyword = displayText(query.trim()).toLowerCase();
  const rows = records.filter(row => {
    const searchable = displayText(`${row.name} ${row.employeeNo} ${row.approvalNo} ${row.sourceRecordId}`).toLowerCase();
    return (!keyword || searchable.includes(keyword)) && (!status || row.status === status) &&
      (!association || row.associationStatus === association) &&
      (!range?.[0] || row.effectiveDate && row.effectiveDate.slice(0, 10) >= range[0].format('YYYY-MM-DD') && row.effectiveDate.slice(0, 10) <= range[1].format('YYYY-MM-DD'));
  });
  const openPerson = (row, tab = 'changes') => {
    setPersonId(row.personId);
    setDetailTab(tab);
    setSelectedId('');
  };
  const linkedPerson = row => personView.people.some(person => person.id === row.personId);
  const columns = [
    { title: '人员', key: 'person', fixed: 'left', width: 160, render: (_, row) => <><Button type="link" className="hr-name-link" disabled={!linkedPerson(row)} onClick={() => openPerson(row)}>{fieldText(row.name)}</Button><span className="hr-cell-note">{fieldText(row.employeeNo)}</span></> },
    { title: '变动内容', key: 'summary', width: 340, render: (_, row) => row.type === 'salary' && !row.salaryAuthorized
      ? <span className="hr-muted">薪资内容需取得薪资档案查看授权</span>
      : row.fields.length ? row.fields.slice(0, 3).map(field => <div className="hr-change-summary" key={field.key}><span>{field.label}</span><span>{fieldText(field.before)} → {fieldText(field.after)}</span></div>) : <span className="hr-muted">具体字段待读取</span> },
    { title: '审批状态', dataIndex: 'status', width: 110, render: statusTag },
    { title: '生效日期', dataIndex: 'effectiveDate', width: 120, render: fieldText, sorter: (a, b) => String(a.effectiveDate || '').localeCompare(String(b.effectiveDate || '')) },
    { title: '档案关联', dataIndex: 'associationStatus', width: 150, render: statusTag },
    { title: '审批来源 / 编号', key: 'source', width: 220, render: (_, row) => <>{fieldText(row.source)}<span className="hr-cell-note">{fieldText(row.approvalNo || row.sourceRecordId)}</span></> },
    { title: '申请时间', dataIndex: 'requestedAt', width: 165, render: dateText },
    { title: '操作', key: 'actions', fixed: 'right', width: 90, render: (_, row) => <Button type="link" onClick={() => setSelectedId(row.id)}>详情</Button> },
  ];

  return <div className="hr-page">
    <div className="hr-page-heading"><div><p className="eyebrow">人事变动</p><h1>{config?.title || '人事变动记录'}</h1><p className="subtitle">查看飞书申请字段、审批结果及对应人员档案。</p></div><Button icon={<ReloadOutlined />} onClick={refresh}>刷新记录</Button></div>
    {error && <Alert type="error" showIcon title="变动记录读取失败" description={error} action={<Button onClick={refresh}>重试</Button>} style={{ marginBottom: 16 }} />}
    {view?.sync?.note && <div className="hr-scope"><span>{view.sync.note}</span>{view.sync.lastSuccess && <span>最近读取 {dateText(view.sync.lastSuccess)}</span>}</div>}
    <Card className="hr-table-card">
      <div className="hr-card-heading"><h2>变动记录 <span>{rows.length} 条</span></h2></div>
      <div className="hr-filter-grid">
        <Input allowClear prefix={<SearchOutlined />} aria-label="搜索人事变动记录" placeholder="姓名 / 员工编号 / 审批编号" value={query} onChange={event => setQuery(event.target.value)} />
        <Select allowClear aria-label="筛选审批状态" placeholder="全部审批状态" value={status} onChange={setStatus} options={choices(records.map(row => row.status))} />
        <Select allowClear aria-label="筛选档案关联" placeholder="全部关联状态" value={association} onChange={setAssociation} options={choices(records.map(row => row.associationStatus))} />
        <DatePicker.RangePicker value={range} onChange={setRange} placeholder={['生效开始日期', '生效结束日期']} />
        <Button onClick={() => { setQuery(''); setStatus(undefined); setAssociation(undefined); setRange(null); }}>重置筛选</Button>
      </div>
      <Table rowKey="id" columns={columns} dataSource={rows} loading={!view && !error} scroll={{ x: 1455 }} pagination={{ pageSize: 10, showSizeChanger: true, showTotal: total => `共 ${total} 条记录` }} locale={{ emptyText: <Empty description="暂无符合条件的变动记录" /> }} />
    </Card>
    <Drawer title={`${config?.title || '人事变动'}详情`} open={!!selected} onClose={() => setSelectedId('')} size={960} destroyOnHidden>
      {selected && <>
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} items={[
          { key: 'person', label: '人员', children: `${fieldText(selected.name)} · ${fieldText(selected.employeeNo)}` },
          { key: 'status', label: '审批状态', children: statusTag(selected.status) },
          { key: 'source', label: '记录来源', children: fieldText(selected.source) },
          { key: 'approval', label: '审批编号', children: fieldText(selected.approvalNo) },
          { key: 'record', label: '来源记录', children: fieldText(selected.sourceRecordId) },
          { key: 'read', label: '读取时间', children: dateText(selected.readAt) },
          { key: 'requested', label: '申请时间', children: dateText(selected.requestedAt) },
          { key: 'completed', label: '审批完成时间', children: dateText(selected.completedAt) },
          { key: 'effective', label: '生效日期', children: fieldText(selected.effectiveDate) },
          { key: 'association', label: '档案关联', children: statusTag(selected.associationStatus) },
          { key: 'mapping', label: '字段关联', span: 2, children: fieldText(selected.fieldMappingStatus) },
          { key: 'reason', label: '变动原因', span: 2, children: fieldText(selected.reason) },
        ]} />
        <h3 className="hr-change-fields-title">变更字段与档案关联</h3>
        <Table rowKey="key" size="small" pagination={false} scroll={{ x: 790 }} dataSource={selected.fields} locale={{ emptyText: '具体字段待读取' }} columns={[
          { title: '申请字段', key: 'label', width: 150, render: (_, field) => fieldText(field.sourceLabel || field.label) },
          { title: '变更前', dataIndex: 'before', width: 150, render: fieldText },
          { title: '申请变更后', dataIndex: 'after', width: 150, render: fieldText },
          { title: '关联档案字段', key: 'target', width: 180, render: (_, field) => <>{fieldText(field.targetTable)}<span className="hr-cell-note">{fieldText(field.targetLabel)}</span></> },
          { title: '档案当前值', dataIndex: 'currentValue', width: 160, render: fieldText },
        ]} />
        <Space wrap style={{ marginTop: 20 }}>
          <Button disabled={!linkedPerson(selected)} onClick={() => openPerson(selected)}>查看人员主库</Button>
          {selected.fields.some(field => field.targetTable === '薪资档案') && <Button disabled={!linkedPerson(selected)} onClick={() => openPerson(selected, 'compensation')}>查看薪资档案</Button>}
          {selected.approvalUrl && <Button href={selected.approvalUrl} target="_blank" rel="noreferrer">查看飞书原记录</Button>}
        </Space>
      </>}
    </Drawer>
    <PersonDetail key={`${personId}-${detailTab}`} person={personView.people.find(person => person.id === personId)} role={role} view={personView} onClose={() => setPersonId('')} refresh={refresh} onNavigate={onNavigate} allowActions={false} initialDetailTab={detailTab} />
  </div>;
}
