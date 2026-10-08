import React from 'react';
import { Bell, BriefcaseBusiness, CalendarClock, ChevronDown, CircleHelp, ClipboardList, FileText, LayoutDashboard, ListTodo, Menu, ReceiptText, Search, Settings2, UsersRound, WalletCards, X } from 'lucide-react';

const navigationSections = [
  {
    id: 'project', label: '项目', items: [
      { id: 'overview', label: '经营总览', icon: LayoutDashboard },
      { id: 'requirements', label: '需求列表', icon: FileText, count: '12' },
      { id: 'projects', label: '项目主库', icon: BriefcaseBusiness },
    ],
    management: { id: 'project-management', label: '项目管理', items: [
      { id: 'initiation', label: '立项申请' },
      { id: 'trial', label: '试标管理' },
      { id: 'quotation', label: '报价管理' },
      { id: 'acceptance', label: '验收管理' },
    ] },
  },
  {
    id: 'people', label: '人事', items: [
      { id: 'hr-overview', label: '人事总览', icon: UsersRound },
      { id: 'people-master', label: '人员主库', icon: ClipboardList },
      { id: 'people-changes', label: '人事变动', icon: CalendarClock },
    ],
  },
  {
    id: 'finance', label: '财务', items: [
      { id: 'invoice-ledger', label: '开票台账', icon: ReceiptText },
      { id: 'expense-ledger', label: '报销台账', icon: WalletCards },
    ],
  },
];

const pageTitles = {
  overview: '经营总览', requirements: '需求列表', projects: '项目主库', initiation: '立项申请', trial: '试标管理', quotation: '报价管理', acceptance: '验收管理',
  'hr-overview': '人事总览', 'people-master': '人员主库', 'people-changes': '人事变动', 'invoice-ledger': '开票台账', 'expense-ledger': '报销台账', todos: '待办列表',
};

export function getPageTitle(id) { return pageTitles[id] || '经营总览'; }

function NavItem({ item, active, onNavigate }) {
  const Icon = item.icon;
  return <button className={`nav-item ${active === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)}>{Icon && <Icon size={19} strokeWidth={1.8} />}<span>{item.label}</span>{item.count && <em>{item.count}</em>}</button>;
}

function NavigationSection({ section, active, open, onToggle, projectOpen, onProjectToggle, onNavigate }) {
  const SectionIcon = section.id === 'project' ? BriefcaseBusiness : section.id === 'people' ? UsersRound : WalletCards;
  return <div className={`nav-section ${open ? 'is-open' : ''}`}>
    <button className="nav-section-toggle" aria-expanded={open} aria-controls={`${section.id}-nav-items`} onClick={() => onToggle(section.id)}><SectionIcon size={15} strokeWidth={1.8} /><span>{section.label}</span><ChevronDown size={14} className="section-chevron" /></button>
    <div id={`${section.id}-nav-items`} className={`nav-section-body ${open ? 'is-open' : ''}`}><div className="nav-section-content">
      {section.items.map(item => <NavItem key={item.id} item={item} active={active} onNavigate={onNavigate} />)}
      {section.management && <><button className={`nav-item nav-group ${projectOpen ? 'is-open' : ''} ${active === section.management.id ? 'active' : ''}`} aria-expanded={projectOpen} aria-controls="project-management-subnav" onClick={() => onProjectToggle(openState => !openState)}><BriefcaseBusiness size={19} strokeWidth={1.8} /><span>{section.management.label}</span><ChevronDown size={14} className="nav-chevron" /></button><div id="project-management-subnav" className={`subnav ${projectOpen ? 'is-open' : ''}`}>{section.management.items.map(item => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}>{item.label}</button>)}</div></>}
    </div></div>
  </div>;
}

export function Sidebar({ active = 'overview', role = 'PMO', mobileOpen, onNavigate, onClose }) {
  const [projectOpen, setProjectOpen] = React.useState(true);
  const [openSections, setOpenSections] = React.useState({ project: true, people: false, finance: false });
  const toggleSection = id => setOpenSections(current => ({ ...current, [id]: !current[id] }));
  return <>
    <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
      <div className="brand-lockup"><span className="company-logo-icon" role="img" aria-label="公司 Logo 图标" /><div className="brand-wordmark"><strong>MMOS <span>2.0</span></strong><small>运营中台</small></div><button className="icon-button mobile-close" aria-label="关闭导航" onClick={onClose}><X size={18} /></button></div>
      <div className="workspace-switcher"><span className="workspace-dot" /> 产品与经营部 <ChevronDown size={15} /></div>
      <nav className="primary-nav" aria-label="主导航">{navigationSections.map(section => <NavigationSection key={section.id} section={section} active={active} open={openSections[section.id]} onToggle={toggleSection} projectOpen={projectOpen} onProjectToggle={setProjectOpen} onNavigate={onNavigate} />)}<p className="nav-caption second">系统</p><button className="nav-item"><Settings2 size={19} strokeWidth={1.8} /><span>系统设置</span></button></nav>
      <div className="sidebar-foot"><div className="help-row"><CircleHelp size={17} /><span>需要帮助？</span></div><div className="user-card"><div className="avatar">{role === '财务' ? '赵' : role === 'PM' ? '王' : '林'}</div><div><strong>{role === '财务' ? '赵敏' : role === 'PM' ? '王然' : '林晓彤'}</strong><small>{role === '财务' ? '财务' : role === 'PM' ? '项目经理' : 'PMO 管理员'}</small></div><ChevronDown size={15} /></div></div>
    </aside>{mobileOpen && <button className="backdrop" aria-label="关闭导航" onClick={onClose} />}
  </>;
}

export function Topbar({ onMenu, onTodo, active, todoCount = 0 }) { return <header className="topbar"><button className="icon-button mobile-menu" aria-label="打开导航" onClick={onMenu}><Menu size={21} /></button><div className="breadcrumbs"><span>MMOS 2.0</span><i>/</i><strong>{getPageTitle(active)}</strong></div><div className="top-actions"><label className="search-box"><Search size={17} /><input placeholder="搜索项目、需求或编号" aria-label="搜索项目、需求或编号" /></label><button className="icon-button notification" aria-label="通知"><Bell size={19} /><b>3</b></button><button className="todo-button" aria-label="进入待办列表" onClick={onTodo}><ListTodo size={17} /><span>待办</span>{todoCount > 0 && <b className="todo-count">{todoCount}</b>}</button><div className="top-avatar">林</div></div></header>; }

export function PlaceholderPage({ title }) { return <div className="placeholder-page"><p className="eyebrow">MMOS 2.0 · 工作区</p><h1>{title}</h1><p>该界面将在经营总览确认后独立开发，当前仅保留导航入口。</p></div>; }
