import React from 'react';
import { Alert, Avatar, Button, Card, Col, DatePicker, Descriptions, Empty, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tabs, Tag, Timeline, message } from 'antd';
import { ApartmentOutlined, ArrowRightOutlined, CheckCircleOutlined, IdcardOutlined, PlusOutlined, SearchOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getHrView, hrAction, subscribeHr } from '../data/hrWorkspace';
import { TrainingAction } from './HrWorkflow';
import './hr-workspace.css';

const roles = ['人事', 'PM', 'PMO', '财务', 'PA'];
const roleLabel = role => ({ 人事: '人事', PM: '项目经理 · 王然', PMO: 'PMO', 财务: '财务', PA: '项目助理' }[role] || role);
const option = value => ({ value, label: value });
const unique = values => [...new Set(values.filter(Boolean))];
const blank = value => value === undefined || value === null || value === '' ? <span className="hr-muted">未填写</span> : value;
const statusColor = value => ({ 在职: 'success', 已完成: 'success', 正常在项: 'success', 待入职: 'warning', 待签合同: 'warning', 办理中: 'processing', 离职中: 'orange', 已离职: 'default', 第1天: 'blue', 第2天: 'cyan', 通过: 'success', 淘汰: 'error', 培训储备: 'purple', 启用: 'success', 在用: 'success', 筹备: 'processing' }[value] || 'default');
const tag = value => <Tag color={statusColor(value)}>{value || '待确认'}</Tag>;

function useDirectoryData(role) {
  const [view, setView] = React.useState(null), [error, setError] = React.useState('');
  const refresh = React.useCallback(() => { try { setView(getHrView(role)); setError(''); } catch (err) { setError(err.message || '人事数据读取失败'); } }, [role]);
  React.useEffect(() => { refresh(); return subscribeHr(refresh); }, [refresh]);
  const normalizedRole = role === 'PA' ? '项目助理' : role === 'HR' ? '人事' : role;
  return { view: view?.role === normalizedRole ? view : null, error, refresh };
}

const titles = {
  'hr-overview': ['人事总览', '从培训到入职，查看人员与办理进度。'],
  'people-master': ['人员主库', '查看已建档人员的当前任职、用工状态与账号信息。'],
  'hr-organization': ['组织管理', '统一维护部门结构、工作地点与岗位业务信息。'],
  'people-external': ['外部人员表', '当前正在项目工作的外部兼职人员。'],
  'project-people': ['项目人员列表', '按项目查看当前人员、培训阶段与入职办理异常。'],
};

export default function HrDirectory({ page = 'hr-overview', role = '人事', onNavigate, onRoleChange, projectId }) {
  const { view, error, refresh } = useDirectoryData(role);
  const [title, subtitle] = titles[page] || titles['hr-overview'];
  const allowed = page === 'hr-organization' ? role === '人事' : page === 'people-master' ? !['PM', 'PA', '项目助理'].includes(role) : roles.includes(role) || role === '项目助理';
  return <div className="hr-page">
    <div className="hr-page-heading"><div><p className="eyebrow">人事 · 基础管理</p><h1>{title}</h1><p className="subtitle">{subtitle}</p></div>{onRoleChange && <div className="hr-identity"><span>演示身份</span><Select aria-label="人事演示身份" value={role} onChange={onRoleChange} options={roles.map(value => ({ value, label: roleLabel(value) }))} /></div>}</div>
    <div className="hr-scope"><span><span className="hr-live-dot" />本地交互预览 · 模拟人员</span><span>{role === '人事' ? '公司范围' : role === 'PMO' ? '全部项目人员' : role === '财务' ? '财务业务涉及人员' : '本人获授权项目'}</span></div>
    {!allowed ? <Alert type="warning" showIcon title="当前身份无此页面访问权限" description="请通过项目人员入口查看获授权的人员摘要。" /> : error ? <Alert type="error" showIcon title="人事数据读取失败" description={error} action={<Button onClick={refresh}>重试</Button>} /> : !view ? <Card loading /> : page === 'hr-organization' ? <Organization view={view} role={role} refresh={refresh} /> : page === 'people-master' ? <MasterList view={view} role={role} refresh={refresh} /> : page === 'people-external' ? <ExternalList view={view} onNavigate={onNavigate} /> : page === 'project-people' ? <ProjectPeople view={view} role={role} refresh={refresh} onNavigate={onNavigate} projectId={projectId} /> : <Overview view={view} role={role} onNavigate={onNavigate} />}
  </div>;
}

