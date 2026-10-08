import React from 'react';
import { Button, Card, DatePicker, Empty, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, Tag, Upload, message } from 'antd';
import { CheckCircle2, FileText, Plus, Search, ShieldCheck, Undo2 } from 'lucide-react';
import dayjs from 'dayjs';
import { createInvoice } from './InvoiceLedgerPage';

export const ACCEPTANCE_KEY = 'mmos.acceptance.records.v1';
const PM_NAME = '王然';
const PMO_NAME = '林晓彤';
const detailFields = ['项目编号', '项目名称', '计价方式', '项目状态', '负责人', 'PA', '验收总金额', '实际验收金额', '验收开票总金额', '已汇款总金额', '公司人员当前总产量', '公司外部人员产量', '当前公司出勤人员成本', '公司外部人员成本', '超量绩效成本', '其他费用', '包时项目内部员工有效时长', '包时项目外部员工有效时长', '产值', '成本', '利润', '利润率', '项目周期', '带教PM', '项目标记', '外部试标成本', '预计处理时间', '产值与验收差距', '总产量', '单价'];

const projects = [
  { projectId: 'PRJ-008', projectNo: 'ZJ20260828008', projectName: '商品标题生成', customer: '阿里', pm: '王然', status: '项目进行中', start: '2026-08-28', end: '2026-09-27', fields: { 计价方式: '计件', 负责人: '王然', PA: '周宁', 单价: '0.48 元/条', 项目周期: '2026-08-28 至 2026-10-31', 带教PM: '林晓彤', 项目标记: '常规', 总产量: '99,000 条' } },
  { projectId: 'PRJ-014', projectNo: 'ZJ20260730014', projectName: '商品图分类', customer: '拼多多', pm: '王然', status: '项目暂停', start: '2026-07-30', end: '2026-09-15', fields: { 计价方式: '计件', 负责人: '王然', PA: '周宁', 单价: '0.36 元/张', 项目周期: '2026-07-30 至 2026-09-30', 项目标记: '暂停', 总产量: '50,500 张' } },
  { projectId: 'PRJ-021', projectNo: 'ZJ20260812021', projectName: '客服对话质检', customer: '京东', pm: '林晓彤', status: '项目进行中', start: '2026-08-12', end: '2026-09-20', fields: { 计价方式: '包时', 负责人: '林晓彤', PA: '陈可', 单价: '86 元/小时', 项目周期: '2026-08-12 至 2026-10-15', 项目标记: '风险' } },
  { projectId: 'flow-005', projectNo: 'ZJ20260828008', projectName: '商品标题生成', customer: '阿里', pm: '王然', status: '项目进行中', start: '2026-08-28', end: '2026-09-27', fields: { 计价方式: '计件', 负责人: '王然', PA: '周宁', 单价: '0.48 元/条', 总产量: '99,000 条' } },
  { projectId: 'flow-006', projectNo: 'ZJ20260812021', projectName: '客服对话质检', customer: '京东', pm: '林晓彤', status: '项目进行中', start: '2026-08-12', end: '2026-09-20', fields: { 计价方式: '包时', 负责人: '林晓彤', PA: '陈可', 单价: '86 元/小时' } },
  { projectId: 'flow-007', projectNo: 'ZJ20260730014', projectName: '商品图分类', customer: '拼多多', pm: '王然', status: '项目暂停', start: '2026-07-30', end: '2026-09-15', fields: { 计价方式: '计件', 负责人: '王然', PA: '周宁', 单价: '0.36 元/张', 总产量: '50,500 张' } },
];

