import React from 'react';
import { Alert, Breadcrumb, Button, Card, Col, DatePicker, Descriptions, Empty, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tabs, Tag, Timeline, message } from 'antd';
import { ArrowLeft, Building2, CircleCheck, ContactRound, FolderKanban, History, Plus, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import dayjs from 'dayjs';
import { GROWTH, CUSTOMER_ROLES, CONTACT_ROLES, canManageCustomers, canEditCustomerProject, initializeCustomerMaster, readCustomerView, readContactCandidates, commitCustomerCommand, applicationContactCandidates } from '../data/customerMaster';
import './customer-master.css';

const roleOptions = CUSTOMER_ROLES.map(value => ({ value, label: value === GROWTH ? '客户增长与战略解决方案部' : `${value} · ${{ 财务: '赵敏', PMO: '林晓彤', PM: '王然' }[value]}` }));
const optional = value => value || <span className="cm-muted">未填写</span>;
const pending = value => value || <span className="cm-pending">待补充</span>;
const names = values => values?.length ? <div className="cm-names">{values.map((name, i) => <Tag key={`${name}-${i}`}>{name}</Tag>)}</div> : <span className="cm-muted">未填写</span>;
const actionLabels = { 'customer.save': '保存客户资料', 'customer.disable': '停用客户', 'customer.delete': '删除客户', 'contact.save': '保存联系人', 'project.save': '调整项目客户关联', 'visit.save': '保存拜访记录', 'recent.save': '维护最近拜访时间（历史操作）' };
const financeFields = [['taxNo', '纳税人识别号'], ['invoiceItemName', '项目名称（开票）'], ['taxCode', '产品和服务编码'], ['term', '账期（天）']];

export function useCustomerView(role) {
  const [state, setState] = React.useState(null), [error, setError] = React.useState('');
  const refresh = React.useCallback(() => {
    try { initializeCustomerMaster(); setState(readCustomerView(role)); setError(''); }
    catch (failure) { setState(null); setError(failure.message || '客户资料读取失败'); }
  }, [role]);
  React.useEffect(() => { refresh(); window.addEventListener('storage', refresh); window.addEventListener('mmos:finance-updated', refresh); window.addEventListener('mmos:initiation-updated', refresh); return () => { window.removeEventListener('storage', refresh); window.removeEventListener('mmos:finance-updated', refresh); window.removeEventListener('mmos:initiation-updated', refresh); }; }, [refresh]);
  return { state, error, refresh };
}

export function ApplicationCustomerFields({ form, record, editable = true }) {
  const customer = Form.useWatch('customer', form);
  const [candidates, setCandidates] = React.useState([]);
  React.useEffect(() => { const sync = () => setCandidates(applicationContactCandidates(customer)); sync(); window.addEventListener('mmos:finance-updated', sync); return () => window.removeEventListener('mmos:finance-updated', sync); }, [customer]);
  if (record?.status === '审核通过') return <Descriptions title="立项生效时客户关联" column={2} items={[{ key: 'type', label: '客户类型', children: optional(record.customerLinks?.customerType || record.customerType) }, ...Object.entries(CONTACT_ROLES).map(([key, label]) => ({ key, label, children: names(record.customerContactSnapshot?.[key]?.map(person => person.name)) }))]} />;
  return <><p className="cm-form-note">客户类型及三项联系人均为选填。每项可选择多人，同一人可以兼任多个角色。</p><Row gutter={12}><Col xs={24} sm={12}><Form.Item name="customerType" label="客户类型"><Select disabled={!editable} allowClear options={['直签', '转手'].map(value => ({ value, label: value }))} placeholder="未填写" /></Form.Item></Col>{Object.entries(CONTACT_ROLES).map(([key, label]) => <Col xs={24} sm={12} key={key}><Form.Item name={key} label={label}><Select disabled={!editable || !customer} mode="multiple" allowClear optionFilterProp="label" options={candidates} placeholder="从当前客户联系人中选择，可留空" /></Form.Item></Col>)}</Row></>;
}

export function CustomerMasterPage({ role = 'PMO', onRoleChange }) {
  return <CustomerMasterContent key={role} role={role} onRoleChange={onRoleChange} />;
}
function CustomerMasterContent({ role, onRoleChange }) {
  const { state, error, refresh } = useCustomerView(role);
  const [selected, setSelected] = React.useState(''), [tab, setTab] = React.useState('contacts');
  const [query, setQuery] = React.useState(''), [status, setStatus] = React.useState('all');
  const [contactQuery, setContactQuery] = React.useState(''), [projectQuery, setProjectQuery] = React.useState('');
  const [editor, setEditor] = React.useState(null), [contactKey, setContactKey] = React.useState(''), [history, setHistory] = React.useState(null);
  const manager = canManageCustomers(role), growth = role === GROWTH;
  const openEditor = (type, row = null, extra = {}) => setEditor({ type, row, revision: state.revision, ...extra });
  const commit = (command, revision = editor?.revision ?? state.revision) => {
    try { commitCustomerCommand(role, revision, command); refresh(); setEditor(null); message.success('已保存'); return true; }
    catch (failure) { message.error(failure.message || '保存失败，原数据保持不变'); return false; }
  };
  const header = <div className="cm-page-heading"><div><p className="eyebrow">客户 · 主数据</p><h1>客户主库</h1><p className="subtitle">统一客户档案，连接客户联系人、项目与每一次拜访。</p></div><div className="cm-identity"><ShieldCheck size={16} /><span>演示身份</span><Select aria-label="客户主库演示身份" value={role} options={roleOptions} onChange={onRoleChange} /></div></div>;
  if (!state) return <div className="cm-page">{header}{error ? <Alert type="error" showIcon title="客户主库暂时无法读取" description={error} action={<Button onClick={refresh}>重试</Button>} /> : <Card loading />}</div>;
  const customer = state.customers.find(row => row.key === selected);
  const contact = state.contacts.find(row => row.key === contactKey);
  const customerContacts = state.contacts.filter(row => row.customerKey === selected);
  const customerProjects = state.projects.filter(row => row.customerKey === selected);
  const data = state.customers.filter(row => (!query.trim() || [row.code, row.name, row.fullName].some(value => value?.toLowerCase().includes(query.trim().toLowerCase()))) && (!manager || status === 'all' || (status === 'active' ? row.active !== false : row.active === false)));
  const scope = role === 'PM' ? '联系人与关联项目仅显示本人项目范围' : growth ? '可维护客户、联系人、项目关联及拜访记录' : role === '财务' ? '可维护客户及开票资料，联系人与项目关联只读' : '客户基础资料只读，可维护管理范围内项目关联';
  const columns = [
    { title: '客户', key: 'name', fixed: 'left', width: 188, sorter: (a, b) => a.name.localeCompare(b.name, 'zh-CN'), render: (_, row) => <div className="cm-customer-cell"><span className="cm-company-icon"><Building2 size={18} /></span><div><Button type="link" onClick={() => { setSelected(row.key); setTab('contacts'); }}>{row.name}</Button><small>{row.code}</small></div></div> },
    { title: '客户全名', dataIndex: 'fullName', width: 280 },
    ...(manager ? financeFields.map(([key, title]) => ({ title, dataIndex: key, width: key === 'term' ? 100 : 205, render: value => key === 'term' ? value ?? '未设置' : pending(value) })) : []),
    { title: role === 'PM' ? '本人关联联系人' : '联系人', width: 110, render: (_, row) => state.contacts.filter(contact => contact.customerKey === row.key).length },
    { title: '可见项目', width: 100, render: (_, row) => state.projects.filter(project => project.customerKey === row.key).length },
    ...(manager ? [{ title: '入库时间', dataIndex: 'createdAt', width: 125, render: value => value ? dayjs(value).format('YYYY-MM-DD') : '—' }, { title: '状态', width: 95, render: (_, row) => <Tag color={row.active === false ? 'default' : 'success'}>{row.active === false ? '已停用' : '启用'}</Tag> }] : []),
    { title: '操作', fixed: 'right', width: 90, render: (_, row) => <Button type="link" onClick={() => { setSelected(row.key); setTab('contacts'); }}>详情</Button> },
  ];
  const projectColumns = [
    { title: '项目', width: 235, render: (_, row) => <div className="cm-project-name"><strong>{row.projectName}</strong><small>{row.projectNo}</small></div> },
    { title: '主项目', dataIndex: 'mainProject', width: 180, render: optional }, { title: '交付PM', dataIndex: 'pm', width: 90 },
    { title: '状态', dataIndex: 'status', width: 120, render: value => <Tag>{value}</Tag> },
    { title: '客户类型', dataIndex: 'customerType', width: 110, render: optional },
    ...Object.entries(CONTACT_ROLES).map(([key, title]) => ({ title, key, width: 190, render: (_, row) => names(row.roleNames[key]) })),
    { title: '操作', fixed: 'right', width: 180, render: (_, row) => <Space size={0}>{canEditCustomerProject(role, row) && <Button type="link" onClick={() => { try { openEditor('project', row, { candidates: readContactCandidates(role, row.projectNo) }); } catch (failure) { message.error(failure.message); } }}>配置联系人</Button>}<Button type="link" onClick={() => setHistory(row)}>历史</Button></Space> },
  ];
  const contactColumns = [
    { title: '联系人姓名', dataIndex: 'name', render: (value, row) => <Button type="link" onClick={() => setContactKey(row.key)}>{value}</Button> },
    { title: '关联项目', render: (_, row) => state.projects.filter(project => Object.keys(CONTACT_ROLES).some(field => project[field]?.includes(row.key))).length },
    { title: '承担的项目角色', render: (_, row) => names(Object.entries(CONTACT_ROLES).filter(([field]) => state.projects.some(project => project[field]?.includes(row.key))).map(([, title]) => title)) },
    ...(growth ? [{ title: '最近拜访时间', render: (_, row) => state.recentVisits[row.key] || <span className="cm-muted">暂无拜访记录</span> }] : []),
    { title: '操作', width: 150, render: (_, row) => <Space size={0}><Button type="link" onClick={() => setContactKey(row.key)}>详情</Button>{growth && <Button type="link" onClick={() => openEditor('contact', row)}>编辑</Button>}</Space> },
  ];
  const disableOrDelete = type => {
    const revision = state.revision;
    Modal.confirm({ title: `${type === 'delete' ? '删除' : '停用'}客户`, content: <><p>{customer.code} · {customer.name}</p><p>{type === 'delete' ? '仅无项目、联系人、拜访及财务关联的客户可以删除，确认时会重新检查关联。' : '停用后禁止新的开票业务选用，历史资料、项目、联系人及拜访保留。本期不提供重新启用。'}</p></>, okText: type === 'delete' ? '确认删除' : '确认停用', cancelText: '取消', okButtonProps: { danger: true }, onOk: () => {
      if (!commit({ type: `customer.${type}`, key: customer.key }, revision)) return Promise.reject(new Error('操作未完成'));
      if (type === 'delete') setSelected('');
    } });
  };
  const audits = <Table rowKey="key" dataSource={state.audit} size="small" scroll={{ x: 650 }} pagination={{ pageSize: 8 }} columns={[{ title: '时间', dataIndex: 'time', render: value => dayjs(value).format('YYYY-MM-DD HH:mm:ss') }, { title: '操作人', dataIndex: 'actor' }, { title: '操作', dataIndex: 'action', render: value => actionLabels[value] || value }, { title: '结果', dataIndex: 'result' }]} expandable={{ expandedRowRender: row => <div className="cm-audit-diff"><pre>{JSON.stringify(row.before, null, 2)}</pre><span>→</span><pre>{JSON.stringify(row.after, null, 2)}</pre></div> }} locale={{ emptyText: '暂无操作记录' }} />;
  return <div className="cm-page">{header}<div className="cm-scope"><span><ShieldCheck size={14} />{scope}</span><Tag>本地模拟数据</Tag></div>
    {!customer ? <>
      <div className="cm-stats">{[[Building2, '已签客户', state.customers.length, '共享同一份客户档案'], [ContactRound, '可见联系人', state.contacts.length, role === 'PM' ? '本人项目当前关联人员' : '按客户分别维护'], [FolderKanban, '可见关联项目', state.projects.filter(row => row.customerKey).length, '客户类型与负责人按项目记录']].map(([Icon, label, count, note], i) => <Card key={label}><div className="cm-stat"><div><span>{label}</span><strong>{count}<small>{i === 1 ? '位' : '个'}</small></strong><p>{note}</p></div><span className={`cm-stat-icon tone-${i}`}><Icon size={21} /></span></div></Card>)}</div>
      <Card className="cm-main-card"><div className="cm-card-heading"><div><h2>客户档案</h2><p>查询已签客户，查看联系人及关联项目</p></div>{manager && <Button type="primary" icon={<Plus size={16} />} onClick={() => openEditor('customer')}>新增客户</Button>}</div>
        <div className="cm-toolbar"><Input prefix={<Search size={16} />} placeholder="搜索客户编号、名称或全名" aria-label="搜索客户" allowClear value={query} onChange={event => setQuery(event.target.value)} />{manager && <Select aria-label="客户状态筛选" value={status} onChange={setStatus} options={[{ value: 'all', label: '全部状态' }, { value: 'active', label: '启用' }, { value: 'disabled', label: '已停用' }]} />}<Button icon={<RefreshCw size={15} />} onClick={refresh}>刷新</Button><span className="cm-result-count">共 {data.length} 个客户</span></div>
        <Table rowKey="key" columns={columns} dataSource={data} scroll={{ x: manager ? 1810 : 780 }} pagination={{ defaultPageSize: 8, showSizeChanger: true, showTotal: total => `共 ${total} 条` }} locale={{ emptyText: <Empty description="未找到匹配的客户" /> }} />
      </Card>
    </> : <>
      <Breadcrumb items={[{ title: <Button type="link" icon={<ArrowLeft size={14} />} onClick={() => setSelected('')}>客户主库</Button> }, { title: customer.name }]} />
      <Card className="cm-detail-heading"><div className="cm-card-heading"><div className="cm-detail-title"><span className="cm-detail-icon"><Building2 size={26} /></span><div><div className="cm-title-row"><h2>{customer.name}</h2>{manager && <Tag color={customer.active === false ? 'default' : 'success'}>{customer.active === false ? '已停用' : '启用'}</Tag>}</div><p>{customer.fullName}</p><small>{customer.code}</small></div></div>{manager && <Space wrap><Button onClick={() => openEditor('customer', customer)}>编辑客户资料</Button>{customer.active !== false && <Button onClick={() => disableOrDelete('disable')}>停用</Button>}<Button danger onClick={() => disableOrDelete('delete')}>删除客户</Button></Space>}</div>
        <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} items={manager ? [...financeFields.map(([key, label]) => ({ key, label, children: key === 'term' ? customer[key] == null ? '未设置' : `${customer[key]} 天` : pending(customer[key]) })), { key: 'createdAt', label: '入库时间', children: customer.createdAt ? dayjs(customer.createdAt).format('YYYY-MM-DD HH:mm') : '—' }] : [{ key: 'fullName', label: '客户全名', children: customer.fullName }]} />
      </Card>
      <Card className="cm-main-card"><Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'contacts', label: `客户联系人 ${customerContacts.length}`, children: <><div className="cm-toolbar"><Input prefix={<Search size={16} />} placeholder="搜索联系人姓名" aria-label="搜索联系人" allowClear value={contactQuery} onChange={event => setContactQuery(event.target.value)} /><span className="cm-result-count">{role === 'PM' ? '本人项目当前关联的联系人' : '同一联系人可以承担多个项目角色'}</span>{growth && <Button type="primary" icon={<Plus size={15} />} onClick={() => openEditor('contact', null, { customerKey: customer.key })}>新增联系人</Button>}</div><Table rowKey="key" columns={contactColumns} dataSource={customerContacts.filter(row => row.name.includes(contactQuery.trim()))} scroll={{ x: growth ? 860 : 660 }} pagination={{ pageSize: 8 }} locale={{ emptyText: <Empty description="暂无可见联系人" /> }} /></> },
        { key: 'projects', label: `关联项目 ${customerProjects.length}`, children: <><div className="cm-toolbar"><Input prefix={<Search size={16} />} placeholder="搜索项目名称、编号或PM" aria-label="搜索关联项目" allowClear value={projectQuery} onChange={event => setProjectQuery(event.target.value)} /><span className="cm-result-count">当前名单与变更历史分别保留</span></div><Table rowKey="projectNo" columns={projectColumns} dataSource={customerProjects.filter(row => [row.projectName, row.projectNo, row.pm].some(value => value?.includes(projectQuery.trim())))} scroll={{ x: 1500 }} pagination={{ pageSize: 6 }} locale={{ emptyText: <Empty description="暂无可见关联项目" /> }} /></> },
      ]} /></Card>
    </>}
    {manager && <div className="cm-footer"><span><CircleCheck size={14} /> 客户与财务台账共用资料 · 修改保存在当前浏览器</span><Button type="link" icon={<History size={14} />} onClick={() => openEditor('audit')}>操作记录</Button></div>}
    {editor && <CustomerEditor key={`${editor.type}-${editor.row?.key || 'new'}`} editor={editor} state={state} onCancel={() => setEditor(null)} onSave={values => commit({ type: `${editor.type}.save`, key: editor.type === 'project' ? editor.row.projectNo : editor.row?.key, values })} />}
    <Modal open={editor?.type === 'audit'} title="客户主库操作记录" width={950} onCancel={() => setEditor(null)} footer={<Button onClick={() => setEditor(null)}>关闭</Button>}>{audits}</Modal>
    <Modal open={Boolean(contact)} title={contact ? `联系人详情 · ${contact.name}` : '联系人详情'} width={1020} onCancel={() => setContactKey('')} footer={<Button onClick={() => setContactKey('')}>关闭</Button>} destroyOnHidden>
      {contact && <><Descriptions items={[{ key: 'name', label: '联系人姓名', children: contact.name }, { key: 'customer', label: '所属客户', children: state.customers.find(row => row.key === contact.customerKey)?.name }]} />
        <h3>关联项目</h3><Table size="small" rowKey="projectNo" columns={projectColumns.filter(column => !['主项目', '状态'].includes(column.title))} dataSource={state.projects.filter(project => Object.keys(CONTACT_ROLES).some(field => project[field]?.includes(contact.key)))} scroll={{ x: 1150 }} pagination={{ pageSize: 4 }} locale={{ emptyText: '暂无可见关联项目' }} />
        {growth && <section className="cm-visits"><div className="cm-card-heading"><div><h3>拜访信息</h3><p>每次拜访独立保存，仅客户增长与战略解决方案部可见</p></div><Button type="primary" icon={<Plus size={14} />} onClick={() => openEditor('visit', null, { contactKey: contact.key })}>新增拜访</Button></div>
          <div className="cm-recent"><span>最近拜访时间</span><strong>{state.recentVisits[contact.key] || '暂无拜访记录'}</strong><small>按该联系人最新一条拜访记录的日期自动更新</small></div>
          {state.visits.filter(row => row.contactKey === contact.key).length ? <Timeline items={state.visits.filter(row => row.contactKey === contact.key).sort((a, b) => b.date.localeCompare(a.date)).map(row => ({ key: row.key, content: <div className="cm-visit"><div className="cm-visit-heading"><strong>{row.date}</strong><Button type="link" onClick={() => openEditor('visit', row)}>更正记录</Button></div><p>{row.content}</p><Descriptions column={1} size="small" items={[{ key: 'next', label: '下次拜访DDL', children: optional(row.nextDdl) }, { key: 'issues', label: '待闭环问题记录', children: optional(row.issues) }, { key: 'note', label: '拜访备注', children: optional(row.note) }]} /></div> }))} /> : <Empty description="暂无拜访记录" />}
        </section>}
      </>}
    </Modal>
    <Modal open={Boolean(history)} title={`项目客户关联变更历史 · ${history?.projectName || ''}`} width={900} onCancel={() => setHistory(null)} footer={<Button onClick={() => setHistory(null)}>关闭</Button>} destroyOnHidden>
      {history && (state.history.filter(row => row.projectNo === history.projectNo).length ? <Timeline items={state.history.filter(row => row.projectNo === history.projectNo).map(row => ({ key: row.key, content: <div><strong>{row.actor}</strong><p>{dayjs(row.time).format('YYYY-MM-DD HH:mm:ss')}</p><Table size="small" rowKey="field" pagination={false} columns={[{ title: '字段', dataIndex: 'field' }, { title: '变更前', dataIndex: 'before' }, { title: '变更后', dataIndex: 'after' }]} dataSource={Object.entries({ customerType: '客户类型', ...CONTACT_ROLES }).map(([field, title]) => ({ field: title, before: Array.isArray(row.changes.before[field]) ? row.changes.before[field].map(person => person.name).join('、') || '未填写' : row.changes.before[field] || '未填写', after: Array.isArray(row.changes.after[field]) ? row.changes.after[field].map(person => person.name).join('、') || '未填写' : row.changes.after[field] || '未填写' }))} /></div> }))} /> : <Empty description="暂无变更历史，当前为初始关联" />)}
    </Modal>
  </div>;
}

