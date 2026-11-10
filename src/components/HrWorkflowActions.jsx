import React from 'react';
import { Alert, Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, message } from 'antd';
import { getHrView, hrAction, isHrReferenceActive } from '../data/hrWorkspace';

export function AssignmentFields({ view, form, required = false, disabled = false }) {
  const department = Form.useWatch('departmentId', form);
  const rules = required ? [{ required: true, message: '请补齐任职信息' }] : [];
  return <div className="hr-form-columns">
    <Form.Item name="departmentId" label="所属部门" rules={rules}>
      <Select disabled={disabled} allowClear showSearch optionFilterProp="label" options={(view.departments || []).filter(item => item.status === '启用').map(item => ({ value: item.id, label: item.name }))} onChange={() => form.setFieldValue('positionId', undefined)} />
    </Form.Item>
    <Form.Item name="positionId" label="岗位" rules={rules}>
      <Select disabled={disabled} allowClear showSearch optionFilterProp="label" options={(view.positions || []).filter(item => isHrReferenceActive(item) && (!department || item.departmentId === department)).map(item => ({ value: item.id, label: item.name }))} />
    </Form.Item>
    <Form.Item name="locationId" label="工作地点" rules={rules}>
      <Select disabled={disabled} allowClear showSearch optionFilterProp="label" options={(view.locations || []).filter(item => isHrReferenceActive(item)).map(item => ({ value: item.id, label: item.name }))} />
    </Form.Item>
    <Form.Item name="manager" label="直属经理" rules={rules}><Input disabled={disabled} /></Form.Item>
  </div>;
}

export function SubsidyDetails({ person, audit = [] }) {
  const history = audit.filter(row => row.objectId === person.id && row.type === 'training.update' && (row.before?.subsidyAmount != null || row.after?.subsidyAmount != null));
  const fields = [
    ['形成依据', person.subsidySource || person.subsidyReason || '尚未生成'],
    ['实际补贴天数', person.subsidyDays == null ? '缺少天数' : `${person.subsidyDays} 天`],
    ['单价', '80元/天'],
    ['应发金额', person.subsidyAmount == null ? '尚未生成' : `¥${Number(person.subsidyAmount).toFixed(2)}`],
    ['生成结果', person.subsidyStatus || (person.subsidyAmount == null ? '尚未生成' : '已生成应发')],
    ['更新时间', person.subsidyUpdatedAt || '暂无更新'],
  ];
  return <Card size="small" title="培训补贴结果" style={{ marginTop: 16 }}>
    <Descriptions size="small" column={2} items={fields.map(([label, children]) => ({ key: label, label, children }))} />
    {person.subsidyReview && <Alert type="warning" title={person.subsidyReview} />}
    {history.length > 0 && <Table size="small" rowKey="id" pagination={{ pageSize: 5 }} dataSource={history} columns={[
      { title: '更新时间', dataIndex: 'at' }, { title: '操作人', dataIndex: 'actor' },
      { title: '天数变化', render: (_, row) => `${row.before?.subsidyDays ?? '暂无'} → ${row.after?.subsidyDays ?? '暂无'}` },
      { title: '应发金额变化', render: (_, row) => `${row.before?.subsidyAmount ?? '暂无'} → ${row.after?.subsidyAmount ?? '暂无'}` },
      { title: '更正依据', dataIndex: 'reason' },
    ]} />}
  </Card>;
}

