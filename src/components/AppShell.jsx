import React from 'react';
import { Segmented, Select } from 'antd';
import { useDisplayDensity } from '../theme/ThemeProvider';
import { Bell, BriefcaseBusiness, CalendarClock, ChevronDown, CircleHelp, ClipboardList, FileText, LayoutDashboard, ListTodo, Menu, ReceiptText, Search, Settings2, UsersRound, WalletCards, X } from 'lucide-react';

const navigationSections = [
  {
    id: 'project', label: '项目', items: [
      { id: 'requirements', label: '需求列表', icon: FileText, count: '12' },
      { id: 'projects', label: '项目主库', icon: BriefcaseBusiness },
    ],
    management: { id: 'project-management', label: '项目管理', items: [
      { id: 'initiation', label: '立项申请' },
      { id: 'trial', label: '试标管理' },
      { id: 'quotation', label: '报价管理' },
      { id: 'output-attendance', label: '产出与出勤' },
      { id: 'acceptance', label: '验收管理' },
      { id: 'project-people', label: '项目人员' },
    ] },
  },
  {
    id: 'people', label: '人事', items: [
      { id: 'hr-overview', label: '人事总览', icon: UsersRound },
      { id: 'people-master', label: '人员主库', icon: ClipboardList },
      { id: 'hr-organization', label: '组织管理', icon: BriefcaseBusiness },
      { id: 'hr-candidates', label: '候选人库', icon: UsersRound },
      { id: 'people-external', label: '外部人员', icon: UsersRound },
    ],
    management: { id: 'people-changes', label: '人事变动', icon: CalendarClock, items: [
      { id: 'hr-onboarding', label: '入职清单' },
      { id: 'hr-intakes', label: '入职资料表' },
    ] },
  },
  {
    id: 'finance', label: '财务', items: [
      { id: 'finance-journal', label: '日记账', icon: WalletCards },
      { id: 'finance-customers', label: '客户主库', icon: ClipboardList },
      { id: 'finance-invoices', label: '发票与回款', icon: ReceiptText },
      { id: 'finance-costs', label: '职位成本', icon: ClipboardList },
      { id: 'finance-settlement', label: '兼职结算', icon: WalletCards },
      { id: 'finance-approvals', label: '财务审批记录', icon: FileText },
      { id: 'finance-contracts', label: '合同管理', icon: FileText },
    ],
  },
];

const pageTitles = {
  overview: '工作台', requirements: '需求列表', projects: '项目主库', initiation: '立项申请', trial: '试标管理', quotation: '报价管理', 'output-attendance': '产出与出勤', acceptance: '验收管理',
  'hr-organization':'组织管理', 'hr-candidates':'候选人库', 'hr-onboarding':'入职清单', 'hr-intakes':'入职资料表', 'people-external':'外部人员', 'project-people':'项目人员', 'hr-overview': '人事总览', 'people-master': '人员主库', 'people-changes': '人事变动', 'finance-customers': '客户主库', 'finance-invoices': '发票与回款', 'finance-journal': '日记账', 'finance-costs': '职位成本', 'finance-settlement': '兼职结算', 'finance-approvals': '财务审批记录', 'finance-contracts': '合同管理', 'expense-ledger': '报销台账', todos: '待办列表',
};

export function getPageTitle(id) { return pageTitles[id] || '工作台'; }

function NavItem({ item, active, onNavigate }) {
  const Icon = item.icon;
  return <button className={`nav-item ${active === item.id ? 'active' : ''}`} aria-current={active === item.id ? 'page' : undefined} onClick={() => onNavigate(item.id)}>{Icon && <Icon size={19} strokeWidth={1.8} />}<span>{item.label}</span>{item.count && <em>{item.count}</em>}</button>;
}

function NavigationGroup({ group, active, onNavigate }) {
  const containsActive = group.items.some(item => item.id === active);
  const [expanded, setExpanded] = React.useState(containsActive || group.id === 'project-management');
  React.useEffect(() => { if (containsActive) setExpanded(true); }, [active, containsActive]);
  const Icon = group.icon || BriefcaseBusiness;
  const contentId = `${group.id}-subnav`;
  return <><button className={`nav-item nav-group ${expanded ? 'is-open' : ''} ${containsActive ? 'has-active-child' : ''}`} aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(value => !value)}><Icon size={19} strokeWidth={1.8} /><span>{group.label}</span><ChevronDown size={14} className="nav-chevron" /></button><div id={contentId} className={`subnav ${expanded ? 'is-open' : ''}`}>{group.items.map(item => <button key={item.id} className={active === item.id ? 'active' : ''} aria-current={active === item.id ? 'page' : undefined} onClick={() => onNavigate(item.id)}>{item.label}</button>)}</div></>;
}

function NavigationSection({ section, active, open, onToggle, onNavigate }) {
  const SectionIcon = section.id === 'project' ? BriefcaseBusiness : section.id === 'people' ? UsersRound : WalletCards;
  return <div className={`nav-section ${open ? 'is-open' : ''}`}>
    <button className="nav-section-toggle" aria-expanded={open} aria-controls={`${section.id}-nav-items`} onClick={() => onToggle(section.id)}><SectionIcon size={15} strokeWidth={1.8} /><span>{section.label}</span><ChevronDown size={14} className="section-chevron" /></button>
    <div id={`${section.id}-nav-items`} className={`nav-section-body ${open ? 'is-open' : ''}`}><div className="nav-section-content">
      {section.items.map(item => <NavItem key={item.id} item={item} active={active} onNavigate={onNavigate} />)}
      {section.management && <NavigationGroup group={section.management} active={active} onNavigate={onNavigate} />}
    </div></div>
  </div>;
}

