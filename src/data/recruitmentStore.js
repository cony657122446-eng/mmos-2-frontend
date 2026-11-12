import { loadHr } from './hrWorkspace.js';
import { initialProjects } from './projectSeeds.js';
import { RECRUITMENT_KEY, RECRUITMENT_EVENT, seedRecruitment, reconcileRecruitment, reduceRecruitment, recruitmentActor, canSee } from './recruitment.js';

function read(key, fallback) { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
export function recruitmentContext() {
  const hr = loadHr();
  const acceptances = read('mmos.acceptance.records.v1', []);
  const ledger = read('mmos.finance.ledger.v1', { invoices: [] });
  const projects = read('mmos.project.master.v1', initialProjects).map(p => {
    const accepted = acceptances.filter(a => a.projectNo === p.projectNo && a.applyStatus === '已通过');
    // Require every accepted settlement to be fully covered; final acceptance alone is not completion.
    const allInvoiced = accepted.length > 0 && accepted.every(a => {
      const invoices = ledger.invoices.filter(i => i.projectNo === p.projectNo && (i.acceptanceNo === a.acceptanceNo || i.recordNo === a.acceptanceNo));
      return invoices.length > 0 && invoices.every(i => Boolean(i.invoiceNo)) && invoices.reduce((sum, i) => sum + Number(i.taxIncluded || 0), 0) >= Number(a.amount);
    });
    return { ...p, approved: /已通过|通过/.test(p.stageRecords?.initiation || '') && !/未通过|不通过/.test(p.stageRecords?.initiation || ''),
      finalAccepted: accepted.some(a => a.type === '最终验收') || p.stageRecords?.acceptance === '最终验收完成',
      allInvoiced: accepted.length ? allInvoiced : p.stageRecords?.invoice === '已开票' };
  });
  const trials = read('mmos.trial.records', []);
  // Trial fixtures are initial browser records, and are persisted by TrialPage before navigating here.
  return { projects, trials, departments: hr.departments, positions: hr.positions, locations: hr.locations,
    reviewers: hr.people.filter(p => p.accountActive && !p.departureEffective).map(p => ({ id: p.id, name: p.name })),
    recruiters: [
      { id: 'talent-hr-1', name: '苏晴', departmentName: '人才开发部', active: true, enabled: true },
      { id: 'talent-hr-2', name: '何珊', departmentName: '人才开发部', active: true, enabled: true },
    ] };
}
export function readRecruitment() {
  const context = recruitmentContext();
  const state = read(RECRUITMENT_KEY, null) || seedRecruitment(context);
  if (!Array.isArray(state.records) || !state.requests) throw new Error('招聘数据无法读取，请保留原始数据并核对后重试');
  const next = reconcileRecruitment(state, context);
  localStorage.setItem(RECRUITMENT_KEY, JSON.stringify(next));
  return { state: next, context };
}
export function recruitmentCommand(role, action, payload) {
  const { state, context } = readRecruitment();
  const result = reduceRecruitment(state, recruitmentActor(role), action, payload, context);
  localStorage.setItem(RECRUITMENT_KEY, JSON.stringify(result.state));
  window.dispatchEvent(new Event(RECRUITMENT_EVENT));
  return result.result;
}
export function recruitmentTodoCount(role) {
  if (role !== '招聘经理') return 0;
  try { return readRecruitment().state.records.filter(r => canSee(r, recruitmentActor(role)) && r.status === '待审批').length; } catch { return 0; }
}
