import React from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Empty, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { getHrCareerView, hrAction } from '../data/hrWorkspace';
import { ASSIGNMENT_KEYS, ASSIGNMENT_LABELS } from '../data/hrCareer';
import { useHrFeature } from './useHrFeature';
import HrDateField from './HrDateField';

const period = row => row.endDate ? `${row.startDate || '开始日待核对'} 至 ${row.endDate}` : row.historicalBackfill ? `${row.startDate || '开始日待核对'} 至 结束日待核对` : `${row.startDate || '开始日待核对'} 至今`;

function Assignment({ title, value }) {
  return <Descriptions title={title} bordered size="small" column={{ xs: 1, sm: 2 }} items={ASSIGNMENT_KEYS.map(key => ({
    key, label: ASSIGNMENT_LABELS[key], children: <>{value?.[key]?.name || '待补齐'}<span className="hr-cell-note">标识：{value?.[key]?.id || '来源待核对'}</span></>,
  }))} />;
}

export function HrCareerPanel({ role, personId }) {
  const { view, error, refresh } = useHrFeature(() => getHrCareerView(role, personId), [role, personId]);
  const [query, setQuery] = React.useState(''), [selectedId, setSelectedId] = React.useState(''), [edit, setEdit] = React.useState(null), [failure, setFailure] = React.useState('');
  const [form] = Form.useForm();
  const hr = ['人事', 'HR'].includes(role);
  React.useEffect(() => { setSelectedId(''); setEdit(null); }, [role, personId]);
  const rows = (view?.rows || []).filter(row => !query.trim() || `${row.approvalId || ''} ${row.assignment?.position?.name}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = rows.find(row => row.id === selectedId);
  React.useEffect(() => {
    if (!edit) return;
    form.resetFields();
    form.setFieldsValue(edit.row ? { ...edit.row } : { personId });
  }, [edit, form, personId]);
  const openEdit = row => { setFailure(''); setEdit({ row, revision: view.revision }); };
  const save = async () => {
    try {
      const input = await form.validateFields();
      hrAction(role, edit.row ? 'career.correct' : 'career.add', { ...input, personId, id: edit.row?.id, expectedVersion: edit.row?.version, expectedRevision: edit.revision });
      setEdit(null); refresh(); message.success('历史任职已保存，冲突与缺项保留待核对');
    } catch (error) { setFailure(error.message || '请检查填写内容'); }
  };
  return <section className="hr-career-panel">
    <Alert type="info" showIcon title="任职按生效日衔接，原任职截至前一自然日" description="历史名称及关联标识独立保存。人事可据材料补录历史段，当前任职更正通过飞书审批；真实审批读取及生效服务待接入。" />
    {error && <Alert type="error" title={error} action={<Button onClick={refresh}>重试</Button>} />}
    <Card className="hr-section hr-table-card"><div className="hr-card-heading"><div><h2>任职期间 <span>{rows.length} 段</span></h2><p>查看完整四项前后快照及材料、审批关联。</p></div><Space wrap><Button icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>{hr && <Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit(null)}>补录历史任职</Button>}</Space></div>
      <div className="hr-filter-grid"><Input aria-label="搜索职业履历" allowClear value={query} placeholder="岗位 / 审批单" onChange={event => setQuery(event.target.value)} /></div>
      <Table rowKey="id" loading={!view && !error} dataSource={rows} scroll={{ x: 1100 }} pagination={{ pageSize: 8, showSizeChanger: true }} locale={{ emptyText: <Empty description="暂无任职履历，可由人事据材料补齐" /> }} columns={[
        { title: '任职期间', width: 215, render: (_, row) => period(row) },
        ...ASSIGNMENT_KEYS.map(key => ({ title: ASSIGNMENT_LABELS[key], width: 150, render: (_, row) => row.assignment?.[key]?.name || '待补齐' })),
        { title: '记录状态', width: 115, dataIndex: 'status', render: value => <Tag color={value === '待核对' ? 'warning' : 'success'}>{value}</Tag> },
        { title: '来源', width: 150, dataIndex: 'source' },
        { title: '操作', width: 100, fixed: 'right', render: (_, row) => <Button type="link" onClick={() => setSelectedId(row.id)}>详情</Button> },
      ]} />
    </Card>
    {!!view?.pending.length && <Card className="hr-section" title="待生效或待核对审批"><Table rowKey={row => row.id || row.sourceRecordId} size="small" scroll={{ x: 650 }} dataSource={view.pending} pagination={{ pageSize: 5 }} columns={[{ title: '员工编号', dataIndex: 'employeeNo' }, { title: '生效日期', dataIndex: 'effectiveDate' }, { title: '审批状态', dataIndex: 'status' }, { title: '审批关联', dataIndex: 'approvalId' }, { title: '处理情况', render: (_, row) => row.issue || (row.effectiveDate > view.today ? '等待业务生效日' : '等待来源核验') }]} /></Card>}
    <Drawer title={selected ? `${selected.name} · 任职履历` : '任职履历详情'} open={!!selected} size={850} onClose={() => setSelectedId('')} destroyOnHidden>
      {selected && <>{selected.issue && <Alert type="warning" title={selected.issue} style={{ marginBottom: 16 }} />}<Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} items={[
        ['人员', `${selected.name} · ${selected.employeeNo}`], ['期间', period(selected)], ['业务生效日期', selected.effectiveDate], ['来源', selected.source], ['审批单', selected.approvalId], ['原始业务标识', selected.sourceRecordId], ['材料依据', selected.evidence], ['记录版本', selected.version],
      ].map(([label, children]) => ({ key: label, label, children: children || '未记录' }))} /><div className="hr-section"><Assignment title="本任职段的当时信息" value={selected.assignment} /></div>{selected.before && <div className="hr-section"><Assignment title="变动前完整快照" value={selected.before} /></div>}{selected.after && <div className="hr-section"><Assignment title="变动后完整快照" value={selected.after} /></div>}
        {hr && selected.historicalBackfill && <Button className="hr-section" onClick={() => openEdit(selected)}>依据材料更正历史补录</Button>}
        <h3>补录与更正记录</h3><Table rowKey={row => `${row.at}:${row.actor}:${row.evidence}`} size="small" dataSource={selected.history || []} pagination={{ pageSize: 5 }} locale={{ emptyText: '暂无补录或更正记录' }} columns={[{ title: '时间', dataIndex: 'at' }, { title: '操作人', dataIndex: 'actor' }, { title: '材料依据', dataIndex: 'evidence' }, { title: '更正前期间', render: (_, row) => row.before ? `${row.before.startDate || '待核对'} 至 ${row.before.endDate || '待核对'}` : '首次补录' }]} />
      </>}
    </Drawer>
    <Modal title={edit?.row ? '更正历史任职补录' : '补录历史任职'} open={!!edit} width={820} onCancel={() => setEdit(null)} onOk={save} okText="保存历史任职" destroyOnHidden>
      <p className="hr-muted">填写当时名称及可核验的来源标识。缺少日期或四项资料时保留待核对；补录不直接修改当前任职。</p>
      {failure && <Alert type="error" title={failure} style={{ marginBottom: 12 }} />}
      <Form form={form} layout="vertical"><Form.Item name="personId" label="关联人员" rules={[{ required: true, message: '请选择人员' }]}><Select showSearch optionFilterProp="label" disabled options={(view?.people || []).map(person => ({ value: person.id, label: `${person.name} · ${person.employeeNo}` }))} /></Form.Item>
        <div className="hr-form-columns"><Form.Item name="startDate" label="任职开始日期"><HrDateField /></Form.Item><Form.Item name="endDate" label="任职结束日期" extra="历史结束日期须早于今天。"><HrDateField /></Form.Item>
          {ASSIGNMENT_KEYS.map(key => <React.Fragment key={key}><Form.Item name={['assignment', key, 'name']} label={`${ASSIGNMENT_LABELS[key]} · 当时名称`}><Input /></Form.Item><Form.Item name={['assignment', key, 'id']} label={`${ASSIGNMENT_LABELS[key]} · 当时标识`}><Input /></Form.Item></React.Fragment>)}
          <Form.Item name="approvalId" label="历史审批单标识"><Input /></Form.Item><Form.Item name="sourceRecordId" label="原始业务记录标识"><Input /></Form.Item>
        </div><Form.Item name="evidence" label="历史审批或可核实材料依据" rules={[{ required: true, whitespace: true, message: '请填写可核实的材料依据' }]}><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Modal>
  </section>;
}