const seedRecords = [
  { key: 'acc-001', acceptanceNo: '260900001201', projectId: 'PRJ-009', projectNo: 'ZJ20260718009', projectName: '多语种文本清洗', customer: '字节', pm: '林晓彤', initiator: '林晓彤', type: '阶段验收', start: '2026-07-18', end: '2026-09-17', volume: '128000', amount: 128000, evidenceName: '阶段验收依据.png', sheetName: '', sheetLink: '', note: '', applyStatus: '待审核', projectStatus: '项目验收中', invoiceStatus: '未开票', paymentStatus: '未到账', rejectReason: '', approvedAt: '', fields: { 计价方式: '包月', 负责人: '林晓彤', PA: '陈可', 单价: '12,800 元/人月', 项目周期: '2026-07-18 至 2026-09-17' }, activity: ['2026-09-23 11:40 · 林晓彤提交阶段验收，等待 PMO 审核'] },
  { key: 'acc-002', acceptanceNo: '260900001188', projectId: 'PRJ-004', projectNo: 'ZJ20260626004', projectName: '广告文案改写', customer: '腾讯', pm: '王然', initiator: '王然', type: '阶段验收', start: '2026-08-01', end: '2026-08-31', volume: '86000', amount: 0, evidenceName: '零金额验收说明.png', sheetName: '', sheetLink: '', note: '本批结算金额为 0，仍进入开票。', applyStatus: '已驳回', projectStatus: '项目验收中', invoiceStatus: '未开票', paymentStatus: '未到账', rejectReason: '验收依据截图缺少客户确认页。', approvedAt: '', fields: { 计价方式: '计件', 负责人: '王然', PA: '周宁', 单价: '0.68 元/条' }, activity: ['2026-09-24 09:18 · PMO 驳回：验收依据截图缺少客户确认页', '2026-09-23 17:05 · 王然提交阶段验收'] },
  { key: 'acc-003', acceptanceNo: '260900001104', projectId: 'PRJ-002', projectNo: 'ZJ20260608002', projectName: '搜索相关性标注', customer: '字节', pm: '王然', initiator: '王然', type: '最终验收', start: '2026-06-08', end: '2026-09-08', volume: '256000', amount: 248600, evidenceName: '最终验收依据.png', sheetName: '验收单.pdf', sheetLink: 'https://feishu.cn/file/acceptance-002', note: '', applyStatus: '已通过', projectStatus: '项目结束', invoiceStatus: '已开票', paymentStatus: '部分到账', rejectReason: '', approvedAt: '2026-09-12 15:10', fields: { 计价方式: '包月', 负责人: '王然', PA: '陈可', 单价: '12,800 元/人月', 验收总金额: '256,000 元', 实际验收金额: '248,600 元' }, snapshot: { 项目名称: '搜索相关性标注', 开票对接方: '字节', 项目编号: 'ZJ20260608002', 验收编号: '260900001104', 项目经理: '王然', 金额: '248,600 元', 验收类型: '最终验收', 验收周期: '2026-06-08 至 2026-09-08', 审核通过时间: '2026-09-12 15:10', 验收依据截图: '最终验收依据.png' }, activity: ['2026-09-12 15:10 · PMO 审核通过，项目结束，已生成开票快照'] },
];

const applyColor = { '待审核': 'processing', '待处理': 'warning', '已驳回': 'error', '已撤回': 'default', '已通过': 'success' };
function nowStamp() { return dayjs().format('YYYY-MM-DD HH:mm'); }
function loadRecords() { try { const value = localStorage.getItem(ACCEPTANCE_KEY); return value ? JSON.parse(value) : seedRecords; } catch { return seedRecords; } }
function persistRecords(next) { localStorage.setItem(ACCEPTANCE_KEY, JSON.stringify(next)); window.dispatchEvent(new CustomEvent('mmos:acceptance-updated', { detail: next })); }
function nextAcceptanceNo(records) { const max = records.reduce((result, item) => Math.max(result, Number(String(item.acceptanceNo || '').slice(-6)) || 0), 1427); return `2609${String(max + 1).padStart(8, '0')}`; }
function viewOf(record) { if (record.applyStatus === '待审核' || record.applyStatus === '待处理') return '待审核'; if (record.applyStatus === '已驳回' || record.applyStatus === '已撤回') return '待修改'; return '已通过'; }
export function isAcceptanceTodo(record, role) { if (role === 'PMO') return record.applyStatus === '待审核' || record.applyStatus === '待处理'; return record.pm === PM_NAME && ['已驳回', '已撤回'].includes(record.applyStatus); }
function canEdit(record, role) { return ['已驳回', '已撤回'].includes(record.applyStatus) && (role === 'PMO' || record.pm === PM_NAME); }
function hasOpen() { return false; }

