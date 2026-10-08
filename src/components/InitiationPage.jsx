import React from 'react';
import {
  Button, Card, Col, DatePicker, Empty, Form, Input, Modal, Row, Select, Space,
  Table, Tabs, Tag, Tooltip, message,
} from 'antd';
import {
  CheckCircle2, ClipboardCheck, Clock3, FilePlus2, FileText, History, Info,
  RotateCcw, Search, Send, ShieldCheck, UserRound, XCircle,
} from 'lucide-react';
import dayjs from 'dayjs';

const INITIATION_FIELDS = [
  { key: 'projectNo', label: '项目编号' }, { key: 'projectName', label: '项目名称', required: true },
  { key: 'mainProject', label: '主项目名称' }, { key: 'status', label: '项目状态' },
  { key: 'customer', label: '客户', required: true }, { key: 'customerManager', label: '客户经理' },
  { key: 'taskType', label: '任务类型', required: true }, { key: 'startDate', label: '起始日期', required: true },
  { key: 'terminal', label: '终端' }, { key: 'security', label: '密级', required: true },
  { key: 'pm', label: 'PM', required: true }, { key: 'pa', label: 'PA' }, { key: 'qa', label: 'QA负责人' },
  { key: 'deputyPm', label: '代理PM' }, { key: 'mentorPm', label: '带教PM' }, { key: 'risk', label: '风险等级', required: true },
  { key: 'projectTag', label: '项目标记' },
];

export const seedApplications = [
  { key: 'init-001', projectNo: 'ZJ20260916017', projectName: '中文答案可用性评测', mainProject: '中文内容评测', status: '待 PMO 审核', customer: '字节', customerManager: '周宁', taskType: '评测', startDate: '2026-09-16', terminal: '字节内部平台', security: 'L4', pm: '王然', pa: '林晓彤', qa: '陈默', deputyPm: '—', mentorPm: '赵子涵', risk: '中', projectTag: 'Agent评测', creator: '王然', createdAt: '2026-09-20 15:28', updatedAt: '2026-09-20 15:36', reason: '', source: 'REQ-202609-009', sourceName: '中文答案可用性评测', activity: ['2026-09-20 15:36 · 王然提交立项申请', '2026-09-20 15:28 · 从可承接需求创建草稿'] },
  { key: 'init-002', projectNo: 'ZJ20260917008', projectName: '多语种语音采集', mainProject: '多语种数据采集', status: '待 PMO 审核', customer: '海天瑞声', customerManager: '周宁', taskType: '采集/采标', startDate: '2026-09-20', terminal: '—', security: 'L4', pm: '林晓彤', pa: '—', qa: '—', deputyPm: '—', mentorPm: '—', risk: '低', projectTag: '小语种', creator: '林晓彤', createdAt: '2026-09-20 10:12', updatedAt: '2026-09-20 10:24', reason: '', source: 'REQ-202609-005', sourceName: '多语种语音采集', activity: ['2026-09-20 10:24 · 林晓彤提交立项申请'] },
  { key: 'init-003', projectNo: '—', projectName: '电商图像质检试标', mainProject: '电商视觉质检', status: '草稿', customer: '京东', customerManager: '赵子涵', taskType: '图像', startDate: '2026-09-22', terminal: '客户试标平台', security: 'L2', pm: '王然', pa: '—', qa: '林晓彤', deputyPm: '—', mentorPm: '王然', risk: '中', projectTag: '待确认', creator: '王然', createdAt: '2026-09-20 09:18', updatedAt: '2026-09-20 09:42', reason: '', source: 'REQ-202609-008', sourceName: '电商图像质检试标', activity: ['2026-09-20 09:42 · 王然保存草稿'] },
  { key: 'init-004', projectNo: 'ZJ20260912006', projectName: '语音质检专项', mainProject: '语音数据质量项目', status: '审核通过', customer: '字节', customerManager: '周宁', taskType: 'ASR/TTS', startDate: '2026-09-12', terminal: '语音质检平台', security: 'L4', pm: '林晓彤', pa: '赵子涵', qa: '陈默', deputyPm: '—', mentorPm: '—', risk: '高', projectTag: '小语种', creator: '林晓彤', createdAt: '2026-09-18 11:06', updatedAt: '2026-09-18 14:20', reason: 'PMO审核通过，已自动进入试标管理', source: 'REQ-202609-003', sourceName: '语音质检专项', activity: ['2026-09-18 14:20 · 林晓彤审核通过，项目状态变更为试标中'] },
  { key: 'init-005', projectNo: 'ZJ20260911031', projectName: '智能客服测试项目', mainProject: '客服 Agent 质量测试', status: '审核不通过', customer: '腾讯', customerManager: '李想', taskType: '测试', startDate: '2026-09-11', terminal: '海外审核平台', security: 'L3', pm: '陈默', pa: '—', qa: '林晓彤', deputyPm: '—', mentorPm: '王然', risk: '高', projectTag: '待补充资源', creator: '陈默', createdAt: '2026-09-17 09:20', updatedAt: '2026-09-17 16:42', reason: '请补充项目人员配置和风险应对方案后重新提交', source: 'REQ-202609-004', sourceName: '智能客服测试项目', activity: ['2026-09-17 16:42 · PMO审核不通过：请补充项目人员配置和风险应对方案'] },
];