function Overview({ view, role, onNavigate }) {
  const people = view.people || [], projectPeople = view.projectPeople || [], onboarding = role === '人事' ? view.onboarding || [] : (view.projectPeople || []).filter(p => p.checklistCreated);
  const training = (role === '人事' ? view.candidates || [] : projectPeople).filter(p => ['第1天', '第2天'].includes(p.trainingStage));
  const metrics = [
    ['已建档人员', people.length, ['PM', 'PA', '项目助理'].includes(role) ? '查看项目人员' : '人员主库', ['PM', 'PA', '项目助理'].includes(role) ? 'project-people' : 'people-master', <IdcardOutlined />],
    ['正在培训', training.length, '培训进度', role === '人事' ? 'hr-candidates' : 'project-people', <TeamOutlined />],
    ['待办理入职', onboarding.filter(p => !['已完成', '已终止'].includes(p.checklistStatus)).length, '入职清单', 'hr-onboarding', <CheckCircleOutlined />],
    ['当前外部人员', (view.external || []).length, '外部人员', 'people-external', <UserOutlined />],
  ];
  const entries = [
    ...(role === '人事' ? [['组织管理', '部门、工作地点及岗位清单', 'hr-organization', <ApartmentOutlined />], ['人员主库', '已建档人员与任职信息', 'people-master', <IdcardOutlined />], ['候选人库', '查看来源、培训状态与结果评定', 'hr-candidates', <UserOutlined />], ['入职资料表', '招聘编号自动匹配及资料核对', 'hr-intakes', <IdcardOutlined />]] : []),
    ['项目人员列表', '当前项目人员与入职异常', 'project-people', <TeamOutlined />],
    ...(['人事', 'PM'].includes(role) ? [['入职清单', '入职意愿、准入条件与办理进度', 'hr-onboarding', <CheckCircleOutlined />]] : []),
    ['外部人员表', '当前在项兼职人员及项目', 'people-external', <UserOutlined />],
  ];
  const anomalyPeople = projectPeople.filter(p => p.anomalies?.length);
  return <>
    <div className="hr-stats">{metrics.map(([name, value, label, target, icon], i) => <Card key={name}><div className="hr-stat-icon" data-tone={i}>{icon}</div><Statistic title={name} value={value} suffix="人" /><Button type="link" size="small" onClick={() => onNavigate?.(target)}>{label}<ArrowRightOutlined /></Button></Card>)}</div>
    <Row gutter={[16, 16]}><Col xs={24} xl={16}><Card title="工作入口"><div className="hr-entry-grid">{entries.map(([name, desc, target, icon]) => <Button className="hr-entry" key={target} onClick={() => onNavigate?.(target)}><span className="hr-entry-icon">{icon}</span><span><strong>{name}</strong><small>{desc}</small></span><ArrowRightOutlined /></Button>)}</div></Card></Col><Col xs={24} xl={8}><Card title="项目人员概况" className="hr-overview-summary"><div className="hr-summary-number"><strong>{unique(projectPeople.map(p => p.id)).length}</strong><span>名当前关联人员</span></div>{['在职', '待入职', '离职中', '已离职'].map(status => <div className="hr-summary-row" key={status}>{tag(status)}<b>{people.filter(p => p.employmentStatus === status).length} 人</b></div>)}<div className="hr-overview-note">项目关联人员按人去重，人员主库仅包含建档成功记录。</div></Card></Col></Row>
    <Card className="hr-section" title="需要跟进的入职事项" extra={<Button type="link" onClick={() => onNavigate?.('hr-onboarding')}>查看入职清单 <ArrowRightOutlined /></Button>}><Table rowKey="id" size="small" dataSource={anomalyPeople} pagination={{ pageSize: 5, hideOnSinglePage: true }} scroll={{ x: 700 }} locale={{ emptyText: <Empty description="当前范围暂无需跟进事项" /> }} columns={[{ title: '姓名', dataIndex: 'name', width: 130 }, { title: '所在项目', render: (_, p) => (p.projectNames || []).join('、') || '待关联' }, { title: '入职异常', render: (_, p) => <Space wrap>{p.anomalies?.map(a => <Tag color="warning" key={a}>{a}</Tag>)}</Space> }, { title: '办理状态', dataIndex: 'checklistStatus', render: tag, width: 120 }]} /></Card>
  </>;
}

