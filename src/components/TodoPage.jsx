import React from 'react';
import { Button, Card, Empty, Select, Space, Table, Tag, message } from 'antd';
import { ArrowRight, CheckCircle2, ClipboardCheck, FileText, ShieldCheck, UserRound } from 'lucide-react';
import { getInitiationApplications, INITIATION_STORAGE_KEY } from './InitiationPage';
import { isQuoteTodo, QUOTE_STORAGE_KEY, quoteHandling, quoteStage } from './QuotationPage';
import { ACCEPTANCE_KEY, isAcceptanceTodo } from './AcceptancePage';
import { loadInvoices } from './InvoiceLedgerPage';

function writeApplications(next) {
  window.localStorage.setItem(INITIATION_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('mmos:initiation-updated', { detail: next }));
}

function loadQuotes() { try { const value = localStorage.getItem(QUOTE_STORAGE_KEY); return value ? JSON.parse(value) : []; } catch { return []; } }
function writeQuotes(next) { localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(next)); window.dispatchEvent(new CustomEvent('mmos:quotation-updated', { detail: next })); }

export function TodoPage({ onNavigate, role = 'PMO', onRoleChange }) {
  const [applications, setApplications] = React.useState(getInitiationApplications);
  const [quotes, setQuotes] = React.useState(loadQuotes);
  const [acceptance, setAcceptance] = React.useState(() => { try { return JSON.parse(localStorage.getItem(ACCEPTANCE_KEY) || '[]'); } catch { return []; } });
  const [invoices, setInvoices] = React.useState(loadInvoices);
  React.useEffect(() => {
    const sync = event => { if (event.detail) setApplications(event.detail); };
    const syncQuotes = event => { if (event.detail) setQuotes(event.detail); };
    const syncAcceptance = event => { if (event.detail) setAcceptance(event.detail); };
    const syncInvoices = event => { if (event.detail) setInvoices(event.detail); };
    window.addEventListener('mmos:initiation-updated', sync);
    window.addEventListener('mmos:quotation-updated', syncQuotes);
    window.addEventListener('mmos:acceptance-updated', syncAcceptance);
    window.addEventListener('mmos:invoice-updated', syncInvoices);
    return () => { window.removeEventListener('mmos:initiation-updated', sync); window.removeEventListener('mmos:quotation-updated', syncQuotes); window.removeEventListener('mmos:acceptance-updated', syncAcceptance); window.removeEventListener('mmos:invoice-updated', syncInvoices); };
  }, []);
  const finance = role === '财务';
  const reviewRows = applications.filter(item => item.status === '待 PMO 审核');
  const pmRows = applications.filter(item => item.creator === '王然' && ['草稿', '审核不通过'].includes(item.status));
  const rows = role === 'PMO' ? reviewRows : finance ? [] : pmRows;
  const quoteRows = finance ? [] : quotes.filter(item => isQuoteTodo(item, role));
  const invoiceRows = finance ? invoices.filter(item => item.invoiceStatus === '待开票') : [];
  const approveQuote = record => {
    const stamp = '2026-09-28 11:20';
    const next = quotes.map(item => item.key === record.key ? { ...item, review: '通过', updatedAt: stamp, activity: [`${stamp} · PMO 从待办审核通过，等待登记字节客户确认或签单`, ...(item.activity || [])] } : item);
    writeQuotes(next);
    setQuotes(next);
    message.success('报价审核通过');
  };
  const approve = record => {
    const next = applications.map(item => item.key === record.key ? {
      ...item,
      status: '审核通过',
      reason: 'PMO审核通过，已自动进入试标管理',
      updatedAt: '2026-09-21 10:20',
      activity: [`2026-09-21 10:20 · PMO从待办列表审核通过，项目状态变更为试标中`, ...(item.activity || [])],
    } : item);
    writeApplications(next);
    setApplications(next);
    message.success('审核通过，项目已自动进入试标管理');
  };
  const columns = [
    { title: '项目编号', dataIndex: 'projectNo', width: 140, render: value => <span className="todo-project-no">{value}</span> },
    { title: '项目名称', dataIndex: 'projectName', width: 220, render: (value, record) => <button className="todo-name-link" onClick={() => onNavigate('initiation')}><span className="todo-name-icon"><FileText size={14} /></span><span><strong>{value}</strong><small>{record.mainProject}</small></span></button> },
    { title: '客户', dataIndex: 'customer', width: 120 },
    { title: 'PM', dataIndex: 'pm', width: 90 },
    { title: '提交时间', dataIndex: 'updatedAt', width: 160 },
    { title: '状态', dataIndex: 'status', width: 120, render: value => <Tag color={value === '审核不通过' ? 'error' : value === '草稿' ? 'default' : 'processing'}>{value}</Tag> },
    { title: '处理', key: 'action', width: 190, render: (_, record) => role === 'PMO' ? <Space size={6}><Button type="primary" size="small" icon={<CheckCircle2 size={13} />} onClick={() => approve(record)}>直接通过</Button><Button type="link" size="small" icon={<ArrowRight size={13} />} onClick={() => onNavigate('initiation')}>查看详情</Button></Space> : <Button type="primary" size="small" icon={<ArrowRight size={13} />} onClick={() => onNavigate('initiation')}>{record.status === '审核不通过' ? '修改并重新提交' : '继续填写'}</Button> },
  ];
  const acceptanceRows = finance ? [] : acceptance.filter(item => isAcceptanceTodo(item, role));
  const invoiceColumns = [
    { title: '验收编号', dataIndex: 'acceptanceNo', width: 140, render: value => <span className="todo-project-no">{value}</span> },
    { title: '项目名称', dataIndex: 'projectName', width: 210, render: (value, record) => <button className="todo-name-link" onClick={() => onNavigate('invoice-ledger')}><span className="todo-name-icon"><FileText size={14} /></span><span><strong>{value}</strong><small>{record.customer} · {record.amount}</small></span></button> },
    { title: '开票状态', dataIndex: 'invoiceStatus', width: 100, render: value => <Tag color="processing">{value}</Tag> },
    { title: '处理', key: 'action', width: 140, render: () => <Button type="link" size="small" icon={<ArrowRight size={13} />} onClick={() => onNavigate('invoice-ledger')}>去开票</Button> },
  ];
  const acceptanceColumns = [
    { title: '验收编号', dataIndex: 'acceptanceNo', width: 140, render: value => <span className="todo-project-no">{value}</span> },
    { title: '项目名称', dataIndex: 'projectName', width: 210, render: (value, record) => <button className="todo-name-link" onClick={() => onNavigate('acceptance')}><span className="todo-name-icon"><FileText size={14} /></span><span><strong>{value}</strong><small>{record.type}</small></span></button> },
    { title: '申请状态', dataIndex: 'applyStatus', width: 100, render: value => <Tag color={value === '待审核' ? 'processing' : 'error'}>{value}</Tag> },
    { title: '处理', key: 'action', width: 130, render: () => <Button type="link" size="small" icon={<ArrowRight size={13} />} onClick={() => onNavigate('acceptance')}>{role === 'PMO' ? '去审核' : '去修改'}</Button> },
  ];
  const quoteColumns = [
    { title: '项目编号', dataIndex: 'projectNo', width: 140, render: value => <span className="todo-project-no">{value}</span> },
    { title: '项目名称', dataIndex: 'projectName', width: 220, render: (value, record) => <button className="todo-name-link" onClick={() => onNavigate(`quotation:${record.key}`)}><span className="todo-name-icon"><FileText size={14} /></span><span><strong>{value}</strong><small>{record.customer}</small></span></button> },
    { title: '当前处理', key: 'handling', width: 120, render: (_, record) => <Tag color={quoteStage(record) === '待审核' ? 'processing' : 'purple'}>{quoteHandling(record)}</Tag> },
    { title: '处理', key: 'action', width: 210, render: (_, record) => <Space size={6}>{role === 'PMO' && quoteStage(record) === '待审核' && <Button type="primary" size="small" icon={<CheckCircle2 size={13} />} onClick={() => approveQuote(record)}>直接通过</Button>}<Button type="link" size="small" icon={<ArrowRight size={13} />} onClick={() => onNavigate(`quotation:${record.key}`)}>{quoteStage(record) === '待签单' ? '登记签单' : quoteStage(record) === '待报价' ? '修改报价' : '查看详情'}</Button></Space> },
  ];
  const isPmo = role === 'PMO';
  const financeTodo = <Card variant="borderless" className="todo-work-card"><div className="todo-card-heading"><div><h2>待开票</h2><p>只显示财务需要确认开票的记录。立项、报价和验收待办不会进入财务待办。</p></div><Tag color={invoiceRows.length ? 'processing' : 'default'}>{invoiceRows.length ? `${invoiceRows.length} 条待处理` : '暂无待处理'}</Tag></div><Table rowKey="key" columns={invoiceColumns} dataSource={invoiceRows} pagination={false} scroll={{ x: 680 }} locale={{ emptyText: <Empty description="当前没有待开票记录" /> }} /></Card>;
  if (finance) return <div className="todo-page"><div className="todo-page-heading"><div><p className="eyebrow">MMOS 2.0 · 工作提醒</p><h1>待办列表</h1><p className="subtitle">财务只接收开票待办，不接收立项、报价和验收待办。</p></div><div className="todo-role-chip"><UserRound size={14} /> 演示身份 <Select size="small" value={role} onChange={onRoleChange} options={[{ value: 'PMO', label: 'PMO · 林晓彤' }, { value: 'PM', label: 'PM · 王然' }, { value: '财务', label: '财务 · 赵敏' }]} /></div></div><div className="todo-stat-row"><Card bordered={false}><div className="todo-stat"><span className="todo-stat-icon"><ClipboardCheck size={17} /></span><span><small>待开票</small><strong>{invoiceRows.length}</strong></span></div></Card></div>{financeTodo}</div>;
  return <div className="todo-page"><div className="todo-page-heading"><div><p className="eyebrow">MMOS 2.0 · 工作提醒</p><h1>待办列表</h1><p className="subtitle">{isPmo ? 'PMO 需要处理的项目立项申请会自动出现在这里。' : '这里显示当前项目经理需要补充或重新提交的申请。'}</p></div><div className="todo-role-chip"><UserRound size={14} /> 演示身份 <Select size="small" value={role} onChange={onRoleChange} options={[{ value: 'PMO', label: 'PMO · 林晓彤' }, { value: 'PM', label: 'PM · 王然' }, { value: '财务', label: '财务 · 赵敏' }]} /></div></div><div className="todo-stat-row"><Card bordered={false}><div className="todo-stat"><span className="todo-stat-icon"><ClipboardCheck size={17} /></span><span><small>{isPmo ? '待审核立项申请' : '我的待办申请'}</small><strong>{rows.length}</strong></span></div></Card><Card bordered={false}><div className="todo-stat"><span className="todo-stat-icon blue"><ShieldCheck size={17} /></span><span><small>处理权限</small><strong>{isPmo ? 'PMO' : 'PM'}</strong></span></div></Card></div><Card bordered={false} className="todo-work-card"><div className="todo-card-heading"><div><h2>{isPmo ? '立项申请待审核' : '我的项目待办'}</h2><p>{isPmo ? '可从列表直接通过，也可以进入立项申请详情查看完整字段后处理。' : '审核不通过的申请需要修改后重新提交，草稿可以继续填写。'}</p></div><Tag color={rows.length ? 'processing' : 'default'}>{rows.length ? `${rows.length} 条待处理` : '暂无待处理'}</Tag></div><Table rowKey="key" columns={columns} dataSource={rows} pagination={{ pageSize: 8, showSizeChanger: false }} scroll={{ x: 900 }} locale={{ emptyText: <Empty description={isPmo ? '当前没有待审核的立项申请' : '当前没有需要处理的项目待办'} /> }} /></Card><Card variant="borderless" className="todo-work-card"><div className="todo-card-heading"><div><h2>报价待办</h2><p>{isPmo ? '待审核的报价可以直接通过。退回和字节签单需要进入详情填写。' : '退回的报价需要修改后重新提交；已立项且有项目计划的项目需要开始执行。'}</p></div><Tag color={quoteRows.length ? 'processing' : 'default'}>{quoteRows.length ? `${quoteRows.length} 条待处理` : '暂无待处理'}</Tag></div><Table rowKey="key" columns={quoteColumns} dataSource={quoteRows} pagination={false} scroll={{ x: 760 }} locale={{ emptyText: <Empty description="当前没有报价待办" /> }} /></Card><Card variant="borderless" className="todo-work-card"><div className="todo-card-heading"><div><h2>验收待办</h2><p>{isPmo ? '待审核的验收申请进入详情后通过或驳回。驳回必须填写原因。' : '被驳回或撤回的验收申请需要修改后重新提交，编号保持不变。'}</p></div><Tag color={acceptanceRows.length ? 'processing' : 'default'}>{acceptanceRows.length ? `${acceptanceRows.length} 条待处理` : '暂无待处理'}</Tag></div><Table rowKey="key" columns={acceptanceColumns} dataSource={acceptanceRows} pagination={false} scroll={{ x: 680 }} locale={{ emptyText: <Empty description="当前没有验收待办" /> }} /></Card></div>;
}
