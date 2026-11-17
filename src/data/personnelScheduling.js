import { initializeTransferState, TRANSFER_MANAGERS } from './hrTransfers.js';
import { beijingToday, employmentStatus, HR_KEY, loadHr, updateHrWorkspace, projectHrPersonDetail } from './hrWorkspace.js';

const copy = value => structuredClone(value);
const check = (value, message) => { if (!value) throw new Error(message); };
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const stamp = () => new Date().toISOString();
export const addDays = (date, count) => new Date(Date.parse(date + 'T12:00:00Z') + count * 86400000).toISOString().slice(0, 10);
export const calendarDays = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const isSchedulingIntern = p => ['实习生', '在校实习生', '往届实习生'].includes(p?.employeeType);
const dateOk = date => /^\d{4}-\d{2}-\d{2}$/.test(date || '') && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
const manager = (s, id) => s.transfers.managers.find(p => p.id === id);
const projectPm = (s, projectId) => s.transfers.managers.find(m => m.name === s.projects.find(p => p.id === projectId)?.pm)?.id;
const alive = (p, day) => p && p.category === '内部人员' && !p.terminated && employmentStatus(p, day) !== '已离职';
const approved = r => Boolean(r.approvedAt) && !['已取消', '已拒绝'].includes(r.status);
const unresolved = r => !['已恢复', '已取消'].includes(r.status);
const visibleRoles = ['PM', 'PA', '项目助理', 'PMO', '人事', 'HR', '财务'];

function note(s, event, recipients, text) {
  [...new Set(recipients.filter(Boolean))].forEach(recipient => {
    const key = event + ':' + recipient;
    if (!s.scheduling.notices.some(n => n.id === key)) s.scheduling.notices.push({ id: key, event, recipient, text, at: stamp(), status: '待接入消息服务' });
  });
}
function audit(s, ctx, action, objectId, before, after, day) {
  s.scheduling.audit.push({ id: uid(), at: stamp(), actor: ctx.actorName || manager(s, ctx.pmId)?.name || '系统', representedPmId: ctx.pmId || '', role: ctx.role, action, objectId, businessDate: day, before: copy(before ?? null), after: copy(after ?? null) });
  if (['PA', '项目助理'].includes(ctx.role)) note(s, `${objectId}:${action}:${s.scheduling.audit.length}`, [ctx.pmId], `${ctx.actorName}代您办理${action}，业务日期${day}，请查看记录。`);
}

export function ensureScheduling(previous, day = beijingToday()) {
  if (previous.scheduling?.version === 1) return ensureSchedulingExamples(copy(previous), day);
  const s = initializeTransferState(previous, day);
  s.scheduling = { version: 1, initializedOn: day, owners: {}, releases: [], requests: [], rests: [], facts: [], exceptions: [], audit: [], notices: [], batches: [], sourceHistory: [], checks: [], lastCheckedAt: '',
    // Explicit local authorization fixture. PA cannot choose an arbitrary PM.
    delegations: [{ id: 'pa-lianghe', name: '梁禾', pmId: 'pm-wang-ran', projectIds: s.projects.filter(p => p.pm === '王然').map(p => p.id) }],
    legacy: { available: copy(s.transfers.available || []), pool: copy(s.transfers.pool || []), approvals: copy(s.transfers.approvals || []) } };
  for (const p of s.people) {
    const legacy = s.transfers.available.find(r => r.personId === p.id);
    const ids = [...new Set(p.projectIds.map(id => projectPm(s, id)).filter(Boolean))];
    const ownerId = legacy?.ownerId || (ids.length === 1 ? ids[0] : null);
    if (ownerId) s.scheduling.owners[p.id] = [{ pmId: ownerId, from: day, source: '升级时当前归属快照' }];
    // Import plans only. Never fabricate an approval or restore an ended relation.
    if (legacy) s.scheduling.releases.push({ id: 'legacy-' + legacy.key, personId: p.id, ownerId: legacy.ownerId, availableDate: day, status: legacy.visible ? '已发布' : '已撤回', sourceProjects: copy(legacy.sources || []), createdAt: legacy.enteredAt, origin: '旧可分配名单迁移', migrationNote: '保留旧项目关系及显隐快照，未补造审批' });
    const pool = s.transfers.pool.find(r => r.personId === p.id && p.transferControl?.pool);
    if (pool) s.scheduling.rests.push({ id: 'legacy-' + pool.operationId + ':' + p.id, personId: p.id, ownerId: pool.formerPmId || pool.actorId, formerPmName: pool.formerPmName || '', start: pool.enteredAt.slice(0, 10), originalStart: pool.enteredAt.slice(0, 10), status: '调休中', sourceProjects: copy(pool.sourceProjectIds || []), createdAt: pool.enteredAt, entered: true, corrections: [], origin: '旧调休记录迁移' });
  }
  // Ready-to-use examples are separate plans; existing employee/project facts stay intact.
  for (const pm of TRANSFER_MANAGERS) {
    const p = s.people.find(p => p.employeeType === '全职' && p.demo && ownerAt(s, p.id, day) === pm.id && p.projectIds.length && !s.scheduling.releases.some(r => r.personId === p.id));
    if (p) s.scheduling.releases.push({ id: `release-${p.id}`, personId: p.id, ownerId: pm.id, availableDate: day, status: '已发布', sourceProjects: p.projectIds.map(id => ({ id, name: s.projects.find(x => x.id === id)?.name })), createdAt: day + 'T09:00:00+08:00', origin: '预释放样例' });
  }
  const p = s.people.find(p => p.id === 'hr-transfer-fulltime');
  const target = s.projects.find(p => p.id === 'DEMO-TRANSFER-LXT-01');
  if (p && target && ownerAt(s, p.id, day)) {
    const ownerPmId = ownerAt(s, p.id, day);
    s.scheduling.facts.push({ id: 'work-lincheng-own', version: 1, personId: p.id, projectId: p.projectIds[0], date: day, hours: 5, validated: true, ownerPmId, projectPmId: ownerPmId, source: '产出记录样例', receivedAt: stamp() },
      { id: 'work-lincheng-support', version: 1, personId: p.id, projectId: target.id, date: day, hours: 3, validated: true, ownerPmId, projectPmId: projectPm(s, target.id), source: '产出记录样例', receivedAt: stamp() });
  }
  return ensureSchedulingExamples(s, day);
}