function MasterList({ view, role, refresh }) {
  const [query, setQuery] = React.useState(''), [filters, setFilters] = React.useState({}), [range, setRange] = React.useState(null), [selected, setSelected] = React.useState(null);
  const people = view.people || [];
  const selectFilter = (key, placeholder, values) => <Select aria-label={placeholder} allowClear placeholder={placeholder} value={filters[key]} onChange={value => setFilters(old => ({ ...old, [key]: value }))} options={unique(values).map(option)} />;
  const data = people.filter(p => (!query.trim() || `${p.name} ${p.employeeNo}`.toLowerCase().includes(query.trim().toLowerCase())) && Object.entries(filters).every(([k, v]) => !v || (k === 'unsigned' ? p.contractSigned === false : (k === 'stage' ? p.stage || '待确认' : p[k]) === v)) && (!range?.[0] || (p.entryDate && p.entryDate >= range[0].format('YYYY-MM-DD') && p.entryDate <= range[1].format('YYYY-MM-DD'))));
  const columns = [
    { title: '员工编号', dataIndex: 'employeeNo', width: 150, fixed: 'left' },
    { title: '员工姓名', dataIndex: 'name', width: 120, fixed: 'left', render: (_, p) => <Button type="link" className="hr-name-link" onClick={() => setSelected(p.id)}>{p.name}</Button> },
    { title: '员工类型', dataIndex: 'employeeType', width: 130 },
    { title: '所属部门', dataIndex: 'departmentName', width: 170, render: blank },
    { title: '岗位', dataIndex: 'positionName', width: 140, render: blank },
    { title: '工作地点', dataIndex: 'locationName', width: 140, render: blank },
    { title: '直属经理', dataIndex: 'manager', width: 110, render: blank },
    { title: '在职状态', dataIndex: 'employmentStatus', width: 115, render: tag },
    { title: '人员阶段', dataIndex: 'stage', width: 110, render: value => value || <span className="hr-muted">待确认</span> },
    { title: '入职日期', dataIndex: 'entryDate', width: 125, render: blank, sorter: (a, b) => (a.entryDate || '').localeCompare(b.entryDate || '') },
    { title: '入职异常', width: 135, render: (_, p) => p.contractSigned === false ? <Tag color="warning">合同未签署</Tag> : p.contractSigned == null ? <Tag>合同结果待核对</Tag> : '—' },
  ];
  return <Card className="hr-table-card"><div className="hr-card-heading"><div><h2>已建档人员 <span>{people.length} 人</span></h2><p>信息更正通过已批准的业务结果同步更新。</p></div><Tag>只读档案</Tag></div><div className="hr-filter-grid"><Input allowClear prefix={<SearchOutlined />} placeholder="搜索姓名 / 员工编号" aria-label="搜索主库人员" value={query} onChange={e => setQuery(e.target.value)} />{selectFilter('departmentName', '所属部门', people.map(p => p.departmentName))}{selectFilter('positionName', '岗位', people.map(p => p.positionName))}{selectFilter('locationName', '工作地点', people.map(p => p.locationName))}{selectFilter('employeeType', '员工类型', people.map(p => p.employeeType))}{selectFilter('employmentStatus', '在职状态', ['待入职', '在职', '离职中', '已离职'])}{selectFilter('stage', '人员阶段', people.map(p => p.stage || '待确认'))}<Select allowClear aria-label="合同异常" value={filters.unsigned} placeholder="入职异常" options={[option('合同未签署')]} onChange={unsigned => setFilters(old => ({ ...old, unsigned }))} /><DatePicker.RangePicker value={range} onChange={setRange} placeholder={['入职开始日期', '入职结束日期']} /><Button onClick={() => { setQuery(''); setFilters({}); setRange(null); }}>重置筛选</Button></div><Table rowKey="id" columns={columns} dataSource={data} scroll={{ x: 1470 }} pagination={{ pageSize: 10, showSizeChanger: true, showTotal: total => `共 ${total} 名人员` }} locale={{ emptyText: <Empty description="没有符合筛选条件的已建档人员" /> }} /><PersonDetail person={people.find(p => p.id === selected)} role={role} view={view} onClose={() => setSelected(null)} refresh={refresh} /></Card>;
}

