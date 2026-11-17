import {loadRenewals} from './data/hrRenewals';
import {HrRenewals} from './components/HrRenewals';
import RecruitmentPage from './components/RecruitmentPage';
import { recruitmentTodoCount } from './data/recruitmentStore';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { getPageTitle, Sidebar, Topbar, PlaceholderPage } from './components/AppShell';
import { OperationsWorkbench } from './components/OperationsWorkbench';
import { FinanceDashboard } from './components/FinanceDashboard';
import { RequirementsPage } from './components/RequirementsPage';
import { ProjectMasterPage, synchronizeProjectMasterRows } from './components/ProjectMasterPage';
import { getInitiationApplications, InitiationPage } from './components/InitiationPage';
import { TodoPage } from './components/TodoPage';
import { TrialPage } from './components/TrialPage';
import { isQuoteTodo, QuotationPage } from './components/QuotationPage';
import { AcceptancePage, isAcceptanceTodo } from './components/AcceptancePage';
import { InvoiceLedgerPage, loadInvoiceTasks } from './components/InvoiceLedgerPage';
import { OutputAttendancePage } from './components/OutputAttendancePage';
import { FinancePage } from './components/FinancePage';
import { ThemeProvider } from './theme/ThemeProvider';
import { loadPreview, operationsTodos } from './data/operationsDashboard';
import { getHrView, subscribeHr, syncHrProjectFacts } from './data/hrWorkspace';
import { initialProjects } from './data/projectSeeds';
import { migrateDisplayTextStorage } from './data/displayText';
import HrDirectory from './components/HrDirectory';
import HrWorkflow, { HrAnomalyTodos } from './components/HrWorkflow';
import HrIntakeForm from './components/HrIntakeForm';
import PersonnelTransferPage from './components/PersonnelSchedulingPage';
import { staffingTodoCount } from './data/personnelScheduling';
import HrDeliveryLineChanges from './components/HrDeliveryLineChanges';
import HrChangesPage from './components/HrChangesPage';
import HrPersonnelContracts from './components/HrPersonnelContracts';
import { HR_CHANGE_TYPES } from './data/hrChanges';
import './components/hr-workspace.css';
import './styles.css';
import './theme/erp-light-theme.css';
import './theme/mmos-theme.css';