function ensureSchedulingExamples(s, day) {
  const q = s.scheduling;
  if (q.exampleCoverageVersion) return s;
  q.exampleCoverageVersion = 1;
  // Earlier interaction may have moved the original fixture to the same PM.
  // Add an isolated example instead of rewriting that person's real preview history.
  if (q.facts.some(f => f.ownerPmId && f.projectPmId && f.ownerPmId !== f.projectPmId)) return s;
  const personId = 'staffing-zhouzhiheng', own = 'DEMO-TRANSFER-WR-01', target = 'DEMO-TRANSFER-LXT-01';
  if (s.people.some(p => p.id === personId) || !s.projects.some(p => p.id === own) || !s.projects.some(p => p.id === target)) return s;
  const n = s.nextEmployeeNumber++;
  s.people.push({ id: personId, name: '周知衡', employeeNo: `MCE${String(n).padStart(8, '0')}`, recruitmentNo: `ZP-${n}`, sourceSystem: '人员安排样例', sourceId: personId, demo: true, employeeType: '全职', category: '内部人员', stage: '正式', departmentId: 'dept-9-5', positionId: 'pos-1', locationId: 'loc-1', manager: '王然', entryDate: addDays(day, -120), arrivalDate: addDays(day, -120), masterCreated: true, trustedEmploymentStatus: '在职', projectIds: [own], accountActive: true, candidate: false, checklistCreated: true, checklistCompleted: true, materialsComplete: true, contractSigned: true, missingFields: [], specialPlans: [], archive: { abilityTags: ['语义评测', '文本质量复核'], english: 'CET6', education: '本科', school: '重庆邮电大学', major: '信息管理与信息系统', graduation: '2023年6月' } });
  q.owners[personId] = [{ pmId: 'pm-wang-ran', from: day, source: '产出样例管理归属快照' }];
  q.facts.push({ id: 'work-zhouzhiheng-own', version: 1, personId, projectId: own, date: day, hours: 5, validated: true, ownerPmId: 'pm-wang-ran', projectPmId: 'pm-wang-ran', source: '产出记录样例', receivedAt: stamp() }, { id: 'work-zhouzhiheng-support', version: 1, personId, projectId: target, date: day, hours: 3, validated: true, ownerPmId: 'pm-wang-ran', projectPmId: 'pm-lin-xiaotong', source: '产出记录样例', receivedAt: stamp() });
  return s;
}

