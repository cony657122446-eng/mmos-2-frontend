import React from 'react';
import {
  Button, Card, Empty, Form, Input, Modal, Row, Select,
  Space, Table, Tabs, Tag, Tooltip, message,
} from 'antd';
import {
  CheckCircle2, ClipboardCheck, Download, FilePlus2, History,
  Plus, Search, Send, SlidersHorizontal, Sparkles,
} from 'lucide-react';

const REQUIRED_FIELDS = ['项目名称', '业务类型', '客户'];
const FIELD_GROUPS = [
  ['项目需求标识', '项目名称', '业务类型', '客户', '计价方式', '密级', '业务标签'],
  ['垂类知识', '语言能力', '平台工具能力', '规则文档', '抢单截至时间'],
  ['标注人员画像', '需求人数', '人力等级', '期望城市', '资源使用周期'],
  ['目标人效果', '目标准确率', '是否接受兼职作业', '每日工作时长'],
];
const FIELD_KEYS = FIELD_GROUPS.flat();

const initialAvailable = [
  { key: 'REQ-202609-001', project: '豆包小程序人评', type: '标采', client: '字节', pricing: '计件', summary: '面向生活服务场景的 Agent 评测与质量标注', createdBy: '林晓彤', createdAt: '2026-09-20 09:42', status: '可承接', deadline: '2026-10-15 18:00', doc: 'https://example.com/requirement/REQ-202609-001' },
  { key: 'REQ-202609-002', project: '海外内容审核产线', type: '审核', client: '腾讯', pricing: '包时', summary: '海外多语种内容审核与质量抽检', createdBy: '赵子涵', createdAt: '2026-09-19 16:18', status: '可承接', deadline: '', doc: 'https://example.com/requirement/REQ-202609-002' },
  { key: 'REQ-202609-004', project: '数学公式校对', type: '标注', client: '阿里', pricing: '计件', summary: '数学公式识别结果校对', createdBy: '林晓彤', createdAt: '2026-09-01 10:12', status: '可承接', deadline: '2026-09-10 18:00', doc: 'https://example.com/requirement/REQ-202609-004' },
];
const initialHistory = [
  { key: 'REQ-202609-003', project: '语音质检专项', type: '标采', client: '字节', pricing: '包月', projectNo: 'ZJ20260910922', pm: '陈默', initiatedAt: '2026-09-18 13:20', status: '已承接', deadline: '2026-09-18 12:00', updatedAt: '2026-09-20 09:30' },
  { key: 'REQ-202609-000', project: '星河智能客服项目', type: '评测', client: '字节', pricing: '计件', projectNo: 'ZJ20260825733', pm: '王然', initiatedAt: '2026-08-25 16:40', status: '已承接', deadline: '2026-08-25 16:00', updatedAt: '2026-09-19 17:08' },
  { key: 'REQ-202608-019', project: '海外内容审核产线', type: '审核', client: '腾讯', pricing: '包时', projectNo: 'ZJ20260819018', pm: '李想', initiatedAt: '2026-08-19 10:08', status: '已承接', deadline: '2026-08-19 10:00', updatedAt: '2026-09-12 15:44' },
];

const fullFieldValue = record => ({
  '项目需求标识': record.key, '项目名称': record.project, '业务类型': record.type,
  客户: record.client, 计价方式: record.pricing, 密级: 'L4', 业务标签: '大模型 / 文本 / 评估',
  垂类知识: '', 语言能力: '中文', '平台工具能力': '飞书表格', 规则文档: record.doc || '',
  抢单截至时间: record.deadline || '', 标注人员画像: '', 需求人数: '6', 人力等级: '无要求',
  期望城市: '无', 资源使用周期: '2026.09.04 ~ 2026.12.31', 目标人效果: '960.00', 目标准确率: '90%',
  是否接受兼职作业: '否', 每日工作时长: '不限制',
});

const blankFieldValue = record => FIELD_KEYS.reduce((values, field) => ({ ...values, [field]: field === '项目需求标识' ? record.key : '' }), {});
const fieldFromText = (text, fieldNames) => {
  const names = fieldNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = text.match(new RegExp(`(?:^|[\\n；;，,])\\s*(?:${names})\\s*[:：]\\s*([^\\n；;，,]+)`, 'i'));
  return match?.[1]?.trim() || '';
};
function recognizeRequirement(text) {
  const source = text.trim();
  const fields = blankFieldValue({ key: `REQ-${Date.now()}` });
  fields['项目名称'] = fieldFromText(source, ['项目名称', '项目名']);
  fields['业务类型'] = fieldFromText(source, ['业务类型', '任务类型']) || ['标注', '采集', '审核', '评测', '翻译', 'ASR/TTS', '图像', '文本', '音频', '视频'].find(value => source.includes(value)) || '';
  fields.客户 = fieldFromText(source, ['客户', '甲方']) || ['字节', '腾讯', '阿里', '京东', '海天瑞声'].find(value => source.includes(value)) || '';
  fields.计价方式 = fieldFromText(source, ['计价方式', '计价']) || ['计件', '包天', '包时', '包月'].find(value => source.includes(value)) || '';
  FIELD_KEYS.filter(field => !REQUIRED_FIELDS.includes(field) && field !== '项目需求标识').forEach(field => {
    const value = fieldFromText(source, [field]);
    if (value) fields[field] = value;
  });
  const doc = source.match(/https?:\/\/[^\s，；;]+/i)?.[0] || '';
  return { key: fields['项目需求标识'], project: fields['项目名称'], type: fields['业务类型'], client: fields.客户, pricing: fields['计价方式'], fieldValues: fields, summary: source, doc, createdBy: '林晓彤', createdAt: '2026-09-20 10:24', status: '待PMO确认' };
}

