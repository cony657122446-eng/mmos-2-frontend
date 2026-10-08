import React from 'react';
import { Button, Card, Empty, Form, Input, Modal, Select, Space, Table, Tabs, Tag, message } from 'antd';
import { ArrowRight, FileText, PauseCircle, Play, Search, ShieldCheck } from 'lucide-react';
import dayjs from 'dayjs';

export const PROJECT_FLOW_KEY = 'mmos.project.flow.v2';
const PM_NAME = '王然';
const stages = ['立项申请', '试标', '报价', '项目执行', '验收', '开票'];
const detailFields = ['项目编号', '项目名称', '计价方式', '项目状态', '负责人', 'PA', '验收总金额', '实际验收金额', '验收开票总金额', '已汇款总金额', '公司人员当前总产量', '公司外部人员产量', '当前公司出勤人员成本', '公司外部人员成本', '超量绩效成本', '其他费用', '包时项目内部员工有效时长', '包时项目外部员工有效时长', '产值', '成本', '利润', '利润率', '项目周期', '带教PM', '项目标记', '外部试标成本', '预计处理时间', '产值与验收差距', '总产量', '单价'];

const seedProjects = [
  { key: 'flow-001', projectNo: 'ZJ20260922001', projectName: '短视频字幕校对', customer: '腾讯', pm: '王然', stage: '立项申请', status: '待 PMO 审核', invoiceStatus: '未开票', paymentStatus: '未到账', stale: false, pauseReason: '', fields: { 计价方式: '计件', 负责人: '王然', PA: '周宁', 项目周期: '2026-09-22 起', 带教PM: '林晓彤', 项目标记: '新项目', 预计处理时间: '15 个工作日', 单价: '0.18 元/条' }, activity: ['2026-09-22 10:12 · 王然提交立项申请'] },
  { key: 'flow-002', projectNo: 'ZJ20260918006', projectName: '语音质检专项', customer: '字节', pm: '林晓彤', stage: '试标', status: '试标中', invoiceStatus: '未开票', paymentStatus: '未到账', stale: false, pauseReason: '', fields: { 计价方式: '包时', 负责人: '林晓彤', PA: '周宁', 项目周期: '2026-09-18 起', 带教PM: '—', 项目标记: '试标', 外部试标成本: '6,400 元', 预计处理时间: '10 个工作日', 单价: '86 元/小时' }, activity: ['2026-09-20 16:20 · PMO 审核通过，项目进入试标中'] },
  { key: 'flow-003', projectNo: 'ZJ20260916017', projectName: '中文答案可用性评测', customer: '字节', pm: '王然', stage: '报价', status: '报价中', invoiceStatus: '未开票', paymentStatus: '未到账', stale: false, pauseReason: '', fields: { 计价方式: '计件', 负责人: '王然', PA: '陈可', 项目周期: '2026-09-16 起', 带教PM: '林晓彤', 项目标记: '重点', 外部试标成本: '3,200 元', 预计处理时间: '20 个工作日', 单价: '0.35 元/条' }, activity: ['2026-09-21 11:05 · 王然提交报价，等待 PMO 审核'] },
  { key: 'flow-004', projectNo: 'ZJ20260821011', projectName: '地图兴趣点审核', customer: '百度', pm: '王然', stage: '项目执行', status: '已立项', invoiceStatus: '未开票', paymentStatus: '未到账', stale: false, plan: '先完成两周样本校准，再按城市分批上人。', pauseReason: '', fields: { 计价方式: '包时', 负责人: '王然', PA: '陈可', 项目周期: '2026-08-21 至 2026-11-30', 带教PM: '—', 项目标记: '常规', 外部试标成本: '0 元', 预计处理时间: '45 个工作日', 单价: '72 元/小时' }, activity: ['2026-09-18 13:12 · 报价成功，已有项目计划，等待开始执行'] },
  { key: 'flow-005', projectId: 'flow-005', projectNo: 'ZJ20260828008', projectName: '商品标题生成', customer: '阿里', pm: '王然', stage: '项目执行', status: '项目进行中', invoiceStatus: '未开票', paymentStatus: '未到账', stale: false, pauseReason: '', fields: { 计价方式: '计件', 负责人: '王然', PA: '周宁', 验收总金额: '—', 实际验收金额: '—', 验收开票总金额: '—', 已汇款总金额: '—', 公司人员当前总产量: '86,400 条', 公司外部人员产量: '12,600 条', 当前公司出勤人员成本: '64,200 元', 公司外部人员成本: '9,800 元', 超量绩效成本: '2,400 元', 其他费用: '1,150 元', 包时项目内部员工有效时长: '—', 包时项目外部员工有效时长: '—', 产值: '47,520 元', 成本: '77,550 元', 利润: '-30,030 元', 利润率: '-63.2%', 项目周期: '2026-08-28 至 2026-10-31', 带教PM: '林晓彤', 项目标记: '常规', 外部试标成本: '1,800 元', 预计处理时间: '30 个工作日', 产值与验收差距: '—', 总产量: '99,000 条', 单价: '0.48 元/条' }, activity: ['2026-09-16 15:30 · 无项目计划，系统自动进入项目进行中'] },
  { key: 'flow-006', projectId: 'flow-006', projectNo: 'ZJ20260812021', projectName: '客服对话质检', customer: '京东', pm: '林晓彤', stage: '项目执行', status: '项目进行中', invoiceStatus: '未开票', paymentStatus: '未到账', stale: true, pauseReason: '', fields: { 计价方式: '包时', 负责人: '林晓彤', PA: '陈可', 公司人员当前总产量: '—', 公司外部人员产量: '—', 当前公司出勤人员成本: '41,300 元', 公司外部人员成本: '0 元', 超量绩效成本: '0 元', 其他费用: '600 元', 包时项目内部员工有效时长: '486 小时', 包时项目外部员工有效时长: '0 小时', 产值: '41,796 元', 成本: '41,900 元', 利润: '-104 元', 利润率: '-0.2%', 项目周期: '2026-08-12 至 2026-10-15', 带教PM: '—', 项目标记: '风险', 外部试标成本: '2,200 元', 预计处理时间: '25 个工作日', 总产量: '—', 单价: '86 元/小时' }, activity: ['2026-09-14 09:00 · 产出数据已超过 7 天未更新'] },
  { key: 'flow-007', projectId: 'flow-007', projectNo: 'ZJ20260730014', projectName: '商品图分类', customer: '拼多多', pm: '王然', stage: '项目执行', status: '项目暂停', invoiceStatus: '未开票', paymentStatus: '未到账', stale: false, pauseReason: '客户临时调整分类标准，暂停等待新规范。', fields: { 计价方式: '计件', 负责人: '王然', PA: '周宁', 公司人员当前总产量: '42,000 张', 公司外部人员产量: '8,500 张', 当前公司出勤人员成本: '28,600 元', 公司外部人员成本: '6,200 元', 超量绩效成本: '900 元', 其他费用: '400 元', 产值: '18,180 元', 成本: '36,100 元', 利润: '-17,920 元', 利润率: '-98.6%', 项目周期: '2026-07-30 至 2026-09-30', 带教PM: '林晓彤', 项目标记: '暂停', 外部试标成本: '1,200 元', 预计处理时间: '18 个工作日', 总产量: '50,500 张', 单价: '0.36 元/张' }, activity: ['2026-09-19 18:06 · 王然发起项目暂停'] },
  { key: 'flow-008', projectNo: 'ZJ20260718009', projectName: '多语种文本清洗', customer: '字节', pm: '林晓彤', stage: '验收', status: '项目验收中', invoiceStatus: '未开票', paymentStatus: '未到账', stale: false, acceptanceType: '阶段验收', pauseReason: '', fields: { 计价方式: '包月', 负责人: '林晓彤', PA: '陈可', 验收总金额: '128,000 元', 实际验收金额: '128,000 元', 验收开票总金额: '—', 已汇款总金额: '—', 公司人员当前总产量: '—', 公司外部人员产量: '—', 当前公司出勤人员成本: '76,400 元', 公司外部人员成本: '12,000 元', 超量绩效成本: '3,600 元', 其他费用: '2,100 元', 包时项目内部员工有效时长: '—', 包时项目外部员工有效时长: '—', 产值: '128,000 元', 成本: '94,100 元', 利润: '33,900 元', 利润率: '26.5%', 项目周期: '2026-07-18 至 2026-09-17', 带教PM: '—', 项目标记: '阶段验收', 外部试标成本: '4,500 元', 预计处理时间: '40 个工作日', 产值与验收差距: '0 元', 总产量: '—', 单价: '12,800 元/人月' }, activity: ['2026-09-23 11:40 · 林晓彤发起阶段验收，等待 PMO 审核'] },
  { key: 'flow-009', projectNo: 'ZJ20260626004', projectName: '广告文案改写', customer: '腾讯', pm: '王然', stage: '开票', status: '项目进行中', invoiceStatus: '待开票', paymentStatus: '未到账', stale: false, acceptanceType: '阶段验收', pauseReason: '', fields: { 计价方式: '计件', 负责人: '王然', PA: '周宁', 验收总金额: '86,000 元', 实际验收金额: '86,000 元', 验收开票总金额: '86,000 元', 已汇款总金额: '0 元', 公司人员当前总产量: '120,000 条', 公司外部人员产量: '15,000 条', 当前公司出勤人员成本: '52,000 元', 公司外部人员成本: '8,400 元', 超量绩效成本: '1,800 元', 其他费用: '900 元', 产值: '91,800 元', 成本: '63,100 元', 利润: '28,700 元', 利润率: '31.3%', 项目周期: '2026-06-26 至 2026-10-31', 带教PM: '林晓彤', 项目标记: '待开票', 外部试标成本: '2,000 元', 预计处理时间: '60 个工作日', 产值与验收差距: '5,800 元', 总产量: '135,000 条', 单价: '0.68 元/条' }, activity: ['2026-09-20 16:48 · 阶段验收通过，项目回到进行中，开票状态为待开票'] },
  { key: 'flow-010', projectNo: 'ZJ20260608002', projectName: '搜索相关性标注', customer: '字节', pm: '王然', stage: '开票', status: '项目结束', invoiceStatus: '已开票', paymentStatus: '部分到账', stale: false, acceptanceType: '最终验收', pauseReason: '', fields: { 计价方式: '包月', 负责人: '王然', PA: '陈可', 验收总金额: '256,000 元', 实际验收金额: '248,600 元', 验收开票总金额: '248,600 元', 已汇款总金额: '160,000 元', 公司人员当前总产量: '—', 公司外部人员产量: '—', 当前公司出勤人员成本: '142,000 元', 公司外部人员成本: '21,500 元', 超量绩效成本: '6,800 元', 其他费用: '3,200 元', 产值: '256,000 元', 成本: '173,500 元', 利润: '75,100 元', 利润率: '30.2%', 项目周期: '2026-06-08 至 2026-09-08', 带教PM: '—', 项目标记: '已结束', 外部试标成本: '5,600 元', 预计处理时间: '65 个工作日', 产值与验收差距: '7,400 元', 总产量: '—', 单价: '12,800 元/人月' }, activity: ['2026-09-12 15:10 · 最终验收通过，项目结束；财务已回传已开票'] },
];