export function ownerAt(s, personId, day) {
  return (s.scheduling.owners[personId] || []).slice().reverse().filter(h => h.from <= day).sort((a, b) => b.from.localeCompare(a.from))[0]?.pmId;
}
export function schedulingContext(s, role, pmId, assistantId = 'pa-lianghe') {
  check(visibleRoles.includes(role), '当前角色无人员调配查看权限');
  if (['PA', '项目助理'].includes(role)) {
    const grant = s.scheduling.delegations.find(g => g.id === assistantId && g.pmId === pmId);
    check(grant, '没有该PM的代办授权');
    return { role, pmId, actorName: grant.name, assistantId, projectIds: grant.projectIds, writable: true };
  }
  return { role, pmId, actorName: manager(s, pmId)?.name || role, writable: role === 'PM' && !!manager(s, pmId) };
}
function accessProject(ctx, projectId) { check(!ctx.projectIds || ctx.projectIds.includes(projectId), '该项目不在助理代办授权范围'); }
function ownPerson(s, ctx, p, day) {
  check(alive(p, day), '人员已离职或不属于在职内部人员');
  check(ownerAt(s, p.id, day) === ctx.pmId, '只能办理本人管理人员');
  if (ctx.projectIds) check(p.projectIds.length > 0 && p.projectIds.every(id => ctx.projectIds.includes(id)), '人员项目不在助理授权范围');
}
function targetProject(s, ctx, id, historical = false, expectedPmId) {
  const p = s.projects.find(p => p.id === id);
  check(p && (historical || !p.ended), '请选择未结束的目标项目');
  check((historical ? expectedPmId : projectPm(s, id)) === ctx.pmId, '目标项目必须属于办理PM');
  accessProject(ctx, id);
  return p;
}
function noConflict(s, request) {
  const conflict = s.scheduling.requests.find(r => {
    if (r.id === request.id || r.personId !== request.personId || !approved(r)) return false;
    if (r.kind === 'move' && r.status === '已同意待生效' && r.start <= request.start) return true;
    if (r.kind === 'move' && request.kind === 'move') return r.start >= request.start;
    if (r.kind === 'move') return r.start >= request.start && r.start <= request.end;
    if (request.kind === 'move') return request.start <= (r.actualEnd || r.end);
    return r.start <= request.end && request.start <= (r.actualEnd || r.end);
  });
  check(!conflict, `与已确认安排冲突：${conflict?.targetName || ''} ${conflict?.start || ''} 至 ${conflict?.actualEnd || conflict?.end || '正式换项后'}`);
}
function setRelationship(s, p, projectIds, eventId, day, pool = false) {
  p.endedProjectRelations ||= [];
  p.projectIds.filter(id => !projectIds.includes(id)).forEach(id => p.endedProjectRelations.push({ projectId: id, endedDate: day, reason: pool ? '调休入池' : '换项安排', evidence: eventId }));
  p.projectIds = [...projectIds];
  p.transferControl = { operationId: eventId, effectiveDate: day, changedAt: stamp(), pool };
}
function processDates(s, day) {
  for (const r of s.scheduling.requests) {
    if (r.status === '待确认' && !r.exceptionId) {
      const current = ownerAt(s, r.personId, day);
      if (current && current !== r.ownerId) {
        const before = r.ownerId; r.ownerId = current;
        audit(s, { role: '系统' }, '确认人随当前归属更新', r.id, before, current, day);
        note(s, r.id + ':reroute:' + current, [current, r.requesterId], `${r.name}的所属PM已变化，待确认申请已转至当前所属PM。`);
      }
    }
    if (!approved(r)) continue;
    const p = s.people.find(p => p.id === r.personId);
    if (r.kind === 'loan') {
      if (r.status === '已提前归还') continue;
      const next = day > r.end ? '已到期结束' : day >= r.start ? '借调中' : '已同意待开始';
      if (next !== r.status) {
        r.status = next;
        if (next === '已到期结束') { r.actualEnd = r.end; r.executedAt = stamp(); note(s, r.id + ':expired', [r.ownerId, r.requesterId], `${p?.name}在${r.targetName}的借调已结束，最后有效日${r.end}。`); }
      }
    } else if (r.status === '已同意待生效' && r.start <= day) {
      const target = s.projects.find(p => p.id === r.targetId);
      if (!p || !r.exceptionId && (!alive(p, day) || target?.ended) || !r.exceptionId && ownerAt(s, p.id, day) !== r.ownerId) { r.issue = '生效条件已变化，请原PM及PMO核实'; continue; }
      r.status = '已生效'; r.executedAt = stamp(); r.businessEffectiveDate = r.start;
      s.scheduling.owners[p.id] ||= [];
      s.scheduling.owners[p.id].push({ pmId: r.requesterId, from: r.start, source: r.id });
      if (!target?.ended && ownerAt(s, p.id, day) === r.requesterId) {
        setRelationship(s, p, [r.targetId], r.id, r.start);
        p.managementPmId = r.requesterId; p.managementPmName = manager(s, r.requesterId)?.name;
      }
      const release = s.scheduling.releases.find(x => x.id === r.releaseId); if (release && release.status === '已发布') release.status = '已承接';
      note(s, r.id + ':effective', [p.id, r.ownerId, r.requesterId], `${p.name}正式换项至${r.targetName}，业务生效日${r.start}。`);
    }
  }
  for (const r of s.scheduling.rests) {
    if (!unresolved(r)) continue;
    const p = s.people.find(p => p.id === r.personId);
    if (!p || !alive(p, day)) { r.issue = '人员在职状态已变化，待核实'; continue; }
    if (!r.entered && r.start <= day) {
      if (ownerAt(s, p.id, day) !== r.ownerId) { r.issue = '入池前所属PM已变化，待核实'; continue; }
      r.sourceProjects = [...p.projectIds]; r.formerPmName = manager(s, r.ownerId)?.name || '';
      setRelationship(s, p, [], r.id, r.start, true); r.entered = true; r.status = '调休中';
      (s.scheduling.owners[p.id] ||= []).push({ pmId: null, from: r.start, source: r.id });
      note(s, r.id + ':start', [p.id], `你已被调休，开始日期${r.start}。`);
    }
    if (r.entered && r.resume && r.resume <= day) {
      const target = s.projects.find(p => p.id === r.targetId);
      if (!target || target.ended || projectPm(s, target.id) !== r.receiverId) { r.issue = '恢复项目已结束或PM变化，待核实'; continue; }
      r.status = '已恢复'; r.restDays = calendarDays(r.start, r.resume); r.verification = '待核实';
      setRelationship(s, p, [r.targetId], r.id, r.resume);
      (s.scheduling.owners[p.id] ||= []).push({ pmId: r.receiverId, from: r.resume, source: r.id });
      note(s, r.id + ':resume', [p.id, r.receiverId, target.pa, target.qa], `${p.name}已分配给${manager(s, r.receiverId)?.name}的${target.name}，恢复日期${r.resume}，请联系报道及安排作业。`);
    }
  }
}

