import React from 'react';
import { Alert, Button, Card, Descriptions, Empty, Input, Modal, Select, Space, Table, Tabs, Tag, message } from 'antd';
import { CONTRACT_FIELDS, contractProjection } from '../data/financeContracts';
import { approvalPayment } from '../data/financeWorkspace';
import { FilePreview } from './FinanceFile';
const money = value => value == null ? '未提供' : `¥ ${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
const display = value => value == null || value === '' ? '未提供' : typeof value === 'boolean' ? value ? '是' : '否' : Array.isArray(value) ? value.map((item, index) => typeof item === 'object' ? <div key={index}>{item.name || item.text || '来源附件'} <FilePreview name={item.name} url={item.url} />{item.error && <small>{item.error}</small>}</div> : String(item)).reduce((all, item, index) => [...all, index > 0 ? '、' : '', item], []) : typeof value === 'object' ? value.text || value.name || JSON.stringify(value) : String(value);
export function FinanceContracts({ state }) {
  const [query, setQuery] = React.useState(''); const [type, setType] = React.useState(); const [status, setStatus] = React.useState(); const [selected, setSelected] = React.useState();
  const contracts = state.contracts.map(contractProjection);
  const rows = contracts.filter(row => (!type || row['合同类型'] === type) && (!status || row['合同状态'] === status) && (!query || [row['合同编号'], row['合同名称']].some(value => String(value || '').includes(query.trim()))));
  const groups = [ ['基本信息', [0, 1, 2, 3, 9]], ['合同文件', [4, 5, 6, 28]], ['日期期限', [10, 11, 12, 26, 33]], ['合同双方', [13, 14, 15, 16]], ['标的条款', [7, 8, 17, 18, 20, 21]], ['费用采购', [19, 34, 35, 36, 37, 38, 39]], ['负责人及记录信息', [22, 23, 24, 25]], ['识别复核信息', [27, 29, 30, 31, 32]] ];
  return <Card className="trial-work-card" variant="borderless">
    <Alert showIcon type="info" title="公司合同台账 · 只读" description={state.demoDataVersion ? '查询合同字段和附件。' : state.contractReadAt ? `最近成功读取：${state.contractReadAt}。每周更新。${state.contractReadError || ''}` : '等待接入公司合同管理系统的合同表。接入后每周更新；当前暂无成功读取数据。'} />
    <Space wrap style={{ margin: '20px 0' }}><Input.Search aria-label="搜索合同" placeholder="合同编号 / 合同名称" value={query} onChange={event => setQuery(event.target.value)} allowClear style={{ width: 280 }} /><Select aria-label="合同类型" allowClear placeholder="全部合同类型" value={type} onChange={setType} options={[...new Set(contracts.map(row => row['合同类型']).filter(Boolean))].map(value => ({ value, label: value }))} style={{ width: 180 }} /><Select aria-label="合同状态" allowClear placeholder="全部合同状态" value={status} onChange={setStatus} options={[...new Set(contracts.map(row => row['合同状态']).filter(Boolean))].map(value => ({ value, label: value }))} style={{ width: 160 }} /><Tag>{rows.length} 份合同</Tag></Space>
    <Table rowKey="key" dataSource={rows} scroll={{ x: 1800 }} locale={{ emptyText: <Empty description="暂无合同读取记录" /> }} columns={['合同编号', '合同名称', '合同类型', '甲方名称', '乙方名称', '合同状态', '签订日期', '合同开始日期', '合同到期日期', '合同总金额', '负责人'].map(label => ({ title: label, dataIndex: label, width: 160, render: (value, row) => label === '合同名称' ? <Button type="link" onClick={() => setSelected(row)}>{display(value)}</Button> : display(value) }))} onRow={row => ({ onClick: () => setSelected(row) })} />
    <Modal title={selected?.['合同名称'] || '合同详情'} open={Boolean(selected)} onCancel={() => setSelected(null)} width={1000} footer={<Button onClick={() => setSelected(null)}>关闭</Button>}><Tabs items={groups.map(([title, indexes]) => ({ key: title, label: title, children: <Descriptions bordered column={1} items={indexes.map(index => ({ key: CONTRACT_FIELDS[index], label: CONTRACT_FIELDS[index], children: display(selected?.[CONTRACT_FIELDS[index]]) }))} /> }))} /></Modal>
  </Card>;
}
export function FinanceApprovals({ state, commit }) {
  const [type, setType] = React.useState('项目付款'); const [selected, setSelected] = React.useState(); const [invoiceNo, setInvoiceNo] = React.useState('');
  const rows = state.approvals.map(row => ({ ...row, ...approvalPayment(row, state.journal) })); const detail = rows.find(row => row.key === selected);
  const confirm = () => {
    const value = invoiceNo.trim();
    if (!value || ['待识别', '待补充'].includes(value)) return message.error('请填写真实发票号码');
    if (rows.some(row => row.key !== selected && row.reimbursementInvoiceNo === value)) return message.error('该发票已关联其他报销，不能重复确认');
    commit({ ...state, approvals: state.approvals.map(row => row.key === selected ? { ...row, reimbursementInvoiceNo: value, invoiceConfirmed: true } : row) }, '确认报销发票号码');
  };
  return <Card className="trial-work-card" variant="borderless"><Alert showIcon type="info" title="飞书来源只读，实际付款由日记账或结算完成回填" description={state.demoDataVersion ? '查询审批及付款关联，核对报销票号。' : state.approvalReadAt ? `最近读取：${state.approvalReadAt}` : '飞书审批读取接口待接入。未取得来源数据时不生成审批或付款结果。'} />
    <Tabs activeKey={type} onChange={setType} items={['项目付款', '费用报销', '对公付款', '借款'].map(value => ({ key: value, label: value }))} />
    <Table rowKey="key" dataSource={rows.filter(row => row.type === type)} scroll={{ x: 1500 }} locale={{ emptyText: <Empty description={`暂无${type}记录`} /> }} columns={[{ title: '项目名称', dataIndex: 'projectName' }, { title: '项目编号', dataIndex: 'projectNo' }, { title: '审批编号', dataIndex: 'sourceId' }, { title: '审批结论', dataIndex: 'result' }, { title: '审批金额', dataIndex: 'amount', align: 'right', render: money }, { title: '已付', dataIndex: 'paid', align: 'right', render: money }, { title: '未付', dataIndex: 'unpaid', align: 'right', render: money }, { title: '实付差额', dataIndex: 'difference', align: 'right', render: money }, { title: '付款状态', dataIndex: 'paymentStatus' }, { title: '成本归集', dataIndex: 'cost', render: value => value ? '已归集' : '未归集' }, { title: '读取状态', dataIndex: 'status' }, { title: '操作', render: (_, row) => <Button type="link" onClick={() => { setSelected(row.key); setInvoiceNo(row.reimbursementInvoiceNo || ''); }}>详情</Button> }]} />
    <Modal title="审批来源与付款详情" open={Boolean(detail)} onCancel={() => setSelected(null)} width={850} footer={<Button onClick={() => setSelected(null)}>关闭</Button>}><Descriptions bordered column={2} items={Object.entries({ 审批编号: detail?.sourceId, 审批类型: detail?.type, 审批结论: detail?.result, 审批金额: money(detail?.amount), 申请内容: detail?.content, 项目匹配: detail?.projectMatchResult, 已付金额: money(detail?.paid), 未付金额: money(detail?.unpaid), 读取时间: detail?.readAt, 读取异常: detail?.readError, 附件: detail?.attachments }).map(([label, value]) => ({ key: label, label, children: display(value) }))} />
      {detail?.type === '费用报销' && <div style={{ marginTop: 20 }}><p>报销发票：{detail.invoiceConfirmed ? '已确认' : detail.ocrError || '待识别 / 核对'}</p><Space><Input aria-label="报销发票号码" value={invoiceNo} onChange={event => setInvoiceNo(event.target.value)} placeholder="真实发票号码" /><Button onClick={confirm}>确认发票号码</Button></Space></div>}
      <h3>实际付款关联</h3><Table rowKey="key" pagination={false} dataSource={state.journal.flatMap(entry => (entry.allocations || []).filter(link => link.target === selected || link.approvalKey === selected).map((link, index) => ({ ...link, key: `${entry.key}:${index}`, date: entry.date, summary: entry.summary })))} columns={[{ title: '实际付款日期', dataIndex: 'date' }, { title: '摘要', dataIndex: 'summary' }, { title: '分配金额', dataIndex: 'amount', align: 'right', render: money }]} />
    </Modal>
  </Card>;
}