export function SourceActions({ role, view, onSaved }) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState('');
  const [form] = Form.useForm();
  const revision = React.useRef();
  const run = async type => {
    try {
      const fields = type === 'source.supplement' ? await form.validateFields() : {};
      if (type === 'source.supplement' && !fields.name?.trim() && !fields.startDate && !fields.endDate) throw Error('请填写姓名或完整报到日期区间');
      hrAction(role, type, { ...fields, expectedRevision: type === 'source.supplement' ? revision.current : view.revision });
      onSaved?.();
      setError('');
      setOpen(false);
      message.success(type === 'source.supplement' ? '补采已处理，请查看逐条结果' : '已知记录已刷新');
    } catch (err) { if (err.message) setError(err.message); }
  };
  const results = view.sync?.lastResults || view.sync?.results || [];
  return <Card size="small" title="来源同步" style={{ marginBottom: 16 }}>
    <Space wrap>
      <Button onClick={() => run('source.refresh')}>刷新已知记录</Button>
      <Button onClick={() => { revision.current = view.revision; form.resetFields(); setError(''); setOpen(true); }}>人事补采</Button>
      <span>最近成功读取 {view.sync?.lastSuccess || '尚未读取'}</span>
      <span>{view.sync?.status}</span>
    </Space>
    {error && <Alert style={{ marginTop: 12 }} type="error" title={error} />}
    {results.length > 0 && <Table size="small" style={{ marginTop: 12 }} rowKey={(row, index) => row.sourceId || index} dataSource={results} pagination={{ pageSize: 5 }} columns={[
      { title: '源记录', dataIndex: 'sourceId' }, { title: '姓名', dataIndex: 'name' }, { title: '处理结果', render: (_, row) => row.result || row.status }, { title: '说明', render: (_, row) => row.reason || row.message || '—' },
    ]} />}
    <Modal title="按来源信息补采" open={open} onCancel={() => setOpen(false)} onOk={() => run('source.supplement')} okText="提交补采" destroyOnHidden>
      <p>姓名与报到日期至少填写一项，同时填写时取交集。</p>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="姓名"><Input /></Form.Item>
        <div className="hr-form-columns">
          <Form.Item name="startDate" label="报到开始日期"><Input type="date" /></Form.Item>
          <Form.Item name="endDate" label="报到结束日期"><Input type="date" /></Form.Item>
        </div>
      </Form>
      {error && <Alert type="error" title={error} />}
    </Modal>
  </Card>;
}

export function HistoryBackfill({ view, role, onSaved }) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState('');
  const [form] = Form.useForm();
  const revision = React.useRef();
  const save = async () => {
    try {
      const values = await form.validateFields();
      hrAction(role, 'history.backfill', { ...values, expectedRevision: revision.current });
      setOpen(false);
      onSaved?.();
      message.success('历史人员已核验补录');
    } catch (err) { if (err.message) setError(err.message); }
  };
  if (!['人事', 'HR'].includes(role)) return null;
  return <>
    <Button onClick={() => { revision.current = getHrView(role).revision; form.resetFields(); setError(''); setOpen(true); }}>历史人员补录</Button>
    <Modal title="历史人员补录" width={760} open={open} onCancel={() => setOpen(false)} onOk={save} okText="核验并补录" destroyOnHidden>
      <Alert type="info" title="补录上线前实际在职且缺失主库的人员，填写已核实的来源与真实历史日期。" style={{ marginBottom: 16 }} />
      {error && <Alert type="error" title={error} />}
      <Form form={form} layout="vertical">
        <div className="hr-form-columns">{[['name', '员工姓名'], ['employeeNo', '已核验MCE'], ['enterpriseAccount', '企业飞书账号']].map(([key, label]) => <Form.Item key={key} name={key} label={label} rules={[{ required: true, whitespace: true }]}><Input /></Form.Item>)}</div>
        <Form.Item name="sourceId" label="来源记录标识"><Input /></Form.Item>
        <AssignmentFields view={view} form={form} />
        <div className="hr-form-columns">
          <Form.Item name="entryDate" label="真实入职日期" rules={[{ required: true }]}><Input type="date" /></Form.Item>
          <Form.Item name="trainingStart" label="实际培训首日"><Input type="date" /></Form.Item>
        </div>
        <Form.Item name="sourceEvidence" label="身份、任职、账号及旧号的核验依据" rules={[{ required: true, whitespace: true }]}><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Modal>
  </>;
}