const statusColor = { '待 PMO 审核': 'processing', '试标中': 'processing', '报价中': 'processing', '已立项': 'cyan', '项目进行中': 'success', '项目暂停': 'warning', '项目验收中': 'purple', '项目结束': 'default' };
function nowStamp() { return dayjs().format('YYYY-MM-DD HH:mm'); }
function loadProjects() { try { const value = localStorage.getItem(PROJECT_FLOW_KEY); return value ? JSON.parse(value) : seedProjects; } catch { return seedProjects; } }
function persistProjects(next) { localStorage.setItem(PROJECT_FLOW_KEY, JSON.stringify(next)); window.dispatchEvent(new CustomEvent('mmos:project-flow-updated', { detail: next })); }
function StatusTag({ status }) { return <Tag color={statusColor[status] || 'default'}>{status}</Tag>; }

function StageTrack({ stage }) {
  const current = stages.indexOf(stage);
  return <div className="flow-track" aria-label={`当前阶段 ${stage}`}>{stages.map((item, index) => <span key={item} className={index < current ? 'done' : index === current ? 'current' : ''}>{item}</span>)}</div>;
}

function ProjectDetail({ record, onClose, role, onNavigate, onPause, onResume, onStart }) {
  if (!record) return null;
  const own = role === 'PMO' || record.pm === PM_NAME;
  const target = { '立项申请': 'initiation', '试标': 'trial', '报价': 'quotation', '验收': 'acceptance', '开票': 'invoice-ledger' }[record.stage];
  return <div className="detail-screen"><div className="detail-screen-bar"><div className="detail-screen-main"><button className="detail-back" onClick={onClose}>返回列表</button><div className="detail-screen-kicker">项目总览 · {record.projectNo}</div><h1>{record.projectName}</h1></div><StatusTag status={record.status} /></div>
    <div className="trial-detail-meta"><span>客户：{record.customer}</span><span>PM：{record.pm}</span><span>阶段：{record.stage}</span></div>
    <StageTrack stage={record.stage} />
    <div className="quote-field-grid flow-meta"><div><small>开票状态</small><strong>{record.invoiceStatus}</strong></div><div><small>到账状态</small><strong>{record.paymentStatus}</strong></div><div><small>产出更新</small><strong>{record.stale ? '超过 7 天未更新' : '正常'}</strong></div></div>
    <section className="trial-detail-section"><div className="trial-detail-heading"><div><p className="panel-kicker">项目字段</p><h3>30 个详情字段</h3></div></div><ol className="flow-detail-fields">{detailFields.map((label, index) => { const value = label === '项目编号' ? record.projectNo : label === '项目名称' ? record.projectName : label === '项目状态' ? record.status : record.fields?.[label]; return <li key={label}><em>{index + 1}</em><span><small>{label}</small><strong>{value || '—'}</strong></span></li>; })}</ol></section>
    {record.pauseReason && <div className="quote-reject-box"><strong>暂停原因</strong><p>{record.pauseReason}</p></div>}
    {record.stale && record.status === '项目进行中' && <div className="quote-wait-box">产出数据已超过 7 天未更新。可以发起项目暂停，也可以直接进入验收。</div>}
    <section className="trial-detail-section"><div className="trial-detail-heading"><div><p className="panel-kicker">操作留痕</p><h3>项目动态</h3></div></div><div className="init-activity">{record.activity.map(item => <div key={item}><span /><p>{item}</p></div>)}</div></section>
    {own && <div className="quote-drawer-actions">
      {target && <Button icon={<ArrowRight size={14} />} onClick={() => onNavigate(target)}>进入{record.stage}</Button>}
      {record.status === '已立项' && <Button type="primary" icon={<Play size={14} />} onClick={() => onStart(record)}>开始执行</Button>}
      {record.status === '项目进行中' && <Button icon={<PauseCircle size={14} />} onClick={() => onPause(record)}>项目暂停</Button>}
      {record.status === '项目进行中' && <Button onClick={() => onNavigate(`acceptance:${record.projectId}:${record.projectNo}`)}>发起验收</Button>}
      {record.status === '项目暂停' && <Button type="primary" icon={<Play size={14} />} onClick={() => onResume(record)}>恢复执行</Button>}
      {record.status === '项目暂停' && <Button onClick={() => onNavigate(`acceptance:${record.projectId}:${record.projectNo}`)}>直接验收</Button>}
    </div>}
  </div>;
}

