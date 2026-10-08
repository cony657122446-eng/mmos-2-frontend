import React from 'react';
import { Button, Card, DatePicker, Empty, Form, Input, InputNumber, Modal, Radio, Select, Space, Table, Tabs, Tag, Upload, message } from 'antd';
import { CheckCircle2, FileText, Play, Plus, Search, ShieldCheck, Stamp, Undo2 } from 'lucide-react';
import dayjs from 'dayjs';

export const QUOTE_STORAGE_KEY = 'mmos.quotation.records.v3';
const PM_NAME = '王然';

const seedQuotes = [
  { key: 'quote-008', quoteId: 'BJ-20260922-008', projectId: 'PRJ-KS-022', projectNo: 'ZJ20260922022', demandId: 'REQ-20260922-022', trialId: 'trial-008', initiationId: 'INI-20260922-022', projectName: '直播切片质检', customer: '快手', pm: '王然', status: '待报价', count: 0, pricing: '', unitPrice: null, plan: '', output: '', profitSheet: '', review: '', rejectReason: '', confirmResult: '', confirmTime: '', voucher: '', updatedAt: '2026-09-22 09:30', activity: ['2026-09-22 09:30 · 王然手动创建报价，等待填写并提交'] },
  {
    key: 'quote-001', quoteId: 'BJ-20260921-001', projectId: 'PRJ-ZJ-006', projectNo: 'ZJ20260912006',
    demandId: 'REQ-20260912-006', trialId: 'trial-001', initiationId: 'INI-20260918-006',
    projectName: '语音质检专项', customer: '字节', pm: '林晓彤', status: '待报价', count: 0,
    pricing: '', unitPrice: null, plan: '', output: '', profitSheet: '',
    review: '', rejectReason: '', confirmResult: '', confirmTime: '', voucher: '',
    updatedAt: '2026-09-21 16:20',
    activity: ['2026-09-21 16:20 · 试标成功，系统将项目状态设为待报价'],
  },
  {
    key: 'quote-002', quoteId: 'BJ-20260921-002', projectId: 'PRJ-ZJ-017', projectNo: 'ZJ20260916017',
    demandId: 'REQ-20260916-017', trialId: 'trial-002', initiationId: 'INI-20260916-017',
    projectName: '中文答案可用性评测', customer: '字节', pm: '王然', status: '报价中', count: 1,
    pricing: '计件', unitPrice: 0.35, plan: '', output: '预计月产值 18 万', profitSheet: 'https://feishu.cn/file/profit-002',
    review: '', rejectReason: '', confirmResult: '', confirmTime: '', voucher: '',
    updatedAt: '2026-09-21 11:05',
    activity: ['2026-09-21 11:05 · 王然提交第 1 次报价，进入 PMO 审核'],
  },
  {
    key: 'quote-003', quoteId: 'BJ-20260920-003', projectId: 'PRJ-TX-012', projectNo: 'ZJ20260909012',
    demandId: 'REQ-20260909-012', trialId: 'trial-003', initiationId: 'INI-20260909-012',
    projectName: '海外客服意图识别', customer: '腾讯', pm: '王然', status: '报价中', count: 1,
    pricing: '包时', unitPrice: 86, plan: '首月完成意图库与抽检规范，次月进入稳定交付。', output: '理论产值 42 万', profitSheet: '',
    review: '', rejectReason: '', confirmResult: '', confirmTime: '', voucher: '',
    updatedAt: '2026-09-20 18:40',
    activity: ['2026-09-20 18:40 · 王然提交第 1 次报价，进入 PMO 审核'],
  },
  {
    key: 'quote-004', quoteId: 'BJ-20260918-004', projectId: 'PRJ-JD-004', projectNo: 'ZJ20260907004',
    demandId: 'REQ-20260907-004', trialId: 'trial-004', initiationId: 'INI-20260907-004',
    projectName: '电商图像质检', customer: '京东', pm: '王然', status: '待报价', count: 1,
    pricing: '计件', unitPrice: 0.12, plan: '', output: '', profitSheet: '',
    review: '不通过', rejectReason: '单价缺少客户口径说明', confirmResult: '', confirmTime: '', voucher: '',
    updatedAt: '2026-09-21 09:16',
    activity: ['2026-09-21 09:16 · PMO 审核不通过，项目退回待报价', '2026-09-20 14:02 · 林晓彤提交第 1 次报价'],
  },
  {
    key: 'quote-005', quoteId: 'BJ-20260915-005', projectId: 'PRJ-ZJ-003', projectNo: 'ZJ20260903003',
    demandId: 'REQ-20260903-003', trialId: 'trial-005', initiationId: 'INI-20260903-003',
    projectName: '搜索相关性标注', customer: '字节', pm: '王然', status: '报价中', count: 2,
    pricing: '包月', unitPrice: 12800, plan: '', output: '理论产值 36 万', profitSheet: 'https://feishu.cn/file/profit-005',
    review: '通过', rejectReason: '', confirmResult: '', confirmTime: '', voucher: '',
    updatedAt: '2026-09-19 17:22',
    activity: ['2026-09-19 17:22 · PMO 审核通过，等待登记字节客户确认或签单', '2026-09-19 10:08 · 王然提交第 2 次报价'],
  },
  {
    key: 'quote-006', quoteId: 'BJ-20260912-006', projectId: 'PRJ-AL-008', projectNo: 'ZJ20260828008',
    demandId: 'REQ-20260828-008', trialId: 'trial-006', initiationId: 'INI-20260828-008',
    projectName: '商品标题生成', customer: '阿里', pm: '王然', status: '项目进行中', count: 1,
    pricing: '计件', unitPrice: 0.48, plan: '', output: '理论产值 22 万', profitSheet: '',
    review: '通过', rejectReason: '', confirmResult: '', confirmTime: '', voucher: '',
    updatedAt: '2026-09-16 15:30',
    activity: ['2026-09-16 15:30 · 已立项后无项目计划，系统自动进入项目进行中', '2026-09-16 15:30 · PMO 审核通过，非字节项目进入已立项'],
  },
  {
    key: 'quote-007', quoteId: 'BJ-20260911-007', projectId: 'PRJ-BD-011', projectNo: 'ZJ20260821011',
    demandId: 'REQ-20260821-011', trialId: 'trial-007', initiationId: 'INI-20260821-011',
    projectName: '地图兴趣点审核', customer: '百度', pm: '王然', status: '已立项', count: 1,
    pricing: '包时', unitPrice: 72, plan: '先完成两周样本校准，再按城市分批上人。', output: '理论产值 30 万', profitSheet: '',
    review: '通过', rejectReason: '', confirmResult: '', confirmTime: '', voucher: '',
    updatedAt: '2026-09-18 13:12',
    activity: ['2026-09-18 13:12 · 已有项目计划，进入已立项，等待开始执行', '2026-09-18 13:12 · PMO 审核通过，非字节项目进入已立项'],
  },
];