function PersonDetail({ person, role, view, onClose, projectMode = false, projectId, refresh, onNavigate }) {
  const [outputProject, setOutputProject] = React.useState(projectId);
  React.useEffect(() => setOutputProject(projectId), [person?.id, projectId]);
  if (!person) return null;
  const external = person.category === '外部人员' || person.employeeType === '兼职' || person.externalNo;
  const groups = [
    ['基础信息', [['employeeNo', '员工编号'], ['name', '员工姓名'], ['gender', '性别'], ['phone', '联系电话'], ['email', '邮箱']]],
    ['当前任职', [['departmentName', '所属部门'], ['positionName', '岗位'], ['locationName', '工作地点'], ['manager', '直属经理']]],
    ['用工状态与日期', [['employeeType', '员工类型'], ['employmentStatus', '在职状态'], ['stage', '人员阶段'], ['entryDate', '入职日期'], ['probationDate', '试用期开始日期'], ['firstWorkDate', '首次参加工作日期'], ['trainingStart', '实际培训第1天'], ['tenureDays', '在岗时长'], ['masterAnomalies', '入职异常']]],
    ['账号信息', [['enterpriseAccount', '企业飞书账号'], ['personalAccount', '个人飞书账号']]],
  ];
  const outputs = (view.outputs || []).filter(o => o.personId === person.id && (!outputProject || o.projectId === outputProject));
  const outputProjects = (view.projects || []).filter(p => (view.outputs || []).some(o => o.personId === person.id && o.projectId === p.id));
  return <Modal open title={<Space><Avatar icon={<UserOutlined />} />{person.name}<span className="hr-muted">{person.employeeNo || person.externalNo}</span></Space>} width={960} onCancel={onClose} footer={<Button onClick={onClose}>关闭</Button>} destroyOnHidden><div className="hr-detail">
    {external ? <Descriptions title="当前外部人员" column={2} items={[{ label: '外部编号', children: person.externalNo || person.employeeNo, key: 'number' }, { label: '本人姓名', children: person.name, key: 'name' }, { label: '工作类型', children: '兼职', key: 'type' }, { label: '当前项目', children: (person.projectNames || []).join('、'), key: 'project' }]} /> : <>{groups.map(([title, fields]) => <Descriptions title={title} key={title} column={{ xs: 1, sm: 2, md: 2 }} items={fields.map(([key, label]) => ({ key, label, children: key === 'tenureDays' ? Number.isFinite(person[key]) ? `${person[key]} 天（自然日）` : <Tag color="warning">日期待核对</Tag> : key === 'stage' ? person[key] || '待确认' : key === 'masterAnomalies' ? person.contractSigned === false ? <Tag color="warning">合同未签署</Tag> : person.contractSigned == null ? '合同结果待核对' : '无' : blank(person[key]) }))} />)}<Descriptions title="特殊计划" items={[{ key: 'plans', label: '计划标签', children: person.specialPlans?.length ? <Space wrap>{person.specialPlans.map(p => <Tag color="purple" key={p}>{p}</Tag>)}</Space> : '无' }]} /></>}
    {projectMode && !external && <Card size="small" className="hr-detail-progress" title="培训与入职摘要"><Space wrap>{person.trainingStage && tag(person.trainingStage)}{person.checklistStatus && tag(person.checklistStatus)}{person.anomalies?.map(a => <Tag color="warning" key={a}>{a}</Tag>)}</Space>{person.missingFields?.length > 0 && <p className="hr-muted">缺失项：{person.missingFields.join('、')}</p>}<div className="hr-detail-actions"><TrainingAction person={person} role={role} onSaved={refresh} />{person.checklistStatus && ['人事', 'PM'].includes(role) && <Button onClick={() => onNavigate?.('hr-onboarding')}>查看入职清单</Button>}</div></Card>}
    {projectMode && <section className="hr-output-history"><div className="hr-card-heading"><div><h2>历史产出</h2><p>仅显示当前身份有权查看的项目记录。</p></div><Select allowClear aria-label="历史产出项目" value={outputProject} onChange={setOutputProject} placeholder="全部有权项目" options={outputProjects.map(p => ({ value: p.id, label: p.name }))} /></div><Table rowKey={(row, i) => row.id || `${row.personId}-${row.projectId}-${row.date}-${i}`} size="small" scroll={{ x: 620 }} dataSource={outputs} pagination={{ pageSize: 5 }} locale={{ emptyText: <Empty description="当前范围暂无历史产出记录" /> }} columns={[{ title: '日期', dataIndex: 'date', width: 120 }, { title: '项目', dataIndex: 'projectId', render: value => view.projects?.find(p => p.id === value)?.name || value }, { title: '人员类别', dataIndex: 'category', width: 110 }, { title: '产出量', dataIndex: 'quantity', align: 'right', width: 110, render: value => value ?? '待核对' }, { title: '单位', dataIndex: 'unit', width: 85 }]} /></section>}
  </div></Modal>;
}

