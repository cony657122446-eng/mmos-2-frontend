import { employmentStatus } from './hrWorkspace.js';

const surnames = [...'顾程陆宋苏梁许彭唐罗夏吴'];
const names = ['思齐', '嘉宁', '予安', '知言', '明远', '若溪', '安禾', '景行', '文清', '亦辰', '佳音', '舒桐', '嘉树'];
const tracks = [
  { match: /多语种|海外|双语/, tags: ['多语种评测', '内容审核'], school: '四川外国语大学', major: '英语', english: 'CET6' },
  { match: /语音|语料/, tags: ['语音转写', '音频质检'], school: '西南大学', major: '汉语言文学', english: 'CET4' },
  { match: /图像|OCR/, tags: ['图像标注', '识别结果复核'], school: '重庆邮电大学', major: '计算机科学与技术', english: 'CET4' },
  { tags: ['文本标注', '语义评测'], school: '重庆师范大学', major: '汉语言文学', english: 'CET6' },
];

export function populateStaffingRosters(state, day) {
  if (state.transfers.staffingVersion >= 1) return state;
  const { managers, pool, history } = state.transfers;
  const active = id => state.projects.some(p => p.id === id && !p.ended);
  // Prefer the last executed transfer target; otherwise keep the first live
  // association. Historical project records and production facts remain intact.
  for (const p of [...state.people, ...state.external]) {
    if (p.projectIds.length < 2) continue;
    const ids = [...new Set(p.projectIds)];
    const last = history.find(h => h.id === p.transferControl?.operationId)?.targetProjectId;
    const keep = ids.includes(last) && active(last) ? last : ids.find(active) || ids[0];
    p.projectIds = [keep];
    p.endedProjectRelations ||= [];
    for (const projectId of ids.filter(id => id !== keep)) {
      p.endedProjectRelations.push({ projectId, endedDate: day, reason: '统一为单项目关联', evidence: 'single-project-roster-v1' });
    }
  }
  // Old releases could leave a person working on another project or in two
  // reserves. Keep current employment first, then the most recent release.
  const reserves = new Map();
  for (const slot of state.transfers.available) {
    const p = state.people.find(p => p.id === slot.personId);
    if (!p || p.projectIds.length || pool.some(r => r.personId === p.id)) continue;
    const prev = reserves.get(p.id);
    if (!prev || Date.parse(slot.enteredAt) >= Date.parse(prev.enteredAt)) reserves.set(p.id, slot);
  }
  state.transfers.available = [...reserves.values()];
  const used = new Set(state.people.map(p => p.name));
  let seq = 0;
  function add(project, intern, waiting) {
    let name;
    do {
      const i = seq++;
      name = surnames[i % surnames.length] + names[(Math.floor(i / surnames.length) + i % surnames.length) % names.length];
    } while (used.has(name) && seq < surnames.length * names.length);
    if (used.has(name)) throw new Error('人员样例姓名不足');
    used.add(name);
    const n = state.nextEmployeeNumber++, id = 'hr-staffing-' + n;
    const track = tracks.find(t => !t.match || t.match.test(project.name));
    const started = new Date(Date.parse(day + 'T12:00:00Z') - (intern ? 45 + seq : 200 + seq) * 86400000).toISOString().slice(0, 10);
    const multilingual = track === tracks[0];
    const person = { id, name, employeeNo: 'MCE' + String(n).padStart(8, '0'), recruitmentNo: 'ZP-' + n, demo: true, sourceId: id, sourceSystem: '人员调配',
      projectIds: waiting ? [] : [project.id], category: '内部人员', employeeType: intern ? '在校实习生' : '全职', stage: intern ? '实习期' : '正式',
      manager: project.pm, departmentId: multilingual ? 'dept-9-2' : 'dept-9-5', positionId: multilingual ? 'pos-2' : 'pos-1', locationId: 'loc-1',
      masterCreated: true, trustedEmploymentStatus: '在职', candidate: false, accountActive: true, contractSigned: true,
      checklistCreated: true, checklistCompleted: true, materialsComplete: true, missingFields: [], specialPlans: [],
      arrivalDate: started, entryDate: started, trainingStart: started, day1: '通过', trainingResult: '通过',
      archive: { abilityTags: [...track.tags], school: track.school, major: track.major, education: '本科', english: track.english, graduation: intern ? '2027年6月' : '2023年6月' } };
    state.people.push(person);
    return person;
  }
  for (const pm of managers) {
    let projects = state.projects.filter(p => p.pm === pm.name && !p.ended);
    if (!projects.length && pm.id === 'pm-li-xiang') {
      const project = { id: 'DEMO-TRANSFER-LX-02', projectNo: 'DEMO-TRANSFER-LX-02', name: '双语语料质量评测', pm: pm.name, pa: '韩语桐', qa: '徐朗', ended: false, demo: true };
      if (!state.projects.some(p => p.id === project.id)) { state.projects.push(project); projects = [project]; }
    }
    if (!projects.length) continue;
    for (const project of projects) {
      const assigned = state.people.filter(p => p.projectIds.includes(project.id) && p.category === '内部人员' && p.masterCreated && !p.terminated && employmentStatus(p, day) !== '已离职');
      let full = assigned.filter(p => p.employeeType === '全职').length;
      let interns = assigned.filter(p => ['在校实习生', '实习生'].includes(p.employeeType)).length;
      while (!full || !interns || full + interns < 4) {
        const intern = interns < full;
        add(project, intern, false);
        if (intern) interns++; else full++;
      }
    }
    let count = state.transfers.available.filter(r => r.ownerId === pm.id).length;
    for (; count < 3; count++) {
      const project = projects[count % projects.length], person = add(project, false, true);
      const key = 'reserve-' + person.id, enteredAt = day + 'T00:00:00+08:00';
      person.endedProjectRelations = [{ projectId: project.id, endedDate: day, reason: '释放至可分配人员', evidence: key }];
      person.transferControl = { operationId: key, effectiveDate: day, changedAt: enteredAt, pool: false };
      state.transfers.available.push({ key, personId: person.id, ownerId: pm.id, ownerName: pm.name, visible: count !== 2, enteredAt, sources: [{ id: project.id, name: project.name }] });
    }
  }
  state.transfers.staffingVersion = 1;
  return state;
}