const statusColor = { '待报价': 'warning', '报价中': 'processing', '已立项': 'cyan', '项目进行中': 'success' };

export function quoteStage(record) {
  if (record.status === '待报价') return '待报价';
  if (record.status === '报价中' && record.review !== '通过') return '待审核';
  if (record.status === '报价中' && record.customer === '字节' && record.review === '通过' && !record.voucher) return '待签单';
  return '报价结果';
}

export function quoteHandling(record) {
  const stage = quoteStage(record);
  if (stage === '待报价') return '待填写';
  if (stage === '待审核') return '待审核';
  if (stage === '待签单') return '待签单';
  if (record.status === '已立项') return '待开始执行';
  return '已进入项目进行中';
}

export function isQuoteTodo(record, role) {
  const stage = quoteStage(record);
  if (role === 'PMO') return stage === '待审核' || stage === '待签单';
  return record.pm === PM_NAME && (stage === '待报价' || (record.status === '已立项' && Boolean(record.plan)));
}

function loadQuotes() {
  try {
    const value = localStorage.getItem(QUOTE_STORAGE_KEY);
    return value ? JSON.parse(value) : seedQuotes;
  } catch {
    return seedQuotes;
  }
}

function persistQuotes(next) {
  localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('mmos:quotation-updated', { detail: next }));
}

function nowStamp() { return dayjs().format('YYYY-MM-DD HH:mm'); }
function hasPlan(record) { return Boolean(String(record.plan || '').trim()); }
function QuoteStatus({ status }) { return <Tag color={statusColor[status] || 'default'}>{status}</Tag>; }