export function HrProjectPeople({ projectId, role = 'PMO', onNavigate }) {
  const { view, error, refresh } = useDirectoryData(role);
  return <div className="hr-page hr-embedded">{error ? <Alert type="error" showIcon title={error} action={<Button onClick={refresh}>重试</Button>} /> : !view ? <Card loading /> : <ProjectPeople view={view} role={role} refresh={refresh} projectId={projectId} onNavigate={onNavigate} embedded />}</div>;
}

function ProjectPeople({ view, role, refresh, projectId, onNavigate, embedded = false }) {
  const [query, setQuery] = React.useState(''), [filters, setFilters] = React.useState({}), [selected, setSelected] = React.useState(null);
  const projects = view.projects || [];
  const project = projectId ? projects.find(p => p.id === projectId || p.projectNo === projectId) : null;
  const raw = [...(view.projectPeople || [])];
  for (const p of view.external || []) if (!raw.some(row => row.id === p.id)) raw.push(p);
  const rows = raw.flatMap(p => (p.projectIds || []).filter(id => projects.some(project => project.id === id) && (!projectId || id === project?.id)).map(id => ({ ...p, rowKey: `${p.id}-${id}`, currentProjectId: id, currentProjectName: projects.find(project => project.id === id)?.name, personCategory: ['内部人员', '外部人员'].includes(p.category) ? p.category : p.externalNo || p.employeeType === '兼职' ? '外部人员' : '待核对' })));
  const data = rows.filter(p => (!query.trim() || `${p.name} ${p.employeeNo || p.externalNo}`.includes(query.trim())) && Object.entries(filters).every(([k, value]) => !value || (k === 'anomaly' ? p.anomalies?.includes(value) : k === 'special' ? p.specialPlans?.includes(value) : p[k] === value)));
  const filter = (key, label, values) => <Select aria-label={label} allowClear value={filters[key]} placeholder={label} options={unique(values).map(option)} onChange={value => setFilters(f => ({ ...f, [key]: value }))} />;
  return <Card className="hr-table-card" variant={embedded ? 'borderless' : 'outlined'}><div className="hr-card-heading"><div><h2>{embedded ? '当前关联人员' : '当前项目人员'}</h2><p>{unique(data.map(p => p.id)).length} 名人员 · {data.length} 条项目关联</p></div><Tag>人员 + 当前项目</Tag></div><div className="hr-filter-grid"><Input aria-label="搜索项目人员" prefix={<SearchOutlined />} placeholder="搜索姓名 / 人员编号" value={query} allowClear onChange={e => setQuery(e.target.value)} />{!projectId && filter('currentProjectName', '所在项目', rows.map(p => p.currentProjectName))}{filter('personCategory', '人员类别', ['内部人员', '外部人员'])}{filter('employeeType', '工作类型', rows.map(p => p.employeeType))}{filter('trainingStage', '培训阶段', rows.map(p => p.trainingStage))}{filter('anomaly', '入职异常', rows.flatMap(p => p.anomalies || []))}{filter('special', '特殊计划', rows.flatMap(p => p.specialPlans || []))}<Button onClick={() => { setQuery(''); setFilters({}); }}>重置筛选</Button></div><Table rowKey="rowKey" dataSource={data} scroll={{ x: 1200 }} pagination={{ pageSize: 10, showSizeChanger: true }} locale={{ emptyText: <Empty description={projectId && !project ? '此项目没有获授权的人事关联数据' : '当前范围暂无符合条件的项目人员'} /> }} columns={[
    { title: '人员', width: 170, fixed: 'left', render: (_, p) => <div><Button type="link" className="hr-name-link" onClick={() => setSelected(p)}>{p.name}</Button><small className="hr-cell-note">{p.employeeNo || p.externalNo}</small></div> },
    { title: '所在项目', dataIndex: 'currentProjectName', width: 180 }, { title: '人员类别', dataIndex: 'personCategory', width: 105 }, { title: '工作类型', dataIndex: 'employeeType', width: 125 },
    { title: '阶段 / 入职异常', width: 235, render: (_, p) => <Space wrap size={[0, 4]}>{['第1天', '第2天'].includes(p.trainingStage) && <Tag color="processing">培训{p.trainingStage}</Tag>}{p.anomalies?.map(a => <Tag color="warning" key={a}>{a}</Tag>)}{!['第1天', '第2天'].includes(p.trainingStage) && !p.anomalies?.length && <Tag color={p.personCategory === '待核对' || p.terminated || /淘汰|储备|待核对/.test(p.trainingStage || '') || p.accountReview || p.contractReview ? 'default' : 'success'}>{p.personCategory === '待核对' ? '待核对' : p.terminated ? '已终止' : /淘汰|储备|待核对/.test(p.trainingStage || '') ? p.trainingStage : p.accountReview || p.contractReview ? '待核对' : '正常在项'}</Tag>}</Space> },
    { title: '特殊计划', width: 155, render: (_, p) => p.specialPlans?.length ? <Space wrap size={0}>{p.specialPlans.map(plan => <Tag key={plan} color="purple">{plan}</Tag>)}</Space> : '—' },
    { title: '操作', fixed: 'right', width: 200, render: (_, p) => <Space size={0} wrap><Button type="link" onClick={() => setSelected(p)}>详情</Button>{p.personCategory === '内部人员' && <TrainingAction person={p} role={role} onSaved={refresh} />}</Space> },
  ]} /><PersonDetail person={selected && raw.find(p => p.id === selected.id)} projectMode projectId={project?.id} role={role} view={view} onClose={() => setSelected(null)} refresh={refresh} onNavigate={onNavigate} /></Card>;
}