function PauseModal({ record, open, onCancel, onSubmit }) {
  const [form] = Form.useForm();
  return <Modal title="发起项目暂停" open={open} okText="确认暂停" onCancel={onCancel} onOk={() => form.validateFields().then(values => { onSubmit(record, values.reason); form.resetFields(); })}>
    <p className="modal-help-copy">暂停后项目状态变为「项目暂停」，系统会向 PMO 发送提示。恢复执行不需要 PMO 审核。</p>
    <Form form={form} layout="vertical"><Form.Item name="reason" label="暂停原因" rules={[{ required: true, message: '请填写暂停原因' }]}><Input.TextArea rows={3} /></Form.Item></Form>
  </Modal>;
}

export function ProjectOverviewPage({ role = 'PMO', onRoleChange, onNavigate }) {
  const [records, setRecords] = React.useState(loadProjects);
  const [stage, setStage] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const [selectedKey, setSelectedKey] = React.useState('');
  const [pauseKey, setPauseKey] = React.useState('');
  React.useEffect(() => { const sync = event => event.detail && setRecords(event.detail); window.addEventListener('mmos:project-flow-updated', sync); return () => window.removeEventListener('mmos:project-flow-updated', sync); }, []);
  const mine = records.filter(item => role === 'PMO' || item.pm === PM_NAME);
  const visible = mine.filter(item => stage === 'all' || item.stage === stage).filter(item => !query.trim() || [item.projectNo, item.projectName, item.customer, item.pm, item.status].some(value => String(value).includes(query.trim())));
  const selected = records.find(item => item.key === selectedKey);
  const update = (record, patch, notice) => {
    const next = records.map(item => item.key === record.key ? { ...item, ...patch } : item);
    persistProjects(next);
    setRecords(next);
    if (notice) message.success(notice);
  };
  const pause = (record, reason) => { update(record, { status: '项目暂停', pauseReason: reason, stale: false, activity: [`${nowStamp()} · ${record.pm}发起项目暂停：${reason}`, ...(record.activity || [])] }, '项目已暂停，已提示 PMO'); setPauseKey(''); };
  const resume = record => update(record, { status: '项目进行中', activity: [`${nowStamp()} · 恢复执行，项目回到项目进行中`, ...(record.activity || [])] }, '项目已恢复执行');
  const start = record => update(record, { status: '项目进行中', activity: [`${nowStamp()} · 提交开始执行，项目进入项目进行中`, ...(record.activity || [])] }, '项目已进入进行中');
  const countOf = name => mine.filter(item => !name || item.stage === name).length;
  const own = record => role === 'PMO' || record.pm === PM_NAME;
  const columns = [
    { title: '项目编号', dataIndex: 'projectNo', width: 146, render: value => <span className="trial-project-no">{value}</span> },
    { title: '项目名称', dataIndex: 'projectName', width: 200, render: (value, record) => <button className="trial-name-link" onClick={() => setSelectedKey(record.key)}><span className="trial-name-icon"><FileText size={14} /></span><span><strong>{value}</strong><small>{record.customer} · {record.pm}</small></span></button> },
    { title: '阶段', dataIndex: 'stage', width: 100 },
    { title: '项目状态', dataIndex: 'status', width: 120, render: value => <StatusTag status={value} /> },
    { title: '开票状态', dataIndex: 'invoiceStatus', width: 100 },
    { title: '到账状态', dataIndex: 'paymentStatus', width: 100 },
    { title: '提醒', key: 'alert', width: 130, render: (_, record) => record.stale ? <Tag color="error">产出超 7 天</Tag> : '—' },
    { title: '操作', key: 'action', width: 250, render: (_, record) => own(record) && <Space size={0} wrap>
      <Button type="link" size="small" onClick={() => setSelectedKey(record.key)}>详情</Button>
      {record.status === '已立项' && <Button type="link" size="small" onClick={() => start(record)}>开始执行</Button>}
      {record.status === '项目进行中' && <Button type="link" size="small" onClick={() => setPauseKey(record.key)}>暂停</Button>}
      {record.status === '项目进行中' && <Button type="link" size="small" onClick={() => onNavigate(`acceptance:${record.projectId}:${record.projectNo}`)}>验收</Button>}
      {record.status === '项目暂停' && <Button type="link" size="small" onClick={() => resume(record)}>恢复</Button>}
      {record.status === '项目暂停' && <Button type="link" size="small" onClick={() => onNavigate(`acceptance:${record.projectId}:${record.projectNo}`)}>直接验收</Button>}
    </Space> },
  ];
  if (selected) return <div className="trial-page flow-page"><ProjectDetail record={selected} onClose={() => setSelectedKey('')} role={role} onNavigate={onNavigate} onPause={record => setPauseKey(record.key)} onResume={resume} onStart={start} /><PauseModal record={records.find(item => item.key === pauseKey)} open={Boolean(pauseKey)} onCancel={() => setPauseKey('')} onSubmit={pause} /></div>;
  return <div className="trial-page flow-page">
    <div className="trial-page-heading"><div><p className="eyebrow">项目管理 · 项目总览</p><h1>项目总览</h1><p className="subtitle">{role === 'PMO' ? '查看从立项申请到开票完成的全部项目，并可进入对应环节处理。' : '只显示本人从立项申请到开票完成的项目，可对进行中的项目暂停、恢复或发起验收。'}</p></div><div className="trial-role-switch"><ShieldCheck size={14} /><span>演示身份</span><Select aria-label="演示身份" size="small" value={role} onChange={onRoleChange} options={[{ value: 'PMO', label: 'PMO · 林晓彤' }, { value: 'PM', label: 'PM · 王然' }, { value: '财务', label: '财务 · 赵敏' }]} /></div></div>
    <div className="flow-stage-grid">{stages.map(item => <Card key={item} variant="borderless"><small>{item}</small><strong>{countOf(item)}</strong></Card>)}</div>
    <Card variant="borderless" className="trial-work-card">
      <div className="trial-list-toolbar"><Input prefix={<Search size={15} />} allowClear value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索项目名称、编号、客户、PM、状态" aria-label="搜索项目总览" /><span className="trial-permission-chip"><ShieldCheck size={13} /> {role === 'PMO' ? '全部项目' : '我承接的项目'}</span></div>
      <Tabs activeKey={stage} onChange={setStage} className="trial-tabs" items={[{ key: 'all', label: <span>全部 <em>{countOf('')}</em></span> }, ...stages.map(item => ({ key: item, label: <span>{item} <em>{countOf(item)}</em></span> }))]} />
      <Table rowKey="key" columns={columns} dataSource={visible} pagination={{ pageSize: 8, showSizeChanger: false }} scroll={{ x: 1240 }} locale={{ emptyText: <Empty description="当前阶段没有项目" /> }} onRow={record => ({ onClick: event => { if (event.target.closest('button, a, .ant-btn')) return; setSelectedKey(record.key); } })} />
    </Card>

  </div>;
}