// Checks never overwrite source project/hours and never manufacture historical PMs.
function validateFacts(s, day) {
  const facts = [...s.outputs.filter(f => !s.scheduling.facts.some(x => x.id === f.id)), ...s.scheduling.facts];
  s.scheduling.checks = [];
  const groups = new Map();
  for (const f of facts) {
    const p = s.people.find(p => p.id === f.personId);
    const project = s.projects.find(p => p.id === f.projectId);
    const base = { ...copy(f), personName: p?.name || '身份待核实', projectName: project?.name || '项目待核实' };
    if (f.withdrawn) { s.scheduling.checks.push({ ...base, result: '来源已撤回' }); continue; }
    if (!p || !f.validated || !dateOk(f.date) || f.date > day || !Number.isFinite(f.hours) || f.hours <= 0) { s.scheduling.checks.push({ ...base, result: '待核实', reason: '身份、确认状态、业务日期或有效工时不完整' }); continue; }
    if (isSchedulingIntern(p)) { s.scheduling.checks.push({ ...base, result: '出勤已确认' }); continue; }
    if (p.employeeType !== '全职') continue;
    const formal = s.scheduling.requests.filter(r => approved(r) && r.kind === 'move' && r.personId === p.id && r.start <= f.date).sort((a, b) => b.start.localeCompare(a.start))[0];
    const sourceOwner = f.ownerPmId || ownerAt(s, p.id, f.date);
    const owner = formal?.requesterId || sourceOwner;
    const workPm = f.projectPmId || (f.date >= s.scheduling.initializedOn ? projectPm(s, f.projectId) : null);
    if (!project || !owner || !workPm) { s.scheduling.checks.push({ ...base, result: '待核实', reason: '业务日期所属PM或项目PM缺少历史依据', coordinator: 'PMO' }); continue; }
    const loan = s.scheduling.requests.find(r => approved(r) && r.kind === 'loan' && r.personId === p.id && r.targetId === f.projectId && r.requesterId === workPm && r.start <= f.date && (r.actualEnd || r.end) >= f.date);
    const ok = owner === workPm || !!loan;
    const result = { ...base, ownerPmId: owner, workPmId: workPm, evidenceId: loan?.id || formal?.id, result: ok ? '核实一致' : '待补办', reason: ok ? '' : '跨PM出勤缺少已确认且覆盖项目和日期的换项或借调' };
    s.scheduling.checks.push(result);
    if (!ok) {
      const key = `${p.id}:${owner}:${workPm}:${f.projectId}`;
      if (!groups.has(key)) groups.set(key, []); groups.get(key).push(result);
    }
  }
  // One exception per continuous sequence, preserving resolved source references.
  const activeIds = new Set();
  for (const [key, rows] of groups) {
    rows.sort((a, b) => a.date.localeCompare(b.date));
    const runs = [];
    rows.forEach(row => { const last = runs.at(-1); if (!last || calendarDays(last.at(-1).date, row.date) > 1) runs.push([row]); else last.push(row); });
    for (const run of runs) {
      let e = s.scheduling.exceptions.find(e => e.groupKey === key && e.factIds.some(id => run.some(f => f.id === id)));
      if (!e) { e = { id: 'exception-' + uid(), groupKey: key, personId: run[0].personId, ownerId: run[0].ownerPmId, pmId: run[0].workPmId, projectId: run[0].projectId, factIds: [], createdAt: stamp() }; s.scheduling.exceptions.push(e); }
      e.factIds = [...new Set([...e.factIds, ...run.map(f => f.id)])]; e.openFacts = run.map(f => f.id); e.start = run[0].date; e.end = run.at(-1).date;
      e.status = s.scheduling.requests.some(r => r.exceptionId === e.id && r.status === '待确认') ? '已发起待确认' : '待补办';
      activeIds.add(e.id); note(s, e.id, [e.pmId], `${run[0].personName}在${run[0].projectName}有跨PM出勤未取得有效流程，请补办。`);
    }
  }
  for (const e of s.scheduling.exceptions) if (!activeIds.has(e.id)) {
    const related = s.scheduling.checks.filter(f => e.factIds.includes(f.id));
    if (related.length === e.factIds.length && related.every(f => ['核实一致', '来源已撤回'].includes(f.result))) {
      if (e.status !== '已复检关闭') { e.closedAt = stamp(); audit(s, { role: '系统' }, '补办复检关闭', e.id, e.status, '已复检关闭', day); }
      e.status = '已复检关闭'; e.openFacts = [];
    } else { e.status = '待核实'; e.reason = '来源变更或缺失，尚不能判定全部明细已解决'; }
  }
  // Earliest confirmed attendance ends each particular rest, including late facts.
  for (const r of s.scheduling.rests) {
    const p = s.people.find(p => p.id === r.personId); if (!p) continue;
    const nextRest = s.scheduling.rests.filter(x => x.personId === p.id && x.start > r.start).sort((a, b) => a.start.localeCompare(b.start))[0];
    const valid = facts.filter(f => f.personId === p.id && f.validated && !f.withdrawn && dateOk(f.date) && f.date >= r.start && f.date <= day && (!nextRest || f.date < nextRest.start) && Number.isFinite(f.hours) && f.hours > 0).sort((a, b) => a.date.localeCompare(b.date));
    const first = valid[0];
    if (r.triggerId && !valid.some(f => f.id === r.triggerId && f.version === r.triggerVersion)) {
      const before = { resume: r.resume, triggerId: r.triggerId, triggerVersion: r.triggerVersion };
      r.resume = r.originalResume || null; r.triggerId = null; r.triggerVersion = null;
      r.status = r.resume ? r.resume <= day ? '已恢复' : '已提取待恢复' : '调休中';
      r.verification = '来源已修订，已结算差异待人工复核';
      r.restDays = r.resume ? calendarDays(r.start, r.resume) : null;
      r.corrections.push({ at: stamp(), before, after: { resume: r.resume, status: r.status }, reason: '原恢复依据已修订或撤回，按最新有效来源重新核实' });
      if (!nextRest && p.transferControl?.operationId === r.id && (!r.resume || r.resume > day)) {
        setRelationship(s, p, [], r.id, r.start, true);
        s.scheduling.owners[p.id] = (s.scheduling.owners[p.id] || []).filter(h => h.source !== r.id || h.from <= r.start);
        s.scheduling.owners[p.id].push({ pmId: null, from: r.start, source: r.id });
      }
    }
    if (!first || r.resume && first.date >= r.resume) continue;
    const before = { resume: r.resume || null, status: r.status, targetId: r.targetId || null };
    if (!r.entered) { r.formerPmName = manager(s, r.ownerId)?.name || ''; r.sourceProjects = [...p.projectIds]; r.entered = true; }
    r.originalResume ??= r.resume || null; r.resume = first.date; r.status = '已恢复'; r.restDays = calendarDays(r.start, r.resume); r.triggerId = first.id; r.triggerVersion = first.version;
    const actual = valid.filter(f => f.date === first.date), projects = [...new Set(actual.map(f => f.projectId).filter(id => s.projects.some(p => p.id === id)))];
    const pms = [...new Set(actual.map(f => f.projectPmId || (f.date >= s.scheduling.initializedOn ? projectPm(s, f.projectId) : null)).filter(Boolean))];
    r.verification = pms.length !== 1 || actual.some(f => !s.projects.some(p => p.id === f.projectId)) ? '已结束调休，实际归属待核实' : r.receiverId && r.receiverId !== pms[0] || r.targetId && !projects.includes(r.targetId) ? '已恢复，实际与计划去向存在差异' : '出勤已确认';
    r.actualProjects = projects; r.corrections.push({ at: stamp(), before, after: { resume: r.resume, restDays: r.restDays }, sourceId: first.id, version: first.version });
    // Late corrections must not undo a later rest or assignment.
    if (!nextRest && (!p.transferControl || p.transferControl.effectiveDate <= first.date || p.transferControl.operationId === r.id)) {
      setRelationship(s, p, projects.filter(id => !s.projects.find(x => x.id === id)?.ended), r.id, first.date);
      s.scheduling.owners[p.id] ||= []; s.scheduling.owners[p.id] = s.scheduling.owners[p.id].filter(h => h.source !== r.id || h.from < first.date);
      s.scheduling.owners[p.id].push({ pmId: pms.length === 1 ? pms[0] : null, from: first.date, source: r.id });
    }
    note(s, r.id + ':actual:' + first.id, [p.id, r.ownerId, r.receiverId, ...pms, ...(pms.length !== 1 ? ['PMO'] : [])], `${p.name}已于${first.date}出勤并结束调休，原计划已停止执行。${r.verification}`);
    audit(s, { role: '系统' }, '出勤更正调休', r.id, before, { resume: r.resume, sourceId: first.id, version: first.version }, first.date);
  }
}