export function Sidebar({ active = 'overview', role = 'PMO', mobileOpen, onNavigate, onClose }) {
  const [openSections, setOpenSections] = React.useState({ project: !(active.startsWith('hr-') || active.startsWith('people-')), people: active.startsWith('hr-') || active.startsWith('people-'), finance: active.startsWith('finance-') });
  React.useEffect(() => { if (['hr-onboarding', 'hr-intakes'].includes(active)) setOpenSections(value => ({ ...value, people: true })); }, [active]);
  const toggleSection = id => setOpenSections(current => ({ ...current, [id]: !current[id] }));
  return <>
    <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
      <div className="brand-lockup mmos-brand-lockup"><img className="mmos-system-logo" src="/mmos-2.0-logo.svg" alt="MMOS 2.0 — MUCHEN Management OS" width="756" height="241" /><button className="icon-button mobile-close" aria-label="关闭导航" onClick={onClose}><X size={18} /></button></div>
      <div className="workspace-switcher"><span className="workspace-dot" /> 产品与经营部 <ChevronDown size={15} /></div>
      <nav className="primary-nav" aria-label="主导航">
        <div className="nav-section"><button className={`nav-section-toggle nav-workbench ${active === 'overview' ? 'active' : ''}`} aria-current={active === 'overview' ? 'page' : undefined} onClick={() => onNavigate('overview')}><LayoutDashboard size={15} strokeWidth={1.8} /><span>工作台</span></button></div>
        {navigationSections.filter(section => role !== '客户增长与战略解决方案部' || section.id === 'finance').map(section => <NavigationSection key={section.id} section={section.id === 'people' ? { ...section, management: role === '人事' ? section.management : undefined, items: section.items.filter(item => role === '人事' || ['PMO','财务'].includes(role) && ['people-master','people-external'].includes(item.id) || ['PM','PA'].includes(role) && item.id === 'people-external') } : section.id === 'finance' && role !== '财务' ? { ...section, items: section.items.filter(item => (role === '客户增长与战略解决方案部' ? ['finance-customers'] : ['finance-customers', 'finance-costs']).includes(item.id)) } : section} active={active} open={openSections[section.id]} onToggle={toggleSection} onNavigate={onNavigate} />)}<p className="nav-caption second">系统</p><button className="nav-item"><Settings2 size={19} strokeWidth={1.8} /><span>系统设置</span></button></nav>
      <div className="sidebar-foot"><div className="help-row"><CircleHelp size={17} /><span>需要帮助？</span></div><div className="user-card"><div className="avatar">{role === '客户增长与战略解决方案部' ? '增' : role === '人事' ? '周' : role === 'PA' ? '助' : role === '财务' ? '赵' : role === 'PM' ? '王' : '林'}</div><div><strong>{role === '客户增长与战略解决方案部' ? '演示账号' : role === '人事' ? '周宁' : role === 'PA' ? '演示助理' : role === '财务' ? '赵敏' : role === 'PM' ? '王然' : '林晓彤'}</strong><small>{role === '客户增长与战略解决方案部' ? '客户增长与战略解决方案部' : role === '人事' ? '人事' : role === 'PA' ? '项目助理' : role === '财务' ? '财务' : role === 'PM' ? '项目经理' : 'PMO 管理员'}</small></div><ChevronDown size={15} /></div></div>
    </aside>{mobileOpen && <button className="backdrop" aria-label="关闭导航" onClick={onClose} />}
  </>;
}

export function Topbar({ role, onRoleChange, onMenu, onTodo, active, todoCount = 0 }) { const { density, setDensity } = useDisplayDensity(); return <header className="topbar"><button className="icon-button mobile-menu" aria-label="打开导航" onClick={onMenu}><Menu size={21} /></button><div className="breadcrumbs"><span>MMOS 2.0</span><i>/</i>{['hr-onboarding', 'hr-intakes'].includes(active) && <><span>人事变动</span><i>/</i></>}<strong>{getPageTitle(active)}</strong></div><div className="top-actions"><Segmented className="density-switch" aria-label="显示密度" size="small" value={density} onChange={setDensity} options={[{ value: 'compact', label: '紧凑' }, { value: 'comfortable', label: '舒适' }]} /><label className="search-box"><Search size={17} /><input placeholder="搜索项目、需求或编号" aria-label="搜索项目、需求或编号" /></label><button className="icon-button notification" aria-label="通知"><Bell size={19} /><b>3</b></button><button className="todo-button" aria-label="进入待办列表" onClick={onTodo}><ListTodo size={17} /><span>待办</span>{todoCount > 0 && <b className="todo-count">{todoCount}</b>}</button><Select aria-label="当前演示身份" value={role} onChange={onRoleChange} style={{width:140}} options={[{value:"人事",label:"人事 · 周宁"},{value:"PMO",label:"PMO · 林晓彤"},{value:"PM",label:"PM · 王然"},{value:"PA",label:"项目助理"},{value:"财务",label:"财务 · 赵敏"},{value:"客户增长与战略解决方案部",label:"客户增长"}]}/></div></header>; }

export function PlaceholderPage({ title }) { return <div className="placeholder-page"><p className="eyebrow">MMOS 2.0 · 工作区</p><h1>{title}</h1><p>该界面将在工作台确认后独立开发，当前仅保留导航入口。</p></div>; }
