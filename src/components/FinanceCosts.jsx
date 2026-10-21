import React from 'react';
import { Alert, Button, Card, Empty, InputNumber, Modal, Select, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { readArray, costProjection } from '../data/financeWorkspace';
import { applyCostBatch, quarterMonths } from '../data/financeCosts';

export function FinanceCosts({ state, role, commit }) {
  const positions = [...readArray('mmos.hr.positions.v1'), ...(state.demoPositions || [])];
  const [year, setYear] = React.useState(dayjs().year());
  const [quarter, setQuarter] = React.useState(Math.floor(dayjs().month() / 3) + 1);
  const [month, setMonth] = React.useState(); const [ids, setIds] = React.useState([]);
  const [selected, setSelected] = React.useState([]); const [mode, setMode] = React.useState('');
  const [edits, setEdits] = React.useState([]); const [batch, setBatch] = React.useState();
  const [results, setResults] = React.useState([]);
  const editable = role === '财务'; const months = quarterMonths(year, quarter);
  const rows = costProjection(state.costs, role, dayjs().format('YYYY-MM')).filter(row => !editable || ((month ? row.month === month : months.includes(row.month)) && (!ids.length || ids.includes(row.positionId))));
  const begin = (type, targets) => {
    setBatch(undefined); setMode(type);
    setEdits(type === 'add' ? ids.flatMap(id => months.map(month => ({ key: `${id}:${month}`, positionId: id, position: positions.find(item => item.key === id)?.name, month, daily: null }))) : targets.map(row => ({ ...row, original: row.daily })));
  };
  const save = () => {
    const output = applyCostBatch(state.costs, edits, mode, positions);
    if (commit({ ...state, costs: output.rows, costResults: output.results }, `职位成本${mode}：${output.results.filter(row => row.success).length} 条成功`)) { setResults(output.results); setMode(''); setSelected([]); }
  };
  const cols = [{ title: '职位', dataIndex: 'position' }, { title: '月份', dataIndex: 'month' }, { title: '整日成本', dataIndex: 'daily' }, { title: '小时成本', render: (_, row) => row.daily == null ? '待补充' : (row.daily / 8).toFixed(2) }];
  return <Card className="trial-work-card" variant="borderless">
    {editable && <><Alert type="info" showIcon title={state.demoDataVersion ? '含模拟职位字典 · 仅供测试，真实人事接口待接入' : positions.length ? '职位选项来自人事职位管理' : '人事职位管理尚未接入，暂无可新增的职位选项'} description="成本按职位和月份保存。人员成本重算等待有效工作量及人事职位数据接入。" />
      <Space wrap style={{ margin: '20px 0' }}><InputNumber aria-label="成本年份" value={year} min={2000} max={2100} onChange={value => { if (value) { setYear(value); setMonth(undefined); } }} /><Select aria-label="成本季度" value={quarter} options={[1, 2, 3, 4].map(value => ({ value, label: `第 ${value} 季度` }))} onChange={value => { setQuarter(value); setMonth(undefined); }} /><Select aria-label="成本月份" allowClear placeholder="季度全部月份" value={month} options={months.map(value => ({ value, label: value }))} onChange={setMonth} style={{ width: 155 }} /><Select aria-label="人事职位" mode="multiple" placeholder="选择人事职位" value={ids} onChange={setIds} options={positions.map(item => ({ value: item.key, label: item.name }))} style={{ minWidth: 220 }} /><Button type="primary" disabled={!ids.length} onClick={() => begin('add')}>季度批量新增</Button><Button disabled={!selected.length} onClick={() => begin('edit', state.costs.filter(row => selected.includes(row.key)))}>修改所选</Button><Button danger disabled={!selected.length} onClick={() => begin('delete', state.costs.filter(row => selected.includes(row.key)))}>删除所选</Button></Space></>}
    {!editable && <Tag>本月 · {dayjs().format('YYYY-MM')} · 只读</Tag>}
    <Table rowKey="key" rowSelection={editable ? { selectedRowKeys: selected, onChange: setSelected } : undefined} dataSource={rows} columns={editable ? [...cols, { title: '操作', render: (_, row) => <Button type="link" onClick={() => begin('edit', [row])}>修改本月</Button> }] : cols} locale={{ emptyText: <Empty description="暂无对应月份成本，缺失不按 0 计算" /> }} />
    {results.length > 0 && <><h3>最近批次结果</h3><Table rowKey="key" size="small" dataSource={results} columns={[...cols.slice(0, 2), { title: '结果', dataIndex: 'result', render: (value, row) => <Tag color={row.success ? 'success' : 'error'}>{value}</Tag> }]} /></>}
    <Modal title={mode === 'delete' ? '确认删除所选职位月份成本' : '核对季度 / 月度成本明细'} open={Boolean(mode)} width={760} onCancel={() => setMode('')} onOk={save} okText={mode === 'delete' ? '确认删除' : '保存所选明细'}>
      {mode === 'delete' ? <p>仅删除下列成本参数；人员、职位、出勤及工时保留。对应月份将显示成本缺失。</p> : <Space style={{ marginBottom: 16 }}><InputNumber aria-label="统一整日成本" placeholder="统一整日成本" min={0} value={batch} onChange={setBatch} /><Button disabled={batch == null} onClick={() => setEdits(edits.map(row => ({ ...row, daily: batch })))}>填入下列明细</Button></Space>}
      <Table rowKey="key" pagination={false} dataSource={edits} columns={[...cols.slice(0, 2), { title: '原值', dataIndex: 'original', render: value => value ?? '未设置' }, { title: '新值', render: (_, row) => mode === 'delete' ? '删除后缺失' : <InputNumber aria-label={`${row.position} ${row.month} 成本`} min={0} value={row.daily} onChange={value => setEdits(edits.map(item => item.key === row.key ? { ...item, daily: value } : item))} /> }, { title: '范围', render: (_, row) => <Button type="link" onClick={() => setEdits(edits.filter(item => item.key !== row.key))}>不处理此月</Button> }]} />
    </Modal>
  </Card>;
}