export function reconcileScheduling(previous, day = beijingToday()) {
  const s = ensureScheduling(previous, day);
  // Facts run first so an earlier recovery cannot be overwritten by a scheduled one.
  validateFacts(s, day); processDates(s, day); validateFacts(s, day);
  for (const r of s.scheduling.requests) {
    const facts = s.scheduling.checks.filter(f => f.personId === r.personId && f.date >= r.start && (r.kind !== 'loan' || f.date <= (r.actualEnd || r.end)));
    r.verification = !facts.length ? '待核实' : facts.some(f => f.result === '待补办' || f.result === '待核实') ? '存在差异 / 待核实' : '核实一致';
  }
  for (const r of s.scheduling.releases.filter(r => r.status === '已发布' && r.availableDate <= day)) {
    if (!s.scheduling.requests.some(q => q.personId === r.personId && approved(q) && !['已提前归还', '已到期结束'].includes(q.status))) note(s, r.id + ':unclaimed', [r.ownerId], `预释放已到预计可用日${r.availableDate}，请继续公开、改期或安排承接。`);
    const p = s.people.find(p => p.id === r.personId);
    if (p && !p.projectIds.some(id => !s.projects.find(x => x.id === id)?.ended)) note(s, r.id + ':no-project', [r.ownerId, 'PMO'], `${p.name}尚无有效所属项目，请明确承接安排。`);
  }
  return s;
}