export const INITIATION_STORAGE_KEY = 'mmos.initiation.applications';
const loadApplications = () => {
  try {
    const stored = window.localStorage.getItem(INITIATION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : seedApplications;
  } catch { return seedApplications; }
};
export const getInitiationApplications = loadApplications;

const statusMeta = {
  草稿: { color: 'default', tone: 'draft' }, '待 PMO 审核': { color: 'processing', tone: 'review' },
  '审核通过': { color: 'success', tone: 'approved' }, '审核不通过': { color: 'error', tone: 'rejected' }, 已撤回: { color: 'warning', tone: 'withdrawn' },
};

const defaultProjectNo = () => `ZJ${dayjs().format('YYYYMMDD')}001`;

function ApplicationStatus({ status }) { const meta = statusMeta[status] || statusMeta.草稿; return <Tag color={meta.color} className={`init-status-tag ${meta.tone}`}>{status}</Tag>; }

function StatusSummary({ applications, role, user }) {
  const visible = applications.filter(item => item.status === '草稿' ? item.creator === user : role === 'PMO' || item.creator === user);
  const counts = { all: visible.length, draft: visible.filter(item => item.status === '草稿').length, review: visible.filter(item => item.status === '待 PMO 审核').length, rejected: visible.filter(item => item.status === '审核不通过').length };
  return <Row gutter={[10, 10]} className="init-stat-grid"><Col xs={12} md={6}><Card bordered={false}><div className="init-stat"><span className="init-stat-icon purple"><FileText size={16} /></span><span><small>可见申请</small><strong>{counts.all}</strong></span></div></Card></Col><Col xs={12} md={6}><Card bordered={false}><div className="init-stat"><span className="init-stat-icon blue"><Clock3 size={16} /></span><span><small>待 PMO 审核</small><strong>{counts.review}</strong></span></div></Card></Col><Col xs={12} md={6}><Card bordered={false}><div className="init-stat"><span className="init-stat-icon amber"><FilePlus2 size={16} /></span><span><small>我的草稿</small><strong>{counts.draft}</strong></span></div></Card></Col><Col xs={12} md={6}><Card bordered={false}><div className="init-stat"><span className="init-stat-icon red"><XCircle size={16} /></span><span><small>需重新提交</small><strong>{counts.rejected}</strong></span></div></Card></Col></Row>;
}

function SourceCard({ record }) { return <Card size="small" className="init-source-card" title={<span><Info size={15} /> 来源需求</span>}><div className="init-source-grid"><div><small>项目需求标识</small><strong>{record.source}</strong></div><div><small>需求名称</small><strong>{record.sourceName}</strong></div><div><small>关联状态</small><strong>已确认，可追溯</strong></div></div></Card>; }

function ApplicationDetail({ record, onClose, role, user, onSave, onSubmit, onWithdraw, onApprove, onReject }) {
  const [form] = Form.useForm();
  const isOwner = record?.creator === user;
  const isDraft = record?.status === '草稿';
  const canEdit = record && isOwner && (isDraft || record.status === '审核不通过');
  React.useEffect(() => { if (record) form.setFieldsValue({ ...record, startDate: record.startDate ? dayjs(record.startDate) : null }); }, [record, form]);
  if (!record) return null;
  const submitForm = () => form.validateFields().then(values => onSave({ ...record, ...values, startDate: values.startDate?.format('YYYY-MM-DD') || '—', updatedAt: '2026-09-21 10:20' }));
  return <div className="detail-screen"><div className="detail-screen-bar"><div className="detail-screen-main"><button className="detail-back" onClick={onClose}>返回列表</button><div className="detail-screen-kicker">立项申请 · {record.projectNo}</div><h1>{record.projectName}</h1></div><Space className="detail-screen-actions">{canEdit && <Button onClick={submitForm} icon={<CheckCircle2 size={15} />}>保存草稿</Button>}{canEdit && <Button type="primary" icon={<Send size={15} />} onClick={() => form.validateFields().then(values => onSubmit({ ...record, ...values, startDate: values.startDate?.format('YYYY-MM-DD') || '—' }))}>提交申请</Button>}{isOwner && record.status === '待 PMO 审核' && <Button icon={<RotateCcw size={15} />} onClick={() => onWithdraw(record)}>撤回申请</Button>}{role === 'PMO' && record.status === '待 PMO 审核' && <><Button type="primary" icon={<ShieldCheck size={15} />} onClick={() => onApprove(record)}>通过</Button><Button danger icon={<XCircle size={15} />} onClick={() => onReject(record)}>不通过</Button></>}</Space></div>
    <div className="init-detail-meta"><ApplicationStatus status={record.status} /><span>申请人：{record.creator}</span><span>更新时间：{record.updatedAt}</span><span>项目状态：{record.status === '审核通过' ? '试标中' : '立项申请中'}</span></div>
    <SourceCard record={record} />
    <section className="init-detail-section"><div className="init-detail-heading"><div><p className="panel-kicker">立项申请记录</p><h3>项目申请字段</h3></div><span className="init-permission-note">{canEdit ? '项目经理可编辑；PMO 仅审核' : '当前为只读视图'}</span></div><Form form={form} layout="vertical" disabled={!canEdit} className="init-form"><Row gutter={12}>{INITIATION_FIELDS.map(field => <Col xs={24} sm={field.key === 'projectName' || field.key === 'mainProject' ? 12 : 8} key={field.key}><Form.Item name={field.key} label={<span>{field.label}{field.required && <b className="required-mark">*</b>}</span>} rules={field.required ? [{ required: true, message: `请填写${field.label}` }] : []}>{field.key === 'status' ? <Input /> : field.key === 'security' ? <Select options={['L2', 'L3', 'L4'].map(value => ({ value, label: value }))} /> : field.key === 'risk' ? <Select options={['低', '中', '高'].map(value => ({ value, label: value }))} /> : field.key === 'startDate' ? <DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} /> : <Input />}</Form.Item></Col>)}</Row></Form></section>
    {record.reason && <section className="init-reason-box"><strong>{record.status === '审核不通过' ? 'PMO 不通过理由' : '审核结果'}</strong><p>{record.reason}</p></section>}
    <section className="init-detail-section"><div className="init-detail-heading"><div><p className="panel-kicker">操作留痕</p><h3>申请动态</h3></div></div><div className="init-activity">{record.activity?.map(item => <div key={item}><span /><p>{item}</p></div>)}</div></section>
  </div>;
}