function ExternalList({ view, onNavigate }) {
  const [query, setQuery] = React.useState(''), [projectId, setProjectId] = React.useState();
  const data = (view.external || []).filter(p => (!query.trim() || `${p.name} ${p.externalNo || p.employeeNo}`.includes(query.trim())) && (!projectId || p.projectIds?.includes(projectId)));
  return <Card className="hr-table-card"><div className="hr-card-heading"><div><h2>当前在项兼职人员 <span>{data.length} 人</span></h2><p>每人当前关联一个项目；历史参与记录保留在原业务中。</p></div></div><div className="hr-toolbar"><Input aria-label="搜索外部人员" allowClear prefix={<SearchOutlined />} placeholder="搜索姓名 / EXT编号" value={query} onChange={e => setQuery(e.target.value)} /><Select allowClear aria-label="外部人员当前项目" placeholder="当前项目" value={projectId} options={(view.projects || []).map(p => ({ value: p.id, label: p.name }))} onChange={setProjectId} /></div><Table rowKey="id" dataSource={data} pagination={{ pageSize: 10, showTotal: n => `共 ${n} 名外部人员` }} scroll={{ x: 700 }} locale={{ emptyText: <Empty description="当前范围暂无符合条件的在项外部人员" /> }} columns={[{ title: '外部编号', width: 160, render: (_, p) => p.externalNo || p.employeeNo }, { title: '本人姓名', dataIndex: 'name', width: 140 }, { title: '工作类型', width: 110, render: () => <Tag>兼职</Tag> }, { title: '当前项目', render: (_, p) => (p.projectNames || []).join('、') || (view.projects || []).filter(project => p.projectIds?.includes(project.id)).map(project => project.name).join('、') }, { title: '操作', width: 150, render: (_, p) => <Button type="link" onClick={() => onNavigate?.(`projects:${view.projects.find(project => project.id === p.projectIds?.[0])?.projectNo || p.projectIds?.[0]}:external`)}>查看项目产量与出勤</Button> }]} /></Card>;
}

