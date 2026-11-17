import React from 'react';
import dayjs from 'dayjs';
import { Alert, Button, Card, DatePicker, Descriptions, Empty, Form, Input, Modal, Radio, Select, Space, Table, Tabs, Tag, message } from 'antd';
import { HolderOutlined, SwapOutlined } from '@ant-design/icons';
import { loadHr, subscribeHr, beijingToday } from '../data/hrWorkspace';
import { addDays, calendarDays, isSchedulingIntern, loadScheduling, schedulingAction, staffingView, schedulingPersonDetails } from '../data/personnelScheduling';
import { matchesPersonnelSearch, parsePersonnelSearch } from '../data/personnelSearch';
import { PersonDetail } from './HrDirectory';
import './hr-workspace.css';
import './personnel-transfer.css';
import './personnel-scheduling.css';

const names = { 'release.publish': '预释放', 'release.withdraw': '撤回预释放', 'request.create': '提取 / 临时借调', 'request.decide': '处理申请', 'request.cancel': '取消申请', 'request.edit': '修改换项安排', 'request.return': '提前归还', 'rest.create': '调休', 'rest.claim': '提取' };
const colors = { 待确认: 'orange', 已同意待生效: 'blue', 已同意待开始: 'blue', 借调中: 'cyan', 已生效: 'green', 已恢复: 'green', 待补办: 'red', 已发起待确认: 'orange', 已复检关闭: 'green', 调休中: 'gold', 已提取待恢复: 'blue', 已拒绝: 'red' };
const badge = value => <Tag color={colors[value]}>{value || '待核实'}</Tag>;
const requestId = () => crypto.randomUUID();
const defaultPm = () => sessionStorage.getItem('mmos.transfer.preview-pm') || 'pm-wang-ran';

function ScheduleDate({ value, onChange, id }) {
  return <DatePicker id={id} value={value ? dayjs(value) : null} onChange={(_, text) => onChange(text)} format="YYYY-MM-DD" placeholder="选择日期" style={{ width: '100%' }} />;
}

function RecordEvidence({ record, checks, pmName, projName }) {
  const labels = { status: '状态', start: '开始日期', end: '预计归还日', resume: '恢复日期', restDays: '有效调休日数', targetId: '目标项目', targetName: '目标项目', ownerId: '原所属PM', requesterId: '用人PM', availableDate: '预计可用日', reason: '原因', sourceId: '来源记录', version: '来源版本', triggerId: '触发出勤记录', triggerVersion: '触发版本', actualEnd: '实际最后一天' };
  const format = (key, value) => value == null ? '未安排' : key.endsWith('PmId') || ['ownerId', 'requesterId'].includes(key) ? pmName(value) : key === 'targetId' ? projName(value) : String(value);
  const before = record.before && typeof record.before === 'object' ? record.before : {}, after = record.after && typeof record.after === 'object' ? record.after : {};
  const changes = Object.keys(labels).filter(key => Object.hasOwn(before, key) || Object.hasOwn(after, key)).map(key => ({ key, field: labels[key], before: format(key, before[key]), after: format(key, after[key]) }));
  const linked = checks.filter(f => record.factIds?.includes(f.id) || record.triggerId === f.id || f.evidenceId === record.id);
  return <Space orientation="vertical" style={{ width: '100%' }}><Descriptions size="small" column={1} items={[{ key: 'ref', label: '业务编号', children: record.id }, { key: 'op', label: '实际操作人', children: record.actor || record.operator || record.decidedBy || '系统 / 历史来源' }, { key: 'origin', label: '来源', children: record.exceptionId ? '跨PM出勤异常补办' : record.origin || '人员安排' }]} />
    {changes.length > 0 && <Table size="small" pagination={false} rowKey="key" dataSource={changes} columns={[{ title: '字段', dataIndex: 'field' }, { title: '办理前', dataIndex: 'before' }, { title: '办理后', dataIndex: 'after' }]} />}
    {record.corrections?.length > 0 && <Table size="small" rowKey={r => r.at} pagination={false} dataSource={record.corrections} columns={[{ title: '更正时间', dataIndex: 'at' }, { title: '原恢复日', render: (_, r) => r.before?.resume || '未安排' }, { title: '更正后恢复日', render: (_, r) => r.after?.resume || '待核实' }, { title: '依据', render: (_, r) => r.reason || `${r.sourceId} · 版本${r.version}` }]} />}
    {linked.length > 0 && <Table size="small" rowKey="id" dataSource={linked} columns={[{ title: '来源记录', dataIndex: 'id' }, { title: '工作日期', dataIndex: 'date' }, { title: '实际项目', dataIndex: 'projectName' }, { title: '小时', dataIndex: 'hours' }, { title: '复检结果', dataIndex: 'result' }]} />}
    {!changes.length && !record.corrections?.length && !linked.length && <p className="hr-muted">暂无日期更正或关联产出；实际投入仍待核实。</p>}
  </Space>;
}

export function useSchedulingData() {
  const [state, setState] = React.useState(null), [error, setError] = React.useState('');
  const refresh = React.useCallback(() => { try { setState(loadScheduling()); setError(''); } catch (e) { setError(e.message); } }, []);
  React.useEffect(() => { refresh(); const stop = subscribeHr(() => setState(loadHr())); const timer = setInterval(refresh, 60000); return () => { stop(); clearInterval(timer); }; }, [refresh]);
  return { state, error, refresh };
}

