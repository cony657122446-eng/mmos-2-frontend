// MMOS 2.9.0 + 2.9.1. Local interactive state; no external writes are performed.
export const RECRUITMENT_KEY = 'mmos.recruitment.submissions.v1';
export const RECRUITMENT_EVENT = 'mmos:recruitment-updated';
export const STATES = ['待审批', '已驳回', '待分配', '进行中', '已结束'];
export const SYNC_STATES = ['待回写', '回写中', '已回写', '回写失败', '已停止回写'];
export const OPTIONS = {
  ability: ['社科心理', '中文教育', '影视', '代码', '外语', '垂类专业', '数理CS', 'AI'],
  priority: ['高优-1级', '次优-2级', '常规招聘'], employment: ['实习', '全职', '兼职'], employed: ['不限', '是', '否'],
  majors: ['不限', '哲学类', '经济学类', '法学类', '教育学类', '文学类', '历史学类', '理学类', '工学类', '农学类', '医学类', '管理类', '艺术学类', '交叉学科类', '音频类'],
  schools: ['不限', '985', '211', '一本及以上', '艺术院校', '双一流院校', '留学', '国内外名校', '公办本科', '大专及以下'],
  keywords: ['不限', '数据评测', 'AI 数据评测', '模型评测', '算法评测', '数据集评测', '标注评测', '语料评测', '效果评测', '质量评测', '合规评测', '方言', 'asr', '文本评测', 'agent', '大模型音频生成评测'],
  gender: ['不限', '男', '女'], stability: ['不限', '5 年少于 3 份工作', '平均每份工作大于 1 年'],
  education: ['不限', '初中及以下', '中专 / 中技', '高中', '大专', '本科', '硕士', '博士'],
  experience: ['不限', '在校应届', '25 年毕业', '26 年毕业', '28 年后毕业', '1 年以内', '1-3 年', '3-5 年', '5-10 年', '10 年以上'],
  byteAccount: ['是', '否', '马甲'], security: ['L1', 'L2', 'L3', 'L4'],
};
// Keep source option provenance even though the submission uses unique text.
export const EXPERIENCE_SOURCE = [...OPTIONS.experience.slice(0, 8), '3-5 年', ...OPTIONS.experience.slice(8)];
export const FIELDS = [
  ['applicantName', '申请人', 'system'], ['departmentName', '申请部门', 'system'], ['locations', '工作地点', 'multi', true],
  ['positionId', '岗位', 'select', true], ['ownerId', '需求归属', 'select', true], ['ability', '能力方向', 'select', true],
  ['overview', '项目概览', 'url', true, 'delivery'], ['priority', '申请优先级', 'select', true], ['headcount', '人数', 'number', true],
  ['earliest', '最早入项时间', 'date', true], ['deadline', '截止入项时间', 'date', true], ['employment', '用工类型', 'multi', true],
  ['age', '年龄', 'text', true], ['employed', '是否在职', 'select', true], ['majors', '专业', 'multi', true], ['schools', '院校层次', 'multi', true],
  ['keywords', '关键词', 'multi', true], ['gender', '性别', 'select', true], ['stability', '跳槽频率', 'select', true],
  ['education', '学历要求', 'multi', true], ['experience', '经验要求', 'multi', true], ['exam', '招聘笔试题', 'url', false, 'delivery'],
  ['answer', '测试答案', 'text', false, 'delivery'], ['reviewers', '测试题审核人', 'multi', false, 'delivery'],
  ['byteAccount', '是否开通字节账号', 'select', false, 'delivery'], ['security', '职场密级要求', 'select', true, 'delivery'],
  ['network', '项目网络安全要求', 'text', false, 'delivery'], ['site', '工作地点（是否驻场等）', 'text', false, 'delivery'],
  ['face', '是否需要人脸验证', 'text', false, 'delivery'], ['equipment', '有无需要自带设备（耳机、电脑等）', 'text', false, 'equipment'],
  ['notes', '其他特殊要求备注', 'text'],
].map(([key, label, type, required, condition], index) => ({ key, label, type, required, condition, number: index + 1 }));
export const todayBJ = (now = new Date()) => new Date(new Date(now).getTime() + 28800000).toISOString().slice(0, 10);
const clone = value => JSON.parse(JSON.stringify(value));
const assert = (test, message) => { if (!test) throw new Error(message); };
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function recruitmentActor(role) {
  const base = { role, active: true, enabled: true };
  if (role === 'PM') return { ...base, id: 'pm-wangran', name: '王然', departmentId: 'dept-9', departmentName: 'AI数据交付中心', submit: true };
  if (role === '部门经理') return { ...base, id: 'manager-demo-1', name: '人事负责人', departmentId: 'dept-3-4', departmentName: '人事运营与薪酬部', submit: true };
  if (role === '招聘经理') return { ...base, id: 'recruitment-manager', name: '顾言', departmentId: 'dept-3-1', departmentName: '人才开发部', approve: true, assign: true };
  return { ...base, id: role, name: role };
}
export const managerAllowed = actor => actor.role === '招聘经理' && actor.active && actor.enabled;
export const canSee = (row, actor) => actor.active && actor.enabled && (managerAllowed(actor) || row.applicantId === actor.id);
export function fieldVisible(field, actor) {
  if (!field.condition) return true;
  return (field.condition === 'delivery' ? ['dept-9', 'dept-5-1'] : ['dept-9', 'dept-5-3']).includes(actor.departmentId);
}
export function exclusiveValues(previous, next) {
  if (!next.includes('不限')) return next;
  return previous?.includes('不限') && next.some(value => value !== '不限') ? next.filter(value => value !== '不限') : ['不限'];
}
export function authorizedOwners(actor, context) {
  if (!actor.submit || !actor.active || !actor.enabled) return [];
  return actor.role === '部门经理' ? context.departments.filter(d => d.id === actor.departmentId && d.status === '启用').map(d => ({ id: d.id, name: d.name, type: 'department' }))
    : context.projects.filter(p => p.pm === actor.name).map(p => ({ id: p.projectNo, name: p.projectName, type: 'project' }));
}
export function authorizedPositions(actor, context) {
  return context.positions.filter(p => p.status === '启用' && (actor.role === '部门经理' ? p.departmentId === actor.departmentId && p.manager === actor.name : p.manager === actor.name));
}
export function projectEndReason(project) {
  if (project?.finalAccepted && project?.allInvoiced) return '项目最终验收通过且全部应开票金额已完成开票';
  return '';
}
export function endReason(row, context, now = new Date()) {
  if (row.form.deadline < todayBJ(now)) return '截止入项日期已到期';
  if (row.trialId && context.trials.some(t => t.key === row.trialId && t.status === '试标失败')) return '对应试标失败';
  return row.ownerType === 'project' ? projectEndReason(context.projects.find(p => p.projectNo === row.form.ownerId)) : '';
}
export function validateSubmission(input, actor, context, now = new Date(), trialId) {
  assert(actor.submit && actor.enabled && actor.active, '当前身份没有招聘提报权限');
  const form = {}; const errors = {};
  for (const field of FIELDS) {
    if (field.type === 'system') continue;
    let value = fieldVisible(field, actor) ? input[field.key] : undefined;
    if (typeof value === 'string') value = value.trim();
    if (Array.isArray(value)) value = [...new Set(value)];
    form[field.key] = value ?? (field.type === 'multi' ? [] : '');
    if (!fieldVisible(field, actor)) continue;
    if (field.required && (value == null || value === '' || Array.isArray(value) && !value.length)) errors[field.key] = `请填写${field.label}`;
    if (OPTIONS[field.key] && value && !(Array.isArray(value) ? value : [value]).every(v => OPTIONS[field.key].includes(v))) errors[field.key] = '所选选项已失效';
    if (Array.isArray(value) && value.includes('不限') && value.length > 1) errors[field.key] = '不限不能与具体选项同时选择';
    if (field.type === 'url' && value) { try { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol)) throw Error(); } catch { errors[field.key] = '请输入有效的 HTTP 或 HTTPS 文档链接'; } }
    if (field.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) errors[field.key] = '请选择有效日期';
  }
  if (!Number.isInteger(form.headcount) || form.headcount < 1) errors.headcount = '人数必须为大于零的整数';
  if (form.deadline < form.earliest || form.deadline < todayBJ(now)) errors.deadline = '截止日期不得早于最早入项日期或今天';
  const owner = authorizedOwners(actor, context).find(o => o.id === form.ownerId);
  const position = authorizedPositions(actor, context).find(p => p.id === form.positionId);
  if (!owner) errors.ownerId = '需求归属不在本人授权范围内';
  if (!position) errors.positionId = '岗位未建立、已停用或不在本人授权范围内';
  if (!Array.isArray(form.locations) || form.locations.some(id => !context.locations.some(l => l.id === id && l.status === '在用'))) errors.locations = '工作地点已失效，请重新选择';
  if (form.reviewers?.some(id => !context.reviewers.some(p => p.id === id))) errors.reviewers = '审核人员已失效';
  if (owner?.type === 'project') {
    const project = context.projects.find(p => p.projectNo === owner.id);
    if (!project?.approved) errors.ownerId = '该项目尚未通过立项';
    if (projectEndReason(project)) errors.ownerId = projectEndReason(project);
  }
  if (trialId) {
    const trial = context.trials.find(t => t.key === trialId);
    if (!trial || trial.projectNo !== owner?.id || trial.status === '试标失败') errors.ownerId = '来源试标失效或已失败，请核对来源项目';
  }
  if (Object.keys(errors).length) { const error = new Error(Object.values(errors)[0]); error.fields = errors; throw error; }
  return { form, ownerType: owner.type, ownerName: owner.name, positionName: position.name, applicantName: actor.name, departmentId: actor.departmentId, departmentName: actor.departmentName,
    directorySnapshot: { position: clone(position), owner: clone(owner), locations: context.locations.filter(l => form.locations.includes(l.id)), reviewers: context.reviewers.filter(r => form.reviewers.includes(r.id)) } };
}
function history(row, action, actor, now, details = '') { row.history.push({ id: uid(), action, actor: actor.name, at: new Date(now).toISOString(), version: row.version, details }); }
function task(row, action, target, now) {
  row.tasks.push({ id: uid(), action, target, version: row.version, sequence: row.tasks.length + 1, state: '待回写', createdAt: new Date(now).toISOString(), reason: '飞书接口待接入', snapshot: clone(row.form) });
}
export function reconcileRecruitment(previous, context, now = new Date()) {
  const state = clone(previous);
  state.records.forEach(row => { const reason = endReason(row, context, now); if (row.status !== '已结束' && reason) {
    row.previousStatus = row.status; row.status = '已结束'; row.endedAt = new Date(now).toISOString(); row.endReason = reason;
    row.tasks.forEach(t => { if (!row.externalRecordId && ['待回写', '回写失败'].includes(t.state)) { t.state = '已停止回写'; t.reason = reason; } });
    history(row, '自动结束', { name: '系统' }, now, reason);
  } });
  return state;
}
export function reduceRecruitment(previous, actor, action, payload, context, now = new Date()) {
  const state = reconcileRecruitment(previous, context, now);
  const key = `${actor.id}:${payload.requestId}`;
  assert(payload.requestId, '缺少操作标识，请重新打开页面');
  if (state.requests[key]) return { state, result: state.requests[key] };
  const finish = result => { state.requests[key] = result; return { state, result }; };
  if (action === 'retry') {
    const row = state.records.find(r => r.id === payload.id);
    assert(row && canSee(row, actor), '无权重试该记录');
    const current = row.tasks.find(t => t.id === payload.taskId);
    assert(current?.state === '回写失败', '仅已确定失败的任务可重试');
    assert(row.status !== '已结束' || row.externalRecordId, row.endReason || '已结束需求不可新建飞书记录');
    current.state = '待回写'; current.reason = '已重新排队，等待飞书接口接入';
    current.retryCount = (current.retryCount || 0) + 1;
    history(row, '重试回写', actor, now, current.action);
    return finish({ id: row.id });
  }
  if (action === 'submit' || action === 'resubmit') {
    assert(action !== 'submit' || !payload.id, '新建提报不能指定已有记录');
    let row = state.records.find(r => r.id === payload.id);
    if (action === 'resubmit') {
      assert(row && row.applicantId === actor.id, '仅原申请人可修改重提');
      assert(row.status === '已驳回' && row.version === payload.version, row.endReason || '状态或版本已变化，请刷新');
    }
    const trialId = row?.trialId && payload.form.ownerId === row.form.ownerId ? row.trialId : payload.trialId;
    const facts = validateSubmission(payload.form, actor, context, now, trialId);
    if (!row) { row = { id: `REC-${uid()}`, number: `ZP-${todayBJ(now).replaceAll('-', '')}-${String(state.records.length + 1).padStart(4, '0')}`, applicantId: actor.id, version: 0, firstSubmittedAt: new Date(now).toISOString(), history: [], versions: [], tasks: [], externalRecordId: '', hr: null }; state.records.unshift(row); }
    Object.assign(row, facts, { version: row.version + 1, lastSubmittedAt: new Date(now).toISOString(), status: '待审批', source: payload.source || row.source || '招聘提报', trialId: trialId || '' });
    row.versions.push({ version: row.version, at: row.lastSubmittedAt, ...clone(facts) });
    history(row, action === 'submit' ? '首次提交' : '修改重提', actor, now);
    task(row, action === 'submit' ? '创建飞书记录' : '更新提报内容', '人事是否同步（叶）＝否', now);
    return finish({ id: row.id });
  }
  assert(managerAllowed(actor), '没有招聘经理操作权限');
  if (action === 'assign' || action === 'reassign') {
    assert(actor.assign, '没有 HR 分配权限');
    const hr = context.recruiters.find(h => h.id === payload.hrId && h.departmentName === '人才开发部' && h.active && h.enabled);
    assert(hr, '所选 HR 须属于人才开发部、在职且账号启用');
    assert(payload.rows?.length && (action !== 'reassign' || payload.rows.length === 1), '请选择需求；改派仅支持单条');
    const results = payload.rows.map(ref => {
      const row = state.records.find(r => r.id === ref.id);
      const expected = action === 'assign' ? '待分配' : '进行中';
      if (!row || row.version !== ref.version || row.status !== expected || (action === 'reassign' && row.hr?.id !== ref.hrId)) return { id: ref.id, number: row?.number, success: false, reason: row?.endReason || '状态、版本或 HR 已变化，请刷新' };
      const old = row.hr?.name || '未分配'; row.hr = clone(hr); row.status = '进行中';
      history(row, action === 'assign' ? '分配 HR' : '改派 HR', actor, now, `${old} → ${hr.name}`); task(row, '更新对接招聘HR', hr.name, now);
      return { id: row.id, number: row.number, success: true, reason: `已分配给 ${hr.name}` };
    });
    return finish({ results });
  }
  const row = state.records.find(r => r.id === payload.id);
  assert(row && canSee(row, actor), '无权查看该记录');
  assert(actor.approve && row.status === '待审批' && row.version === payload.version, row.endReason || '状态或版本已变化，请刷新');
  assert(['approve', 'reject'].includes(action), '不支持的操作');
  if (action === 'reject') assert(payload.reason?.trim(), '请填写驳回原因');
  row.status = action === 'approve' ? '待分配' : '已驳回';
  history(row, action === 'approve' ? '审批通过' : '审批驳回', actor, now, payload.reason?.trim() || '');
  task(row, '更新审批同步结果', action === 'approve' ? '人事是否同步（叶）＝是' : '人事是否同步（叶）＝驳回', now);
  if (action === 'reject') task(row, '机器人追加记录批注', payload.reason.trim(), now);
  return finish({ id: row.id });
}
export function syncStatus(row) {
  return ['回写失败', '回写中', '待回写', '已停止回写'].find(s => row.tasks.some(t => t.state === s)) || '已回写';
}
export function seedRecruitment(context, now = new Date()) {
  let state = { records: [], requests: {} };
  const actor = recruitmentActor('PM'), manager = recruitmentActor('招聘经理');
  const project = authorizedOwners(actor, context).find(o => context.projects.some(p => p.projectNo === o.id && p.approved && !projectEndReason(p)));
  const position = authorizedPositions(actor, context)[0];
  if (!project || !position) return state;
  const day = todayBJ(now), later = new Date(Date.parse(`${day}T00:00:00Z`) + 30 * 86400000).toISOString().slice(0, 10);
  for (let i = 0; i < 6; i++) {
    const form = { locations: [context.locations.find(l => l.status === '在用').id], ownerId: project.id, positionId: position.id, ability: ['AI', '中文教育', '代码'][i % 3], priority: OPTIONS.priority[i % 3], headcount: [8, 5, 12, 3, 6, 2][i], earliest: day, deadline: later, employment: ['实习'], age: '不限', employed: '不限', majors: ['不限'], schools: ['公办本科'], keywords: ['数据评测'], gender: '不限', stability: '不限', education: ['本科'], experience: ['不限'], overview: 'https://example.com/project-brief', security: 'L2', notes: '优先考虑具备文本评测经验的人员。' };
    const out = reduceRecruitment(state, actor, 'submit', { requestId: `seed-${i}`, form }, context, now); state = out.state; const id = out.result.id;
    if (i === 1) state = reduceRecruitment(state, manager, 'reject', { id, version: 1, requestId: `reject-${i}`, reason: '请补充驻场安排与笔试要求后重新提报。' }, context, now).state;
    if ([2, 3, 4].includes(i)) state = reduceRecruitment(state, manager, 'approve', { id, version: 1, requestId: `approve-${i}` }, context, now).state;
    if (i === 4) state = reduceRecruitment(state, manager, 'assign', { rows: [{ id, version: 1 }], hrId: context.recruiters[0].id, requestId: `assign-${i}` }, context, now).state;
    if (i === 5) state.records.find(r => r.id === id).form.deadline = new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  }
  return reconcileRecruitment(state, context, now);
}