function applyOne(s, ctx, type, pld, day) {
  const q = s.scheduling;
  const p = s.people.find(p => p.id === pld.personId);
  const time = stamp();
  if (type.startsWith('release.')) {
    ownPerson(s, ctx, p, day); check(p.employeeType === '全职', '预释放仅适用于全职人员');
    let r = q.releases.find(r => r.personId === p.id && r.ownerId === ctx.pmId && r.status !== '已承接');
    const before = copy(r || null);
    if (type === 'release.withdraw') { check(r, '预释放记录不存在'); r.status = '已撤回'; }
    else {
      check(dateOk(pld.date), '请选择预计可用日期');
      if (!r) { r = { id: uid(), personId: p.id, ownerId: ctx.pmId, createdAt: time, sourceProjects: p.projectIds.map(id => ({ id, name: s.projects.find(p => p.id === id)?.name })) }; q.releases.push(r); }
      r.availableDate = pld.date; r.status = '已发布';
    }
    audit(s, ctx, type === 'release.withdraw' ? '撤回预释放' : '发布或修改预释放', r.id, before, r, day); return r;
  }
  if (type === 'request.create') {
    const exception = pld.exceptionId && q.exceptions.find(e => e.id === pld.exceptionId && e.personId === pld.personId && e.pmId === ctx.pmId && e.status !== '已复检关闭');
    check(!pld.exceptionId || exception, '补办待办不存在或不属于当前PM');
    check(p && p.employeeType === '全职' && (exception || alive(p, day)), '仅在职全职人员可申请');
    check(['move', 'loan'].includes(pld.kind), '请选择正式提取或临时借调');
    check(dateOk(pld.start) && (pld.kind !== 'loan' || dateOk(pld.end) && pld.end >= pld.start), '请填写正确的开始日期及归还日期');
    const ownerId = exception ? exception.ownerId : ownerAt(s, p.id, day);
    check(ownerId, '原所属PM缺失，待核实');
    check(exception || pld.start >= day, '历史业务请从产出异常待办补办');
    const target = targetProject(s, ctx, pld.targetId, !!exception, exception?.pmId);
    check(exception || ownerId !== ctx.pmId || !p.projectIds.includes(target.id), '人员已在该项目，请选择其他项目');
    if (exception) check(pld.targetId === exception.projectId && pld.start <= exception.end && (pld.kind !== 'loan' || pld.end >= exception.start), '补办项目和日期须覆盖关联产出');
    const release = q.releases.find(r => r.personId === p.id && r.ownerId === ownerId && r.status === '已发布');
    check(exception || ownerId === ctx.pmId || release, '人员未发布可用计划，请刷新列表');
    check(exception || !release || pld.start >= release.availableDate, '计划开始日不能早于预计可用日，请协调修改计划');
    check(!q.requests.some(r => r.personId === p.id && r.requesterId === ctx.pmId && r.targetId === target.id && r.start === pld.start && r.kind === pld.kind && r.status === '待确认'), '已有相同待确认申请，请查看进度');
    if (ownerId === ctx.pmId) accessProject(ctx, target.id);
    const r = { id: uid(), personId: p.id, name: p.name, employeeNo: p.employeeNo, ownerId, requesterId: ctx.pmId, targetId: target.id, targetName: target.name, kind: pld.kind, start: pld.start, end: pld.kind === 'loan' ? pld.end : null, status: '待确认', createdAt: time, releaseId: release?.id, exceptionId: exception?.id, verification: '待核实', operator: ctx.actorName, representedPmId: ctx.pmId };
    noConflict(s, r);
    if (ownerId === ctx.pmId) { ownPerson(s, ctx, p, day); r.approvedAt = time; r.status = r.kind === 'loan' ? '已同意待开始' : '已同意待生效'; r.confirmation = '同PM调配，无需对方确认'; }
    q.requests.push(r); audit(s, ctx, exception ? '发起异常补办' : r.kind === 'loan' ? '申请临时借调' : '申请正式提取', r.id, null, r, r.start);
    if (ownerId !== ctx.pmId) note(s, r.id + ':confirm', [ownerId], `${ctx.actorName}申请${r.kind === 'loan' ? '借调' : '提取'}${p.name}至${target.name}，${r.start}开始，请同意或填写拒绝原因。`);
    return r;
  }
  if (type.startsWith('request.')) {
    const r = q.requests.find(r => r.id === pld.id); check(r, '申请不存在'); const before = copy(r);
    const person = s.people.find(p => p.id === r.personId);
    if (type === 'request.decide') {
      check(r.status === '待确认', '申请状态已变化，请刷新');
      const currentOwner = r.exceptionId ? r.ownerId : ownerAt(s, r.personId, day);
      check(currentOwner === ctx.pmId && currentOwner === r.ownerId, '原所属PM已变化或无权处理，请刷新确认人');
      if (ctx.projectIds) check(person.projectIds.length && person.projectIds.every(id => ctx.projectIds.includes(id)), '人员不在助理项目授权范围');
      check(pld.approve === true || Boolean(pld.reason?.trim()), '拒绝时必须填写原因');
      if (pld.approve) {
        check(r.exceptionId || alive(person, day), '人员已离职');
        check(r.exceptionId || !s.projects.find(p => p.id === r.targetId)?.ended && projectPm(s, r.targetId) === r.requesterId, '目标项目或PM已变化');
        noConflict(s, r); r.approvedAt = time; r.status = r.kind === 'loan' ? '已同意待开始' : '已同意待生效';
      } else { r.status = '已拒绝'; r.reason = pld.reason.trim(); }
      r.decidedAt = time; r.decidedBy = ctx.actorName;
      note(s, r.id + ':decision', [r.requesterId], `${r.name}的${r.kind === 'loan' ? '借调' : '提取'}申请${pld.approve ? '已同意' : '已拒绝：' + r.reason}。`);
    } else {
      check(r.requesterId === ctx.pmId, '仅申请方可办理'); accessProject(ctx, r.targetId);
      if (type === 'request.return') {
        if (r.status === '已提前归还') return r;
        check(r.kind === 'loan' && r.status === '借调中', '只能归还正在执行的借调');
        r.status = '已提前归还'; r.actualEnd = day; r.returnedAt = time;
        note(s, r.id + ':return', [r.ownerId], `${r.name}已从${r.targetName}提前归还，${day}为最后有效借调日，无需再次确认。`);
      } else if (type === 'request.cancel') {
        if (r.status === '已取消') return r;
        check(['待确认', '已同意待生效', '已同意待开始'].includes(r.status), '已生效不可取消；借调中请办理归还');
        r.status = '已取消'; r.cancelledAt = time; note(s, r.id + ':cancel', [r.ownerId], `${r.name}的未生效申请已由提人方取消。`);
      } else if (type === 'request.edit') {
        check(r.kind === 'move' && r.status === '已同意待生效', '仅已同意未生效的正式换项可修改');
        check(dateOk(pld.start), '请选择计划开始日期');
        const target = targetProject(s, ctx, pld.targetId);
        r.start = pld.start; r.targetId = target.id; r.targetName = target.name; noConflict(s, r);
        note(s, r.id + ':edit:' + uid(), [r.ownerId], `${r.name}的换项由${before.targetName}（${before.start}）改为${r.targetName}（${r.start}），直接生效，无需重审。`);
      } else throw new Error('未知申请操作');
    }
    audit(s, ctx, ({ 'request.decide': pld.approve ? '同意申请' : '拒绝申请', 'request.return': '提前归还', 'request.cancel': '取消申请', 'request.edit': '修改安排' })[type], r.id, before, r, r.start); return r;
  }
  if (type === 'rest.create') {
    ownPerson(s, ctx, p, day); check(isSchedulingIntern(p), '调休仅适用于实习生'); check(dateOk(pld.date), '请选择调休开始日期');
    check(!q.rests.some(r => r.personId === p.id && (unresolved(r) || (r.resume || '9999') > pld.date)), '已有重叠调休安排，请查看记录');
    const r = { id: uid(), personId: p.id, ownerId: ctx.pmId, start: pld.date, originalStart: pld.date, status: '待开始', createdAt: time, plannedProjects: [...p.projectIds], sourceProjects: [], corrections: [] };
    q.rests.push(r); audit(s, ctx, '办理调休', r.id, null, r, r.start); note(s, r.id + ':plan', [p.id, ctx.pmId], `${p.name}的调休计划从${r.start}开始。`); return r;
  }
  if (type === 'rest.claim') {
    const r = q.rests.find(r => r.id === pld.id); check(r?.status === '调休中', '已被提取或状态已变化，请刷新');
    const person = s.people.find(p => p.id === r.personId); check(alive(person, day), '人员已离职');
    const target = targetProject(s, ctx, pld.targetId); check(dateOk(pld.date) && pld.date >= r.start, '恢复日期不能早于调休开始日');
    const before = copy(r); r.targetId = target.id; r.receiverId = ctx.pmId; r.resume = pld.date; r.originalResume = pld.date; r.status = '已提取待恢复'; r.claimedAt = time;
    audit(s, ctx, '提取调休实习生', r.id, before, r, r.resume); note(s, r.id + ':claim', [person.id, ctx.pmId], `${person.name}计划于${r.resume}进入${target.name}，本次调休已占用。`); return r;
  }
  throw new Error('未知人员调配操作');
}