function demandStatus(record, now = new Date('2026-09-28T12:00:00')) {
  if (record.status === '已承接' || record.status === '已过期') return record.status;
  const deadline = record.fieldValues?.['抢单截至时间'] || record.deadline;
  if (deadline && new Date(deadline.replace(' ', 'T')) < now) return '已过期';
  return '可承接';
}
function StatusTag({ status }) {
  const color = status === '可承接' ? 'blue' : status === '已承接' ? 'green' : status === '已过期' ? 'default' : 'purple';
  return <Tag color={color}>{status}</Tag>;
}

function RequiredState({ record }) {
  return <Space size={4} wrap>{REQUIRED_FIELDS.map(field => {
    const value = field === '项目名称' ? record.project : field === '业务类型' ? record.type : field === '客户' ? record.client : record.pricing;
    return <Tag key={field} color={value ? 'success' : 'error'}>{field}{value ? ' · 已识别' : ' · 待补充'}</Tag>;
  })}</Space>;
}

function FieldGrid({ values, editable = false, onChange }) {
  return <div className="requirements-field-grid">{FIELD_GROUPS.map((group, groupIndex) => <div className="requirements-field-group" key={groupIndex}>{group.map(field => <div className="requirements-field" key={field}><span>{field}{REQUIRED_FIELDS.includes(field) && <b>*</b>}</span>{editable && field !== '项目需求标识' ? <Input value={values[field] || ''} placeholder="原文未识别，待补充" onChange={event => onChange?.(field, event.target.value)} /> : <strong className={!values[field] ? 'is-empty' : ''}>{values[field] || '待补充 / 待确认'}</strong>}</div>)}</div>)}</div>;
}

function DetailView({ record, onClose, editable, onSave, onConfirm, canInitiate, canEdit, canArchive, onArchive }) {
  const [values, setValues] = React.useState(() => record?.fieldValues || fullFieldValue(record || {}));
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => { if (record) { setValues(record.fieldValues || fullFieldValue(record)); setEditing(false); } }, [record]);
  if (!record) return null;
  const save = () => onSave?.({ ...record, project: values['项目名称'], type: values['业务类型'], client: values.客户, pricing: values['计价方式'], fieldValues: values });
  const confirm = () => onConfirm?.({ ...record, project: values['项目名称'], type: values['业务类型'], client: values.客户, pricing: values['计价方式'], fieldValues: values });
  const canChange = editable || (canEdit && editing);
  return <div className="detail-screen"><div className="detail-screen-bar"><div className="detail-screen-main"><button className="detail-back" onClick={onClose}>返回列表</button><div className="detail-screen-kicker">需求详情 · {record.key}</div><h1>{record.project || '需求详情'}</h1></div><Space className="detail-screen-actions">{canEdit && !editing && <Button onClick={() => setEditing(true)}>编辑字段</Button>}{canChange && <Button type="default" icon={<CheckCircle2 size={15} />} onClick={() => { save(); setEditing(false); }}>保存</Button>}{editable && <Button type="primary" icon={<Send size={15} />} onClick={confirm}>确认并发布</Button>}{canArchive && <Button danger onClick={() => onArchive(record)}>下架</Button>}{canInitiate && <Button type="primary" icon={<Send size={15} />} onClick={() => message.success('已发起立项申请，需求已锁定')}>发起立项申请</Button>}</Space></div>
    <div className="drawer-meta"><StatusTag status={demandStatus(record)} /><span>创建人：{record.createdBy}</span><span>创建时间：{record.createdAt}</span><span>抢单截至：{values['抢单截至时间'] || '未设置'}</span></div>
    <Card size="small" className="source-card" title={<span><Sparkles size={15} /> Agent 识别结果</span>}><p>Agent仅识别原始文字中明确存在的信息；空字段不会自动猜测或补全。</p><RequiredState record={record} /></Card>
    <section className="drawer-section"><div className="drawer-section-heading"><h3>项目需求表字段</h3><span>{canChange ? 'PMO 可编辑详细字段' : '完整字段只读展示'}</span></div><FieldGrid values={values} editable={canChange} onChange={(field, value) => setValues(current => ({ ...current, [field]: value }))} /></section>
    <section className="drawer-section"><div className="drawer-section-heading"><h3>原始需求文字</h3><span>只读留痕</span></div><div className="raw-requirement">{record.summary}。客户原始需求文本将在接入后完整保留，用于识别结果追溯。</div></section>
    <section className="drawer-section"><div className="drawer-section-heading"><h3>文档链接</h3></div>{record.doc ? <a href={record.doc} target="_blank" rel="noreferrer">打开原始需求文档</a> : <span className="empty-copy">暂无文档链接</span>}</section>
  </div>;
}