function FieldGrid({ record }) {
  const rows = [
    ['项目报价标识', record.quoteId], ['项目标识', record.projectId], ['项目编号', record.projectNo],
    ['项目需求标识', record.demandId], ['项目试标标识', record.trialId], ['立项申请标识', record.initiationId],
    ['客户', record.customer], ['项目状态', record.status], ['报价次数', record.count],
  ];
  return <div className="quote-field-grid">{rows.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value || '—'}</strong></div>)}</div>;
}

function QuoteDetail({ record, onClose, role, canEdit, canModify, onSubmit, onModify, onApprove, onReject, onSign, onStart }) {
  const [form] = Form.useForm();
  const pricing = Form.useWatch('pricing', form);
  const unitPrice = Form.useWatch('unitPrice', form);
  React.useEffect(() => {
    if (!record) return;
    form.setFieldsValue({
      pricing: record.pricing || undefined,
      unitPrice: record.unitPrice,
      plan: record.plan,
      output: record.output,
      profitSheet: record.profitSheet,
    });
  }, [record, form]);
  if (!record) return null;
  const stage = quoteStage(record);
  const ready = pricing && unitPrice !== null && unitPrice !== undefined && unitPrice !== '';
  return <div className="detail-screen"><div className="detail-screen-bar"><div className="detail-screen-main"><button className="detail-back" onClick={onClose}>返回列表</button><div className="detail-screen-kicker">报价管理 · {record.projectNo}</div><h1>{record.projectName}</h1></div><QuoteStatus status={record.status} /></div>
    <div className="trial-detail-meta"><span>客户：{record.customer}</span><span>PM：{record.pm}</span><span>当前处理：{quoteHandling(record)}</span></div>
    {record.rejectReason && stage === '待报价' && <div className="quote-reject-box"><strong>上次审核不通过</strong><p>{record.rejectReason}</p></div>}
    <section className="trial-detail-section"><div className="trial-detail-heading"><div><p className="panel-kicker">系统带入</p><h3>项目关联字段</h3></div></div><FieldGrid record={record} /></section>
    <section className="trial-detail-section">
      <div className="trial-detail-heading"><div><p className="panel-kicker">报价内容</p><h3>{canEdit ? '待报价可编辑' : '已锁定'}</h3></div></div>
      <Form form={form} layout="vertical" disabled={!canEdit && !canModify}>
        <div className="quote-form-grid">
          <Form.Item name="pricing" label="计价方式" rules={[{ required: true, message: '请选择计价方式' }]}><Select placeholder="必填" options={['计件', '包时', '包月'].map(value => ({ value, label: value }))} /></Form.Item>
          <Form.Item name="unitPrice" label="单价" rules={[{ required: true, message: '请填写单价' }]}><InputNumber min={0} style={{ width: '100%' }} placeholder="必填" /></Form.Item>
        </div>
        <Form.Item name="plan" label="项目计划"><Input.TextArea rows={3} placeholder="选填。有内容时，报价成功后不会自动开始执行" /></Form.Item>
        <div className="quote-form-grid">
          <Form.Item name="output" label="理论产值"><Input placeholder="选填" /></Form.Item>
          <Form.Item name="profitSheet" label="理论利润测算表"><Input placeholder="选填，粘贴资料链接" /></Form.Item>
        </div>
      </Form>
      {canEdit && <Button type="primary" disabled={!ready} onClick={() => form.validateFields().then(values => onSubmit(record, values))}>提交报价</Button>}
      {canModify && <Button disabled={!ready} onClick={() => form.validateFields().then(values => onModify(record, values))}>保存修改</Button>}
      {!canEdit && <div className="quote-readonly"><span>计价方式 <b>{record.pricing || '—'}</b></span><span>单价 <b>{record.unitPrice ?? '—'}</b></span>{record.plan && <p>项目计划：{record.plan}</p>}{record.output && <p>理论产值：{record.output}</p>}{record.profitSheet && <p>理论利润测算表：{record.profitSheet}</p>}</div>}
    </section>
    {stage === '待签单' && <div className="quote-wait-box">报价已审核通过。字节项目还要登记确认结果、确认时间，以及截图或链接形式的凭证，三项都有才能进入已立项。</div>}
    {record.confirmResult && <div className="quote-sign-box"><strong>客户确认 / 签单</strong><p>结果：{record.confirmResult}</p><p>时间：{record.confirmTime}</p><p>凭证：{record.voucherKind === 'screenshot' ? '截图' : '链接'}</p>{record.voucherKind === 'screenshot' && record.voucherImage ? <img src={record.voucherImage} alt="签单或客户确认截图" /> : <a href={record.voucher} target="_blank" rel="noreferrer">{record.voucher}</a>}</div>}
    <section className="trial-detail-section"><div className="trial-detail-heading"><div><p className="panel-kicker">操作留痕</p><h3>报价动态</h3></div></div><div className="init-activity">{record.activity?.map(item => <div key={item}><span /><p>{item}</p></div>)}</div></section>
    <div className="quote-drawer-actions">
      {role === 'PMO' && stage === '待审核' && <Button danger icon={<Undo2 size={14} />} onClick={() => onReject(record)}>审核不通过</Button>}
      {role === 'PMO' && stage === '待审核' && <Button type="primary" icon={<CheckCircle2 size={14} />} onClick={() => onApprove(record)}>审核通过</Button>}
      {role === 'PMO' && stage === '待签单' && <Button type="primary" icon={<Stamp size={14} />} onClick={() => onSign(record)}>登记确认 / 签单</Button>}
      {record.status === '已立项' && hasPlan(record) && (role === 'PMO' || record.pm === PM_NAME) && <Button type="primary" icon={<Play size={14} />} onClick={() => onStart(record)}>开始执行</Button>}
    </div>
  </div>;
}

