import React from 'react';
import { Alert, Button, Card, Col, DatePicker, Descriptions, Empty, Form, Input, InputNumber, Modal, Result, Row, Select, Space, Statistic, Table, Tabs, Tag, Timeline, message } from 'antd';
import { PlusOutlined, ReloadOutlined, TeamOutlined } from '@ant-design/icons';
import HrDateField from './HrDateField';
import { FIELDS, OPTIONS, STATES, SYNC_STATES, RECRUITMENT_EVENT, recruitmentActor, managerAllowed, canSee, fieldVisible, authorizedOwners, authorizedPositions, exclusiveValues, syncStatus, todayBJ } from '../data/recruitment';
import { readRecruitment, recruitmentCommand } from '../data/recruitmentStore';
import './recruitment.css';

const opts = values => values.map(value => ({ value, label: value }));
const stamp = value => value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '—';
const color = { 待审批: 'blue', 已驳回: 'red', 待分配: 'orange', 进行中: 'cyan', 已结束: 'default', 回写失败: 'red', 已回写: 'green' };
const Status = ({ value }) => <Tag color={color[value]}>{value}</Tag>;
const requestId = () => crypto.randomUUID();

function SubmissionForm({ actor, context, editing, preset, onSaved, onCancel, role }) {
  const [form] = Form.useForm(); const [busy, setBusy] = React.useState(false); const token = React.useRef(requestId());
  const owners = authorizedOwners(actor, context), positions = authorizedPositions(actor, context);
  const ownerId = Form.useWatch('ownerId', form);
  const initialOwner = editing?.form.ownerId || preset?.projectNo;
  const sourceTrial = editing?.trialId || preset?.trialId;
  const visible = FIELDS.filter(f => fieldVisible(f, actor));
  const fieldOptions = field => {
    if (field.key === 'locations') return context.locations.filter(l => l.status === '在用').map(l => ({ value: l.id, label: l.name }));
    if (field.key === 'positionId') return positions.map(p => ({ value: p.id, label: p.name }));
    if (field.key === 'ownerId') return owners.map(o => ({ value: o.id, label: `${o.type === 'project' ? '项目' : '部门'} · ${o.name}` }));
    if (field.key === 'reviewers') return context.reviewers.map(p => ({ value: p.id, label: p.name }));
    return opts(OPTIONS[field.key] || []);
  };
  const submit = async () => {
    try {
      const values = await form.validateFields(); setBusy(true);
      const result = recruitmentCommand(role, editing ? 'resubmit' : 'submit', { requestId: token.current, id: editing?.id, version: editing?.version, form: values,
        source: editing?.source || preset?.source || '招聘提报', trialId: ownerId === initialOwner ? sourceTrial : '' });
      message.success(editing ? '修改已提交，进入新一轮审批' : '招聘需求已提交'); onSaved(result.id);
    } catch (error) {
      if (error.fields) form.setFields(Object.entries(error.fields).map(([name, msg]) => ({ name, errors: [msg] })));
      if (!error.errorFields) message.error(error.message);
    } finally { setBusy(false); }
  };
  return <Card title={editing ? `修改并重提 · ${editing.number}` : '新建招聘提报'} extra={<Button onClick={onCancel}>返回</Button>}>
    <p className="recruitment-hint">每条需求对应一个岗位；申请人及部门由当前身份带入。标记 * 的字段必须填写。</p>
    {(!owners.length || !positions.length) && <Alert type="warning" showIcon title="没有可用的需求归属或岗位，请先由人事建立岗位并完成授权。" />}
    <Form form={form} layout="vertical" initialValues={editing?.form || { ownerId: preset?.projectNo }} onFinish={submit} scrollToFirstError>
      <Row gutter={[24, 0]}>{visible.map(field => <Col xs={24} md={12} xl={8} key={field.key}>
        {field.type === 'system' ? <Form.Item label={`${field.number}. ${field.label}`}><Input disabled value={actor[field.key === 'applicantName' ? 'name' : 'departmentName']} /></Form.Item>
          : <Form.Item name={field.key} label={`${field.number}. ${field.label}`} rules={[{ required: field.required, message: `请填写${field.label}` }, ...(['text', 'url'].includes(field.type) ? [{ whitespace: true, message: '不能只输入空格' }] : [])]}
            extra={field.key === 'deadline' ? '北京时间，截止当天仍有效。' : field.key === 'positionId' ? '仅显示本人获授权且已启用的岗位。' : undefined}
            getValueFromEvent={field.type === 'multi' ? values => exclusiveValues(form.getFieldValue(field.key) || [], values) : undefined}>
            {['select', 'multi'].includes(field.type) ? <Select showSearch optionFilterProp="label" allowClear mode={field.type === 'multi' ? 'multiple' : undefined} options={fieldOptions(field)} placeholder={`请选择${field.label}`} />
              : field.type === 'number' ? <InputNumber min={1} precision={0} style={{ width: '100%' }} />
                : field.type === 'date' ? <HrDateField /> : <Input placeholder={field.type === 'url' ? 'https://' : `填写${field.label}`} />}
          </Form.Item>}
      </Col>)}</Row>
      <div className="recruitment-form-footer"><Space><Button onClick={onCancel}>取消</Button><Button type="primary" loading={busy} onClick={submit}>提交审批</Button></Space></div>
    </Form>
  </Card>;
}