function NewRequirementModal({ open, onClose, onRecognize }) {
  const [text, setText] = React.useState('');
  return <Modal title={<span><FilePlus2 size={17} /> 新建需求 · 原文识别</span>} open={open} onCancel={onClose} width={720} footer={<Space><Button onClick={onClose}>取消</Button><Button onClick={() => message.success('需求草稿已保存')}>保存草稿</Button><Button type="primary" icon={<Sparkles size={15} />} onClick={() => { onRecognize(text); setText(''); }}>开始识别</Button></Space>}>
    <div className="new-demand-intro">第一步：粘贴客户原始需求。Agent 将按照项目需求表识别所有可确认字段，完成后由 PMO 在详情中确认和补充。</div>
    <Input.TextArea rows={9} value={text} onChange={event => setText(event.target.value)} placeholder="请粘贴或填写原始需求文字……" />
    <div className="new-demand-hint"><Sparkles size={15} /> 必填字段：项目名称、业务类型、客户。必须由 Agent 识别到或由 PMO 补充后，才可以确认发布；计价方式属于普通需求字段，不作为发布阻断条件。</div>
  </Modal>;
}

function AvailableList({ data, onOpen, onNew }) {
  const columns = [{ title: '项目名称', dataIndex: 'project', render: (value, record) => <button className="table-link" onClick={() => onOpen(record)}>{value || '待补充项目名称'}</button> }, { title: '业务类型', dataIndex: 'type' }, { title: '客户', dataIndex: 'client' }, { title: '计价方式', dataIndex: 'pricing' }, { title: '抢单截至时间', dataIndex: 'deadline', render: value => value || '未设置' }, { title: '需求描述摘要', dataIndex: 'summary', ellipsis: true }, { title: '创建时间', dataIndex: 'createdAt' }, { title: '当前状态', key: 'status', render: (_, record) => <StatusTag status={demandStatus(record)} /> }];
  return <><div className="requirements-toolbar"><div><p className="eyebrow">项目 · 需求接入</p><h1>可承接需求</h1><p className="subtitle">查看已完成 PMO 确认和必填字段校验、等待项目经理承接的需求。</p></div><Button type="primary" icon={<Plus size={15} />} onClick={onNew}>新建需求</Button></div><Card className="requirements-card" bordered={false}><div className="list-summary"><span><strong>{data.length}</strong> 条可承接需求</span><Space><Input prefix={<Search size={14} />} placeholder="搜索项目名称 / 编号" style={{ width: 230 }} /><Button icon={<SlidersHorizontal size={15} />}>筛选</Button></Space></div><Table rowKey="key" columns={columns} dataSource={data} pagination={{ pageSize: 8, showSizeChanger: false }} locale={{ emptyText: <Empty description="暂无可承接需求" /> }} scroll={{ x: 1100 }} onRow={record => ({ onClick: () => onOpen(record) })} /></Card></>;
}