function readFile(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }

function AcceptanceForm({ record, draft, role, onSubmit }) {
  const [form] = Form.useForm();
  const evidence = Form.useWatch('evidence', form);
  const editable = !record || canEdit(record, role);
  React.useEffect(() => {
    const source = record || draft;
    if (!source) return;
    form.setFieldsValue({ type: source.type, period: source.start && source.end ? [dayjs(source.start), dayjs(source.end)] : undefined, volume: source.volume, amount: source.amount, sheetLink: source.sheetLink, note: source.note, evidence: source.evidence || '' });
  }, [record, draft, form]);
  if (record && !editable) return null;
  return <Form form={form} layout="vertical" onFinish={values => onSubmit(values)}>
    <div className="quote-form-grid">
      <Form.Item name="type" label="验收类型" rules={[{ required: true, message: '请选择验收类型' }]}><Select placeholder="阶段验收或最终验收" options={['阶段验收', '最终验收'].map(value => ({ value, label: value }))} /></Form.Item>
      <Form.Item name="period" label="本批数据起止时间" rules={[{ required: true, message: '请选择起止时间' }]}><DatePicker.RangePicker style={{ width: '100%' }} /></Form.Item>
    </div>
    <div className="quote-form-grid">
      <Form.Item name="volume" label="验收数据量" rules={[{ required: true, message: '请填写验收数据量' }]}><Input placeholder="必填" /></Form.Item>
      <Form.Item name="amount" label="验收金额" rules={[{ required: true, message: '请填写验收金额，可以为 0' }]}><InputNumber min={0} style={{ width: '100%' }} placeholder="可以为 0" /></Form.Item>
    </div>
    <Form.Item name="evidence" hidden rules={[{ required: true, message: '请上传验收依据截图' }]}><Input /></Form.Item>
    <Form.Item label="验收依据截图" required extra={evidence ? '已选择截图' : '支持 PNG、JPG、WEBP，不超过 2MB'}>
      <Upload accept="image/png,image/jpeg,image/webp" maxCount={1} showUploadList={false} beforeUpload={async file => { if (file.size > 2 * 1024 * 1024) { message.error('截图不能超过 2MB'); return Upload.LIST_IGNORE; } form.setFieldValue('evidence', await readFile(file)); form.setFieldValue('evidenceName', file.name); return Upload.LIST_IGNORE; }}><Button>{evidence ? '重新上传截图' : '上传截图'}</Button></Upload>
      {evidence && <img className="quote-voucher-preview" src={evidence} alt="验收依据截图预览" />}
    </Form.Item>
    <Form.Item name="evidenceName" hidden><Input /></Form.Item>
    <div className="quote-form-grid">
      <Form.Item name="sheetName" label="验收单文件"><Input placeholder="选填，填写文件名" /></Form.Item>
      <Form.Item name="sheetLink" label="验收单链接"><Input placeholder="选填" /></Form.Item>
    </div>
    <Form.Item name="note" label="备注"><Input.TextArea rows={2} placeholder="选填" /></Form.Item>
    <Button type="primary" htmlType="submit">{record ? '重新提交' : '提交验收'}</Button>
  </Form>;
}