export function StaffingTodos({ role, onNavigate, managerFilter = 'all' }) {
  const { state, error } = useSchedulingData();
  if (!['PM', 'PA', 'PMO'].includes(role) || !state?.scheduling) return null;
  const pmId = role === 'PA' ? 'pm-wang-ran' : defaultPm();
  const pmName = id => state.transfers.managers.find(p => p.id === id)?.name || '待核实';
  const scope = id => role === 'PMO' ? managerFilter === 'all' || pmName(id) === managerFilter : id === pmId;
  const requests = state.scheduling.requests.filter(r => r.status === '待确认' && scope(r.ownerId)).map(r => ({ id: r.id, name: r.name, type: r.kind === 'loan' ? '借调确认' : '正式提取确认', pm: pmName(r.ownerId), project: r.targetName, period: `${r.start}${r.end ? ' 至 ' + r.end : ''}`, status: r.status }));
  const exceptions = state.scheduling.exceptions.filter(e => e.status !== '已复检关闭' && scope(e.pmId)).map(e => ({ id: e.id, name: state.people.find(p => p.id === e.personId)?.name, type: '跨PM出勤补办', pm: pmName(e.pmId), project: state.projects.find(p => p.id === e.projectId)?.name, period: `${e.start} 至 ${e.end}`, status: e.status }));
  return <Card className="todo-work-card" title={`人员调配待办 · ${role === 'PMO' ? '公司范围' : pmName(pmId)} · ${requests.length + exceptions.length}`} extra={<Button onClick={() => { sessionStorage.setItem('mmos.staffing.section', requests.length ? 'requests' : 'validation'); onNavigate('project-people'); }}>查看 / 办理</Button>}>
    {error && <Alert type="error" title={error} />}
    <Table size="small" rowKey="id" dataSource={[...requests, ...exceptions]} pagination={{ pageSize: 5 }} scroll={{ x: 780 }} columns={[{ title: '人员', dataIndex: 'name' }, { title: '事项', dataIndex: 'type' }, { title: '负责PM', dataIndex: 'pm' }, { title: '目标 / 实际项目', dataIndex: 'project' }, { title: '业务日期', dataIndex: 'period' }, { title: '状态', dataIndex: 'status', render: badge }]} locale={{ emptyText: '暂无人员调配确认或补办待办' }} />
  </Card>;
}