export default function RecruitmentPage({ role, preset, onPresetHandled, todoOnly = false }) {
  const actor = recruitmentActor(role); const manager = managerAllowed(actor);
  const [loaded, setLoaded] = React.useState(null), [error, setError] = React.useState('');
  const [query, setQuery] = React.useState(''), [status, setStatus] = React.useState('全部'), [hr, setHr] = React.useState(), [sync, setSync] = React.useState(), [range, setRange] = React.useState(null);
  const [selected, setSelected] = React.useState([]), [detailId, setDetailId] = React.useState(null), [editor, setEditor] = React.useState(null);
  const [approval, setApproval] = React.useState(null), [allocation, setAllocation] = React.useState(null), [batchResult, setBatchResult] = React.useState(null);
  const [actionForm] = Form.useForm(); const [busy, setBusy] = React.useState(false);
  const refresh = React.useCallback(() => { try { setLoaded(readRecruitment()); setError(''); } catch (e) { setLoaded(null); setError(e.message); } }, []);
  React.useEffect(() => { refresh(); const events = [RECRUITMENT_EVENT, 'storage', 'mmos:trial-updated', 'mmos:project-updated', 'mmos:acceptance-updated', 'mmos:invoice-updated', 'focus']; events.forEach(e => window.addEventListener(e, refresh)); const timer = setInterval(refresh, 30000); return () => { events.forEach(e => window.removeEventListener(e, refresh)); clearInterval(timer); }; }, [refresh]);
  React.useEffect(() => { setEditor(null); setDetailId(null); setSelected([]); setApproval(null); setAllocation(null); setBatchResult(null); setStatus('全部'); setHr(undefined); setSync(undefined); setRange(null); setQuery(''); }, [role]);
  React.useEffect(() => { if (preset && actor.submit) { setEditor({ preset }); onPresetHandled?.(); } }, [preset, actor.submit, onPresetHandled]);
  if (!actor.submit && !manager) return <Result status="403" title="当前身份没有招聘提报查看权限" subTitle="提报人查看本人需求，招聘经理查看和处理全部需求。" />;
  if (error) return <Result status="error" title="招聘数据读取失败" subTitle={error} extra={<Button onClick={refresh}>重新读取</Button>} />;
  if (!loaded) return <Card loading />;
  const { state, context } = loaded;
  const visible = state.records.filter(r => canSee(r, actor));
  const detail = visible.find(r => r.id === detailId);
  const rows = visible.filter(r => (!todoOnly || r.status === '待审批') && (status === '全部' || r.status === status) && (!hr || r.hr?.id === hr) && (!sync || syncStatus(r) === sync)
    && (!query.trim() || [r.number, r.ownerName, r.positionName].some(v => v.includes(query.trim()))))
    .filter(r => !range?.[0] || (todayBJ(r.firstSubmittedAt) >= range[0].format('YYYY-MM-DD') && todayBJ(r.firstSubmittedAt) <= range[1].format('YYYY-MM-DD')))
    .sort((a, b) => b.firstSubmittedAt.localeCompare(a.firstSubmittedAt) || b.number.localeCompare(a.number));
  const openApprove = row => { actionForm.resetFields(); setApproval({ row, token: requestId() }); };
  const openAllocate = (records, reassign = false) => { actionForm.resetFields(); setAllocation({ rows: records.map(r => ({ id: r.id, version: r.version, hrId: r.hr?.id })), reassign, token: requestId() }); };
  const execute = async () => {
    try {
      const values = await actionForm.validateFields(); setBusy(true);
      const result = approval ? recruitmentCommand(role, values.decision, { id: approval.row.id, version: approval.row.version, reason: values.reason, requestId: approval.token })
        : recruitmentCommand(role, allocation.reassign ? 'reassign' : 'assign', { rows: allocation.rows, hrId: values.hrId, requestId: allocation.token });
      setApproval(null); setAllocation(null); setSelected([]); if (result.results) setBatchResult(result.results); else message.success('审批结果已保存'); refresh();
    } catch (e) { if (!e.errorFields) { message.error(e.message); refresh(); } } finally { setBusy(false); }
  };
  const rowActions = (row, inDetail = false) => <Space size={0}>{!inDetail && <Button type="link" onClick={() => setDetailId(row.id)}>详情</Button>}{manager && row.status === '待审批' && <Button type="link" onClick={() => openApprove(row)}>审批</Button>}{manager && row.status === '待分配' && <Button type="link" onClick={() => openAllocate([row])}>分配 HR</Button>}{actor.id === row.applicantId && row.status === '已驳回' && <Button type="link" onClick={() => setEditor({ editing: row })}>修改重提</Button>}</Space>;
  const formattedField = (field, record) => {
    if (!fieldVisible(field, record)) return '不适用';
    if (field.type === 'system') return record[field.key];
    if (field.key === 'positionId') return record.positionName;
    if (field.key === 'ownerId') return record.ownerName;
    const value = record.form[field.key];
    if (['locations', 'reviewers'].includes(field.key)) return record.directorySnapshot?.[field.key]?.map(v => v.name).join('、') || '—';
    if (field.type === 'url' && /^https?:\/\//.test(value)) return <a href={value} target="_blank" rel="noreferrer">{value}</a>;
    return Array.isArray(value) ? value.join('、') || '—' : value || '—';
  };
  const fieldDetails = record => <Descriptions bordered size="small" column={{ xs: 1, md: 2, xl: 3 }} items={FIELDS.map(f => ({ key: f.key, label: `${f.number}. ${f.label}`, children: formattedField(f, record) }))} />;
  return <div className="recruitment-page">
    <div className="recruitment-heading"><div><p className="eyebrow">招聘 · 需求管理</p><h1>{todoOnly ? '招聘审批待办' : '招聘提报'}</h1><p className="subtitle">{manager ? '查看全部招聘需求，审批后分配对接 HR。' : '查看本人提报，跟进审批、分配和招聘进度。'}</p></div><Space><Button icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>{actor.submit && !editor && <Button type="primary" icon={<PlusOutlined />} onClick={() => { setDetailId(null); setEditor({}); }}>新建提报</Button>}</Space></div>
    {editor ? <SubmissionForm key={editor.editing?.id || 'new'} role={role} actor={actor} context={context} {...editor} onCancel={() => setEditor(null)} onSaved={id => { setEditor(null); setDetailId(id); refresh(); }} />
      : detail ? <>
        <Card title={<Space><Button onClick={() => setDetailId(null)}>返回列表</Button><span>{detail.number}</span><Status value={detail.status} /></Space>} extra={<Space>{rowActions(detail, true)}{manager && detail.status === '进行中' && <Button onClick={() => openAllocate([detail], true)}>改派 HR</Button>}</Space>}>
          <Descriptions column={{ xs: 1, md: 3 }} items={[{ label: '当前版本', children: `V${detail.version}` }, { label: '首次申请时间', children: stamp(detail.firstSubmittedAt) }, { label: '最近提交时间', children: stamp(detail.lastSubmittedAt) }, { label: '对接 HR', children: detail.hr?.name || '待分配' }, { label: '来源入口', children: detail.source }, { label: '回写进度', children: <Status value={syncStatus(detail)} /> }]} />
          {detail.status === '已驳回' && <Alert type="warning" showIcon title="审批驳回" description={detail.history.filter(h => h.action === '审批驳回').at(-1)?.details} />}
          {detail.status === '已结束' && <Alert type="info" showIcon title={detail.endReason} description={`结束时间：${stamp(detail.endedAt)}`} />}
          <Tabs items={[
            { key: 'form', label: '提报详情', children: fieldDetails(detail) },
            { key: 'history', label: '审批与分配历史', children: <Timeline items={[...detail.history].reverse().map(h => ({ content: <><strong>{h.action} · {h.actor} · V{h.version}</strong><p>{stamp(h.at)}　{h.details}</p></> }))} /> },
            { key: 'versions', label: `提交版本（${detail.versions.length}）`, children: <Tabs items={detail.versions.map(v => ({ key: String(v.version), label: `V${v.version}`, children: <><p>提交时间：{stamp(v.at)}</p>{fieldDetails(v)}</> }))} /> },
            { key: 'sync', label: '飞书回写记录', children: <><Alert type="info" showIcon title="飞书接口待接入" description="业务操作已保存到本地。任务保留顺序、版本和目标值，接入后写入同一条飞书记录；当前不会发送审批、批注或修改底表。" /><p>关联飞书记录：{detail.externalRecordId || '待首次建档返回'}</p><Table rowKey="id" size="small" pagination={false} scroll={{ x: 780 }} dataSource={detail.tasks} columns={[{ title: '顺序', dataIndex: 'sequence', width: 65 }, { title: '动作', dataIndex: 'action', width: 170 }, { title: '版本', dataIndex: 'version', width: 65, render: v => `V${v}` }, { title: '目标内容', dataIndex: 'target', width: 220 }, { title: '状态', dataIndex: 'state', width: 100, render: v => <Status value={v} /> }, { title: '说明', dataIndex: 'reason', width: 180 }, { title: '操作', width: 90, render: (_, task) => task.state === '回写失败' && (detail.status !== '已结束' || detail.externalRecordId) ? <Button type="link" onClick={() => { try { recruitmentCommand(role, 'retry', { id: detail.id, taskId: task.id, requestId: requestId() }); message.success('已重新排队'); refresh(); } catch(e) { message.error(e.message); } }}>重试</Button> : '—' }]} /></> },
          ]} />
        </Card>
      </> : <>
        {!todoOnly && <div className="recruitment-stats">{STATES.map(s => <Card key={s} size="small"><Statistic title={s} value={visible.filter(r => r.status === s).length} suffix="条" /></Card>)}</div>}
        <Card>
          {!todoOnly && <Tabs activeKey={status} onChange={value => { setStatus(value); setSelected([]); }} items={['全部', ...STATES].map(s => ({ key: s, label: s }))} />}
          <div className="recruitment-filters"><Input.Search allowClear aria-label="搜索招聘需求" placeholder="需求编号、需求归属、岗位" value={query} onChange={e => setQuery(e.target.value)} /><DatePicker.RangePicker value={range} onChange={setRange} placeholder={['申请开始日期', '申请结束日期']} /><Select allowClear aria-label="对接 HR 筛选" placeholder="对接 HR" value={hr} onChange={setHr} options={context.recruiters.map(h => ({ value: h.id, label: h.name }))} /><Select allowClear aria-label="回写进度筛选" placeholder="回写进度" value={sync} onChange={setSync} options={opts(SYNC_STATES)} /><Button onClick={() => { setQuery(''); setRange(null); setHr(undefined); setSync(undefined); setStatus('全部'); setSelected([]); }}>重置</Button></div>
          <div className="recruitment-table-bar"><span>共 {rows.length} 条需求{selected.length ? ` · 已选 ${selected.length} 条` : ''}</span>{manager && !todoOnly && <Button icon={<TeamOutlined />} disabled={!selected.length} onClick={() => openAllocate(visible.filter(r => selected.includes(r.id)))}>批量分配 HR</Button>}</div>
          <Table rowKey="id" dataSource={rows} rowSelection={manager && !todoOnly ? { selectedRowKeys: selected, onChange: setSelected, preserveSelectedRowKeys: true, getCheckboxProps: r => ({ disabled: r.status !== '待分配' }) } : undefined} scroll={{ x: 1860 }} pagination={{ defaultPageSize: 8, showSizeChanger: true }} locale={{ emptyText: <Empty description={todoOnly ? '暂无待审批招聘需求' : '没有符合条件的招聘需求'} /> }} columns={[
            { title: '需求编号 / 归属', key: 'subject', width: 250, fixed: 'left', render: (_, r) => <div><Button type="link" className="recruitment-record-link" onClick={() => setDetailId(r.id)}>{r.number}</Button><div>{r.ownerName}</div></div> },
            { title: '业务状态', dataIndex: 'status', width: 105, render: v => <Status value={v} /> }, { title: '申请人', dataIndex: 'applicantName', width: 90 }, { title: '申请部门', dataIndex: 'departmentName', width: 160 }, { title: '申请时间', dataIndex: 'firstSubmittedAt', width: 180, render: stamp },
            { title: '岗位', dataIndex: 'positionName', width: 130 }, { title: '人数', key: 'count', width: 70, align: 'right', render: (_, r) => r.form.headcount }, { title: '优先级', key: 'priority', width: 100, render: (_, r) => r.form.priority },
            { title: '截止日期', key: 'deadline', width: 115, render: (_, r) => r.form.deadline }, 
            { title: '对接 HR', key: 'hr', width: 90, render: (_, r) => r.hr?.name || '—' }, { title: '回写进度', key: 'sync', width: 115, render: (_, r) => <Status value={syncStatus(r)} /> }, { title: '操作', key: 'actions', fixed: 'right', width: 190, render: (_, r) => rowActions(r) },
          ]} />
        </Card>
      </>}
    <Modal title={approval ? `审批招聘需求 · ${approval.row.number}` : allocation?.reassign ? '改派对接 HR' : `分配对接 HR · ${allocation?.rows.length || 0} 条需求`} open={Boolean(approval || allocation)} onCancel={() => { setApproval(null); setAllocation(null); }} onOk={execute} confirmLoading={busy} okText="确认" forceRender>
      <Form form={actionForm} layout="vertical" preserve={false}>{approval ? <><Form.Item name="decision" label="审批结果" rules={[{ required: true, message: '请选择审批结果' }]}><Select options={[{ value: 'approve', label: '通过' }, { value: 'reject', label: '驳回' }]} /></Form.Item><Form.Item noStyle shouldUpdate={(a, b) => a.decision !== b.decision}>{({ getFieldValue }) => getFieldValue('decision') === 'reject' && <Form.Item name="reason" label="驳回原因" rules={[{ required: true, whitespace: true, message: '请填写驳回原因' }]}><Input.TextArea rows={4} /></Form.Item>}</Form.Item></> : <><p>候选 HR 均属于人才开发部、在职且账号启用。</p><Form.Item name="hrId" label="对接 HR" rules={[{ required: true, message: '请选择对接 HR' }]}><Select options={context.recruiters.filter(h => h.active && h.enabled).map(h => ({ value: h.id, label: h.name }))} /></Form.Item></>}</Form>
    </Modal>
    <Modal title="分配处理结果" open={Boolean(batchResult)} onCancel={() => setBatchResult(null)} footer={<Button onClick={() => setBatchResult(null)}>完成</Button>}><p>成功 {batchResult?.filter(r => r.success).length} 条，失败 {batchResult?.filter(r => !r.success).length} 条</p>{batchResult?.map(r => <Alert key={r.id} type={r.success ? 'success' : 'error'} showIcon title={r.number} description={r.reason} />)}</Modal>
  </div>;
}