function Detail({ record, draft, onClose, role, onSubmit, onApprove, onRetry, onReject, onWithdraw, onChangePeriod }) {
  const current = record;
  const project = draft || current;
  if (!project) return null;
  const fields = { ...project.fields, 项目编号: project.projectNo, 项目名称: project.projectName, 项目状态: current?.projectStatus || project.status };
  return <div className="detail-screen"><div className="detail-screen-bar"><div className="detail-screen-main"><button className="detail-back" onClick={onClose}>返回列表</button><div className="detail-screen-kicker">验收管理 · {project.projectNo}</div><h1>{project.projectName}</h1></div>{current && <Tag color={applyColor[current.applyStatus]}>{current.applyStatus}</Tag>}</div>
    <div className="trial-detail-meta"><span>客户：{project.customer}</span><span>PM：{project.pm}</span>{current?.acceptanceNo && <span>验收编号：{current.acceptanceNo}</span>}</div>
    {current?.rejectReason && <div className="quote-reject-box"><strong>驳回原因</strong><p>{current.rejectReason}</p></div>}
    <section className="trial-detail-section"><div className="trial-detail-heading"><div><p className="panel-kicker">系统带入</p><h3>项目已有字段</h3></div></div><ol className="flow-detail-fields">{detailFields.map((label, index) => <li key={label}><em>{index + 1}</em><span><small>{label}</small><strong>{fields[label] || '—'}</strong></span></li>)}</ol></section>
    <section className="trial-detail-section"><div className="trial-detail-heading"><div><p className="panel-kicker">验收申请</p><h3>{current && !canEdit(current, role) ? '已锁定' : '填写后提交'}</h3></div></div>
      {current && !canEdit(current, role) ? <div className="quote-readonly"><span>验收类型 <b>{current.type}</b></span><span>验收周期 <b>{current.start} 至 {current.end}</b></span><span>数据量 <b>{current.volume}</b></span><span>金额 <b>{current.amount} 元</b></span><span>依据截图 <b>{current.evidenceName || '已上传'}</b></span>{current.evidence && <img className="quote-voucher-preview" src={current.evidence} alt="验收依据截图" />}{current.sheetLink && <span>验收单链接 <a href={current.sheetLink} target="_blank" rel="noreferrer">{current.sheetLink}</a></span>}{current.note && <p>备注：{current.note}</p>}</div> : <AcceptanceForm record={current} draft={draft} role={role} onSubmit={onSubmit} />}
    </section>
    {role === 'PMO' && current?.applyStatus === '待审核' && <PeriodEditor record={current} onSave={onChangePeriod} />}
    {current?.snapshot && <section className="trial-detail-section"><div className="trial-detail-heading"><div><p className="panel-kicker">财务快照</p><h3>审核通过时生成，之后不回写</h3></div></div><div className="quote-field-grid">{Object.entries(current.snapshot).map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div></section>}
    {current && <section className="trial-detail-section"><div className="trial-detail-heading"><div><p className="panel-kicker">操作留痕</p><h3>验收动态</h3></div></div><div className="init-activity">{current.activity.map(item => <div key={item}><span /><p>{item}</p></div>)}</div></section>}
    {current && <div className="quote-drawer-actions">
      {role === 'PMO' && current.applyStatus === '待审核' && <Button danger icon={<Undo2 size={14} />} onClick={() => onReject(current)}>驳回</Button>}
      {role === 'PMO' && current.applyStatus === '待审核' && <Button type="primary" icon={<CheckCircle2 size={14} />} onClick={() => onApprove(current, false)}>审核通过</Button>}
      {role === 'PMO' && current.applyStatus === '待审核' && <Button onClick={() => onApprove(current, true)}>模拟写入失败</Button>}
      {role === 'PMO' && current.applyStatus === '待处理' && <Button type="primary" onClick={() => onRetry(current)}>重试写入</Button>}
      {current.applyStatus === '待审核' && (role === 'PMO' || current.initiator === (role === 'PM' ? PM_NAME : PMO_NAME)) && <Button onClick={() => onWithdraw(current)}>撤回</Button>}
    </div>}
  </div>;
}

function PeriodEditor({ record, onSave }) {
  const [period, setPeriod] = React.useState([dayjs(record.start), dayjs(record.end)]);
  return <div className="quote-wait-box">PMO 审核时可以修改验收周期。金额、数据量和截图需要驳回后由申请人修改。<DatePicker.RangePicker value={period} onChange={setPeriod} style={{ margin: '8px 8px 0 0' }} /><Button size="small" onClick={() => period?.[0] && period?.[1] && onSave(record, period)}>保存周期</Button></div>;
}

function RejectModal({ open, onCancel, onSubmit }) {
  const [form] = Form.useForm();
  return <Modal title="驳回验收申请" open={open} okText="驳回" okButtonProps={{ danger: true }} onCancel={onCancel} onOk={() => form.validateFields().then(values => { onSubmit(values.reason); form.resetFields(); })}>
    <Form form={form} layout="vertical"><Form.Item name="reason" label="驳回原因" rules={[{ required: true, message: '请填写驳回原因' }]}><Input.TextArea rows={3} /></Form.Item></Form>
  </Modal>;
}

function CreateModal({ records, open, preset, onCancel, onCreate }) {
  const [projectId, setProjectId] = React.useState(preset?.projectId);
  React.useEffect(() => { if (open) setProjectId(preset?.projectId); }, [open, preset]);
  const options = projects.filter(item => !hasOpen(records, item.projectId));
  return <Modal title="选择验收项目" open={open} okText="填写验收" onCancel={onCancel} onOk={() => { const project = options.find(item => item.projectId === projectId); if (!project) { message.warning('请选择没有未完成验收的项目'); return; } onCreate(project); }}>
    <p className="modal-help-copy">只能从项目进行中或项目暂停发起。同一项目可以同时存在多条验收申请，每条使用新的验收编号。</p>
    <Select aria-label="验收项目" style={{ width: '100%' }} value={projectId} onChange={setProjectId} placeholder="选择项目" options={options.map(item => ({ value: item.projectId, label: `${item.projectNo} · ${item.projectName} · ${item.status}` }))} />
  </Modal>;
}

export function AcceptancePage({ role = 'PMO', onRoleChange, presetProject, onPresetHandled }) {
  const [records, setRecords] = React.useState(loadRecords);
  const [tab, setTab] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const [selectedKey, setSelectedKey] = React.useState('');
  const [draft, setDraft] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  const [preset, setPreset] = React.useState(null);
  const [rejectKey, setRejectKey] = React.useState('');
  React.useEffect(() => { const sync = event => event.detail && setRecords(event.detail); window.addEventListener('mmos:acceptance-updated', sync); return () => window.removeEventListener('mmos:acceptance-updated', sync); }, []);
  React.useEffect(() => { if (!presetProject) return; setPreset(presetProject); setCreating(true); onPresetHandled?.(); }, [presetProject, onPresetHandled]);
  const mine = records.filter(item => role === 'PMO' || item.pm === PM_NAME);
  const visible = mine.filter(item => tab === 'all' || viewOf(item) === tab).filter(item => !query.trim() || [item.acceptanceNo, item.projectNo, item.projectName, item.customer, item.pm].some(value => String(value || '').includes(query.trim())));
  const selected = records.find(item => item.key === selectedKey);
  const save = (next, notice) => { persistRecords(next); setRecords(next); if (notice) message.success(notice); };
  const update = (record, patch, notice) => save(records.map(item => item.key === record.key ? { ...item, ...patch } : item), notice);
  const submit = (source, values, existing) => {
    const start = values.period[0].format('YYYY-MM-DD');
    const end = values.period[1].format('YYYY-MM-DD');
    const actor = role === 'PMO' ? PMO_NAME : PM_NAME;
    const shared = { ...values, start, end, evidenceName: values.evidenceName || existing?.evidenceName || '验收依据截图', applyStatus: '待审核', projectStatus: '项目验收中', rejectReason: '', activity: [`${nowStamp()} · ${actor}${existing ? '重新提交' : '提交'}${values.type}，等待 PMO 审核`, ...(existing?.activity || [])] };
    if (existing) { update(existing, shared, '已重新提交，沿用原验收编号'); setSelectedKey(''); return; }
    const created = { key: `acc-${Date.now()}`, acceptanceNo: nextAcceptanceNo(records), projectId: source.projectId, projectNo: source.projectNo, projectName: source.projectName, customer: source.customer, pm: source.pm, initiator: actor, projectStatus: '项目验收中', invoiceStatus: '未开票', paymentStatus: '未到账', approvedAt: '', fields: source.fields, ...shared };
    save([created, ...records], '验收已提交，项目进入项目验收中');
    setDraft(null);
  };
  const finishApproval = (record, stamp) => {
    const finalAcceptance = record.type === '最终验收';
    const approved = { ...record, approvedAt: stamp, projectStatus: finalAcceptance ? '项目结束' : '项目进行中' };
    createInvoice(approved);
    update(record, { applyStatus: '已通过', projectStatus: approved.projectStatus, invoiceStatus: '待开票', approvedAt: stamp, writeError: '', activity: [`${stamp} · 财务开票记录写入成功`, `${stamp} · PMO 审核通过，${finalAcceptance ? '项目结束' : '项目回到进行中'}，开票状态变为待开票`, ...(record.activity || [])] }, finalAcceptance ? '写入成功，项目已结束' : '写入成功，项目回到进行中');
  };
  const approve = (record, fail) => {
    const stamp = nowStamp();
    if (fail) { update(record, { applyStatus: '待处理', approvedAt: stamp, writeError: '财务数据写入失败', activity: [`${stamp} · 财务数据写入失败，验收申请保持待处理`, ...(record.activity || [])] }, '写入失败，请重试'); return; }
    finishApproval(record, stamp);
  };
  const retry = record => finishApproval(record, record.approvedAt || nowStamp());
  const reject = reason => { const record = records.find(item => item.key === rejectKey); update(record, { applyStatus: '已驳回', rejectReason: reason, activity: [`${nowStamp()} · PMO 驳回：${reason}`, ...(record.activity || [])] }, '已驳回，未生成开票记录'); setRejectKey(''); };
  const withdraw = record => update(record, { applyStatus: '已撤回', activity: [`${nowStamp()} · ${role === 'PMO' ? PMO_NAME : record.initiator}撤回验收申请`, ...(record.activity || [])] }, '已撤回，项目仍处于项目验收中');
  const changePeriod = (record, period) => update(record, { start: period[0].format('YYYY-MM-DD'), end: period[1].format('YYYY-MM-DD'), activity: [`${nowStamp()} · PMO 修改验收周期`, ...(record.activity || [])] }, '验收周期已更新');
  const countOf = name => mine.filter(item => !name || viewOf(item) === name).length;
  const columns = [
    { title: '验收编号', dataIndex: 'acceptanceNo', width: 140, render: value => <span className="trial-project-no">{value}</span> },
    { title: '项目名称', dataIndex: 'projectName', width: 190, render: (value, record) => <button className="trial-name-link" onClick={() => setSelectedKey(record.key)}><span className="trial-name-icon"><FileText size={14} /></span><span><strong>{value}</strong><small>{record.projectNo} · {record.customer}</small></span></button> },
    { title: 'PM', dataIndex: 'pm', width: 80 },
    { title: '验收类型', dataIndex: 'type', width: 100 },
    { title: '验收金额', dataIndex: 'amount', width: 100, render: value => `${value} 元` },
    { title: '验收周期', key: 'period', width: 180, render: (_, record) => `${record.start} 至 ${record.end}` },
    { title: '申请状态', dataIndex: 'applyStatus', width: 100, render: value => <Tag color={applyColor[value]}>{value}</Tag> },
    { title: '项目状态', dataIndex: 'projectStatus', width: 120 },
    { title: '开票状态', dataIndex: 'invoiceStatus', width: 100 },
    { title: '操作', key: 'action', width: 180, render: (_, record) => <Space size={0} wrap>
      <Button type="link" size="small" onClick={() => setSelectedKey(record.key)}>查看</Button>
      {role === 'PMO' && record.applyStatus === '待审核' && <Button type="link" size="small" onClick={() => approve(record, false)}>通过</Button>}
      {role === 'PMO' && record.applyStatus === '待审核' && <Button danger type="link" size="small" onClick={() => setRejectKey(record.key)}>驳回</Button>}
      {role === 'PMO' && record.applyStatus === '待处理' && <Button type="link" size="small" onClick={() => retry(record)}>重试</Button>}
      {canEdit(record, role) && <Button type="link" size="small" onClick={() => setSelectedKey(record.key)}>修改</Button>}
    </Space> },
  ];
  if (selected || draft) return <div className="trial-page acceptance-page"><Detail record={selected} draft={draft} onClose={() => { setSelectedKey(''); setDraft(null); }} role={role} onSubmit={values => submit(draft || selected, values, selected)} onApprove={approve} onRetry={retry} onReject={record => setRejectKey(record.key)} onWithdraw={withdraw} onChangePeriod={changePeriod} /><RejectModal open={Boolean(rejectKey)} onCancel={() => setRejectKey('')} onSubmit={reject} /></div>;
  return <div className="trial-page acceptance-page">
    <div className="trial-page-heading"><div><p className="eyebrow">项目管理 · 验收管理</p><h1>验收管理</h1><p className="subtitle">从项目进行中或项目暂停发起阶段验收、最终验收。PMO 审核通过后才生成开票快照。</p></div><Space><div className="trial-role-switch"><ShieldCheck size={14} /><span>演示身份</span><Select aria-label="演示身份" size="small" value={role} onChange={onRoleChange} options={[{ value: 'PMO', label: 'PMO · 林晓彤' }, { value: 'PM', label: 'PM · 王然' }, { value: '财务', label: '财务 · 赵敏' }]} /></div><Button type="primary" icon={<Plus size={14} />} onClick={() => { setPreset(null); setCreating(true); }}>发起验收</Button></Space></div>
    <div className="trial-stat-grid quote-stat-grid">{['待审核', '待修改', '已通过'].map(item => <Card key={item} variant="borderless"><div><small>{item}</small><strong>{countOf(item)}</strong></div></Card>)}</div>
    <Card variant="borderless" className="trial-work-card">
      <div className="trial-list-toolbar"><Input prefix={<Search size={15} />} allowClear value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索验收编号、项目编号、项目名称、客户、PM" aria-label="搜索验收申请" /><span className="trial-permission-chip"><ShieldCheck size={13} /> {role === 'PMO' ? '全部验收申请' : '我承接项目的验收申请'}</span></div>
      <Tabs activeKey={tab} onChange={setTab} className="trial-tabs" items={[['all', '全部'], ['待审核', '待审核'], ['待修改', '待修改'], ['已通过', '已通过']].map(([key, label]) => ({ key, label: <span>{label} <em>{countOf(key === 'all' ? '' : key)}</em></span> }))} />
      <Table rowKey="key" columns={columns} dataSource={visible} pagination={{ pageSize: 8, showSizeChanger: false }} scroll={{ x: 1360 }} locale={{ emptyText: <Empty description="暂无符合条件的验收申请" /> }} onRow={record => ({ onClick: event => { if (event.target.closest('button, a, .ant-btn')) return; setSelectedKey(record.key); } })} />
    </Card>
    <CreateModal records={records} open={creating} preset={preset} onCancel={() => setCreating(false)} onCreate={project => { setCreating(false); setDraft({ ...project, type: preset?.acceptanceType }); }} />
  </div>;
}
