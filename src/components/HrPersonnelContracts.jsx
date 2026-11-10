import React from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Empty, Form, Input, Modal, Select, Space, Statistic, Table, Tabs, Tag, message } from 'antd';
import { DownloadOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getHrContractsView, hrAction } from '../data/hrWorkspace';
import { CONTRACT_TYPES, safeContractFile } from '../data/hrPersonnelContracts';
import { createContractZip } from '../data/contractZip';
import { LocalAttachment } from './HrIntakeForm';
import { useHrFeature } from './useHrFeature';
import HrDateField from './HrDateField';
import './hr-workspace.css';

const option = value => ({ label: value, value });
const shown = value => value === undefined || value === null || value === '' ? '未记录' : String(value);
const color = { 正在执行: 'success', 结束执行: 'default', 执行待核对: 'warning', 尚未进入执行: 'processing' };
const contractActions = { 'contract.add': '新增 / 历史补录', 'contract.correct': '台账更正', 'contract.terminate': '登记终止', 'contract.delete': '移入已删除', 'contract.restore': '恢复记录' };
const beijingInput = value => value && Number.isFinite(Date.parse(value)) ? new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(0, 19) : '';
function Execution({ value }) { return <Tag color={color[value.state]}>{value.state}</Tag>; }

export default function HrPersonnelContractsPage({ role }) {
  if (!['人事', 'HR', '财务'].includes(role)) return <Alert type="warning" showIcon title="当前角色无权进入人员合同管理" />;
  return <div className="hr-page"><div className="hr-page-heading"><div><p className="eyebrow">人事管理</p><h1>人员合同管理</h1><p className="subtitle">按人员归档合同与协议，追溯签署、期限、原件及变更记录。</p></div></div><HrPersonnelContractsPanel role={role} /></div>;
}