function readQuotes() { try { return JSON.parse(localStorage.getItem('mmos.quotation.records.v3') || '[]'); } catch { return []; } }
function readAcceptance() { try { return JSON.parse(localStorage.getItem('mmos.acceptance.records.v1') || '[]'); } catch { return []; } }
function countOperationsTodos(role) { try { return operationsTodos(loadPreview(), role).length; } catch { return 0; } }
function synchronizeHrProjects() {
  const raw = localStorage.getItem('mmos.project.master.v1');
  const projects = raw ? JSON.parse(raw) : initialProjects;
  const completed = readAcceptance().filter(record => record.type === '最终验收' && record.applyStatus === '已通过');
  syncHrProjectFacts([...projects, ...completed]);
}
function countHrTodos(role) {
  try {
    const view = getHrView(role);
    const people = ['人事', '部门经理'].includes(role) ? view.onboarding : view.projectPeople;
    return people.filter(person => person.checklistCreated && (
      person.anomalies?.length || person.exitFollowup || person.abandoned || person.assignmentMissingFields?.length
    )).length;
  } catch { return 0; }
}
function countTodos(role) { if(role === '招聘经理') return recruitmentTodoCount(role); if(['人事', '部门经理'].includes(role))return countHrTodos(role); if (role === '财务') return loadInvoiceTasks().filter(item => item.invoiceStatus === '待开票').length; const initiation = getInitiationApplications().filter(item => role === 'PMO' ? item.status === '待 PMO 审核' : item.creator === '王然' && ['草稿', '审核不通过'].includes(item.status)).length; return staffingTodoCount(role, sessionStorage.getItem('mmos.transfer.preview-pm') || 'pm-wang-ran') + (role==='PM'?countHrTodos(role)+(loadRenewals().renewals||[]).filter(r=>r.status==='待PM确认'&&r.pm==='王然').length:0) + countOperationsTodos(role) + initiation + readQuotes().filter(item => isQuoteTodo(item, role)).length + readAcceptance().filter(item => isAcceptanceTodo(item, role)).length; }
const retiredPersonnelPages = new Set(['hr-career', 'hr-attendance']);
function App() { const requestedPage = new URLSearchParams(window.location.search).get('page') || 'overview'; const initial = requestedPage === 'hr-training' ? 'hr-candidates' : retiredPersonnelPages.has(requestedPage) ? 'people-master' : requestedPage; const [active, setActive] = React.useState(initial.startsWith('overview:') ? 'overview' : initial.startsWith('quotation') ? 'quotation' : initial.startsWith('acceptance') ? 'acceptance' : initial.startsWith('projects:') ? 'projects' : initial); const [projectFocus,setProjectFocus] = React.useState(initial.startsWith('projects:') ? {no:initial.split(':')[1],scope:initial.split(':')[2]} : null); const [reportFocus, setReportFocus] = React.useState(initial.startsWith('overview:') ? initial.slice(9) : ''); const [quoteFocus, setQuoteFocus] = React.useState(initial.startsWith('quotation:') ? initial.split(':')[1] : ''); const [acceptancePreset, setAcceptancePreset] = React.useState(null); const [initiationPreset, setInitiationPreset] = React.useState(null); const [mobileOpen, setMobileOpen] = React.useState(false); const [role, setRole] = React.useState(() => initial.startsWith('recruitment-') ? 'PM' : initial.startsWith('hr-') || initial === 'people-master' ? '人事' : 'PMO'); const [todoCount, setTodoCount] = React.useState(() => countTodos('PMO')); React.useEffect(() => {
    const update = () => {
      try { synchronizeProjectMasterRows(); synchronizeHrProjects(); }
      catch (error) { console.error('业务关联同步失败', error); }
    };
    const onStorage = event => {
      if (!event.key || ['mmos.project.master.v1', 'mmos.acceptance.records.v1', 'mmos.quotation.records.v3', 'mmos.initiation.applications'].includes(event.key)) update();
    };
    update();
    window.addEventListener('mmos:acceptance-updated', update);
    window.addEventListener('mmos:project-updated', update);
    window.addEventListener('mmos:quotation-updated', update);
    window.addEventListener('mmos:initiation-updated', update);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('mmos:acceptance-updated', update);
      window.removeEventListener('mmos:project-updated', update);
      window.removeEventListener('mmos:quotation-updated', update);
      window.removeEventListener('mmos:initiation-updated', update);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  React.useEffect(() => {
    if (!retiredPersonnelPages.has(requestedPage)) return;
    const url = new URL(window.location.href);
    url.searchParams.set('page', 'people-master');
    window.history.replaceState(null, '', url);
  }, [requestedPage]);
  const refreshTodos = nextRole => setTodoCount(countTodos(nextRole)); React.useEffect(() => { const sync = () => refreshTodos(role); const stopHr=subscribeHr(sync); sync(); window.addEventListener('mmos:initiation-updated', sync); window.addEventListener('mmos:quotation-updated', sync); window.addEventListener('mmos:acceptance-updated', sync); window.addEventListener('mmos:invoice-updated', sync); window.addEventListener('mmos:operations-updated', sync); window.addEventListener('mmos:recruitment-updated', sync); window.addEventListener('storage', sync); return () => { stopHr(); window.removeEventListener('mmos:initiation-updated', sync); window.removeEventListener('mmos:quotation-updated', sync); window.removeEventListener('mmos:acceptance-updated', sync); window.removeEventListener('mmos:invoice-updated', sync); window.removeEventListener('mmos:operations-updated', sync); window.removeEventListener('mmos:recruitment-updated', sync); window.removeEventListener('storage', sync); }; }, [role]); const [recruitmentPreset, setRecruitmentPreset] = React.useState(null); const [hrChangeFocus, setHrChangeFocus] = React.useState(null); const navigate = (id, context) => { if(id === 'hr-training') id = role === '人事' ? 'hr-candidates' : 'project-people'; if (role === '客户增长与战略解决方案部' && !['finance-customers', 'projects', 'overview'].includes(String(id).split(':')[0])) return; const [pageId, projectId, projectNo, projectName, customer] = String(id).split(':'); setActive(pageId); setRecruitmentPreset(pageId === 'recruitment-submissions' ? context || null : null); setHrChangeFocus(HR_CHANGE_TYPES.some(item => item.page === pageId) && typeof context?.hrChangeRecordId === 'string' ? { id: context.hrChangeRecordId } : null); setProjectFocus(pageId==='projects'&&projectId?{no:projectId,scope:projectNo}:null); setReportFocus(pageId === 'overview' ? projectId || '' : ''); setQuoteFocus(pageId === 'quotation' ? projectId || '' : ''); setAcceptancePreset(pageId === 'acceptance' && projectId ? { projectId, projectNo } : null); setInitiationPreset(pageId === 'initiation' && projectId === 'subproject' ? { kind: '子项目立项', projectNo, projectName: decodeURIComponent(projectName || ''), customer: decodeURIComponent(customer || '') } : null); window.history.replaceState(null, '', `?page=${pageId}`); setMobileOpen(false); }; React.useEffect(() => { if(active === 'hr-training' || requestedPage === 'hr-training') { const target = role === '人事' ? 'hr-candidates' : 'project-people'; setActive(target); const url = new URL(window.location.href); url.searchParams.set('page', target); window.history.replaceState(null, '', url); } }, [active, requestedPage, role]); const changeRole = next => { setRole(next); refreshTodos(next); if(next === '招聘经理') { setActive('recruitment-submissions'); window.history.replaceState(null, '', '?page=recruitment-submissions'); } if(next === '部门经理') { setActive('hr-candidates'); window.history.replaceState(null, '', '?page=hr-candidates'); } };  const page = active === 'recruitment-submissions' || role === '招聘经理' && ['todos', 'overview'].includes(active) ? <RecruitmentPage key={role} role={role} preset={recruitmentPreset} onPresetHandled={() => setRecruitmentPreset(null)} todoOnly={active === 'todos'} /> : role === '客户增长与战略解决方案部' && !['finance-customers', 'projects'].includes(active) ? <FinancePage onNavigate={navigate} page="finance-customers" role={role} onRoleChange={changeRole} /> : active === 'hr-renewals' ? <HrRenewals role={role} onNavigate={navigate} /> : active === 'hr-personnel-contracts' ? <HrPersonnelContracts role={role} /> : active === 'hr-delivery-line-changes' ? <HrDeliveryLineChanges role={role} onNavigate={navigate} /> : HR_CHANGE_TYPES.some(item => item.page === active) ? <HrChangesPage key={active} page={active} role={role} onNavigate={navigate} focusRecord={hrChangeFocus} /> : ['project-people', 'project-intern-pool'].includes(active) ? <PersonnelTransferPage key={active} page={active} role={role} onNavigate={navigate} onRoleChange={changeRole} /> : ['hr-overview', 'people-master', 'hr-organization', 'people-external'].includes(active) ? <HrDirectory page={active} role={role} onNavigate={navigate} /> : ['hr-candidates', 'hr-onboarding', 'hr-intakes'].includes(active) ? <div className="hr-workspace"><div className="trial-page-heading"><div><p className="eyebrow">人事基础管理</p><h1>{getPageTitle(active)}</h1><p className="subtitle">人员与办理记录统一关联，按当前身份查看和处理。</p></div></div><HrWorkflow page={active} role={role} onNavigate={navigate}/></div> : active === 'overview' ? ['人事', '部门经理'].includes(role) ? <HrDirectory page="hr-overview" role={role} onNavigate={navigate}/> : role === '财务' ? <FinanceDashboard role={role} onRoleChange={changeRole} onNavigate={navigate} /> : <OperationsWorkbench role={role} onRoleChange={changeRole} focusReportKey={reportFocus} onReportFocused={() => setReportFocus('')} /> : active === 'requirements' ? <RequirementsPage /> : active === 'projects' ? <ProjectMasterPage focusProjectNo={projectFocus?.no} focusPersonScope={projectFocus?.scope === 'external' ? '外部人员' : undefined} role={role} onRoleChange={changeRole} onNavigate={navigate} /> : active === 'initiation' ? <InitiationPage role={role} onRoleChange={changeRole} preset={initiationPreset} onPresetHandled={() => setInitiationPreset(null)} /> : active === 'trial' ? <TrialPage role={role} onRoleChange={changeRole} onNavigate={navigate} /> : active === 'quotation' ? <QuotationPage role={role} onRoleChange={changeRole} focusKey={quoteFocus} onNavigate={navigate} /> : active === 'output-attendance' ? <OutputAttendancePage role={role} onRoleChange={changeRole} /> : active === 'acceptance' ? <AcceptancePage role={role} onRoleChange={changeRole} presetProject={acceptancePreset} onPresetHandled={() => setAcceptancePreset(null)} /> : active.startsWith('finance-') || active === 'invoice-ledger' ? <FinancePage onNavigate={navigate} page={active === 'invoice-ledger' ? 'finance-invoices' : active} role={role} onRoleChange={changeRole} /> : active === 'todos' ? ['人事', '部门经理'].includes(role) ? <div className="hr-workspace"><h1>{role === '部门经理' ? '本部门待办' : '人事待办'}</h1><HrAnomalyTodos role={role} onNavigate={navigate}/></div> : <TodoPage role={role} onRoleChange={changeRole} onNavigate={navigate} /> : <PlaceholderPage title={getPageTitle(active)} />; if (active === 'hr-intake-form') return <HrIntakeForm/>; return <div className="app-shell erp-app"><Sidebar active={active} role={role} mobileOpen={mobileOpen} onNavigate={navigate} onClose={() => setMobileOpen(false)} /><main className="main-area"><Topbar role={role} onRoleChange={changeRole} active={active} todoCount={todoCount} onMenu={() => setMobileOpen(true)} onTodo={() => navigate('todos')} /><div className="content-wrap">{page}</div></main></div> }

const displayMigration = migrateDisplayTextStorage();
if (displayMigration.errors.length) console.error('历史展示文字更新失败', displayMigration.errors);
const appRoot = import.meta.hot?.data.appRoot || createRoot(document.getElementById('root'));
if (import.meta.hot) import.meta.hot.data.appRoot = appRoot;
appRoot.render(<ThemeProvider><App /></ThemeProvider>);