function CustomerEditor({ editor, state, onCancel, onSave }) {
  const [form] = Form.useForm(), { type, row } = editor;
  if (type === 'audit') return null;
  const title = { customer: row ? '编辑客户资料' : '新增已签客户', contact: row ? '编辑联系人' : '新增联系人', project: '配置项目客户联系人', visit: row ? '更正拜访记录' : '新增拜访记录' }[type];
  const initialValues = { ...row, customerKey: row?.customerKey || editor.customerKey, contactKey: row?.contactKey || editor.contactKey, ...(type === 'visit' ? { date: row?.date ? dayjs(row.date) : null } : {}) };
  return <Modal open title={title} width={type === 'customer' ? 740 : 650} zIndex={1300} onCancel={onCancel} onOk={() => form.submit()} okText="保存" cancelText="取消" destroyOnHidden>
    <Form form={form} layout="vertical" initialValues={initialValues} onFinish={values => onSave({ ...values, ...(type === 'visit' ? { date: values.date?.format('YYYY-MM-DD') || '' } : {}) })}>
      {type === 'customer' && <><p className="cm-form-note">客户及财务共用此档案。已确认开票的资料保留原快照。</p><Row gutter={16}>{[['name', '客户名称'], ['fullName', '客户全名'], ...financeFields.filter(([key]) => key !== 'term')].map(([key, label], index) => <Col xs={24} sm={key === 'fullName' ? 24 : 12} key={key}><Form.Item name={key} label={label} rules={index < 3 ? [{ required: true, whitespace: true, message: `请填写${label}` }] : []}><Input placeholder={index < 3 ? `请输入${label}` : '可留空，后续补充'} /></Form.Item></Col>)}<Col xs={24} sm={12}><Form.Item name="term" label="账期（天）"><InputNumber style={{ width: '100%' }} placeholder="可留空" /></Form.Item></Col></Row></>}
      {type === 'contact' && <><p className="cm-form-note">仅维护所属客户与姓名。更换实际负责人请通过项目关联配置。</p><Form.Item name="customerKey" label="所属客户" rules={[{ required: true, message: '请选择客户' }]}><Select showSearch optionFilterProp="label" options={state.customers.map(customer => ({ value: customer.key, label: customer.name }))} /></Form.Item><Form.Item name="name" label="联系人姓名" rules={[{ required: true, whitespace: true, message: '请填写联系人姓名' }]}><Input /></Form.Item></>}
      {type === 'project' && <><p className="cm-form-note">{row.projectName} · {row.customer}<br />每个角色可选多位负责人，也可全部清空；同一人可以兼任多个角色。</p><Form.Item name="customerType" label="客户类型"><Select allowClear placeholder="未填写" options={['直签', '转手'].map(value => ({ value, label: value }))} /></Form.Item>{Object.entries(CONTACT_ROLES).map(([field, label]) => <Form.Item key={field} name={field} label={label}><Select mode="multiple" allowClear optionFilterProp="label" placeholder="请选择本客户的联系人，可留空" options={editor.candidates} /></Form.Item>)}</>}
      {type === 'visit' && <><Form.Item name="contactKey" hidden><Input /></Form.Item><Form.Item name="date" label="本次拜访日期" rules={[{ required: true, message: '请选择实际拜访日期' }]}><DatePicker style={{ width: '100%' }} /></Form.Item><Form.Item name="content" label="当次拜访记录" rules={[{ required: true, whitespace: true, message: '请填写当次拜访记录' }]}><Input.TextArea rows={4} placeholder="沟通内容、情况及结论" /></Form.Item><Form.Item name="nextDdl" label="下次拜访DDL"><Input placeholder="自由文本，例如：待定、11月上旬、搁置" /></Form.Item><Form.Item name="issues" label="待闭环问题记录"><Input.TextArea rows={3} placeholder="手工记录问题及进展" /></Form.Item><Form.Item name="note" label="拜访备注"><Input.TextArea rows={2} /></Form.Item></>}
    </Form>
  </Modal>;
}