function RejectModal({ record, open, onCancel, onConfirm }) { const [reason, setReason] = React.useState(''); return <Modal title={<span><XCircle size={16} /> 填写不通过理由</span>} open={open} onCancel={() => { setReason(''); onCancel(); }} onOk={() => { if (!reason.trim()) { message.warning('请输入不通过理由'); return; } onConfirm(record, reason.trim()); setReason(''); }} okText="确认不通过" okButtonProps={{ danger: true }}><p className="modal-help-copy">不通过后，项目经理可以在“立项申请中的项目”中查看理由、修改申请并重新提交。</p><Input.TextArea rows={5} value={reason} onChange={event => setReason(event.target.value)} placeholder="请填写需要补充或修改的内容……" /></Modal>; }

function NewApplicationModal({ open, onCancel, onCreate }) { const [form] = Form.useForm(); return <Modal title={<span><FilePlus2 size={16} /> 新建立项申请</span>} open={open} onCancel={onCancel} onOk={() => form.validateFields().then(values => { onCreate({ ...values, startDate: values.startDate.format('YYYY-MM-DD') }); form.resetFields(); })} okText="保存草稿" width={760} destroyOnHidden><p className="modal-help-copy">保存后仅当前账户可见。提交时系统会生成默认项目编号和隐藏项目标识，PMO 审核通过后自动进入试标管理。</p><Form form={form} layout="vertical"><Row gutter={12}><Col span={12}><Form.Item name="projectName" label="项目名称" rules={[{ required: true, message: '请填写项目名称' }]}><Input /></Form.Item></Col><Col span={12}><Form.Item name="mainProject" label="主项目名称"><Input /></Form.Item></Col></Row><Row gutter={12}><Col span={8}><Form.Item name="customer" label="客户" rules={[{ required: true, message: '请填写客户' }]}><Input /></Form.Item></Col><Col span={8}><Form.Item name="taskType" label="任务类型" rules={[{ required: true, message: '请填写任务类型' }]}><Input /></Form.Item></Col><Col span={8}><Form.Item name="startDate" label="起始日期" rules={[{ required: true, message: '请选择起始日期' }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col></Row><Row gutter={12}><Col span={8}><Form.Item name="security" label="密级" initialValue="L3"><Select options={['L2', 'L3', 'L4'].map(value => ({ value, label: value }))} /></Form.Item></Col><Col span={8}><Form.Item name="risk" label="风险等级" initialValue="低"><Select options={['低', '中', '高'].map(value => ({ value, label: value }))} /></Form.Item></Col><Col span={8}><Form.Item name="terminal" label="终端"><Input /></Form.Item></Col></Row><Row gutter={12}><Col span={8}><Form.Item name="pm" label="PM" rules={[{ required: true, message: '请填写PM' }]}><Input /></Form.Item></Col><Col span={8}><Form.Item name="pa" label="PA"><Input /></Form.Item></Col><Col span={8}><Form.Item name="qa" label="QA负责人"><Input /></Form.Item></Col></Row></Form></Modal>; }

export function InitiationPage({ role: roleProp, onRoleChange }) {
  const [localRole, setLocalRole] = React.useState('PMO');
  const role = roleProp || localRole;
  const setRole = onRoleChange || setLocalRole;
  const user = role === 'PMO' ? '林晓彤' : '王然';
  const [applications, setApplications] = React.useState(loadApplications);
  const [tab, setTab] = React.useState('projects');
  const [selected, setSelected] = React.useState(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(null);
  const [query, setQuery] = React.useState('');
  React.useEffect(() => { window.localStorage.setItem(INITIATION_STORAGE_KEY, JSON.stringify(applications)); }, [applications]);
  React.useEffect(() => {
    const sync = event => { if (event.detail) setApplications(event.detail); };
    window.addEventListener('mmos:initiation-updated', sync);
    return () => window.removeEventListener('mmos:initiation-updated', sync);
  }, []);
  const visible = applications.filter(item => item.status === '草稿' ? item.creator === user : role === 'PMO' || item.creator === user);
  const projectRows = visible.filter(item => !['审核通过', '审核不通过'].includes(item.status));
  const reviewRows = role === 'PMO' ? applications.filter(item => item.status === '待 PMO 审核') : [];
  const historyRows = visible.filter(item => ['审核通过', '审核不通过', '已撤回'].includes(item.status));
  const filterRows = rows => rows.filter(item => !query.trim() || [item.projectNo, item.projectName, item.customer, item.pm, item.creator].some(value => String(value).toLowerCase().includes(query.trim().toLowerCase())));
  const updateApplications = updater => setApplications(current => { const next = typeof updater === 'function' ? updater(current) : updater; window.localStorage.setItem(INITIATION_STORAGE_KEY, JSON.stringify(next)); window.dispatchEvent(new CustomEvent('mmos:initiation-updated', { detail: next })); return next; });
  const save = record => { updateApplications(current => current.map(item => item.key === record.key ? { ...item, ...record, status: item.status === '审核不通过' ? '草稿' : item.status, updatedAt: '2026-09-21 10:20' } : item)); setSelected(record); message.success('立项申请草稿已保存'); };
  const submit = record => { const next = { ...record, projectNo: record.projectNo && record.projectNo !== '—' ? record.projectNo : defaultProjectNo(), status: '待 PMO 审核', updatedAt: '2026-09-21 10:20', activity: [`2026-09-21 10:20 · ${user}提交立项申请`, ...(record.activity || [])] }; updateApplications(current => current.map(item => item.key === record.key ? next : item)); setSelected(next); message.success('已提交申请，已进入 PMO 待办'); };
  const create = values => { const key = `init-${Date.now()}`; const next = { key, ...values, projectNo: '—', internalProjectId: `PID-${Date.now()}`, status: '草稿', customerManager: '—', deputyPm: '—', mentorPm: '—', projectTag: '待确认', creator: user, createdAt: '2026-09-21 10:20', updatedAt: '2026-09-21 10:20', source: '—', sourceName: '手动新建立项申请', activity: [`2026-09-21 10:20 · ${user}保存草稿`] }; updateApplications(current => [next, ...current]); setNewOpen(false); setSelected(next); message.success('草稿已保存，仅当前账户可见'); };
  const withdraw = record => { updateApplications(current => current.map(item => item.key === record.key ? { ...item, status: '已撤回', updatedAt: '2026-09-21 10:20', activity: [`2026-09-21 10:20 · ${user}撤回申请`, ...(item.activity || [])] } : item)); setSelected(null); message.success('申请已撤回'); };
  const approve = record => { updateApplications(current => current.map(item => item.key === record.key ? { ...item, status: '审核通过', reason: 'PMO审核通过，已自动进入试标管理', updatedAt: '2026-09-21 10:20', activity: [`2026-09-21 10:20 · PMO审核通过，项目状态变更为试标中`, ...(item.activity || [])] } : item)); setSelected(null); message.success('审核通过，项目已自动进入试标管理'); };
  const reject = (record, reason) => { updateApplications(current => current.map(item => item.key === record.key ? { ...item, status: '审核不通过', reason, updatedAt: '2026-09-21 10:20', activity: [`2026-09-21 10:20 · PMO审核不通过：${reason}`, ...(item.activity || [])] } : item)); setRejecting(null); setSelected(null); message.success('已退回项目经理修改'); };
  const columns = [{ title: '项目编号', dataIndex: 'projectNo', width: 130, render: value => <span className="init-project-no">{value}</span> }, { title: '项目名称', dataIndex: 'projectName', width: 190, render: (value, record) => <button className="init-name-link" onClick={event => { event.stopPropagation(); setSelected(record); }}><span className="init-name-icon"><FileText size={14} /></span><span><strong>{value}</strong><small>{record.mainProject}</small></span></button> }, { title: '客户', dataIndex: 'customer', width: 90 }, { title: 'PM', dataIndex: 'pm', width: 76 }, { title: '任务类型', dataIndex: 'taskType', width: 92 }, { title: '风险等级', dataIndex: 'risk', width: 80, render: value => <Tag color={value === '高' ? 'red' : value === '中' ? 'orange' : 'green'}>{value}</Tag> }, { title: '申请状态', dataIndex: 'status', width: 120, render: value => <ApplicationStatus status={value} /> }, { title: '更新时间', dataIndex: 'updatedAt', width: 145 }, { title: '操作', key: 'action', width: 120, render: (_, record) => <Space size={3}>{role === 'PMO' && record.status === '待 PMO 审核' ? <><Button type="link" size="small" onClick={event => { event.stopPropagation(); approve(record); }}>通过</Button><Button danger type="link" size="small" onClick={event => { event.stopPropagation(); setRejecting(record); }}>不通过</Button></> : <Button type="link" size="small" onClick={event => { event.stopPropagation(); setSelected(record); }}>查看详情</Button>}</Space> }];
  const openRecord = record => setSelected(record);
  const items = [{ key: 'projects', label: <span><ClipboardCheck size={15} /> 立项申请中的项目 <em>{projectRows.length}</em></span>, children: <ApplicationList title="立项申请中的项目" subtitle={role === 'PMO' ? 'PMO 可查看全部已提交申请；草稿仅显示当前账户自己保存的内容。' : '仅显示当前账户自己创建或提交的立项申请。'} rows={filterRows(projectRows)} columns={columns} onOpen={openRecord} onNew={() => setNewOpen(true)} canNew /> }, { key: 'review', label: <span><ShieldCheck size={15} /> PMO 待审核 <em>{reviewRows.length}</em></span>, children: role === 'PMO' ? <ApplicationList title="PMO 待审核" subtitle="处理项目经理提交的立项申请，通过后项目自动进入试标管理。" rows={filterRows(reviewRows)} columns={columns} onOpen={openRecord} /> : <div className="init-access-card"><ShieldCheck size={22} /><strong>该视图仅 PMO 可处理</strong><span>当前账户为项目经理，只能在“立项申请中的项目”中查看自己的申请。</span></div> }, { key: 'history', label: <span><History size={15} /> 审核记录 <em>{historyRows.length}</em></span>, children: <ApplicationList title="审核记录" subtitle="查看已通过、已不通过和已撤回的立项申请记录。" rows={filterRows(historyRows)} columns={columns} onOpen={openRecord} /> }];
  if (selected) return <div className="initiation-page"><ApplicationDetail record={selected} onClose={() => setSelected(null)} role={role} user={user} onSave={save} onSubmit={submit} onWithdraw={record => Modal.confirm({ title: '确认撤回申请？', content: '撤回后申请将离开 PMO 待办，修改后可以重新提交。', okText: '确认撤回', cancelText: '取消', onOk: () => withdraw(record) })} onApprove={approve} onReject={record => setRejecting(record)} /><RejectModal record={rejecting} open={Boolean(rejecting)} onCancel={() => setRejecting(null)} onConfirm={reject} /></div>;
  return <div className="initiation-page"><div className="init-page-heading"><div><p className="eyebrow">项目管理 · 立项申请</p><h1>立项申请</h1><p className="subtitle">以项目经理提交、PMO审核、自动进入试标管理为主线的立项工作区。</p></div><Space><div className="init-role-switch"><UserRound size={14} /><span>演示身份</span><Select size="small" value={role} onChange={value => { setRole(value); setSelected(null); setTab('projects'); }} options={[{ value: 'PMO', label: 'PMO · 林晓彤' }, { value: 'PM', label: 'PM · 王然' }, { value: '财务', label: '财务 · 赵敏' }]} /></div></Space></div><StatusSummary applications={applications} role={role} user={user} /><Card bordered={false} className="init-work-card"><div className="init-list-toolbar"><Space className="init-search"><Input prefix={<Search size={15} />} allowClear value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索项目名称、编号、客户、PM" /></Space><span className="init-permission-chip"><ShieldCheck size={13} /> 当前账户：{role} · {user}</span></div><Tabs activeKey={tab} onChange={setTab} items={items} className="init-tabs" /></Card><NewApplicationModal open={newOpen} onCancel={() => setNewOpen(false)} onCreate={create} /></div>;
}

function ApplicationList({ title, subtitle, rows, columns, onOpen, onNew, canNew }) { return <div className="init-list-view"><div className="init-list-heading"><div><p className="panel-kicker">项目管理 · 立项申请</p><h2>{title}</h2><p>{subtitle}</p></div>{canNew && <Button type="primary" icon={<FilePlus2 size={15} />} onClick={onNew}>新建立项申请</Button>}</div><div className="init-table-meta"><span>当前显示 <strong>{rows.length}</strong> 条记录</span><span><i className="init-legend-dot draft" />草稿仅创建人可见 <i className="init-legend-dot review" />待 PMO 审核</span></div><Table rowKey="key" columns={columns} dataSource={rows} pagination={{ pageSize: 6, showSizeChanger: false }} scroll={{ x: 1050 }} locale={{ emptyText: <Empty description="暂无符合条件的立项申请" /> }} onRow={record => ({ onClick: () => onOpen?.(record) })} /></div>; }