export function reduceScheduling(previous, context, type, payload, revision = previous.revision, day = beijingToday()) {
  check(previous.revision === revision, '数据已更新，请刷新后再提交');
  let s = reconcileScheduling(previous, day);
  const ctx = schedulingContext(s, context.role, context.pmId, context.assistantId); check(ctx.writable, '当前角色仅可查看');
  const requestId = payload.requestId; check(requestId, '缺少请求标识，请重新打开操作');
  if (s.scheduling.batches.some(b => b.id === requestId && b.pmId === ctx.pmId)) return s;
  const items = payload.items || [payload]; check(items.length && items.length <= 500, '请选择人员，单次最多500人');
  const results = [];
  for (const item of items) {
    const draft = copy(s);
    try { const record = applyOne(draft, ctx, type, { ...payload, ...item }, day); s = draft; results.push({ personId: record.personId, id: record.id, success: true, message: record.status }); }
    catch (error) { results.push({ personId: item.personId || s.scheduling.requests.find(r => r.id === item.id)?.personId, id: item.id, success: false, message: error.message }); }
  }
  s.scheduling.batches.push({ id: requestId, at: stamp(), pmId: ctx.pmId, actor: ctx.actorName, type, results });
  s = reconcileScheduling(s, day); s.revision = previous.revision + 1; return s;
}

