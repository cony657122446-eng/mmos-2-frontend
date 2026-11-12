import React from 'react';
import { Alert, Button, Card, Empty, Input, Modal, Radio, Select, Space, Table, Tabs, Tag, Tooltip, message } from 'antd';
import { ApartmentOutlined, BellOutlined, CoffeeOutlined, HistoryOutlined, HolderOutlined, SearchOutlined, SwapOutlined, TeamOutlined } from '@ant-design/icons';
import { getHrView, subscribeHr } from '../data/hrWorkspace';
import { PmAvailableList } from './PmAvailableList';
import { TRANSFER_MANAGERS, getPoolPersonDetails, getTransferView, transferAction } from '../data/hrTransfers';
import { displayText } from '../data/displayText';
import { insertPersonnelSearchPaste, matchesPersonnelSearch, parsePersonnelSearch } from '../data/personnelSearch';
import { PersonDetail } from './HrDirectory';
import './hr-workspace.css';
import './personnel-transfer.css';

const DEFAULT_PM = 'pm-wang-ran';
const POOL_TABS = [{ key: 'intern', label: '调休实习生' }, { key: 'fulltime', label: '全职员工' }];
const OWN_ROSTER = '__own_roster__';
const DRAG_TYPE = 'application/x-mmos-personnel';
const unique = values => [...new Set(values.filter(Boolean))];
const displayTime = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
const actionNames = {
  transfer: '换项',
  'available.release': '释放至可分配人员', claim: '提取',
  'pool.enter': '移入调休池',

};

function useTransferData(actorId, role) {
  const [view, setView] = React.useState(null);
  const [error, setError] = React.useState('');
  const scope = React.useRef({ actorId, role });
  scope.current = { actorId, role };
  const refresh = React.useCallback(() => {
    try {
      setView(getTransferView(scope.current.actorId, scope.current.role));
      setError('');
    } catch (err) {
      setError(err.message || '人员调配数据读取失败');
    }
  }, []);
  React.useEffect(() => {
    refresh();
    return subscribeHr(refresh);
  }, [actorId, role, refresh]);
  return { view: view?.actor?.id === actorId && view?.role === role ? view : null, error, refresh };
}