function CreateQuoteModal({ open, onCancel, onCreate }) {
  const [form] = Form.useForm();
  return <Modal title="创建报价" open={open} okText="创建并填写" onCancel={onCancel} onOk={() => form.validateFields().then(values => { onCreate(values); form.resetFields(); })}>
    <p className="modal-help-copy">由当前 PM 创建。创建后进入待报价，补充计价方式和单价后再提交给 PMO。</p>
    <Form form={form} layout="vertical">
      <div className="quote-form-grid"><Form.Item name="projectNo" label="项目编号" rules={[{ required: true, message: '请填写项目编号' }]}><Input /></Form.Item><Form.Item name="projectName" label="项目名称" rules={[{ required: true, message: '请填写项目名称' }]}><Input /></Form.Item></div>
      <div className="quote-form-grid"><Form.Item name="customer" label="客户" rules={[{ required: true, message: '请填写客户' }]}><Input /></Form.Item><Form.Item name="pricing" label="计价方式"><Select allowClear placeholder="可稍后填写" options={['计件', '包时', '包月'].map(value => ({ value, label: value }))} /></Form.Item></div>
      <Form.Item name="unitPrice" label="单价"><InputNumber min={0} style={{ width: '100%' }} placeholder="可稍后填写" /></Form.Item>
    </Form>
  </Modal>;
}
function RejectModal({ record, open, onCancel, onSubmit }) {
  const [form] = Form.useForm();
  return <Modal title="退回报价" open={open} okText="退回待报价" okButtonProps={{ danger: true }} onCancel={onCancel} onOk={() => form.validateFields().then(values => { onSubmit(record, values.reason); form.resetFields(); })}>
    <p className="modal-help-copy">退回后项目从「报价中」回到「待报价」。报价次数保留，上次填写的内容也保留。</p>
    <Form form={form} layout="vertical"><Form.Item name="reason" label="不通过原因" rules={[{ required: true, message: '请填写不通过原因' }]}><Input.TextArea rows={3} /></Form.Item></Form>
  </Modal>;
}