export default function PersonnelSchedulingPage({ page = 'project-people', role = 'PMO', onNavigate, onRoleChange }) {
  const { state, error, refresh } = useSchedulingData();
  const [pmId, setPm] = React.useState(defaultPm), [projectId, setProject] = React.useState('all');
  const [section, setSection] = React.useState(() => sessionStorage.getItem('mmos.staffing.section') || 'list');
  const [kind, setKind] = React.useState('intern'), [query, setQuery] = React.useState(''), [batchOpen, setBatchOpen] = React.useState(false);
  const [selected, setSelected] = React.useState([]), [op, setOp] = React.useState(null), [results, setResults] = React.useState(null), [detail, setDetail] = React.useState(null), [record, setRecord] = React.useState(null);
  const [busy, setBusy] = React.useState(false), [opError, setOpError] = React.useState(''), [dragging, setDragging] = React.useState(null), [status, setStatus] = React.useState();
  const [filters, setFilters] = React.useState({}), [listPage, setListPage] = React.useState(1);
  const [form] = Form.useForm();
  const [api, messageHolder] = message.useMessage();
  const currentPm = ['PA', '项目助理'].includes(role) ? 'pm-wang-ran' : pmId;
  const ctx = { role, pmId: currentPm, assistantId: 'pa-lianghe' };
  const pool = page === 'project-intern-pool';
  React.useEffect(() => { setSelected([]); setDetail(null); setOp(null); setResults(null); setStatus(undefined); setProject('all'); setQuery(''); setFilters({}); }, [role, currentPm, kind, page]);
  React.useEffect(() => { setSelected([]); setDragging(null); setListPage(1); }, [filters, query, projectId, kind, page, currentPm, role]);
  React.useEffect(() => { if (op) { form.resetFields(); form.setFieldsValue(op.defaults); } }, [op, form]);
  React.useEffect(() => { sessionStorage.removeItem('mmos.staffing.section'); }, []);
  if (error) return <Alert type="error" title={error} action={<Button onClick={refresh}>重试</Button>} />;
  if (!state?.scheduling) return <Card loading />;
  let v;
  try { v = staffingView(state, ctx); } catch (e) { return <Alert type="warning" title={e.message} />; }
  const can = v.ctx.writable, all = ['PMO', '人事', 'HR', '财务'].includes(role), today = beijingToday();
  const person = id => v.people.find(p => p.id === id) || { id, name: state.people.find(p => p.id === id)?.name || '未匹配', employeeNo: state.people.find(p => p.id === id)?.employeeNo };
  const pmName = id => v.managers.find(p => p.id === id)?.name || '未记录';
  const projName = id => v.projects.find(p => p.id === id)?.name || '未记录';
  const changePm = id => { setPm(id); sessionStorage.setItem('mmos.transfer.preview-pm', id); };
  const open = (type, rows, defaults = {}) => {
    setOpError('');
    const r = rows[0];
    setOp({ type, rows, revision: state.revision, requestId: requestId(), defaults: { date: r?.availableDate || today, kind: 'move', start: r?.start || today, end: r?.end || addDays(today, 2), targetId: r?.targetId, approve: true, ...defaults } });
  };
  const inspect = id => { try { setDetail(schedulingPersonDetails(state, ctx, id)); } catch (e) { api.error(e.message); } };
  const submit = async () => {
    try {
      const fields = await form.validateFields();
      if (op.type === 'request.create' && !op.rows[0]?.exceptionId) fields.kind = op.defaults.kind;
      if (op.type === 'request.create' && fields.kind === 'move') delete fields.end;
      setBusy(true); setOpError('');
      const payload = { ...fields, requestId: op.requestId, items: op.rows.map(r => ({ ...fields, personId: r.personId || r.id, id: r.id, exceptionId: r.exceptionId })) };
      const next = await schedulingAction(ctx, op.type, payload, op.revision);
      const outcome = next.scheduling.batches.find(b => b.id === op.requestId);
      setResults(outcome); setSelected([]); setOp(null); refresh();
      const ok = outcome.results.filter(r => r.success).length;
      api[ok === outcome.results.length ? 'success' : 'warning'](`${ok}人成功，${outcome.results.length - ok}人未完成，请查看逐人结果`);
    } catch (e) { if (!e.errorFields) setOpError(e.message); } finally { setBusy(false); }
  };
  const publicRows = kind === 'intern' ? v.rests.filter(r => ['调休中', '已提取待恢复'].includes(r.status)) : v.releases.filter(r => r.status === '已发布');
  const borrowedHere = p => v.requests.some(r => r.personId === p.id && r.requesterId === currentPm && r.status === '借调中' && (projectId === 'all' || r.targetId === projectId));
  const selectedPmPeople = v.people.filter(p => borrowedHere(p) || p.ownerId === currentPm && (projectId === 'all' || projectId === 'available' ? projectId !== 'available' || v.releases.some(r => r.personId === p.id && r.status === '已发布') : p.projectIds.includes(projectId)));
  const baseRows = pool ? publicRows.map(r => ({ ...person(r.personId), ...r, id: r.id, personId: r.personId })) : selectedPmPeople.map(p => ({ ...p, personId: p.id }));
  const releaseFor = r => v.releases.find(x => x.personId === r.personId && x.status === '已发布');
  const filterPm = r => pool && kind === 'intern' ? r.formerPmName || '未记录' : r.ownerId || '未记录';
  const filterDate = r => pool && kind === 'intern' ? r.start : releaseFor(r)?.availableDate;
  const optionsFrom = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')).map(value => ({ value, label: value }));
  const rows = baseRows.filter(r => {
    if (!matchesPersonnelSearch(`${r.name} ${r.employeeNo}`, parsePersonnelSearch(query))) return false;
    if (filters.employeeType && (filters.employeeType === 'intern' ? !isSchedulingIntern(r) : r.employeeType !== '全职')) return false;
    if (filters.manager && filterPm(r) !== filters.manager) return false;
    if (filters.education && (r.education || '未记录') !== filters.education) return false;
    if (filters.abilities?.length && !filters.abilities.some(t => (r.abilityTags || []).includes(t))) return false;
    if (filters.relation && (filters.relation === 'own' ? r.ownerId !== currentPm : r.ownerId === currentPm)) return false;
    if (filters.release && (filters.release === 'published' ? !releaseFor(r) : !!releaseFor(r))) return false;
    if (filters.restStatus && r.status !== filters.restStatus) return false;
    const date = filterDate(r);
    if (filters.availability && (!date || (filters.availability === 'now' ? date > today : date <= today))) return false;
    if (filters.dates?.length && (!date || date < filters.dates[0] || date > filters.dates[1])) return false;
    return true;
  });
  const updateFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }));
  const resetFilters = () => { setFilters({}); setQuery(''); };
  const basicFilters = <div className="staffing-basic-filters" aria-label="人员基础筛选">
    {!pool && <label><span>人员类型</span><Select aria-label="筛选人员类型" allowClear placeholder="全部类型" value={filters.employeeType} onChange={value => updateFilter('employeeType', value)} options={[{ value: 'fulltime', label: '全职' }, { value: 'intern', label: '实习生' }]} /></label>}
    {pool ? <label><span>{kind === 'intern' ? '前任PM' : '所属PM'}</span><Select aria-label={kind === 'intern' ? '筛选前任PM' : '筛选所属PM'} allowClear showSearch optionFilterProp="label" placeholder="全部PM" value={filters.manager} onChange={value => updateFilter('manager', value)} options={optionsFrom(baseRows.map(filterPm)).map(o => ({ ...o, label: kind === 'intern' || o.value === '未记录' ? o.value : pmName(o.value) }))} /></label> : <label><span>人员归属</span><Select aria-label="筛选人员归属" allowClear placeholder="全部归属" value={filters.relation} onChange={value => updateFilter('relation', value)} options={[{ value: 'own', label: '本人所属' }, { value: 'borrowed', label: '借入人员' }]} /></label>}
    <label className="staffing-filter-abilities"><span>能力标签（匹配任一）</span><Select aria-label="筛选能力标签" mode="multiple" allowClear maxTagCount="responsive" placeholder="全部能力" value={filters.abilities || []} onChange={value => updateFilter('abilities', value)} options={optionsFrom(baseRows.flatMap(r => r.abilityTags || []))} /></label>
    <label><span>学历</span><Select aria-label="筛选学历" allowClear placeholder="全部学历" value={filters.education} onChange={value => updateFilter('education', value)} options={optionsFrom(baseRows.map(r => r.education || '未记录'))} /></label>
    {!pool && <label><span>可用计划</span><Select aria-label="筛选可用计划" allowClear placeholder="全部计划" value={filters.release} onChange={value => updateFilter('release', value)} options={[{ value: 'published', label: '已发布' }, { value: 'unpublished', label: '未发布' }]} /></label>}
    {pool && (kind === 'intern' ? <label><span>调休状态</span><Select aria-label="筛选调休状态" allowClear placeholder="全部状态" value={filters.restStatus} onChange={value => updateFilter('restStatus', value)} options={optionsFrom(['调休中', '已提取待恢复'])} /></label> : <label><span>可用时间</span><Select aria-label="筛选可用时间" allowClear placeholder="全部时间" value={filters.availability} onChange={value => updateFilter('availability', value)} options={[{ value: 'now', label: '今日及以前可用' }, { value: 'future', label: '未来可用' }]} /></label>)}
    <label className="staffing-filter-dates"><span>{pool && kind === 'intern' ? '调休开始日期' : '预计可用日期'}</span><DatePicker.RangePicker placeholder={['开始日期', '结束日期']} aria-label="筛选日期范围" value={filters.dates?.map(d => dayjs(d)) || null} onChange={(_, dates) => updateFilter('dates', dates?.every(Boolean) ? dates : undefined)} /></label>
    <div className="staffing-filter-summary"><Button onClick={resetFilters}>重置筛选</Button><span role="status">符合条件 {rows.length} 人 / 当前范围 {baseRows.length} 人</span></div>
  </div>;
  const picked = rows.filter(r => selected.includes(r.id));
  const mine = r => r.ownerId === currentPm;
  const ownRelease = r => mine(r) && v.releases.some(x => x.personId === r.personId && x.status === '已发布');
  const withdrawDisabled = !picked.length || picked.some(r => !ownRelease(r));
  const poolClaimDisabled = !picked.length || picked.some(r => !isSchedulingIntern(r) && mine(r));
  const internalMove = op?.type === 'request.create' && op.rows.every(mine);
  const fixedRequestKind = op?.type === 'request.create' && !op.rows[0]?.exceptionId;
  const operationTitle = internalMove ? '本人项目调配' : fixedRequestKind ? op.defaults.kind === 'loan' ? '临时借调' : '提取' : names[op?.type];
  const claim = (selection, targetId) => {
    if (!selection.length) return;
    if (selection.some(ownRelease)) { api.info('自己的可用人员请直接撤回，无需提取'); return; }
    const intern = isSchedulingIntern(selection[0]);
    if (selection.some(r => isSchedulingIntern(r) !== intern)) { api.warning('请分别选择全职员工或调休实习生'); return; }
    open(intern ? 'rest.claim' : 'request.create', selection, { targetId, start: selection.reduce((d, r) => r.availableDate > d ? r.availableDate : d, today) });
  };
  const dropProject = (event, p) => {
    event.preventDefault(); const selection = dragging; setDragging(null);
    if (!selection?.length || !can || p.pmId !== currentPm || p.ended) { api.warning('请选择本人未结束项目作为去向'); return; }
    if (selection.some(r => isSchedulingIntern(r)) && !pool) { api.info('实习生请先办理调休，再从公共池提取'); return; }
    claim(selection, p.id);
  };
  const dragProps = r => ({ draggable: can && !ownRelease(r) && (pool ? kind === 'fulltime' && !mine(r) || kind === 'intern' && r.status === '调休中' : mine(r) && r.employeeType === '全职'), onDragStart: e => { const batch = selected.includes(r.id) ? picked : [r]; setDragging(batch); e.dataTransfer.setData('text/plain', batch.map(r => r.personId).join(',')); e.dataTransfer.effectAllowed = 'move'; }, onDragEnd: () => setDragging(null) });
  const rosterColumns = [
    { title: '人员', width: 155, fixed: 'left', render: (_, r) => <div className="transfer-person-cell"><span {...dragProps(r)} tabIndex={0} aria-label={`拖动${r.name}`} title={ownRelease(r) ? '自己的可用人员请直接撤回' : mine(r) && !pool ? '拖动到本人其他项目进行调配' : '拖动到本人项目；也可点击提取'}><HolderOutlined /></span><div><Button type="link" className="hr-name-link" onClick={() => inspect(r.personId)}>{r.name}</Button><small className="hr-cell-note">{r.employeeNo}</small><small>{r.employeeType}</small></div></div> },
    { title: pool && kind === 'intern' ? '前任PM' : '所属PM', width: 105, render: (_, r) => pool && kind === 'intern' ? r.formerPmName || '未记录' : pmName(r.ownerId) },
    { title: '能力 / 教育', width: 240, render: (_, r) => <><Space size={[0, 4]} wrap>{(r.abilityTags || []).map(t => <Tag key={t}>{t}</Tag>)}</Space><div className="hr-cell-note">{[r.english, r.education, r.school, r.major].filter(Boolean).join(' · ') || '待补齐'}</div></> },
    { title: pool ? kind === 'intern' ? '调休与恢复安排' : '可用计划 / 原项目' : '在项与可用计划', width: 250, render: (_, r) => pool && kind === 'intern' ? <>{badge(r.status)}<div>{r.start} 起调休</div>{r.resume && <small>{r.resume}恢复 · {projName(r.targetId)}</small>}</> : <>{(r.projectIds || []).map(id => <div key={id}>{projName(id)}</div>)}{(pool ? [r] : v.releases.filter(x => x.personId === r.personId && x.status === '已发布')).map(x => <div key={x.id}><Tag color="blue">{x.availableDate} 可用</Tag>{!r.projectIds?.length && x.sourceProjects?.map(p => p.name).join('、')}</div>)}{v.requests.filter(x => x.personId === r.personId && !['已取消', '已拒绝', '已到期结束', '已提前归还'].includes(x.status)).map(x => <small className="hr-cell-note" key={x.id}>{x.kind === 'loan' ? '借调' : '换项'} · {x.targetName} · {x.start} · {x.status}</small>)}</> },
    { title: '操作', width: 240, fixed: 'right', render: (_, r) => <Space size={0} wrap><Button type="link" onClick={() => inspect(r.personId)}>详情</Button>{can && (pool ? ownRelease(r) ? <Button type="link" onClick={() => open('release.withdraw', [r])}>撤回</Button> : <>{(kind === 'fulltime' || r.status === '调休中') && <Button type="link" onClick={() => claim([r])}>提取</Button>}{kind === 'fulltime' && <Button type="link" onClick={() => open('request.create', [r], { kind: 'loan', start: r.availableDate > today ? r.availableDate : today })}>借调</Button>}</> : mine(r) && <>{isSchedulingIntern(r) ? <Button type="link" onClick={() => open('rest.create', [r])}>调休</Button> : <><Button type="link" onClick={() => open('release.publish', [r], { date: v.releases.find(x => x.personId === r.personId)?.availableDate || today })}>预释放</Button>{v.releases.some(x => x.personId === r.personId && x.status === '已发布') && <Button type="link" onClick={() => open('release.withdraw', [r])}>撤回</Button>}</>}</>)}</Space> },
  ];
  const projectRail = <aside className="transfer-sidebar"><div className="transfer-sidebar-heading"><strong>{pmName(currentPm)}的项目</strong><p>{dragging ? `已拖起${dragging.length}人，请放入本人目标项目` : '当前身份的项目；拖入人员后填写办理日期'}</p></div><div className="transfer-project-tree"><button className="transfer-all-projects" onClick={() => setProject('all')}>全部在项人员</button>{!pool && <button className="transfer-all-projects" onClick={() => setProject('available')}>已发布可用计划</button>}{v.ownProjects.filter(p => !p.ended).map(p => ({ ...p, pmId: currentPm })).map(p => <button key={p.id} data-project-id={p.id} className={`transfer-project ${projectId === p.id ? 'is-selected' : ''}`} onClick={() => setProject(p.id)} onDragOver={e => e.preventDefault()} onDrop={e => dropProject(e, p)}><span className="transfer-project-mark" /><span><strong>{p.name}</strong><small>{p.projectNo || p.id}</small></span></button>)}</div></aside>;
  const search = <div className="transfer-filters"><Input.Search aria-label="人员搜索" placeholder="姓名、员工编号，多个用逗号分隔" value={query} onChange={e => setQuery(e.target.value)} allowClear /><Button onClick={() => setBatchOpen(true)}>批量搜索</Button><Button onClick={() => setSelected(rows.filter(r => !pool || kind !== 'intern' || r.status === '调休中').map(r => r.id))}>全选搜索结果</Button><Button onClick={() => setSelected([])}>清空选择</Button></div>;
  const list = <><Alert className="transfer-role-alert" showIcon type="info" title={pool ? kind === 'intern' ? '公共池直接提取，无需前任PM确认；确认出勤即结束调休' : '全职预释放保留原项目和所属PM；跨PM正式提取与借调均由原PM确认' : '变更所属PM统一由原PM确认，不区分交付线；到正式换项生效日才切换归属。'} />
    {pool && <Tabs activeKey={kind} onChange={k => { setKind(k); setSelected([]); }} items={[{ key: 'intern', label: '调休实习生' }, { key: 'fulltime', label: '全职员工' }]} />}
    <div className="staffing-layout">{projectRail}
    <Card className="transfer-list-card" title={pool ? '选择待分配人员' : `${pmName(currentPm)} · ${projectId === 'all' ? '全部项目' : projectId === 'available' ? '可用计划' : projName(projectId)}`}><div>{search}{basicFilters}<div className="transfer-batch-bar"><span>已选 <strong>{picked.length}</strong> 人{picked.length > 0 && ` · ${picked.map(r => r.name).join('、')}`}</span>{can && <Space wrap>{pool ? <><Button type="primary" disabled={poolClaimDisabled} onClick={() => claim(picked)}>提取</Button>{kind === 'fulltime' && <><Button disabled={poolClaimDisabled} onClick={() => open('request.create', picked, { kind: 'loan' })}>批量借调</Button><Button disabled={withdrawDisabled} onClick={() => open('release.withdraw', picked)}>批量撤回</Button></>}</> : <><Button disabled={!picked.length || picked.some(r => !mine(r) || r.employeeType !== '全职')} onClick={() => open('release.publish', picked)}>批量预释放</Button><Button disabled={!picked.length || picked.some(r => !mine(r) || !isSchedulingIntern(r))} onClick={() => open('rest.create', picked)}>批量调休</Button><Button disabled={withdrawDisabled} onClick={() => open('release.withdraw', picked)}>批量撤回</Button></>}</Space>}</div>
    <Table className="transfer-table" size="small" rowKey="id" columns={rosterColumns} dataSource={rows} rowSelection={can ? { selectedRowKeys: selected, onChange: setSelected, preserveSelectedRowKeys: true, getCheckboxProps: r => ({ disabled: pool && kind === 'intern' && r.status !== '调休中' }) } : undefined} onRow={dragProps} pagination={{ current: listPage, defaultPageSize: 8, showSizeChanger: true, onChange: setListPage }} scroll={{ x: 1100 }} locale={{ emptyText: <Empty description={baseRows.length ? '暂无符合筛选条件的人员' : '当前范围没有可查看人员'}>{baseRows.length > 0 && <Button onClick={resetFilters}>重置筛选</Button>}</Empty> }} /></div></Card></div></>;
  const requestColumns = [
    { title: '人员 / 申请', width: 150, render: (_, r) => <><strong>{r.name}</strong><div>{r.employeeNo}</div><small>{r.kind === 'loan' ? '临时借调' : '正式换项'}{r.exceptionId && ' · 异常补办'}</small></> },
    { title: '原PM → 用人PM', width: 150, render: (_, r) => `${pmName(r.ownerId)} → ${pmName(r.requesterId)}` },
    { title: '项目 / 时段', width: 230, render: (_, r) => <>{r.targetName}<div>{r.start}{r.end && ` 至 ${r.end}（含首尾${calendarDays(r.start, r.end) + 1}天）`}</div>{r.actualEnd && <small>实际最后一天 {r.actualEnd}</small>}</> },
    { title: '状态', width: 150, render: (_, r) => <>{badge(r.status)}<div className="hr-cell-note">{r.issue || r.reason || r.verification}</div></> },
    { title: '操作', width: 250, render: (_, r) => <Space size={0} wrap><Button type="link" onClick={() => setRecord(r)}>详情</Button>{can && r.ownerId === currentPm && r.status === '待确认' && <Button type="primary" size="small" onClick={() => open('request.decide', [r])}>同意 / 拒绝</Button>}{can && r.requesterId === currentPm && <>{r.status === '已同意待生效' && <Button type="link" onClick={() => open('request.edit', [r])}>修改</Button>}{['待确认', '已同意待生效', '已同意待开始'].includes(r.status) && <Button type="link" onClick={() => open('request.cancel', [r])}>取消</Button>}{r.status === '借调中' && <Button type="link" onClick={() => open('request.return', [r])}>提前归还</Button>}</>}</Space> },
  ];
  const confirming = v.requests.filter(r => selected.includes(r.id) && r.ownerId === currentPm && r.status === '待确认');
  const requests = <Card title="换项与借调申请" extra={<Select aria-label="申请状态筛选" style={{ width: 170 }} allowClear placeholder="全部状态" value={status} onChange={setStatus} options={[...new Set(v.requests.map(r => r.status))].map(value => ({ value, label: value }))} />}><Space style={{ marginBottom: 12 }}><Button type="primary" disabled={!can || !confirming.length} onClick={() => open('request.decide', confirming)}>批量同意 / 拒绝（{confirming.length}）</Button><span className="hr-muted">逐人校验和保存，单人失败不回滚其他人。</span></Space><Table rowSelection={can ? { selectedRowKeys: selected, onChange: setSelected, preserveSelectedRowKeys: true, getCheckboxProps: r => ({ disabled: r.ownerId !== currentPm || r.status !== '待确认' }) } : undefined} rowKey="id" size="small" columns={requestColumns} dataSource={v.requests.filter(r => !status || r.status === status).slice().reverse()} scroll={{ x: 1000 }} pagination={{ pageSize: 8 }} /><Alert type="info" title="同线与跨线采用同一原PM确认流程；预计归还日为借调最后一天，次日自动结束。" /></Card>;
  const restRecords = <Card title="调休与恢复记录"><Table rowKey="id" size="small" dataSource={v.rests.slice().reverse()} scroll={{ x: 1100 }} columns={[{ title: '人员', render: (_, r) => person(r.personId).name }, { title: '前任PM', render: (_, r) => r.formerPmName || '未记录' }, { title: '原填开始日', dataIndex: 'originalStart' }, { title: '恢复日 / 调休日', render: (_, r) => <>{r.resume || '待安排'}<div>{r.resume ? `${calendarDays(r.start, r.resume)}个日历日（恢复日不计）` : '调休区间待结束'}</div></> }, { title: '接收安排', render: (_, r) => r.targetId ? `${pmName(r.receiverId)} · ${projName(r.targetId)}` : '未提取' }, { title: '状态与核实', render: (_, r) => <>{badge(r.status)}<div>{r.verification || '待核实'}</div></> }, { title: '操作', render: (_, r) => <Button type="link" onClick={() => setRecord(r)}>日期与更正详情</Button> }]} /><Alert type="info" title="有效调休期间不计薪资成本；这里只提供区间与更正事实，已结算金额须人工复核。" /></Card>;
  const exceptionColumns = [{ title: '人员', render: (_, e) => person(e.personId).name }, { title: '实际用人PM / 项目', render: (_, e) => `${pmName(e.pmId)} · ${projName(e.projectId)}` }, { title: '异常期间', render: (_, e) => `${e.start} 至 ${e.end}` }, { title: '状态', dataIndex: 'status', render: badge }, { title: '未解决明细', render: (_, e) => e.openFacts?.length || 0 }, { title: '处理', render: (_, e) => <Space><Button type="link" onClick={() => setRecord(e)}>详情</Button>{can && e.pmId === currentPm && e.status === '待补办' && <Button type="primary" size="small" onClick={() => open('request.create', [{ personId: e.personId, exceptionId: e.id }], { targetId: e.projectId, start: e.start, end: e.end, kind: 'loan' })}>补办</Button>}</Space> }];
  const validation = <><Card title="跨PM出勤补办"><Alert className="transfer-role-alert" showIcon type="warning" title="补办由实际用人PM发起，原PM确认后复检；仅提交申请不会关闭异常。真实产出和工时完整保留。" /><Table rowKey="id" columns={exceptionColumns} dataSource={v.exceptions} scroll={{ x: 1000 }} /></Card><Card title="产出核实明细" style={{ marginTop: 16 }} extra={<Button onClick={refresh}>重新核实已载入数据</Button>}><p className="hr-muted">数据截至：{state.scheduling.dataAsOf || state.scheduling.facts.at(-1)?.receivedAt || '来源待接入'}；没有产出保留待核实。</p><Table rowKey={r => r.id} size="small" dataSource={v.checks} scroll={{ x: 1100 }} columns={[{ title: '来源 / 版本', render: (_, f) => `${f.id} / ${f.version || '未提供'}` }, { title: '人员', dataIndex: 'personName' }, { title: '实际项目', dataIndex: 'projectName' }, { title: '业务日期', dataIndex: 'date' }, { title: '实际小时', dataIndex: 'hours' }, { title: '核实结果', dataIndex: 'result', render: badge }, { title: '依据 / 原因', render: (_, f) => f.reason || f.evidenceId || '来源已确认' }]} /></Card></>;
  const logs = <><Card title="通知记录"><Alert title="这里展示通知接收人和内容；飞书消息服务尚未连接。" type="info" /><Table rowKey="id" size="small" dataSource={v.notices.slice().reverse()} columns={[{ title: '接收人', render: (_, r) => pmName(r.recipient) !== '未记录' ? pmName(r.recipient) : state.people.find(p => p.id === r.recipient)?.name || r.recipient }, { title: '内容', dataIndex: 'text' }, { title: '状态', dataIndex: 'status' }]} /></Card><Card title="操作审计" style={{ marginTop: 16 }}><Table rowKey="id" size="small" dataSource={v.audit.slice().reverse()} columns={[{ title: '实际操作人', dataIndex: 'actor' }, { title: '所代表PM', render: (_, r) => pmName(r.representedPmId) }, { title: '动作', dataIndex: 'action' }, { title: '业务日期', dataIndex: 'businessDate' }, { title: '真实操作时间', dataIndex: 'at' }, { title: '记录', render: (_, r) => <Button type="link" onClick={() => setRecord(r)}>前后值</Button> }]} /></Card></>;
  return <div className="hr-page personnel-transfer-page staffing-page">{messageHolder}<div className="hr-page-heading"><div><p className="eyebrow">项目 · 人员安排</p><h1>{pool ? '待分配人员' : '在项人员'}</h1><p className="subtitle">预释放、正式换项、临时借调与实习生调休</p></div><Space wrap>{onRoleChange && <Select aria-label="人员安排角色" value={role} onChange={onRoleChange} options={['PM', 'PA', 'PMO', '人事', '财务'].map(value => ({ value, label: value === 'PA' ? '项目助理 · 梁禾' : value }))} />}<Select aria-label="当前办理PM" value={currentPm} disabled={['PA', '项目助理'].includes(role)} onChange={changePm} style={{ width: 190 }} options={v.managers.map(m => ({ value: m.id, label: `${can ? '办理身份' : '查看身份'} · ${m.name}` }))} /></Space></div>
    {!can && <Alert className="transfer-role-alert" type="info" title="当前角色只读；切换为项目经理可办理，项目助理仅在授权范围内代办。" />}
    {role === 'PA' && <Alert className="transfer-role-alert" type="info" title="梁禾代表王然办理，仅限已授权项目；每次操作均记录实际操作者并提醒王然。" />}
    <div className="staffing-summary"><Card size="small"><span>公开可用全职</span><strong>{v.releases.filter(r => r.status === '已发布').length}</strong></Card><Card size="small"><span>调休中实习生</span><strong>{v.rests.filter(r => r.status === '调休中').length}</strong></Card><Card size="small"><span>待确认申请</span><strong>{v.requests.filter(r => r.status === '待确认').length}</strong></Card><Card size="small"><span>待补办 / 待核实</span><strong>{v.exceptions.filter(r => r.status !== '已复检关闭').length}</strong></Card></div>
    {results && <Alert className="transfer-role-alert" type={results.results.every(r => r.success) ? 'success' : 'warning'} closable onClose={() => setResults(null)} title="本次逐人处理结果" description={<Space wrap>{results.results.map((r, i) => <Tag key={i} color={r.success ? 'green' : 'red'}>{person(r.personId).name}：{r.success ? '成功' : '未完成'} · {r.message}</Tag>)}</Space>} />}
    <Tabs activeKey={section} onChange={key => { setSection(key); setSelected([]); }} items={[{ key: 'list', label: pool ? '待分配列表' : '在项人员', children: list }, { key: 'requests', label: '换项 / 借调申请', children: requests }, { key: 'rests', label: '调休记录', children: restRecords }, { key: 'validation', label: `产出核实与补办${v.exceptions.some(e => e.status !== '已复检关闭') ? ' · 待处理' : ''}`, children: validation }, { key: 'history', label: '通知与日志', children: logs }]} />
    <Modal title="批量搜索人员" open={batchOpen} onCancel={() => setBatchOpen(false)} onOk={() => setBatchOpen(false)} cancelText="取消" okText="应用搜索"><Input.TextArea aria-label="批量人员名单" rows={6} value={query} onChange={e => setQuery(e.target.value)} placeholder="每行一位姓名或员工编号；支持逗号、空格分隔" /><p>按任一关键词匹配当前页签，支持跨页全选后批量拖动。</p></Modal>
    <Modal open={!!op} title={operationTitle} width={640} onCancel={() => !busy && setOp(null)} onOk={submit} confirmLoading={busy} okText="确认办理" cancelText="取消" destroyOnHidden>
      {op && <><p>办理对象：{op.rows.map(r => person(r.personId || r.id).name).join('、')}</p>{opError && <Alert type="error" title={opError} />}{op.revision !== state.revision && <Alert type="warning" title="数据已变化，请关闭后重新打开，保留最新有效安排。" />}
      <Form form={form} layout="vertical" preserve={false}>
        {op.type === 'request.create' && !fixedRequestKind && <Form.Item name="kind" label="办理方式" rules={[{ required: true }]}><Radio.Group options={internalMove ? [{ value: 'move', label: '本人项目调配（所属PM不变）' }] : [{ value: 'move', label: '正式提取（到期切换所属PM）' }, { value: 'loan', label: '临时借调（保留原PM）' }]} /></Form.Item>}
        {['request.create', 'request.edit', 'rest.claim'].includes(op.type) && <Form.Item name="targetId" label="目标项目" rules={[{ required: true, message: '请选择目标项目' }]}><Select showSearch optionFilterProp="label" disabled={!!op.rows[0]?.exceptionId} options={(op.rows[0]?.exceptionId ? v.projects.filter(p => p.id === op.defaults.targetId) : v.ownProjects.filter(p => !p.ended)).map(p => ({ value: p.id, label: p.name }))} /></Form.Item>}
        {['request.create', 'request.edit'].includes(op.type) && <Form.Item name="start" label={op.rows[0]?.exceptionId ? '实际业务开始日期' : fixedRequestKind && op.defaults.kind === 'loan' ? '借调开始日期' : '计划生效日期'} rules={[{ required: true, message: '请选择日期' }]}><ScheduleDate /></Form.Item>}
        {op.type === 'request.create' && <Form.Item noStyle shouldUpdate>{({ getFieldValue }) => (fixedRequestKind ? op.defaults.kind : getFieldValue('kind')) === 'loan' && <><Form.Item name="end" label="预计归还日期（最后一天，含当天）" rules={[{ required: true, message: '请选择归还日期' }]}><ScheduleDate /></Form.Item><p className="hr-muted">预计{Math.max(0, calendarDays(getFieldValue('start'), getFieldValue('end')) + 1) || '—'}个日历日；实际工时以产出为准。</p></>}</Form.Item>}
        {['release.publish', 'rest.create', 'rest.claim'].includes(op.type) && <Form.Item name="date" label={op.type === 'release.publish' ? '预计可用日期' : op.type === 'rest.create' ? '调休开始日期' : '提取恢复日期'} rules={[{ required: true, message: '请选择日期' }]}><ScheduleDate /></Form.Item>}
        {op.type === 'request.decide' && <><Form.Item name="approve" label="确认意见" rules={[{ required: true }]}><Radio.Group options={[{ value: true, label: '同意' }, { value: false, label: '拒绝' }]} /></Form.Item><Form.Item noStyle shouldUpdate>{({ getFieldValue }) => getFieldValue('approve') === false && <Form.Item name="reason" label="拒绝原因" rules={[{ required: true, whitespace: true, message: '请填写拒绝原因' }]}><Input.TextArea rows={3} /></Form.Item>}</Form.Item></>}
        <Alert type="info" showIcon title={({ 'release.publish': '只发布预计可用日期，原所属PM及项目关系保持。', 'release.withdraw': '撤回后停止公开展示，人员所属PM和原项目保持不变；已提交申请保留。', 'request.create': internalMove ? '本人项目调配直接形成安排，所属PM保持不变。' : fixedRequestKind ? op.defaults.kind === 'loan' ? '借调申请由原PM确认，借调期间保留原所属PM；预计归还日计入借调期间。' : '提取申请由原PM确认，到计划生效日切换所属PM与项目。' : '补办申请提交后由原PM确认，通过后重新核实对应出勤。', 'request.cancel': '取消未生效申请后停止原计划，不需原PM再确认。', 'request.edit': '直接保存新计划并通知原PM，不再审批。', 'request.return': `提前归还无需原PM确认，${today}仍为有效借调日，次日起不再覆盖。`, 'rest.create': '到开始日退出全部项目；有效调休区间不计薪资成本。', 'rest.claim': '保存后立即占用人员；按恢复日执行，有更早确认出勤则自动恢复。' })[op.type] || '逐人校验已有安排、项目和最新归属，冲突不会覆盖原计划。'} />
      </Form></>}
    </Modal>
    <Modal title="业务详情与依据" open={!!record} onCancel={() => setRecord(null)} width={850} footer={<Button onClick={() => setRecord(null)}>关闭</Button>} destroyOnHidden>{record && <><Descriptions column={2} bordered size="small" items={Object.entries({ 人员: person(record.personId).name, 当前状态: record.status, 原所属PM: record.ownerId && pmName(record.ownerId), 用人PM: record.requesterId && pmName(record.requesterId), 目标项目: record.targetName, 业务开始日: record.start, 预计结束日: record.end, 业务生效日: record.businessEffectiveDate, 原填恢复日: record.originalResume, 当前恢复日: record.resume, 真实提交时间: record.createdAt, 真实确认时间: record.approvedAt, 实际归还日: record.actualEnd, 核实结果: record.verification, 拒绝原因: record.reason }).filter(([, value]) => value).map(([label, children]) => ({ key: label, label, children }))} /><h3>来源与前后值</h3><RecordEvidence record={record} checks={v.checks} pmName={pmName} projName={projName} /></>}</Modal>
    {detail && <PersonDetail person={detail.person} view={detail.view} role={role} onClose={() => setDetail(null)} refresh={refresh} onNavigate={onNavigate} allowActions={false} readOnlyNote="沿用人员主库详情；历史项目及敏感资料按当前权限展示。" />}
  </div>;
}