// Integration boundary: callers supply confirmed IDs, versions and historical PM snapshots.
export function mergeSchedulingFacts(previous, rows, day = beijingToday(), options = {}) {
  let s = ensureScheduling(previous, day);
  if (options.failed) { s.scheduling.readError = options.error || '来源读取失败，保留上次成功数据'; return s; }
  for (const row of rows) {
    check(row.id && Number.isInteger(row.version), '产出来源必须带记录ID及版本');
    const old = s.scheduling.facts.find(f => f.id === row.id);
    if (old && old.version >= row.version) continue;
    if (old) { s.scheduling.sourceHistory.push(copy(old)); Object.assign(old, copy(row), { receivedAt: stamp() }); }
    else s.scheduling.facts.push({ ...copy(row), receivedAt: stamp() });
  }
  s.scheduling.readError = ''; s.scheduling.dataAsOf = stamp(); s = reconcileScheduling(s, day); s.revision = previous.revision + 1; return s;
}

export function loadScheduling() { return updateHrWorkspace(s => reconcileScheduling(s)); }
export async function schedulingAction(ctx, type, payload, revision) {
  const commit = () => updateHrWorkspace(s => reduceScheduling(s, ctx, type, payload, revision), revision);
  if (globalThis.navigator?.locks) return navigator.locks.request(HR_KEY + '.scheduling', commit);
  return commit();
}
export function staffingView(state, context, day = beijingToday()) {
  const s = state, q = s.scheduling, ctx = schedulingContext(s, context.role, context.pmId, context.assistantId);
  const all = ['PMO', '人事', 'HR', '财务'].includes(ctx.role);
  const ownProjects = s.projects.filter(p => projectPm(s, p.id) === ctx.pmId && (!ctx.projectIds || ctx.projectIds.includes(p.id)));
  const scoped = r => all || [r.ownerId, r.requesterId, r.receiverId, r.pmId].includes(ctx.pmId);
  const fulltime = q.releases.filter(r => r.status === '已发布' || r.ownerId === ctx.pmId).filter(r => r.status !== '已承接' || scoped(r)).map(r => ({ ...r, person: s.people.find(p => p.id === r.personId) })).filter(r => r.person);
  const people = s.people.filter(p => alive(p, day) && (p.employeeType === '全职' || isSchedulingIntern(p))).map(p => ({ id: p.id, name: p.name, employeeNo: p.employeeNo, employeeType: p.employeeType, projectIds: p.projectIds, ownerId: ownerAt(s, p.id, day), abilityTags: p.abilityTags || p.archive?.abilityTags || [], english: p.archive?.english, school: p.archive?.school, major: p.archive?.major, education: p.archive?.education })).filter(p => all || p.ownerId === ctx.pmId || q.requests.some(r => r.personId === p.id && r.requesterId === ctx.pmId && r.status === '借调中') || q.releases.some(r => r.personId === p.id && r.status === '已发布') || q.rests.some(r => r.personId === p.id && ['调休中', '已提取待恢复'].includes(r.status)) || p.projectIds.some(id => ownProjects.some(p => p.id === id)));
  return { ctx, people, managers: s.transfers.managers, projects: s.projects.map(p => ({ ...p, pmId: projectPm(s, p.id) })), ownProjects, releases: fulltime.map(({ person, ...r }) => r), rests: q.rests.filter(r => all || ['调休中', '已提取待恢复'].includes(r.status) || scoped(r)), requests: q.requests.filter(scoped), exceptions: q.exceptions.filter(e => all || e.pmId === ctx.pmId), checks: q.checks.filter(f => all || f.workPmId === ctx.pmId || f.ownerPmId === ctx.pmId || ownProjects.some(p => p.id === f.projectId)), notices: q.notices.filter(n => all || n.recipient === ctx.pmId), audit: q.audit.filter(a => all || a.representedPmId === ctx.pmId || q.requests.some(r => r.id === a.objectId && scoped(r)) || q.rests.some(r => r.id === a.objectId && scoped(r))) };
}
export function schedulingPersonDetails(state, context, personId) {
  const v = staffingView(state, context); check(v.people.some(p => p.id === personId), '无权查看该人员');
  const source = state.people.find(p => p.id === personId);
  const all = ['PMO', '人事', 'HR', '财务'].includes(context.role);
  const ids = new Set((all ? state.projects : v.ownProjects).map(p => p.id));
  const person = projectHrPersonDetail(source, context.role, state, ids);
  return { person, view: { role: context.role, revision: state.revision, people: [person], projects: state.projects.filter(p => ids.has(p.id)), outputs: state.outputs.filter(f => f.personId === personId && ids.has(f.projectId)), attendance: state.attendance.filter(f => f.personId === personId && ids.has(f.projectId)), audit: [] } };
}
export function staffingTodoCount(role, pmId = 'pm-wang-ran') {
  if (!['PM', 'PMO', 'PA'].includes(role)) return 0;
  const s = loadHr(); if (!s.scheduling) return 0;
  return s.scheduling.requests.filter(r => r.status === '待确认' && (role === 'PMO' || r.ownerId === pmId)).length + s.scheduling.exceptions.filter(e => e.status !== '已复检关闭' && (role === 'PMO' || e.pmId === pmId)).length;
}