// The project master reads the same association records as the customer master.
export function ProjectCustomerPanel({ projectNo, role }) {
  const { state, error, refresh } = useCustomerView(role);
  const [editor, setEditor] = React.useState(null), [showHistory, setShowHistory] = React.useState(false);
  if (error) return <Alert type="error" title={error} action={<Button onClick={refresh}>重试</Button>} />;
  const project = state?.projects.find(row => row.projectNo === projectNo);
  if (!project) return null;
  return <section className="detail-section cm-page"><div className="cm-card-heading"><div><h3>客户联系人</h3><p>与客户主库共用当前关联，按项目分别维护</p></div><Space><Button onClick={() => setShowHistory(true)}>变更历史</Button>{canEditCustomerProject(role, project) && <Button onClick={() => { try { setEditor({ type: 'project', row: project, revision: state.revision, candidates: readContactCandidates(role, projectNo) }); } catch (failure) { message.error(failure.message); } }}>配置联系人</Button>}</Space></div><Descriptions column={{ xs: 1, md: 2 }} items={[{ key: 'customerType', label: '客户类型', children: optional(project.customerType) }, ...Object.entries(CONTACT_ROLES).map(([key, label]) => ({ key, label, children: names(project.roleNames[key]) }))]} />
    {editor && <CustomerEditor editor={editor} state={state} onCancel={() => setEditor(null)} onSave={values => { try { commitCustomerCommand(role, editor.revision, { type: 'project.save', key: projectNo, values }); setEditor(null); refresh(); message.success('项目客户关联已保存'); } catch (failure) { message.error(failure.message); } }} />}
    <Modal open={showHistory} title="客户关联变更历史" width={800} onCancel={() => setShowHistory(false)} footer={<Button onClick={() => setShowHistory(false)}>关闭</Button>}><Table rowKey="key" dataSource={state.history.filter(row => row.projectNo === projectNo)} columns={[{ title: '时间', dataIndex: 'time', render: value => dayjs(value).format('YYYY-MM-DD HH:mm:ss') }, { title: '操作人', dataIndex: 'actor' }]} expandable={{ expandedRowRender: row => <Descriptions column={1} items={Object.entries({ customerType: '客户类型', ...CONTACT_ROLES }).map(([field, label]) => { const display = value => Array.isArray(value) ? value.map(person => person.name).join('、') || '未填写' : value || '未填写'; return { key: field, label, children: `${display(row.changes.before[field])} → ${display(row.changes.after[field])}` }; })} /> }} locale={{ emptyText: '暂无变更历史' }} /></Modal>
  </section>;
}