export default function PersonnelTransferPage({ page = 'project-people', role = 'PMO', onNavigate, onRoleChange, focusProjectNo }) {
  const [actorId, setActorId] = React.useState(() => TRANSFER_MANAGERS.find(pm => pm.id === sessionStorage.getItem('mmos.transfer.preview-pm'))?.id || DEFAULT_PM);
  const { view, error, refresh } = useTransferData(actorId, role);
  const tab = page === 'project-intern-pool' ? 'pool' : 'people';
  const [browsePmId, setBrowsePmId] = React.useState(DEFAULT_PM);
  const [scope, setScope] = React.useState({ type: 'mine' });
  const [query, setQuery] = React.useState('');
  const [batchSearchOpen, setBatchSearchOpen] = React.useState(false);
  const [batchSearchDraft, setBatchSearchDraft] = React.useState('');
  const [batchSearchScope, setBatchSearchScope] = React.useState('own');
  const [poolTab, setPoolTab] = React.useState('intern');
  const [employeeType, setEmployeeType] = React.useState();
  const [sourceProject, setSourceProject] = React.useState();
  const [selectedKeys, setSelectedKeys] = React.useState([]);
  const [poolKeys, setPoolKeys] = React.useState([]);
  const [operation, setOperation] = React.useState(null);
  const [targetProjectId, setTargetProjectId] = React.useState();
  const [operationError, setOperationError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [audit, setAudit] = React.useState(null);
  const [detail, setDetail] = React.useState(null);
  const [poolDetailId, setPoolDetailId] = React.useState(null);
  const [poolDetailData, setPoolDetailData] = React.useState(null);
  const [dragCount, setDragCount] = React.useState(0);
  const [dropTarget, setDropTarget] = React.useState(null);
  const drag = React.useRef(null);
  const pointerDrag = React.useRef(null);
  const [messageApi, messageContext] = message.useMessage();

  const endDrag = React.useCallback(() => {
    const sourceBrowsePmId = drag.current?.sourceBrowsePmId;
    drag.current = null;
    if (sourceBrowsePmId) setBrowsePmId(sourceBrowsePmId);
    setDropTarget(null);
    setDragCount(0);
  }, []);

  const cancelPointerDrag = React.useCallback(() => {
    const current = pointerDrag.current;
    pointerDrag.current = null;
    if (current?.handle.hasPointerCapture(current.pointerId)) {
      current.handle.releasePointerCapture(current.pointerId);
    }
    endDrag();
  }, [endDrag]);

  React.useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'Escape') cancelPointerDrag();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', cancelPointerDrag);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', cancelPointerDrag);
      const current = pointerDrag.current;
      pointerDrag.current = null;
      if (current?.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
    };
  }, [cancelPointerDrag]);

  React.useEffect(() => {
    cancelPointerDrag();
    setScope({ type: 'mine' });
    setBrowsePmId(actorId);
    setSelectedKeys([]);
    setPoolKeys([]);
    setOperation(null);
    setOperationError('');
    setDetail(null);
    setPoolDetailId(null);
    setBatchSearchOpen(false);
    setSourceProject(undefined);
  }, [actorId, role]);

  React.useEffect(() => {
    setQuery('');
    setEmployeeType(undefined);
    setSourceProject(undefined);
    setSelectedKeys([]);
    setPoolKeys([]);
    setOperation(null);
    setOperationError('');
    setDetail(null);
    setPoolDetailId(null);
    setBatchSearchOpen(false);
    cancelPointerDrag();
  }, [page, cancelPointerDrag]);

  React.useEffect(() => {
    if (!focusProjectNo || !view) return;
    const project = view.projects.find(item => item.id === focusProjectNo || item.projectNo === focusProjectNo);
    if (project?.lineId === view.actor.lineId) {
      setBrowsePmId(project.pmId);
      setScope({ type: 'project', id: project.id });
    }
  }, [focusProjectNo, view?.actor?.id]);

  React.useEffect(() => {
    if (!view) return;
    setSelectedKeys(keys => keys.filter(key => view.rows.some(row => row.key === key && row.canTransfer)));
    setPoolKeys(keys => keys.filter(key => [...view.pool, ...view.available].some(row => row.personId === key && (row.canClaim || row.canManage || row.canClaimAvailable))));
  }, [view?.revision, view?.actor?.id]);

  React.useEffect(() => {
    if (!poolDetailId || !view) {
      setPoolDetailData(null);
      return;
    }
    try {
      const details = getPoolPersonDetails(actorId, role, poolDetailId);
      if (!details) {
        setPoolDetailId(null);
        setPoolDetailData(null);
        messageApi.info('该人员已离开名单或当前无权查看，详情已关闭');
        return;
      }
      setPoolDetailData({ ...details, actorId, role });
    } catch (err) {
      setPoolDetailId(null);
      setPoolDetailData(null);
      messageApi.error(displayText(err.message) || '人员详情读取失败，请重试');
    }
  }, [poolDetailId, actorId, role, page, view?.revision, messageApi]);

  if (error) return <div className="hr-page"><Alert type="error" showIcon title="人员调配数据读取失败" description={error} action={<Button onClick={refresh}>重试</Button>} /></div>;
  if (!view) return <Card loading aria-label="正在加载在项人员" />;

  const { actor, projects, managers, canOperate } = view;
  const activeProjects = projects.filter(project => !project.ended);
  const ownProjects = activeProjects.filter(project => project.pmId === actorId);
  const lineManagers = managers.filter(manager => manager.lineId === actor.lineId);
  const lineProjects = activeProjects.filter(project => project.lineId === actor.lineId);
  const linePmIds = new Set(lineManagers.map(manager => manager.id));
  const activeProjectIds = new Set(lineProjects.map(project => project.id));
  const lineRows = view.rows.filter(row => linePmIds.has(row.pmId) && activeProjectIds.has(row.sourceProjectId));
  const browseManager = managers.find(manager => manager.id === browsePmId) || actor;
  const browseProjects = lineProjects.filter(project => project.pmId === browseManager.id);
  const scopedRows = lineRows.filter(row => scope.type === 'mine' ? row.pmId === actorId : scope.type === 'manager' ? row.pmId === scope.id : row.sourceProjectId === scope.id);
  const searchKeywords = parsePersonnelSearch(query);
  const draftKeywords = parsePersonnelSearch(batchSearchDraft);
  const matchesQuery = person => matchesPersonnelSearch(displayText(`${person.name} ${person.employeeNo}`), searchKeywords);
  const rows = scopedRows.filter(row => matchesQuery(row) && (!employeeType || row.employeeType === employeeType) && (!sourceProject || row.sourceProjectId === sourceProject));
  const selectableRows = rows.filter(row => row.canTransfer);
  const managerRoster = view.available.filter(row => row.ownerId === browseManager.id);
  const rosterOpen = tab === 'people' && scope.type === 'roster';
  const internTab = tab === 'pool' && poolTab === 'intern';
  const pmColumn = internTab ? { title: '前任PM', dataIndex: 'formerPmName' } : { title: '所属PM', dataIndex: 'ownerName' };
  const candidates = rosterOpen ? managerRoster : internTab ? view.pool : view.available.filter(row => row.visible);
  const pool = candidates.filter(person => matchesPersonnelSearch(displayText([
    person.name, person.employeeNo, ...(person.abilityTags || []), person.english, person.education, person.school, person.major,
    person[pmColumn.dataIndex], ...(person.projectExperience || []).map(project => project.name),
  ].filter(Boolean).join(' ')), searchKeywords));
  const canExtract = row => canOperate && (row.canClaimAvailable || (row.canClaim || row.canManage && !row.assignedProjectIds.length) && ownProjects.length > 0);
  const selectedRows = view.rows.filter(row => selectedKeys.includes(row.key) && row.canTransfer);
  const selectedPool = candidates.filter(row => poolKeys.includes(row.personId) && canExtract(row));
  const history = view.history.filter(item => !['approval.submit', 'approval.resolve'].includes(item.type));
  const selectedScopeProject = projects.find(project => scope.type === 'project' && project.id === scope.id);
  const selectedScopePm = managers.find(manager => scope.type === 'manager' && manager.id === scope.id);
  const sourceManagerId = selectedScopeProject?.pmId || selectedScopePm?.id || actorId;
  const scopeTitle = selectedScopeProject?.name || (selectedScopePm ? `${selectedScopePm.name}的项目人员` : canOperate ? '我的全部项目' : `${actor.name}的全部项目`);
  const sourceIds = new Set(operation?.items?.map(item => item.sourceProjectId) || []);
  const extracting = operation?.kind === 'claim';
  const allowRoster = extracting && operation.rows.every(row => row.canClaimAvailable);
  const targets = extracting ? ownProjects : lineProjects.filter(project => !sourceIds.has(project.id));
  const targetProject = projects.find(project => project.id === targetProjectId);
  const crossPm = operation?.kind === 'transfer' && targetProject && targetProject.pmId !== actorId;
  const moveDestination = targetProjectId === OWN_ROSTER ? '你的可分配人员列表' : targetProject && `项目「${targetProject.name}」`;
  const sourcePms = extracting ? unique(operation.rows.filter(row => row.canClaimAvailable).map(row => row.ownerName)) : [];
  const notifiedPm = extracting ? sourcePms.join('、') : crossPm ? targetProject.pmName : null;
  const stale = operation && operation.revision !== view.revision;
  const visiblePoolDetails = poolDetailData?.actorId === actorId && poolDetailData?.role === role
    && poolDetailData?.person.id === poolDetailId && candidates.some(person => person.personId === poolDetailId)
    ? poolDetailData : null;

  function closeOperation() {
    if (busy) return;
    setOperation(null);
    setOperationError('');
    setTargetProjectId(undefined);
  }

  async function execute(kind, payload, revision = view.revision) {
    if (busy || !canOperate) return false;
    setBusy(true);
    setOperationError('');
    try {
      await Promise.resolve(transferAction(actorId, kind, payload, revision, role));
      refresh();
      setSelectedKeys([]);
      setPoolKeys([]);
      setOperation(null);
      setTargetProjectId(undefined);
      const successMessages = {
        transfer: '换项成功',
        'available.release': '已加入本人可分配人员列表', 'available.visibility': '共享状态已更新', claim: `已将 ${payload.members?.length} 人提取到${moveDestination}`,
        'pool.enter': '移入调休池成功，通知已记录',
      };
      messageApi.success(successMessages[kind]);
      return true;
    } catch (err) {
      setOperationError(displayText(err.message) || '操作失败，请刷新后重试');
      refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }

  function openOperation(kind, selection, destination, revision = view.revision) {
    if (!canOperate || !selection.length || busy) return;
    if (kind === 'pool.enter' && selection.some(row => !row.canEnterPool)) {
      messageApi.warning('调休池适用于实习生，请仅选择本人项目下可调休的实习生');
      return;
    }
    const items = selection.map(row => ({ personId: row.personId, sourceProjectId: row.sourceProjectId }));
    if (destination && kind === 'transfer' && destination.pmId === actorId) {
      execute(kind, { items, targetProjectId: destination.id }, revision);
      return;
    }
    setOperation({ kind, items, personIds: unique(selection.map(row => row.personId)), names: unique(selection.map(row => row.name)), rows: selection, revision });
    setTargetProjectId(destination?.id);
    setOperationError('');
  }

  function submitOperation() {
    if (!operation || stale) return;
    if (operation.kind === 'claim') {
      const roster = targetProjectId === OWN_ROSTER;
      execute('claim', { members: operation.rows.map(row => ({ personId: row.personId, key: row.intern ? undefined : row.key })), destination: roster ? 'roster' : 'project', targetProjectId: roster ? undefined : targetProjectId, confirmed: true }, operation.revision);
    } else if (['pool.enter', 'available.release'].includes(operation.kind)) {
      execute(operation.kind, { items: operation.items }, operation.revision);
    } else {
      execute(operation.kind, { items: operation.items, targetProjectId, confirmed: Boolean(crossPm) }, operation.revision);
    }
  }

  function draggableRow(row, kind) {
    if (!canOperate || busy) return false;
    return kind === 'claim' ? canExtract(row) : row.canTransfer;
  }

  function dragContext(row, kind) {
    if (!draggableRow(row, kind)) return null;
    const selected = kind === 'transfer' ? selectedRows : selectedPool;
    const selection = selected.some(item => item.personId === row.personId && item.key === row.key) ? selected : [row];
    return { actorId, kind, selection, revision: view.revision, sourceBrowsePmId: browsePmId };
  }

  function dragRowProps(row, kind) {
    return { draggable: Boolean(draggableRow(row, kind)), onDragStart: event => startDrag(event, row, kind), onDragEnd: endDrag };
  }

  function startDrag(event, row, kind) {
    const current = !pointerDrag.current && dragContext(row, kind);
    if (!current) { event.preventDefault(); return; }
    drag.current = current;
    const { selection } = current;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ actorId, keys: selection.map(person => person.key || person.personId) }));
    event.dataTransfer.setData('text/plain', selection.map(person => person.name).join('、'));
    setDragCount(selection.length);
  }

  function canDrop(project) {
    const current = drag.current;
    if (!current || !canOperate || current.actorId !== actorId || project.ended) return false;
    if (project.id === OWN_ROSTER) return current.kind === 'claim' && current.selection.every(row => row.canClaimAvailable);
    if (current.kind === 'claim') return project.pmId === actorId;
    return project.lineId === actor.lineId && !current.selection.some(row => row.sourceProjectId === project.id);
  }

  function projectAtPointer(event) {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const projectId = element?.closest('[data-transfer-project-id]')?.dataset.transferProjectId;
    return projectId === OWN_ROSTER ? { id: OWN_ROSTER } : projects.find(project => project.id === projectId);
  }

  function hoverManager(managerId) {
    const current = drag.current;
    if (!current || current.kind !== 'transfer' || current.actorId !== actorId || !canOperate) return;
    if (!lineManagers.some(manager => manager.id === managerId)) return;
    setBrowsePmId(managerId);
    setDropTarget(null);
  }

  function dragOverManager(event, managerId) {
    if (!drag.current || drag.current.kind !== 'transfer') return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    hoverManager(managerId);
  }

  function startPointerDrag(event, row, kind) {
    const current = event.button === 0 && dragContext(row, kind);
    if (!current) return;
    event.preventDefault();
    pointerDrag.current = {
      ...current,
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      active: false, handle: event.currentTarget,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePointerDrag(event) {
    const current = pointerDrag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (!current.active) {
      if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 6) return;
      current.active = true;
      drag.current = current;
      setDragCount(current.selection.length);
    }
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const managerId = element?.closest('[data-transfer-manager-id]')?.dataset.transferManagerId;
    if (managerId) hoverManager(managerId);
    const project = projectAtPointer(event);
    setDropTarget(project && canDrop(project) ? project.id : null);
  }

  function finishPointerDrag(event) {
    const current = pointerDrag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    const project = current.active ? projectAtPointer(event) : null;
    const validTarget = project && canDrop(project);
    cancelPointerDrag();
    if (validTarget) openOperation(current.kind, current.selection, project, current.revision);
  }

  function dragHandle(row, kind = 'transfer', caption) {
    const enabled = draggableRow(row, kind);
    return <span draggable={false} title={kind === 'claim' ? `拖动${row.name}到提取去向` : undefined} className={enabled ? 'transfer-drag-handle' : 'transfer-drag-handle is-disabled'}
      onPointerDown={event => startPointerDrag(event, row, kind)}
      onPointerMove={movePointerDrag} onPointerUp={finishPointerDrag}
      onPointerCancel={cancelPointerDrag} onLostPointerCapture={cancelPointerDrag}
      onDragStart={event => { event.preventDefault(); event.stopPropagation(); }}>
      <HolderOutlined />{caption && <span className="transfer-drag-caption">{caption}</span>}
    </span>;
  }

  function dropOnProject(event, project) {
    event.preventDefault();
    event.stopPropagation();
    const current = drag.current;
    if (!canDrop(project)) return;
    endDrag();
    openOperation(current.kind, current.selection, project, current.revision);
  }

  function projectButton(project) {
    const isDropTarget = dropTarget === project.id;
    return <button key={project.id} type="button" data-transfer-project-id={project.id} className={`transfer-project ${scope.type === 'project' && scope.id === project.id ? 'is-selected' : ''} ${isDropTarget ? 'is-drop-target' : ''}`}
      onClick={() => { setScope({ type: 'project', id: project.id }); setSourceProject(undefined); }}
      onDragOver={event => { if (canDrop(project)) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(project.id); } }}
      onDragLeave={() => setDropTarget(current => current === project.id ? null : current)}
      onDrop={event => dropOnProject(event, project)} aria-label={`${project.pmName}的项目 ${project.name}${isDropTarget ? '，松开以调配' : ''}`}>
      <span className="transfer-project-mark" /><span><strong>{project.name}</strong><small>{project.projectNo || project.id}</small></span>
      <span className="transfer-project-count">{view.rows.filter(row => row.sourceProjectId === project.id).length}</span>
    </button>;
  }

  function showDetail(row) {
    setDetail(row);
  }

  function selectBrowseManager(managerId) {
    if (drag.current) {
      hoverManager(managerId);
      return;
    }
    setBrowsePmId(managerId);
    setScope({ type: 'manager', id: managerId });
    setPoolKeys([]);
    setQuery('');
    setEmployeeType(undefined);
    setSourceProject(undefined);
  }

  function openBatchSearch() {
    setBatchSearchDraft(query);
    setBatchSearchScope('own');
    setBatchSearchOpen(true);
  }

  function applyBatchSearch() {
    if (tab === 'people' && !rosterOpen && batchSearchScope === 'own') selectBrowseManager(actorId);
    setQuery(draftKeywords.join('、'));
    setBatchSearchOpen(false);
  }

  function pastePersonnelSearch(event) {
    const pastedText = event.clipboardData.getData('text');
    if (!/[\r\n\t]/.test(pastedText)) return;
    event.preventDefault();
    const input = event.target;
    const result = insertPersonnelSearchPaste(query, pastedText, input.selectionStart, input.selectionEnd);
    setQuery(result.value);
    requestAnimationFrame(() => {
      if (input.isConnected) input.setSelectionRange(result.caret, result.caret);
    });
  }

  function selectMatchingRows() {
    const nextKeys = unique([...selectedKeys, ...selectableRows.map(row => row.key)]);
    const added = nextKeys.length - selectedKeys.length;
    setSelectedKeys(nextKeys);
    messageApi.success(`已选中当前结果的 ${selectableRows.length} 条可调配关联，新增 ${added} 条`);
  }

  const detailView = detail ? getHrView(role) : null;
  const allowedDetailPerson = detailView && [...(detailView.projectPeople || []), ...(detailView.people || []), ...(detailView.external || [])].find(person => person.id === detail.personId);
  const canUseLegacyActions = role === 'PM' && actorId === DEFAULT_PM && detail?.pmId === actorId && Boolean(allowedDetailPerson);
  const detailPerson = detail && (allowedDetailPerson || {
    id: detail.personId, name: detail.name, employeeNo: detail.employeeNo,
    employeeType: detail.employeeType, manager: detail.pmName,
    projectIds: detail.projectIds || [], projectNames: unique(view.rows.filter(row => row.personId === detail.personId).map(row => row.sourceProjectName)),
  });
  const legacyView = allowedDetailPerson ? detailView : { projects: lineProjects, outputs: [], attendance: [] };

  const peopleColumns = [
    { title: '人员', key: 'name', fixed: 'left', width: 190, render: (_, row) => <div className="transfer-person-cell"><Tooltip title={row.canTransfer ? '拖向PM展开项目，再拖入目标项目' : row.reason || '仅可调配本人项目人员'}>{dragHandle(row)}</Tooltip><div><Button type="link" className="hr-name-link" onClick={() => showDetail(row)}>{row.name}</Button><small className="hr-cell-note">{row.employeeNo || '—'}</small></div></div> },
    { title: '本次源项目', dataIndex: 'sourceProjectName', width: 220, render: (value, row) => <div>{value}<small className="hr-cell-note">{row.pmName}{row.projectIds.length > 1 ? ` · 同时关联 ${row.projectIds.length} 个项目` : ''}</small></div> },
    { title: '员工类型', dataIndex: 'employeeType', width: 125, render: (value, row) => <Tag color={row.intern ? 'cyan' : 'default'}>{value}</Tag> },
    { title: '调配范围', key: 'scope', width: 185, render: (_, row) => row.canTransfer ? <span className="transfer-scope-text">可换项{row.canEnterPool ? ' · 可调休' : ''}</span> : <span className="hr-muted">{row.reason || (row.pmId !== actorId ? '该PM负责的人员' : '当前类型暂不支持换项')}</span> },
    { title: '操作', key: 'actions', fixed: 'right', width: 210, render: (_, row) => <Space size={0}><Button type="link" onClick={() => showDetail(row)}>详情</Button>{row.canTransfer && <Button type="link" disabled={busy} onClick={() => openOperation('transfer', [row])}>换项</Button>}{row.canTransfer && row.employeeType === '全职' && <Button type="link" disabled={busy} onClick={() => openOperation('available.release', [row])}>释放</Button>}{row.canEnterPool && <Button type="link" disabled={busy} onClick={() => openOperation('pool.enter', [row])}>调休</Button>}</Space> },
  ];

  const poolColumns = [
    { title: '待分配人员', key: 'person', fixed: 'left', width: 170, render: (_, row) => <div className="transfer-person-cell transfer-pool-person">{dragHandle(row, 'claim')}<div><Button type="link" className="hr-name-link" onClick={() => setPoolDetailId(row.personId)}>{displayText(row.name)}</Button><small className="hr-cell-note">{displayText(row.employeeNo)}</small><small className="hr-cell-note">{displayText(row.employeeType)}</small></div></div> },
    { title: '能力 / 英语', key: 'ability', width: 220, render: (_, row) => <div className="transfer-pool-skills">{row.abilityTags?.length ? <Space className="transfer-pool-abilities" wrap size={[0, 5]}>{row.abilityTags.map(tag => <Tag color="blue" key={tag}>{displayText(tag)}</Tag>)}</Space> : <span className="hr-muted">未录入能力标签</span>}<small className="hr-cell-note">英语 · {displayText(row.english) || '未录入'}</small></div> },
    { ...pmColumn, width: 100, render: value => displayText(value) || <span className="hr-muted">未记录</span> },
    { title: '专业 / 学历', key: 'education', width: 190, render: (_, row) => <div className="transfer-pool-education"><span>{displayText(row.major) || '专业未录入'}</span><small className="hr-cell-note">{[row.education, row.school].filter(Boolean).map(displayText).join(' · ') || '学历及学校未录入'}</small></div> },
    { title: '过往项目', dataIndex: 'projectExperience', width: 230, render: experience => experience?.length ? <Tooltip title={experience.map(project => displayText(project.name)).join('、')}><div className="transfer-pool-projects">{experience.slice(0, 2).map(project => <span key={project.id}>{displayText(project.name)}</span>)}{experience.length > 2 && <small className="hr-cell-note">共 {experience.length} 个项目</small>}</div></Tooltip> : <span className="hr-muted">暂无项目经历</span> },
    { title: '待分配时间', dataIndex: 'enteredAt', width: 160, render: value => <span className="hr-muted">{displayText(displayTime(value))}</span> },
    { title: '操作', key: 'actions', className: 'transfer-pool-actions', fixed: 'right', width: 150, render: (_, row) => <Space size={0}><Button type="link" size="small" onClick={() => setPoolDetailId(row.personId)}>详情</Button>{canOperate && <Button type="link" size="small" disabled={busy || !canExtract(row)} onClick={() => openOperation('claim', [row])}>提取</Button>}</Space> },
  ];

  const extractSelection = { selectedRowKeys: selectedPool.map(row => row.personId), preserveSelectedRowKeys: true, onChange: setPoolKeys, getCheckboxProps: row => ({ disabled: busy || !canExtract(row) }) };
  const extractButtons = <Space wrap><Button disabled={busy || !pool.some(canExtract)} onClick={() => setPoolKeys(keys => unique([...keys, ...pool.filter(canExtract).map(row => row.personId)]))}>全选搜索结果</Button><Button type="primary" disabled={busy || !selectedPool.length} onClick={() => openOperation('claim', selectedPool)}>提取</Button>{selectedPool.length > 0 && <>{dragHandle(selectedPool[0], 'claim', `拖动已选 ${selectedPool.length} 人`)}<Button type="text" onClick={() => setPoolKeys([])}>清空选择</Button></>}</Space>;
  const personnelList = <>
        <div className="hr-card-heading"><div><h2>{tab === 'pool' ? '待分配人员' : scopeTitle}</h2><p>{tab === 'pool' ? (internTab ? '前任PM为实习生本次进入调休池时的项目经理，可提取到本人未结束项目。' : '所属PM为当前可分配名单的项目经理。其他PM公开的员工可提取到本人名单或未结束项目。') : `${unique(rows.map(row => row.personId)).length} 名人员 · ${rows.length} 条项目关联`}</p></div>{selectedScopeProject && !selectedScopeProject.projectNo?.startsWith('DEMO-TRANSFER-') && tab === 'people' && <Button onClick={() => onNavigate?.(`projects:${selectedScopeProject.projectNo || selectedScopeProject.id}`)}>项目详情</Button>}</div>
        {tab === 'people' && sourceManagerId !== actorId && <div className="transfer-view-note">当前查看其他PM的项目人员。操作PM为 {actor.name}，已选的本人项目关联可拖动到中间列的目标项目。<Button type="link" size="small" onClick={() => selectBrowseManager(actorId)}>查看本人项目</Button></div>}
        <div className="transfer-filters"><Input allowClear aria-label={tab === 'pool' ? `搜索姓名、编号、能力、专业、英语或${pmColumn.title}` : '搜索在项人员，多个姓名或编号可用空格或逗号分隔'} prefix={<SearchOutlined />} placeholder={tab === 'pool' ? `姓名 / 能力 / 专业 / ${pmColumn.title}` : '姓名 / 编号，可输入多个'} value={query} onChange={event => setQuery(event.target.value)} onPaste={pastePersonnelSearch} /><Button icon={<SearchOutlined />} onClick={openBatchSearch}>批量搜索</Button>{tab === 'people' && <><Select allowClear aria-label="筛选员工类型" placeholder="员工类型" value={employeeType} onChange={setEmployeeType} options={unique(scopedRows.map(row => row.employeeType)).map(value => ({ value, label: value }))} /><Select allowClear showSearch optionFilterProp="label" aria-label="筛选源项目" placeholder="源项目" value={sourceProject} onChange={setSourceProject} options={activeProjects.filter(project => scopedRows.some(row => row.sourceProjectId === project.id)).map(project => ({ value: project.id, label: project.name }))} /></>}<Button onClick={() => { setQuery(''); setEmployeeType(undefined); setSourceProject(undefined); }}>重置筛选</Button></div>
        {tab === 'people' && searchKeywords.length > 0 && <div className="transfer-search-summary"><span>{scopeTitle} · {searchKeywords.length} 个关键词，匹配任意一个 · {rows.length} 条结果</span><Button type="link" size="small" onClick={() => setQuery('')}>清除关键词</Button></div>}
        <div className="transfer-batch-bar"><span>已选 <strong>{tab === 'pool' ? selectedPool.length : selectedRows.length}</strong> {tab === 'pool' ? '人' : '条项目关联'}{tab === 'people' && selectedRows.length > 0 ? ` · ${unique(selectedRows.map(row => row.personId)).length} 人` : ''}</span><Space wrap>{tab === 'people' ? <><Tooltip title="选中当前筛选结果中的全部可调配关联，包含其他分页"><Button disabled={!canOperate || !selectableRows.length || busy} onClick={selectMatchingRows}>全选可调配结果（{selectableRows.length}）</Button></Tooltip><Button type="primary" icon={<SwapOutlined />} disabled={!canOperate || !selectedRows.length || busy} onClick={() => openOperation('transfer', selectedRows)}>批量换项</Button><Button icon={<CoffeeOutlined />} disabled={!canOperate || !selectedRows.length || busy} onClick={() => openOperation('pool.enter', selectedRows)}>移入调休池</Button><Button disabled={!selectedRows.length || busy || selectedRows.some(r => r.employeeType !== '全职')} onClick={() => openOperation('available.release', selectedRows)}>批量释放全职人员</Button></> : extractButtons}{tab === 'people' && selectedKeys.length > 0 && <Button type="text" onClick={() => { setSelectedKeys([]); setPoolKeys([]); }}>清空选择</Button>}</Space></div>
        {tab === 'people' && selectedRows.length > 0 && <div className="transfer-selected-drag">{dragHandle(selectedRows[0], 'transfer', `拖动已选 ${selectedRows.length} 条关联`)}<span>{unique(selectedRows.map(row => row.name)).join('、')}</span></div>}
        <Table className="transfer-table" rowKey={row => tab === 'pool' ? row.personId : row.key} columns={tab === 'pool' ? poolColumns : peopleColumns} dataSource={tab === 'pool' ? pool : rows} loading={busy} scroll={{ x: tab === 'pool' ? 1252 : 1030 }} pagination={{ pageSize: 10, showSizeChanger: true, showTotal: total => `共 ${total} 条` }}
          rowSelection={tab === 'pool' ? extractSelection : { selectedRowKeys: selectedKeys, preserveSelectedRowKeys: true, onChange: setSelectedKeys, getCheckboxProps: row => ({ disabled: busy || !row.canTransfer }) }}
          onRow={row => dragRowProps(row, tab === 'people' ? 'transfer' : 'claim')}
          locale={{ emptyText: <Empty description={tab === 'pool' ? query ? '暂无匹配的待分配人员' : '暂无符合条件的待分配人员' : '当前筛选范围暂无在项人员'} /> }} />
  </>;
  return <div className="hr-page personnel-transfer-page">
    {messageContext}
    <div className="hr-page-heading"><div><p className="eyebrow">项目 · 人员调配</p><h1>{tab === 'pool' ? '待分配人员' : '在项人员'}</h1><p className="subtitle">{tab === 'pool' ? '查看各PM已公开的全职人员和调休池中的全部实习生。' : '拖动人员，悬停PM展开项目，再放入目标项目。'}</p></div><div className="transfer-identity"><label htmlFor="transfer-actor">{canOperate ? '操作PM' : '查看PM范围'}</label><Select id="transfer-actor" aria-label="操作PM" value={actorId} onChange={value => { sessionStorage.setItem('mmos.transfer.preview-pm', value); setActorId(value); setPoolDetailId(null); }} disabled={busy} options={managers.map(manager => ({ value: manager.id, label: `${manager.name} · ${manager.lineName}` }))} /></div></div>
    <div className="transfer-page-toolbar"><Space wrap><Tag icon={<ApartmentOutlined />} color="blue">{tab === 'pool' ? '全公司共享' : actor.lineName}</Tag><span className="hr-muted">{canOperate ? '操作PM' : '查看范围'} · {actor.name}</span></Space><Space wrap><Button icon={<HistoryOutlined />} onClick={() => setAudit('history')}>调配记录</Button><Button icon={<BellOutlined />} onClick={() => setAudit('notifications')}>通知记录</Button></Space></div>
    {!canOperate && <Alert className="transfer-role-alert" type="info" showIcon title="当前角色可查看人员调配" description="切换为PM后，可选择本人项目人员进行换项、调休与提取。" action={onRoleChange && <Button onClick={() => onRoleChange('PM')}>切换为PM</Button>} />}
    {operationError && !operation && <Alert className="transfer-role-alert" type="error" showIcon closable onClose={() => setOperationError('')} title={operationError} action={<Button onClick={() => { refresh(); setOperationError(''); }}>刷新数据</Button>} />}
    <div className={`transfer-layout ${tab === 'pool' ? 'is-pool' : ''}`}>
      {tab === 'people' && <aside className="transfer-sidebar transfer-managers-column" aria-label="项目经理">
        <div className="transfer-sidebar-heading"><h2>项目经理</h2><p>{actor.lineName}</p></div>
        <div className="transfer-manager-list">
          {lineManagers.map(manager => <button type="button" key={manager.id} data-transfer-manager-id={manager.id} className={`transfer-manager ${browseManager.id === manager.id ? 'is-selected' : ''} ${dragCount > 0 && browseManager.id === manager.id ? 'is-drag-hover' : ''}`} onClick={() => selectBrowseManager(manager.id)} aria-pressed={browseManager.id === manager.id}
            onDragEnter={event => dragOverManager(event, manager.id)}
            onDragOver={event => dragOverManager(event, manager.id)}
            onDrop={event => { event.preventDefault(); event.stopPropagation(); endDrag(); }}>
            <span className="transfer-manager-avatar">{manager.name.slice(-2)}</span>
            <span className="transfer-manager-text"><strong>{manager.name}</strong><small>{lineProjects.filter(project => project.pmId === manager.id).length} 个项目{manager.id === actorId ? ' · 本人' : ''}</small></span>
          </button>)}
        </div>
      </aside>}
      <aside className="transfer-sidebar transfer-projects-column" aria-label={tab === 'pool' ? '本人可提取项目' : `${browseManager.name}的未结束项目`}>
        <div className="transfer-sidebar-heading"><h2>{tab === 'pool' ? '提取目标项目' : '未结束项目'}</h2><p>{tab === 'pool' ? actor.name : browseManager.name} · {tab === 'pool' ? ownProjects.length : browseProjects.length} 个项目</p></div>
        {dragCount > 0 && <div className="transfer-drag-tip">已拖起 {dragCount} 条 · {drag.current?.kind === 'claim' ? '放入可用去向后确认提取' : tab === 'pool' ? '放入目标项目' : '悬停PM切换项目，放入目标项目'}</div>}
        <div className="transfer-project-tree">
          {(tab === 'pool' && !internTab || rosterOpen && browseManager.id !== actorId) && canOperate && <button type="button" className={`transfer-project ${dropTarget === OWN_ROSTER ? 'is-drop-target' : ''}`} data-transfer-project-id={OWN_ROSTER}
            onDragOver={event => { if (canDrop({id: OWN_ROSTER})) { event.preventDefault(); setDropTarget(OWN_ROSTER); } }} onDragLeave={() => setDropTarget(null)} onDrop={event => dropOnProject(event, {id: OWN_ROSTER})}
            onClick={() => { if (selectedPool.length && selectedPool.every(row => row.canClaimAvailable)) openOperation('claim', selectedPool, {id: OWN_ROSTER}); }}
            disabled={!(dragCount ? drag.current?.selection : selectedPool)?.every(row => row.canClaimAvailable) || !dragCount && !selectedPool.length}>我的可分配人员列表</button>}
          {rosterOpen && browseManager.id !== actorId && canOperate && <div><h3>我的目标项目</h3>{ownProjects.map(projectButton)}</div>}
          {tab === 'pool' ? ownProjects.length ? ownProjects.map(projectButton) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该PM暂无未结束项目" /> : <>
            <button type="button" className={`transfer-all-projects ${!['project', 'roster'].includes(scope.type) ? 'is-selected' : ''}`} onClick={() => { setScope({ type: 'manager', id: browseManager.id }); setSourceProject(undefined); }}><TeamOutlined /><span>全部项目人员</span><b>{browseProjects.length}</b></button>
            <button type="button" className={`transfer-all-projects ${rosterOpen ? 'is-selected' : ''}`} aria-pressed={rosterOpen} onClick={() => { setScope({ type: 'roster', id: browseManager.id }); setQuery(''); setPoolKeys([]); setPoolDetailId(null); setSelectedKeys([]); }}><TeamOutlined /><span>可分配人员</span><b>{managerRoster.length}</b></button>
            {browseProjects.map(projectButton)}
            {!browseProjects.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该PM暂无未结束项目" />}
          </>}
        </div>
      </aside>
      <Card className="transfer-list-card">
        {rosterOpen ? <><div className="transfer-filters"><Input aria-label="搜索可分配人员" placeholder="姓名 / 编号，可输入多个" allowClear value={query} onChange={e => setQuery(e.target.value)} onPaste={pastePersonnelSearch}/><Button onClick={openBatchSearch}>批量搜索</Button></div>
          <div className="transfer-batch-bar">已选 {selectedPool.length} 人 {extractButtons}</div>
          <PmAvailableList manager={browseManager} rows={pool} busy={busy} selection={extractSelection} onRow={row => dragRowProps(row, 'claim')} renderGrip={row => dragHandle(row, 'claim')} onInspect={setPoolDetailId} onClaim={row => openOperation('claim', [row])} canExtract={canExtract}
          onVisibility={(row, visible) => execute('available.visibility', { key: row.key, visible })} /></> : tab === 'pool' ?
          <Tabs activeKey={poolTab} destroyOnHidden onChange={key => {
            cancelPointerDrag(); setPoolTab(key); setQuery(''); setPoolKeys([]); setPoolDetailId(null); setOperation(null); setOperationError('');
          }} items={POOL_TABS.map(item => ({ ...item, children: item.key === poolTab ? personnelList : null }))} /> : personnelList}
      </Card>
    </div>
    <Modal open={batchSearchOpen} title="批量搜索人员" onCancel={() => setBatchSearchOpen(false)} onOk={applyBatchSearch} okText="应用搜索" cancelText="取消" width={620} destroyOnHidden>
      <div className="transfer-batch-search-form">
        <div><label className="transfer-field-label" htmlFor="transfer-batch-search">姓名或员工编号</label><Input.TextArea id="transfer-batch-search" aria-label="批量搜索姓名或员工编号" rows={6} allowClear value={batchSearchDraft} onChange={event => setBatchSearchDraft(event.target.value)} placeholder={'可直接粘贴Excel名单\n张三，李四\nMCE00001234'} /><p className="hr-muted">支持空格、逗号、顿号、分号、换行和制表符，匹配任意一个关键词。</p><small className="hr-cell-note">已识别 {draftKeywords.length} 个不同关键词，留空可恢复普通浏览。</small></div>
        {tab === 'people' && !rosterOpen && <div><span className="transfer-field-label">搜索范围</span><Radio.Group value={batchSearchScope} onChange={event => setBatchSearchScope(event.target.value)}><Space orientation="vertical"><Radio value="own">{canOperate ? '本人' : actor.name}全部未结束项目</Radio><Radio value="current">当前列表范围 · {scopeTitle}</Radio></Space></Radio.Group><p className="hr-muted">{batchSearchScope === 'own' ? `搜索${actor.name}全部未结束项目，并清除员工类型和源项目筛选。` : '保留当前PM、项目和员工类型筛选。'}</p></div>}
      </div>
    </Modal>
    <Modal open={Boolean(operation)} title={operation ? actionNames[operation.kind] : ''} onCancel={closeOperation} width={640} destroyOnHidden footer={<Space><Button disabled={busy} onClick={closeOperation}>{extracting ? '取消提取' : notifiedPm ? '否，取消换项' : '取消'}</Button><Button type="primary" loading={busy} disabled={Boolean(stale) || (!['pool.enter', 'available.release'].includes(operation?.kind) && !targetProjectId)} onClick={submitOperation}>{extracting ? '提取' : notifiedPm ? '是，换项并通知' : operation ? actionNames[operation.kind] : '确认'}</Button></Space>}>
      {operation && <div className="transfer-operation-form">
        <div><span className="transfer-field-label">所选人员 · {operation.personIds.length} 人</span><Space wrap size={[0, 6]}>{operation.names.map(name => <Tag key={name}>{name}</Tag>)}</Space></div>
        {operation.kind === 'available.release' ? <Alert showIcon type="info" title="仅结束所选的来源项目关联" description={`来源项目：${unique(operation.rows.map(r => r.sourceProjectName)).join('、')}。新加入本人列表的人员默认隐藏；已在列表中的人员保留原显隐状态。`} /> : operation.kind === 'pool.enter' ? <><Alert showIcon type="info" title="入池将结束所选实习生的全部当前项目关联" description="进入公司共享调休池后无交付线归属，并生成本人“你已被调休”的通知记录。" /><div className="transfer-affected-projects">{operation.personIds.map(personId => {
          const person = operation.rows.find(row => row.personId === personId);
          const currentProjectNames = person.currentProjects?.map(project => project.name) || person.projectIds.map(id => projects.find(project => project.id === id)?.name || id);
          return <div key={personId}><strong>{person.name}</strong><span>{unique(currentProjectNames).join('、')}</span></div>;
        })}</div></> : <>
          <div><label className="transfer-field-label" htmlFor="transfer-target">{extracting ? '提取去向' : '目标项目'}</label><Select id="transfer-target" aria-label={extracting ? '提取去向' : '选择目标项目'} showSearch optionFilterProp="label" value={targetProjectId} onChange={setTargetProjectId} placeholder={allowRoster ? '选择我的可分配名单或项目' : '选择未结束的目标项目'} style={{ width: '100%' }} options={[...(allowRoster ? [{ value: OWN_ROSTER, label: '我的可分配人员列表' }] : []), ...targets.map(project => ({ value: project.id, label: `${project.pmName} · ${project.name} · ${project.lineName}` }))]} notFoundContent={<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可用目标项目" />} /></div>
          {allowRoster && <p className="hr-muted">提取后将从原 PM 名单移出。提取到本人名单时默认隐藏，可再设为公开。</p>}
          {extracting && operation.rows.some(row => row.intern) && <Alert type="info" showIcon title="调休实习生将直接加入所选项目" description="调休池人员无交付线限制，将生成实习生及目标项目PM、PA、QA的通知记录。" />}
          {operation.kind === 'transfer' && <p className="hr-muted">换项将结束本次选择的 {operation.items.length} 条源项目关联。</p>}
          {notifiedPm && <Alert type="warning" showIcon title={extracting ? `确认提取${operation.names.join('、')}并通知原项目经理${notifiedPm}？` : "如果进行换项，则会提示该项目经理，是否换项？"} description={extracting ? `提取去向：${moveDestination || '请选择'}。确认后将分别通知：${operation.rows.filter(row => row.canClaimAvailable).map(row => row.ownerName + '（' + row.name + '）').join('、')}。` : `确认后，${operation.names.join('、')}将加入${moveDestination}，并生成发给项目经理${notifiedPm}的通知记录。`} />}
        </>}
        {stale && <Alert type="warning" showIcon title="人员数据已发生变化" description="请关闭此窗口，按最新列表重新选择人员后操作。" />}
        {operationError && <Alert type="error" showIcon title={operationError} />}
      </div>}
    </Modal>
    <Modal open={Boolean(audit)} title={audit === 'notifications' ? '通知记录' : '调配记录'} onCancel={() => setAudit(null)} width={1000} footer={<Button onClick={() => setAudit(null)}>关闭</Button>} destroyOnHidden>
      {operationError && <Alert className="transfer-audit-note" type="error" showIcon closable title={operationError} onClose={() => setOperationError('')} />}
      {audit === 'notifications' ? <Table rowKey="id" size="small" dataSource={view.notifications} scroll={{ x: 760 }} pagination={{ pageSize: 6 }} locale={{ emptyText: <Empty description="完成调配后可查看通知记录" /> }} columns={[
        { title: '接收人', key: 'recipient', width: 150, render: (_, row) => <div>{row.recipientName}<small className="hr-cell-note">{row.recipientRole}</small></div> },
        { title: '通知内容', dataIndex: 'content', render: displayText }, { title: '时间', dataIndex: 'createdAt', width: 175, render: displayTime }, { title: '状态', dataIndex: 'status', width: 100, render: value => <Tag color={value === '模拟待配置' ? 'warning' : 'blue'}>{displayText(value)}</Tag> },
      ]} /> : <Table rowKey="id" size="small" dataSource={history} scroll={{ x: 780 }} pagination={{ pageSize: 6 }} locale={{ emptyText: <Empty description="暂无调配记录" /> }} columns={[
          { title: '操作', dataIndex: 'title', width: 140, render: displayText }, { title: '内容', key: 'summary', render: (_, row) => <div>{displayText(row.summary)}<small className="hr-cell-note">{row.actorName}</small></div> }, { title: '状态', dataIndex: 'status', width: 120, render: displayText }, { title: '时间', dataIndex: 'createdAt', width: 175, render: displayTime },
      ]} />}
    </Modal>
    {detail && <PersonDetail person={detailPerson} role={role} view={legacyView} onClose={() => setDetail(null)} projectMode projectId={detail.sourceProjectId} refresh={refresh} onNavigate={onNavigate} allowActions={canUseLegacyActions || (role === '人事' && Boolean(allowedDetailPerson))} readOnlyNote={!canUseLegacyActions && role === 'PM' ? '当前详情为只读。培训操作请切换王然并查看本人项目。' : undefined} />}
    {visiblePoolDetails && <PersonDetail person={visiblePoolDetails.person} role={role} view={visiblePoolDetails.view} onClose={() => setPoolDetailId(null)} refresh={refresh} onNavigate={onNavigate} allowActions={false} />}
  </div>;
}