export function HrPersonnelContractsPanel({ role, personId, summaryRows }) {
  const { view, error, refresh } = useHrFeature(() => getHrContractsView(role, personId), [role, personId]);
  const [query, setQuery] = React.useState(''), [type, setType] = React.useState(), [signature, setSignature] = React.useState(), [execution, setExecution] = React.useState(), [tab, setTab] = React.useState('normal');
  const [selectedId, setSelectedId] = React.useState(''), [keys, setKeys] = React.useState([]);
  const [edit, setEdit] = React.useState(null), [operation, setOperation] = React.useState(null), [preview, setPreview] = React.useState(null);
  const [editError, setEditError] = React.useState(''), [busy, setBusy] = React.useState(false);
  const [form] = Form.useForm(), [actionForm] = Form.useForm();
  const values = Form.useWatch([], form) || {};
  const hr = ['人事', 'HR'].includes(role);
  React.useEffect(() => { setSelectedId(''); setKeys([]); setEdit(null); setOperation(null); setPreview(null); }, [role, personId]);
  const all = view?.rows || summaryRows || [];
  const selected = all.find(row => row.id === selectedId);
  const rows = all.filter(row => row.deleted === (tab === 'deleted') && (!query || `${row.name} ${row.employeeNo} ${row.number}`.toLowerCase().includes(query.trim().toLowerCase())) &&
    (!type || row.type === type) && (!signature || row.signatureState === signature) && (!execution || row.execution.state === execution));
  const normal = all.filter(row => !row.deleted);
  React.useEffect(() => {
    if (!edit) return;
    const row = edit.row;
    form.resetFields();
    form.setFieldsValue(row ? { ...row, signed: row.signatureState === '签署完成' ? 'yes' : row.signatureState === '签署未完成' ? 'no' : undefined, signedAt: beijingInput(row.signedAt), file: undefined, reason: '' } : { personId, termType: '固定期限' });
  }, [edit, form, personId]);
  React.useEffect(() => { if (operation) actionForm.resetFields(); }, [operation, actionForm]);
  const openEdit = row => { setEditError(''); setEdit({ row, revision: view.revision }); };
  const save = async () => {
    try {
      const input = await form.validateFields();
      const signedAt = input.signedAt ? input.signedAt === beijingInput(edit.row?.signedAt) ? edit.row.signedAt : `${input.signedAt.length === 16 ? `${input.signedAt}:00` : input.signedAt}+08:00` : '';
      hrAction(role, edit.row ? 'contract.correct' : 'contract.add', { ...input, signed: input.signed === 'yes' ? true : input.signed === 'no' ? false : null, signedAt, id: edit.row?.id, expectedVersion: edit.row?.version, expectedRevision: edit.revision });
      setEdit(null); setEditError(''); refresh(); message.success('合同台账已保存，执行状态已重新核对');
    } catch (failure) { setEditError(failure.message || '请检查必填项'); }
  };
  const openOperation = (row, type) => { setEditError(''); setOperation({ row, type, revision: view.revision }); };
  const applyOperation = async () => {
    try {
      const input = await actionForm.validateFields();
      hrAction(role, `contract.${operation.type}`, { ...input, id: operation.row.id, expectedVersion: operation.row.version, expectedRevision: operation.revision });
      setOperation(null); refresh(); message.success(operation.type === 'delete' ? '合同已移入已删除，可恢复' : operation.type === 'restore' ? '合同已恢复' : '终止依据已保存');
    } catch (failure) { setEditError(failure.message || '请检查必填项'); }
  };
  const previewFile = (row, file = row.files?.at(-1)) => {
    if (!row.canPreview) return message.warning('当前账号不具备该原件所含敏感资料查看权限');
    const safe = safeContractFile(file);
    if (!safe) return message.warning('合同原件尚未归档，请查看缺件原因');
    setPreview({ file: safe, number: row.number, id: row.id });
  };
  const exportFiles = async () => {
    setBusy(true);
    try {
      const current = getHrContractsView(role, personId);
      if (!current.canManage) throw new Error('仅人事可以导出人员合同');
      const requested = current.rows.filter(row => keys.includes(row.id) && !row.deleted);
      if (!requested.length) throw new Error('请先选择要导出的合同');
      const files = [], missing = [];
      for (const row of requested) {
        const source = safeContractFile(row.files?.at(-1));
        try {
          if (!source) throw new Error(row.archiveError || '最终签署PDF尚未归档');
          const response = await fetch(source.data || source.url);
          if (!response.ok) throw new Error('原件读取失败');
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('文件不是有效PDF原件');
          files.push({ name: `${row.employeeNo}_${row.number || row.id}_v${source.version || 1}_${files.length + 1}.pdf`, bytes });
        } catch (failure) { missing.push({ employeeNo: row.employeeNo, number: row.number || '合同编号缺失', id: row.id, reason: failure.message }); }
      }
      const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
      files.push({ name: '导出索引及缺件清单.csv', bytes: '\ufeff' + [
        ['员工编号', '合同编号', '记录标识', '结果', '说明'],
        ...requested.map(row => { const failure = missing.find(item => item.id === row.id); return [row.employeeNo, row.number, row.id, failure ? '缺件' : '已导出', failure?.reason || `记录版本${row.version}`]; }),
      ].map(row => row.map(csvCell).join(',')).join('\r\n') });
      hrAction(role, 'contract.export', { selection: requested.map(row => ({ id: row.id, version: row.version })), missing, successCount: files.length - 1, expectedRevision: current.revision });
      const url = URL.createObjectURL(createContractZip(files));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `人员合同_${dayjs().format('YYYYMMDD_HHmmss')}.zip`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (files.length === 1) message.warning('未取得合同文件，已提供全部缺件原因清单');
      else message.success(`已导出${files.length - 1}份原件${missing.length ? `，另有${missing.length}项缺件` : ''}`);
    } catch (failure) { message.error(failure.message || '导出失败，请重试'); }
    finally { setBusy(false); }
  };
  const columns = [
    ...(!personId ? [{ title: '人员', key: 'person', width: 150, fixed: 'left', render: (_, row) => <>{row.name}<span className="hr-cell-note">{row.employeeNo}</span></> }] : []),
    { title: '合同 / 协议', key: 'contract', width: 190, render: (_, row) => <><strong>{row.type}</strong><span className="hr-cell-note">{row.number || '合同编号待补齐'}</span></> },
    { title: '执行状态', key: 'execution', width: 135, render: (_, row) => <Execution value={row.execution} /> },
    { title: '签署情况', dataIndex: 'signatureState', width: 125, render: value => <Tag color={value === '签署完成' ? 'success' : 'default'}>{value}</Tag> },
    { title: '合同期限', key: 'term', width: 225, render: (_, row) => <>{row.startDate || '开始日待核对'} 至 {row.termType === '无固定期限' ? '无固定期限' : row.endDate || '结束日待核对'}</> },
    { title: '原件归档', dataIndex: 'archiveState', width: 120, render: value => <Tag color={value === '已归档' ? 'success' : 'warning'}>{value}</Tag> },
    { title: '来源', dataIndex: 'source', width: 155 },
    { title: '操作', key: 'actions', fixed: 'right', width: hr ? 170 : 110, render: (_, row) => <Space size={0}><Button type="link" size="small" onClick={() => setSelectedId(row.id)}>详情</Button>{hr && <Button type="link" size="small" onClick={() => row.deleted ? openOperation(row, 'restore') : openEdit(row)}>{row.deleted ? '恢复' : '维护'}</Button>}</Space> },
  ];
  return <div className="hr-contract-panel">
    {!personId && <div className="hr-mini-stats">{[['正常合同', normal.length], ['正在执行', normal.filter(row => row.execution.state === '正在执行').length], ['执行待核对', normal.filter(row => row.execution.state === '执行待核对').length], ['原件缺件', normal.filter(row => row.archiveState !== '已归档').length]].map(([title, value]) => <Card key={title}><Statistic title={title} value={value} /></Card>)}</div>}
    {error && <Alert type="error" showIcon title={error} action={<Button onClick={refresh}>重试</Button>} />}
    <Card className="hr-table-card">
      <div className="hr-card-heading"><div><h2>合同与协议 <span>{rows.length} 份</span></h2><p>每份独立判断，同一人员允许多份正在执行。</p></div><Space wrap><Button icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>{hr && <><Button icon={<DownloadOutlined />} disabled={!keys.length || tab === 'deleted'} loading={busy} onClick={exportFiles}>导出选中原件</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit(null)}>新增 / 历史补录</Button></>}</Space></div>
      {hr && <Tabs activeKey={tab} onChange={value => { setTab(value); setKeys([]); }} items={[{ key: 'normal', label: '正常记录' }, { key: 'deleted', label: '已删除记录' }]} />}
      <div className="hr-filter-grid"><Input allowClear aria-label="搜索人员合同" placeholder="姓名 / 员工编号 / 合同编号" value={query} onChange={event => setQuery(event.target.value)} /><Select allowClear placeholder="全部合同类型" aria-label="筛选人员合同类型" value={type} onChange={setType} options={CONTRACT_TYPES.map(option)} /><Select allowClear placeholder="全部签署情况" aria-label="筛选合同签署情况" value={signature} onChange={setSignature} options={['签署完成', '签署未完成', '签署待核对'].map(option)} /><Select allowClear placeholder="全部执行状态" aria-label="筛选合同执行状态" value={execution} onChange={setExecution} options={Object.keys(color).map(option)} /><Button onClick={() => { setQuery(''); setType(undefined); setSignature(undefined); setExecution(undefined); }}>重置筛选</Button></div>
      <Table rowKey="id" columns={columns} dataSource={rows} loading={!view && !error} rowClassName={row => row.execution.state === '正在执行' ? 'hr-contract-active' : ''} rowSelection={hr && tab === 'normal' ? { selectedRowKeys: keys, onChange: setKeys, preserveSelectedRowKeys: true } : undefined} scroll={{ x: personId ? 1190 : 1340 }} pagination={{ pageSize: 8, showSizeChanger: true, showTotal: total => `共${total}份合同` }} locale={{ emptyText: <Empty description="暂无符合条件的合同" /> }} />
    </Card>
    {!personId && hr && <Card className="hr-contract-readiness" title="单份入职合同自动发起条件"><p className="hr-muted">企业飞书账号实际激活且该份合同资料齐全后触发；真实模板、主体、变量及法大大服务待接入。</p><Table rowKey="personId" size="small" dataSource={view?.readiness || []} pagination={{ pageSize: 5 }} columns={[{ title: '人员', dataIndex: 'name' }, { title: '当前状态', dataIndex: 'state' }, { title: '现有任务', dataIndex: 'taskId', render: shown }, { title: '条件核验', dataIndex: 'reasons', render: values => values.join('；') || '等待服务端校验发起' }]} /></Card>}
    <Drawer title="人员合同详情" open={!!selected} onClose={() => setSelectedId('')} size={960} destroyOnHidden>
      {selected && <><Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} items={[
        ['人员', `${selected.name} · ${selected.employeeNo}`], ['合同类型', selected.type], ['合同编号', selected.number], ['执行状态', <Execution value={selected.execution} />], ['合同形式', selected.form], ['合同归属', selected.owner],
        ['签署情况', selected.signatureState], ['实际签署完成时间', selected.signedAt], ['期限类型', selected.termType], ['合同期间', `${selected.startDate || '待核对'} 至 ${selected.termType === '无固定期限' ? '无固定期限' : selected.endDate || '待核对'}`],
        ['签署任务标识', selected.taskId], ['原件归档', selected.archiveState], ['记录来源', selected.source], ['记录版本', selected.version], ['判定依据', selected.execution.explanation], ['结束前最后有效日', selected.execution.endedOn],
      ].map(([label, children]) => ({ key: label, label, children: children || '未记录' }))} />
        {!!selected.execution.endings.length && <div className="hr-contract-facts"><h3>结束事实</h3>{selected.execution.endings.map((fact, index) => <p key={index}>{fact.reason} · {fact.date}起结束执行{fact.contractId ? ` · 新合同 ${all.find(row => row.id === fact.contractId)?.number || fact.contractId}` : ''}</p>)}</div>}
        <Space wrap style={{ margin: '20px 0' }}><Button disabled={!selected.canPreview || selected.archiveState !== '已归档'} onClick={() => previewFile(selected)}>查看合同原件</Button>{hr && !selected.deleted && <><Button onClick={() => openEdit(selected)}>依据原件更正 / 补充附件</Button><Button onClick={() => openOperation(selected, 'terminate')}>登记提前终止</Button><Button danger onClick={() => openOperation(selected, 'delete')}>移入已删除</Button></>}{hr && selected.deleted && <Button onClick={() => openOperation(selected, 'restore')}>恢复记录</Button>}</Space>
        {!selected.canPreview && <Alert type="info" title="原件仅限人事或取得业务及对应敏感资料授权的财务查看" />}
        {selected.archiveError && <Alert type="warning" title={selected.archiveError} />}
        {selected.canPreview && <><h3>原件版本</h3><Table rowKey={row => row.version || `${row.name}:${row.at}`} size="small" dataSource={selected.files || []} pagination={false} columns={[{ title: '版本', dataIndex: 'version' }, { title: '文件', dataIndex: 'name' }, { title: '归档时间', dataIndex: 'at' }, { title: '依据', dataIndex: 'source' }, { title: '操作', render: (_, row) => <Button type="link" onClick={() => previewFile(selected, row)}>查看</Button> }]} /></>}
        {hr && <><h3>维护记录</h3><Table rowKey={row => `${row.at}:${row.version}:${row.type}`} size="small" dataSource={selected.history || []} locale={{ emptyText: '暂无维护记录' }} pagination={{ pageSize: 5 }} columns={[{ title: '时间', dataIndex: 'at' }, { title: '操作人', dataIndex: 'actor' }, { title: '操作', dataIndex: 'type', render: value => contractActions[value] || value }, { title: '依据', dataIndex: 'reason' }, { title: '原值', render: (_, row) => row.before ? `${row.before.number || '编号缺失'} · ${row.before.startDate || '日期缺失'} 至 ${row.before.endDate || row.before.termType || '日期缺失'}` : '首次登记' }]} /></>}
      </>}
    </Drawer>
    <Modal title={edit?.row ? '依据真实材料更正合同台账' : '新增或补录人员合同'} width={800} open={!!edit} onCancel={() => setEdit(null)} onOk={save} okText="保存台账" destroyOnHidden>
      <p className="hr-muted">登记已有合同及真实材料。合同条款变更须另签新合同或补充协议；资料缺失可保留待核对。</p>
      {editError && <Alert type="error" title={editError} style={{ marginBottom: 12 }} />}
      <Form form={form} layout="vertical"><div className="hr-form-columns">
        <Form.Item name="personId" label="关联人员" rules={[{ required: true, message: '请选择人员' }]}><Select showSearch optionFilterProp="label" disabled={!!edit?.row || !!personId} options={(view?.people || []).map(person => ({ value: person.id, label: `${person.name} · ${person.employeeNo}` }))} /></Form.Item>
        <Form.Item name="type" label="合同或协议类型"><Select allowClear options={CONTRACT_TYPES.map(option)} /></Form.Item>
        <Form.Item name="number" label="合同编号"><Input /></Form.Item><Form.Item name="form" label="合同形式"><Select allowClear options={['电子合同', '纸质合同'].map(option)} /></Form.Item>
        <Form.Item name="owner" label="合同归属"><Input /></Form.Item><Form.Item name="termType" label="期限类型"><Select allowClear options={['固定期限', '无固定期限'].map(option)} onChange={value => { if (value === '无固定期限') form.setFieldValue('endDate', ''); }} /></Form.Item>
        <Form.Item name="startDate" label="合同开始日期"><HrDateField /></Form.Item><Form.Item name="endDate" label="合同结束日期"><HrDateField disabled={values.termType === '无固定期限'} /></Form.Item>
        <Form.Item name="signed" label="材料记载的签署情况"><Select options={[{ value: 'yes', label: '已完成全部签署' }, { value: 'no', label: '尚未完成全部签署' }]} allowClear placeholder="签署事实待核对" /></Form.Item>
        <Form.Item name="signedAt" label="实际签署完成时间（北京时间）" rules={values.signed === 'yes' ? [{ required: true, message: '请填写真实签署完成时间' }] : []}><HrDateField time /></Form.Item>
      </div>
        {values.termType === '无固定期限' && <Form.Item name="openEndedEvidence" label="原文无固定期限依据"><Input.TextArea rows={2} /></Form.Item>}
        <Form.Item name="replacesId" label="续签所替代的原合同" extra="新合同已签且进入有效期后，从约定开始日替代；补签保留真实签署时间。"><Select allowClear showSearch optionFilterProp="label" options={all.filter(row => row.personId === (edit?.row?.personId || values.personId) && row.id !== edit?.row?.id).map(row => ({ value: row.id, label: `${row.type} · ${row.number || row.id}` }))} /></Form.Item>
        <Form.Item name="file" label="合同PDF原件" extra="补充或纠正附件会形成新版本，原版本继续保留。"><LocalAttachment pdf /></Form.Item>
        <Form.Item name="reason" label="真实合同或材料依据" rules={[{ required: true, whitespace: true, message: '请填写材料依据' }]}><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Modal>
    <Modal title={{ delete: '移入已删除记录', restore: '恢复合同记录', terminate: '登记提前终止' }[operation?.type]} open={!!operation} onCancel={() => setOperation(null)} onOk={applyOperation} destroyOnHidden okText="确认保存">
      <p>{operation?.type === 'delete' ? '记录移入可恢复列表，原件、签署、终止和替代历史持续保留。' : operation?.type === 'terminate' ? '依据已确认材料登记，从生效日北京时间00:00结束执行。' : '恢复台账可见状态，执行状态按已保存的全部业务事实重新计算。'}</p>
      <Form form={actionForm} layout="vertical">{operation?.type === 'terminate' && <Form.Item name="date" label="终止生效日期" rules={[{ required: true }]}><HrDateField /></Form.Item>}<Form.Item name="reason" label="材料或业务依据" rules={[{ required: true, whitespace: true, message: '请填写依据' }]}><Input.TextArea rows={3} /></Form.Item></Form>{editError && <Alert type="error" title={editError} />}
    </Modal>
    <Modal title={`合同原件 · ${preview?.number || '编号待补齐'}`} open={!!preview && !!all.find(row => row.id === preview.id)?.canPreview} onCancel={() => setPreview(null)} width={1000} footer={<Button onClick={() => setPreview(null)}>关闭</Button>} destroyOnHidden>
      {preview && <iframe title="人员合同PDF原件" src={`${preview.file.data || preview.file.url}#toolbar=${hr ? 1 : 0}&navpanes=0`} className="hr-contract-pdf" />}
    </Modal>
  </div>;
}