function readScreenshot(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
function SignModal({ record, open, onCancel, onSubmit }) {
  const [form] = Form.useForm();
  const voucherKind = Form.useWatch('voucherKind', form);
  const voucherImage = Form.useWatch('voucherImage', form);
  React.useEffect(() => { if (open) form.setFieldsValue({ voucherKind: 'link', voucher: '', voucherImage: '' }); }, [open, form]);
  return <Modal title="登记字节客户确认 / 签单" open={open} okText="完成登记" onCancel={onCancel} onOk={() => form.validateFields().then(values => { onSubmit(record, values); form.resetFields(); })}>
    <p className="modal-help-copy">{record?.projectName} 是字节项目。确认结果、确认时间、凭证缺任何一项都不能进入已立项。凭证可以上传截图，也可以填写链接。</p>
    <Form form={form} layout="vertical">
      <Form.Item name="confirmResult" label="确认结果" rules={[{ required: true, message: '请登记确认结果' }]}><Select options={['客户确认', '已签单'].map(value => ({ value, label: value }))} /></Form.Item>
      <Form.Item name="confirmTime" label="确认时间" rules={[{ required: true, message: '请登记确认时间' }]}><DatePicker showTime style={{ width: '100%' }} /></Form.Item>
      <Form.Item name="voucherKind" label="凭证形式" rules={[{ required: true, message: '请选择凭证形式' }]}><Radio.Group options={[{ value: 'link', label: '链接' }, { value: 'screenshot', label: '截图' }]} /></Form.Item>
      {voucherKind === 'screenshot' ? <Form.Item name="voucherImage" label="签单或客户确认截图" rules={[{ required: true, message: '请上传截图' }]} extra="支持 PNG、JPG、WEBP，单张不超过 2MB"><Upload accept="image/png,image/jpeg,image/webp" maxCount={1} showUploadList={false} beforeUpload={async file => { if (file.size > 2 * 1024 * 1024) { message.error('截图不能超过 2MB'); return Upload.LIST_IGNORE; } form.setFieldValue('voucherImage', await readScreenshot(file)); return Upload.LIST_IGNORE; }}><Button>{voucherImage ? '重新选择截图' : '上传截图'}</Button></Upload>{voucherImage && <img className="quote-voucher-preview" src={voucherImage} alt="已选择的签单或客户确认截图" />}</Form.Item> : <Form.Item name="voucher" label="签单或客户确认链接" rules={[{ required: true, message: '请填写凭证链接' }]}><Input placeholder="粘贴飞书文档、文件或消息链接" /></Form.Item>}
    </Form>
  </Modal>;
}

export function QuotationPage({ role = 'PMO', onRoleChange, focusKey = '' }) {
  const [records, setRecords] = React.useState(loadQuotes);
  const [tab, setTab] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const [selectedKey, setSelectedKey] = React.useState(focusKey);
  const [rejectKey, setRejectKey] = React.useState('');
  const [signKey, setSignKey] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  React.useEffect(() => {
    const sync = event => event.detail && setRecords(event.detail);
    window.addEventListener('mmos:quotation-updated', sync);
    return () => window.removeEventListener('mmos:quotation-updated', sync);
  }, []);
  React.useEffect(() => { if (focusKey) setSelectedKey(focusKey); }, [focusKey]);
  const mine = records.filter(item => role === 'PMO' || (role === 'PM' && item.pm === PM_NAME));
  const visible = mine.filter(item => tab === 'all' || quoteStage(item) === tab).filter(item => !query.trim() || [item.projectNo, item.projectName, item.customer, item.pm].some(value => String(value || '').includes(query.trim())));
  const selected = records.find(item => item.key === selectedKey) || null;
  const canEdit = record => role === 'PM' && Boolean(record) && quoteStage(record) === '待报价' && record.pm === PM_NAME;
  const canModify = record => role === 'PMO' && Boolean(record) && ['待报价', '待审核', '待签单'].includes(quoteStage(record));
  const update = (record, patch, notice) => {
    const next = records.map(item => item.key === record.key ? { ...item, ...patch, updatedAt: nowStamp() } : item);
    persistQuotes(next);
    setRecords(next);
    if (notice) message.success(notice);
  };
  const submitQuote = (record, values) => {
    const count = (record.count || 0) + 1;
    update(record, {
      ...values, count, status: '报价中', review: '', rejectReason: '',
      activity: [`${nowStamp()} · ${record.pm}提交第 ${count} 次报价，进入 PMO 审核`, ...(record.activity || [])],
    }, '报价已提交，项目进入报价中');
    setSelectedKey('');
  };
  const modifyQuote = (record, values) => update(record, { ...values, activity: [`${nowStamp()} · PMO 修改报价内容，项目状态保持${record.status}`, ...(record.activity || [])] }, '报价内容已修改');
  const createQuote = values => {
    const created = { key: `quote-${Date.now()}`, quoteId: `BJ-${dayjs().format('YYYYMMDDHHmmss')}`, projectId: `PRJ-${Date.now()}`, projectNo: values.projectNo, projectName: values.projectName, customer: values.customer, pm: PM_NAME, status: '待报价', count: 0, pricing: values.pricing || '', unitPrice: values.unitPrice ?? null, plan: '', output: '', profitSheet: '', review: '', rejectReason: '', confirmResult: '', confirmTime: '', voucher: '', demandId: '—', trialId: '—', initiationId: '—', updatedAt: nowStamp(), activity: [`${nowStamp()} · 王然手动创建报价`] };
    const next = [created, ...records];
    persistQuotes(next);
    setRecords(next);
    setCreating(false);
    setSelectedKey(created.key);
    message.success('报价已创建，请补充项目信息并提交');
  };
  const approve = record => {
    if (record.customer === '字节') {
      update(record, { review: '通过', rejectReason: '', activity: [`${nowStamp()} · PMO 审核通过，项目保持报价中，等待登记字节客户确认或签单`, ...(record.activity || [])] }, '审核通过，等待登记客户确认或签单');
      return;
    }
    const nextStatus = hasPlan(record) ? '已立项' : '项目进行中';
    update(record, {
      status: nextStatus, review: '通过', rejectReason: '',
      activity: [`${nowStamp()} · ${hasPlan(record) ? '已有项目计划，进入已立项，等待开始执行' : '已立项后无项目计划，系统自动进入项目进行中'}`, `${nowStamp()} · PMO 审核通过，非字节项目进入已立项`, ...(record.activity || [])],
    }, nextStatus === '已立项' ? '审核通过，项目进入已立项' : '审核通过，项目已自动进入进行中');
  };
  const reject = (record, reason) => {
    update(record, { status: '待报价', review: '不通过', rejectReason: reason, activity: [`${nowStamp()} · PMO 审核不通过：${reason}`, ...(record.activity || [])] }, '已退回，项目回到待报价');
    setRejectKey('');
  };
  const sign = (record, values) => {
    const nextStatus = hasPlan(record) ? '已立项' : '项目进行中';
    const confirmTime = values.confirmTime?.format ? values.confirmTime.format('YYYY-MM-DD HH:mm') : values.confirmTime;
    update(record, {
      status: nextStatus, confirmResult: values.confirmResult, confirmTime, voucherKind: values.voucherKind, voucher: values.voucherKind === 'screenshot' ? '截图' : values.voucher, voucherImage: values.voucherKind === 'screenshot' ? values.voucherImage : '',
      activity: [`${nowStamp()} · ${hasPlan(record) ? '登记完成，进入已立项，等待开始执行' : '登记完成，无项目计划，系统自动进入项目进行中'}`, `${nowStamp()} · PMO 登记${values.confirmResult}`, ...(record.activity || [])],
    }, '客户确认已登记');
    setSignKey('');
  };
  const startExecution = record => update(record, { status: '项目进行中', activity: [`${nowStamp()} · 提交开始执行，项目进入项目进行中`, ...(record.activity || [])] }, '项目已进入进行中');
  const countOf = stage => mine.filter(item => !stage || quoteStage(item) === stage).length;
  const columns = [
    { title: '项目编号', dataIndex: 'projectNo', width: 146, render: value => <span className="trial-project-no">{value}</span> },
    { title: '项目名称', dataIndex: 'projectName', width: 210, render: (value, record) => <button className="trial-name-link" onClick={() => setSelectedKey(record.key)}><span className="trial-name-icon"><FileText size={14} /></span><span><strong>{value}</strong><small>{record.customer} · {record.pm}</small></span></button> },
    { title: '客户', dataIndex: 'customer', width: 80 },
    { title: 'PM', dataIndex: 'pm', width: 80 },
    { title: '计价方式', dataIndex: 'pricing', width: 90, render: value => value || '—' },
    { title: '单价', dataIndex: 'unitPrice', width: 80, render: value => value ?? '—' },
    { title: '报价次数', dataIndex: 'count', width: 90 },
    { title: '项目状态', dataIndex: 'status', width: 110, render: value => <QuoteStatus status={value} /> },
    { title: '当前处理', key: 'handling', width: 130, render: (_, record) => quoteHandling(record) },
    { title: '最近更新', dataIndex: 'updatedAt', width: 150 },
    { title: '操作', key: 'action', width: 210, render: (_, record) => {
      const stage = quoteStage(record);
      return <Space size={0} wrap>
        <Button type="link" size="small" onClick={() => setSelectedKey(record.key)}>查看</Button>
        {canEdit(record) && <Button type="link" size="small" onClick={() => setSelectedKey(record.key)}>填写报价</Button>}
        {canModify(record) && <Button type="link" size="small" onClick={() => setSelectedKey(record.key)}>修改</Button>}
        {role === 'PMO' && stage === '待审核' && <Button type="link" size="small" onClick={() => approve(record)}>通过</Button>}
        {role === 'PMO' && stage === '待审核' && <Button danger type="link" size="small" onClick={() => setRejectKey(record.key)}>退回</Button>}
        {role === 'PMO' && stage === '待签单' && <Button type="link" size="small" onClick={() => setSignKey(record.key)}>登记签单</Button>}
        {(role === 'PMO' || record.pm === PM_NAME) && record.status === '已立项' && hasPlan(record) && <Button type="link" size="small" onClick={() => startExecution(record)}>开始执行</Button>}
      </Space>;
    } },
  ];
  const tabs = [['all', '全部'], ['待报价', '待报价'], ['待审核', '待审核'], ['待签单', '待签单'], ['报价结果', '报价结果']].map(([key, label]) => ({ key, label: <span>{label} <em>{countOf(key === 'all' ? '' : key)}</em></span> }));
  if (selected) return <div className="trial-page quote-page"><QuoteDetail record={selected} onClose={() => setSelectedKey('')} role={role} canEdit={canEdit(selected)} canModify={canModify(selected)} onSubmit={submitQuote} onModify={modifyQuote} onApprove={approve} onReject={record => setRejectKey(record.key)} onSign={record => setSignKey(record.key)} onStart={startExecution} /><RejectModal record={records.find(item => item.key === rejectKey)} open={Boolean(rejectKey)} onCancel={() => setRejectKey('')} onSubmit={reject} /><SignModal record={records.find(item => item.key === signKey)} open={Boolean(signKey)} onCancel={() => setSignKey('')} onSubmit={sign} /></div>;
  return <div className="trial-page quote-page">
    <div className="trial-page-heading"><div><p className="eyebrow">项目管理 · 报价管理</p><h1>报价管理</h1><p className="subtitle">PM 创建并提交报价。PMO 负责审核、修改和字节客户签单登记。</p></div><Space><div className="trial-role-switch"><ShieldCheck size={14} /><span>演示身份</span><Select aria-label="演示身份" size="small" value={role} onChange={onRoleChange} options={[{ value: 'PMO', label: 'PMO · 林晓彤' }, { value: 'PM', label: 'PM · 王然' }, { value: '财务', label: '财务 · 赵敏' }]} /></div>{role === 'PM' && <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>创建报价</Button>}</Space></div>
    <div className="trial-stat-grid quote-stat-grid">{['待报价', '待审核', '待签单', '报价结果'].map(stage => <Card key={stage} variant="borderless"><div><small>{stage}</small><strong>{countOf(stage)}</strong></div></Card>)}</div>
    <Card variant="borderless" className="trial-work-card">
      <div className="trial-list-toolbar"><Input prefix={<Search size={15} />} allowClear value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索项目名称、编号、客户、PM" aria-label="搜索报价记录" /><span className="trial-permission-chip"><ShieldCheck size={13} /> {role === 'PMO' ? '全部报价记录' : '我承接的报价记录'}</span></div>
      <Tabs activeKey={tab} onChange={setTab} items={tabs} className="trial-tabs" />
      <div className="trial-table-wrap"><Table rowKey="key" columns={columns} dataSource={visible} pagination={{ pageSize: 8, showSizeChanger: false }} scroll={{ x: 1380 }} locale={{ emptyText: <Empty description="暂无符合条件的报价记录" /> }} onRow={record => ({ onClick: event => { if (event.target.closest('button, a, .ant-btn')) return; setSelectedKey(record.key); } })} /></div>
    </Card>
    <CreateQuoteModal open={creating} onCancel={() => setCreating(false)} onCreate={createQuote} />
  </div>;
}