function HistoryList({ data, onOpen, title, subtitle, emptyText }) {
  const [selected, setSelected] = React.useState([]);
  const columns = [{ title: '项目名称', dataIndex: 'project', render: (value, record) => <button className="table-link" onClick={() => onOpen(record)}>{value}</button> }, { title: '客户', dataIndex: 'client' }, { title: 'PM', dataIndex: 'pm', render: value => value || '—' }, { title: '抢单截至时间', dataIndex: 'deadline', render: value => value || '未设置' }, { title: '当前状态', key: 'status', render: (_, record) => <StatusTag status={demandStatus(record)} /> }, { title: '过期原因', dataIndex: 'expireReason', render: value => value || '—' }, { title: '最近更新时间', dataIndex: 'updatedAt' }];
  const exportRows = () => { const headers = ['项目需求标识', '项目名称', '客户', '当前状态', '抢单截至时间', '最近更新时间']; const rows = data.filter(item => !selected.length || selected.includes(item.key)).map(item => [item.key, item.project, item.client, demandStatus(item), item.deadline, item.updatedAt]); const csv = [headers, ...rows].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n'); const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `MMOS-${title}.csv`; anchor.click(); URL.revokeObjectURL(url); message.success(`已导出 ${rows.length} 条${title}`); };
  return <><div className="requirements-toolbar"><div><p className="eyebrow">项目 · 需求接入</p><h1>{title}</h1><p className="subtitle">{subtitle}</p></div><Button type="primary" icon={<Download size={15} />} onClick={exportRows}>批量导出{selected.length ? ` (${selected.length})` : ''}</Button></div><Card className="requirements-card" bordered={false}><div className="list-summary"><span><strong>{data.length}</strong> 条记录</span><Input prefix={<Search size={14} />} placeholder="搜索项目名称" style={{ width: 230 }} /></div><Table rowKey="key" rowSelection={{ selectedRowKeys: selected, onChange: setSelected }} columns={columns} dataSource={data} pagination={{ pageSize: 8, showSizeChanger: false }} locale={{ emptyText: <Empty description={emptyText} /> }} scroll={{ x: 1100 }} onRow={record => ({ onClick: () => onOpen(record) })} /></Card></>;
}

export function RequirementsPage() {
  const [records, setRecords] = React.useState([...initialAvailable, ...initialHistory]);
  const [activeTab, setActiveTab] = React.useState('available');
  const [newOpen, setNewOpen] = React.useState(false);
  const [detail, setDetail] = React.useState(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const recognize = text => { if (!text.trim()) { message.warning('请先填写原始需求文字'); return; } const record = recognizeRequirement(text); setNewOpen(false); setDetail(record); setConfirmOpen(true); message.success('原始需求已识别，请由 PMO 确认并补充字段'); };
  const saveDraft = record => { setDetail(record); message.success('需求补充内容已保存'); };
  const updateRecord = next => setRecords(current => current.some(item => item.key === next.key) ? current.map(item => item.key === next.key ? next : item) : [next, ...current]);
  const publish = record => { const missing = REQUIRED_FIELDS.filter(field => !record.fieldValues?.[field]); if (missing.length) { message.error(`请先补充必填字段：${missing.join('、')}`); return; } const next = { ...record, status: '可承接', deadline: record.fieldValues?.['抢单截至时间'] || '', createdAt: record.createdAt || '2026-09-20 10:24' }; updateRecord(next); setDetail(null); setConfirmOpen(false); setActiveTab('available'); message.success('需求已确认并发布到可承接需求列表'); };
  const saveExisting = record => { const next = { ...record, deadline: record.fieldValues?.['抢单截至时间'] || record.deadline || '', updatedAt: '2026-09-28 12:00' }; updateRecord(next); setDetail(next); message.success('需求字段已保存'); };
  const archive = record => { const next = { ...record, status: '已过期', expireReason: 'PMO手动下架', updatedAt: '2026-09-28 12:00' }; updateRecord(next); setDetail(null); setActiveTab('expired'); message.success('需求已下架，进入已过期需求记录'); };
  const openDetail = record => { setDetail(record); setConfirmOpen(false); };
  const available = records.filter(item => demandStatus(item) === '可承接');
  const accepted = records.filter(item => demandStatus(item) === '已承接');
  const expired = records.filter(item => demandStatus(item) === '已过期');
  const tabItems = [
    { key: 'available', label: <span><ClipboardCheck size={15} /> 可承接需求 <em>{available.length}</em></span>, children: <AvailableList data={available} onOpen={openDetail} onNew={() => setNewOpen(true)} /> },
    { key: 'accepted', label: <span><History size={15} /> 已承接需求记录 <em>{accepted.length}</em></span>, children: <HistoryList data={accepted} onOpen={openDetail} title="已承接需求记录" subtitle="已经由项目经理承接的需求。" emptyText="暂无已承接需求记录" /> },
    { key: 'expired', label: <span><History size={15} /> 已过期需求记录 <em>{expired.length}</em></span>, children: <HistoryList data={expired} onOpen={openDetail} title="已过期需求记录" subtitle="超过抢单截至时间，或由 PMO 手动下架的需求。" emptyText="暂无已过期需求记录" /> },
  ];
  if (detail) return <div className="requirements-page"><DetailView record={detail} onClose={() => { setDetail(null); setConfirmOpen(false); }} editable={confirmOpen} canEdit={!confirmOpen} canArchive={demandStatus(detail) === '可承接' && !(detail.fieldValues?.['抢单截至时间'] || detail.deadline)} onArchive={archive} onSave={confirmOpen ? saveDraft : saveExisting} onConfirm={publish} canInitiate={!confirmOpen && demandStatus(detail) === '可承接'} /></div>;
  return <div className="requirements-page"><Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} className="requirements-tabs" /><NewRequirementModal open={newOpen} onClose={() => setNewOpen(false)} onRecognize={recognize} /></div>;
}