function Organization({ view, role, refresh }) {
  const [collection, setCollection] = React.useState('departments'), [query, setQuery] = React.useState(''), [editor, setEditor] = React.useState(null), [form] = Form.useForm();
  const validity = Form.useWatch('validity', form);
  const labels = { departments: '部门', locations: '工作地点', positions: '岗位' };
  const values = view[collection] || [];
  const data = values.filter(row => !query.trim() || `${row.name} ${row.id}`.includes(query.trim())).map(row => ({ ...row })).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const byId = Object.fromEntries(data.map(p => [p.id, p]));
  if (collection === 'departments' && !query.trim()) for (const p of data) if (p.parentId && byId[p.parentId]) (byId[p.parentId].children ||= []).push(p);
  const tableData = collection === 'departments' && !query.trim() ? data.filter(p => !p.parentId || !byId[p.parentId]) : data;
  const open = row => { setEditor({ ...(row || {}), _revision: view.revision }); form.resetFields(); form.setFieldsValue(row ? { ...row, startDate: row.startDate ? dayjs(row.startDate) : null, endDate: row.endDate ? dayjs(row.endDate) : null } : { status: collection === 'locations' ? '在用' : '启用', validity: '永久启用', sort: 0 }); };
  const save = async () => { try { const fields = await form.validateFields(); hrAction(role, 'organization.save', { collection, ...editor, ...fields, expectedRevision: editor._revision, startDate: fields.startDate?.format('YYYY-MM-DD') || '', endDate: fields.endDate?.format('YYYY-MM-DD') || '' }); refresh(); setEditor(null); message.success('组织资料已保存'); } catch (err) { if (!err.errorFields) message.error(err.message || '保存失败'); } };
  const remove = row => { try { hrAction(role, 'organization.delete', { collection, id: row.id, expectedRevision: view.revision }); refresh(); message.success('已删除未被引用的记录'); } catch (err) { message.error(err.message || '删除失败'); } };
  const columns = [{ title: `${labels[collection]}名称`, dataIndex: 'name', width: 235 }, { title: '编号', dataIndex: 'id', width: 130 },
    ...(collection === 'departments' ? [{ title: '上级部门', dataIndex: 'parentId', width: 200, render: value => view.departments?.find(d => d.id === value)?.name || '一级部门' }, { title: '显示排序', dataIndex: 'sort', width: 100 }, { title: '备注', dataIndex: 'note', render: blank }] : collection === 'locations' ? [{ title: '地址', dataIndex: 'address', width: 220, render: blank }, { title: '有效性', dataIndex: 'validity', width: 120 }, { title: '有效日期', width: 220, render: (_, r) => r.validity === '时间段' ? `${r.startDate || '待补充'} 至 ${r.endDate || '待补充'}` : '—' }] : [{ title: '所属部门', dataIndex: 'departmentId', width: 220, render: value => view.departments?.find(d => d.id === value)?.name || '待关联' }, { title: '默认直属经理', dataIndex: 'manager', width: 130, render: blank }, { title: '有效性', dataIndex: 'validity', width: 120 }]),
    { title: '状态', dataIndex: 'status', width: 100, render: tag }, { title: '操作', width: 155, fixed: 'right', render: (_, row) => <Space size={0}><Button type="link" onClick={() => open(row)}>维护</Button><Popconfirm title="删除这条组织资料？" description="存在业务引用或下级节点时将无法删除，请改为停用。" onConfirm={() => remove(row)}><Button type="link" danger>删除</Button></Popconfirm></Space> }];
  return <Card className="hr-table-card"><Tabs activeKey={collection} onChange={key => { setCollection(key); setQuery(''); }} items={Object.entries(labels).map(([key, label]) => ({ key, label }))} /><div className="hr-toolbar"><Input allowClear aria-label="搜索组织资料" prefix={<SearchOutlined />} value={query} onChange={e => setQuery(e.target.value)} placeholder={`搜索${labels[collection]}名称 / 编号`} /><Button type="primary" icon={<PlusOutlined />} onClick={() => open(null)}>新增{labels[collection]}</Button><span className="hr-muted hr-toolbar-note">历史业务保留原名称；停用不自动改变现有任职。</span></div><Table key={collection} rowKey="id" dataSource={tableData} columns={columns} expandable={{ defaultExpandAllRows: true }} scroll={{ x: 1000 }} pagination={{ pageSize: 10 }} />
    <Modal open={!!editor} title={`${editor?.id ? '维护' : '新增'}${labels[collection]}`} onCancel={() => setEditor(null)} onOk={save} okText="保存" destroyOnHidden width={640}><Form form={form} layout="vertical"><Form.Item name="name" label={`${labels[collection]}名称`} rules={[{ required: true, whitespace: true, message: '请输入名称' }]}><Input maxLength={100} /></Form.Item><Row gutter={16}>{collection === 'departments' ? <><Col span={16}><Form.Item name="parentId" label="上级部门"><Select allowClear placeholder="无上级（一级部门）" options={(view.departments || []).filter(p => p.id !== editor?.id).map(p => ({ value: p.id, label: p.name }))} /></Form.Item></Col><Col span={8}><Form.Item name="sort" label="显示排序"><InputNumber min={0} precision={0} /></Form.Item></Col></> : collection === 'positions' ? <><Col span={12}><Form.Item name="departmentId" label="所属部门" rules={[{ required: true, message: '请选择部门' }]}><Select showSearch optionFilterProp="label" options={(view.departments || []).filter(p => p.status === '启用' || p.id === editor?.departmentId).map(p => ({ value: p.id, label: p.name }))} /></Form.Item></Col><Col span={12}><Form.Item name="manager" label="岗位默认直属经理"><Input /></Form.Item></Col><Col span={12}><Form.Item name="keyType" label="关键岗位类型"><Input placeholder="保留原有业务配置" /></Form.Item></Col><Col span={12}><Form.Item name="bonusLevel" label="奖金级别"><Input /></Form.Item></Col></> : <Col span={24}><Form.Item name="address" label="地址"><Input placeholder="来源暂未核实时可留空" /></Form.Item></Col>}<Col span={12}><Form.Item name="status" label="状态" rules={[{ required: true }]}><Select options={(collection === 'locations' ? ['在用', '筹备', '弃用'] : ['启用', '停用']).map(option)} /></Form.Item></Col>{collection !== 'departments' && <><Col span={12}><Form.Item name="validity" label="有效性模式" rules={[{ required: true }]}><Select options={['永久启用', '永久停用', '时间段'].map(option)} /></Form.Item></Col>{validity === '时间段' && <><Col span={12}><Form.Item name="startDate" label="有效开始日期" rules={[{ required: true, message: '请选择开始日期' }]}><DatePicker /></Form.Item></Col><Col span={12}><Form.Item name="endDate" label="有效截止日期" dependencies={['startDate']} rules={[{ required: true, message: '请选择截止日期' }, ({ getFieldValue }) => ({ validator: (_, value) => !value || !getFieldValue('startDate') || !value.isBefore(getFieldValue('startDate'), 'day') ? Promise.resolve() : Promise.reject(new Error('截止日期不得早于开始日期')) })]}><DatePicker /></Form.Item></Col></>}</>}</Row>{collection === 'departments' && <Form.Item name="note" label="备注"><Input.TextArea rows={3} /></Form.Item>}</Form></Modal>
  </Card>;
}
