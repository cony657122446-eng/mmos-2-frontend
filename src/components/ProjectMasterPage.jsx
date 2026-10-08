import React from 'react';
import {
  Button, Card, Checkbox, Col, DatePicker, Empty, Form, Input, Modal, Row, Segmented, Select, Space, Table, Tabs, Tag,
  Tooltip, message,
} from 'antd';
import {
  ArrowUpRight, BriefcaseBusiness, CalendarDays, Check, ChevronRight, CircleAlert,
  ClipboardList, Download, Edit3, ExternalLink, FileText, Filter, FolderOpen, History, Link2,
  ListFilter, ListChecks, Search, SlidersHorizontal, UsersRound, X,
} from 'lucide-react';
import dayjs from 'dayjs';

const PROJECT_STAGES = [
  { key: 'initiation', label: '立项申请', page: 'initiation' },
  { key: 'trial', label: '试标', page: 'trial' },
  { key: 'quotation', label: '报价', page: 'quotation' },
  { key: 'running', label: '项目运行', page: 'projects' },
  { key: 'acceptance', label: '验收', page: 'acceptance' },
  { key: 'invoice', label: '开票', page: 'invoice-ledger' },
  { key: 'ended', label: '项目结束', page: 'projects' },
];

const STATUS_ORDER = ['立项申请中', '试标中', '试标失败', '试标成功', '报价中', '已立项', '项目进行中', '项目暂停', '项目验收中', '待开票', '已开票', '项目结束'];
const MAIN_FIELDS = [
  { key: 'projectNo', label: '项目编号' }, { key: 'projectName', label: '项目名称' }, { key: 'mainProject', label: '主项目名称' },
  { key: 'customer', label: '客户' }, { key: 'customerManager', label: '客户经理' }, { key: 'taskType', label: '任务类型' },
  { key: 'startDate', label: '起始日期' }, { key: 'ability', label: '项目能力标签' }, { key: 'terminal', label: '终端' },
  { key: 'security', label: '密级' }, { key: 'pm', label: 'PM' }, { key: 'pa', label: 'PA' }, { key: 'qa', label: 'QA负责人' },
  { key: 'deputyPm', label: '代理PM' }, { key: 'mentorPm', label: '带教PM' }, { key: 'risk', label: '风险等级' },
  { key: 'status', label: '项目状态' }, { key: 'note', label: '备注' }, { key: 'ruleVersion', label: '适用规则版本' },
  { key: 'byteSign', label: '字节签单状态' }, { key: 'efficiency', label: '项目人效' }, { key: 'tencentNo', label: '腾讯项目编号' },
  { key: 'byteId', label: '字节项目ID' }, { key: 'byteDemandId', label: '字节需求ID' }, { key: 'byteSubId', label: '字节子项目ID' },
  { key: 'endDate', label: '结束日期' }, { key: 'managementDoc', label: '管理文档' }, { key: 'remitted', label: '已汇款总金额' },
  { key: 'progress', label: '关键进展' }, { key: 'incentive', label: '激励考核细则' }, { key: 'byteSubProject', label: '字节子项目' },
  { key: 'pricing', label: '计价方式' }, { key: 'unitPrice', label: '单价' }, { key: 'projectTag', label: '项目标记' },
  { key: 'cycle', label: '项目周期' }, { key: 'expectedTime', label: '预计处理时间' }, { key: 'invoiceStatus', label: '开票状态' },
  { key: 'paymentStatus', label: '到账状态' }, { key: 'internalOutput', label: '公司人员当前总产量' }, { key: 'externalOutput', label: '公司外部人员产量' },
  { key: 'totalOutput', label: '总产量' }, { key: 'internalHours', label: '包时项目内部员工有效时长' }, { key: 'externalHours', label: '包时项目外部员工有效时长' },
  { key: 'attendanceCost', label: '当前公司出勤人员成本' }, { key: 'externalCost', label: '公司外部人员成本' }, { key: 'excessCost', label: '超量绩效成本' },
  { key: 'otherCost', label: '其他费用' }, { key: 'trialCost', label: '外部试标成本' }, { key: 'outputValue', label: '产值' },
  { key: 'cost', label: '成本' }, { key: 'profit', label: '利润' }, { key: 'profitRate', label: '利润率' },
  { key: 'acceptanceTotal', label: '验收总金额' }, { key: 'acceptanceActual', label: '实际验收金额' }, { key: 'acceptanceInvoiced', label: '验收开票总金额' },
  { key: 'outputGap', label: '产值与验收差距' },
];

const FIELD_GROUPS = [
  { title: '项目识别', keys: ['projectNo', 'projectName', 'mainProject', 'customer', 'taskType', 'terminal', 'security', 'projectTag', 'pricing', 'unitPrice'] },
  { title: '项目角色', keys: ['pm', 'deputyPm', 'pa', 'qa', 'mentorPm', 'customerManager'] },
  { title: '生命周期与风险', keys: ['status', 'risk', 'startDate', 'endDate', 'cycle', 'expectedTime', 'progress', 'note'] },
  { title: '产量与出勤', keys: ['internalOutput', 'externalOutput', 'totalOutput', 'efficiency', 'internalHours', 'externalHours'] },
  { title: '成本与利润', keys: ['attendanceCost', 'externalCost', 'excessCost', 'otherCost', 'trialCost', 'outputValue', 'cost', 'profit', 'profitRate'] },
  { title: '验收与回款', keys: ['acceptanceTotal', 'acceptanceActual', 'acceptanceInvoiced', 'remitted', 'outputGap', 'invoiceStatus', 'paymentStatus'] },
  { title: '客户侧标识', keys: ['tencentNo', 'byteId', 'byteDemandId', 'byteSubId', 'byteSubProject', 'byteSign'] },
  { title: '规则与经营', keys: ['ability', 'ruleVersion'] },
  { title: '文档与附件', keys: ['managementDoc', 'incentive'] },
];
const ROLE_ORDER = ['PM', '代理PM', 'PA', 'QA', '质检', '标注'];
const OUTPUT_FIELDS = ['日期', '人员姓名', '人员类型', '项目角色', '所属PM', '职位', '内容分类', '计价方式', '出勤工时', '是否在项', '产出量', '有效产量', '待确认有效产量', '结算工时', '结算出勤', '有效出勤工时', '单价', '试标成本', '人员产值', '人员成本', '验收追溯', '同步状态'];
const PROJECT_PEOPLE = {
  'p-001': [
    { name: '王然', role: 'PM', type: '内部', manager: '—', title: '项目经理', hours: 8, output: 0, effective: 0, settle: 8, cost: 860 },
    { name: '赵子涵', role: '代理PM', type: '内部', manager: '王然', title: '项目经理', hours: 4, output: 0, effective: 0, settle: 4, cost: 430 },
    { name: '林晓彤', role: 'PA', type: '内部', manager: '王然', title: '项目助理', hours: 8, output: 0, effective: 0, settle: 8, cost: 420 },
    { name: '陈默', role: 'QA', type: '内部', manager: '王然', title: 'QA', hours: 8, output: 1200, effective: 1160, settle: 8, cost: 480 },
    { name: '周启明', role: '质检', type: '内部', manager: '王然', title: '质检员', hours: 8, output: 2400, effective: 2280, settle: 7.5, cost: 360 },
    { name: '孙磊', role: '标注', type: '内部', manager: '王然', title: '标注员', hours: 8, output: 6800, effective: 6520, settle: 8, cost: 320 },
    { name: '李倩', role: '标注', type: '外部', manager: '王然', title: '标注员', hours: 6, output: 3100, effective: 2940, settle: 6, cost: 240 },
  ],
};
function businessWeek(date) { const days = (date.day() + 2) % 7; const start = date.subtract(days, 'day').startOf('day'); return [start, start.add(6, 'day')]; }
function projectPeople(project) {
  return PROJECT_PEOPLE[project.key] || [
    { name: project.pm || '项目经理', role: 'PM', type: '内部', manager: '—', title: '项目经理', hours: 8, output: 0, effective: 0, settle: 8, cost: 860 },
    { name: project.pa && project.pa !== '—' ? project.pa : '项目助理', role: 'PA', type: '内部', manager: project.pm, title: '项目助理', hours: 8, output: 0, effective: 0, settle: 8, cost: 420 },
    { name: project.qa && project.qa !== '—' ? project.qa : '质检员', role: '质检', type: '内部', manager: project.pm, title: '质检员', hours: 8, output: 1800, effective: 1680, settle: 8, cost: 360 },
    { name: '作业员A', role: '标注', type: '内部', manager: project.pm, title: '标注员', hours: 8, output: 4200, effective: 3980, settle: 8, cost: 320 },
    { name: '作业员B', role: '标注', type: '外部', manager: project.pm, title: '标注员', hours: 6, output: 2600, effective: 2410, settle: 6, cost: 240 },
  ];
}
function outputRows(project) {
  return projectPeople(project).flatMap(person => [0, 1, 2, 3, 4, 5, 6, 7].map(offset => {
    const date = dayjs('2026-09-24').subtract(offset, 'day');
    const ratio = offset % 2 === 0 ? 1 : 0.8;
    return { key: `${person.name}-${date.format('YYYYMMDD')}`, date: date.format('YYYY-MM-DD'), person, hours: person.hours, output: Math.round(person.output * ratio), effective: Math.round(person.effective * ratio), settle: person.settle, cost: Math.round(person.cost * ratio) };
  }));
}
const MERGED_FIELD_VALUES = {
  'p-001': { pricing: '计件', unitPrice: '0.42 元/条', projectTag: '常规', cycle: '2026-09-10 起', expectedTime: '40 个工作日', invoiceStatus: '未开票', paymentStatus: '未到账', internalOutput: '64,000 条', externalOutput: '8,200 条', totalOutput: '72,200 条', internalHours: '—', externalHours: '—', attendanceCost: '48,600 元', externalCost: '6,400 元', excessCost: '1,200 元', otherCost: '800 元', trialCost: '2,400 元', outputValue: '30,324 元', cost: '59,400 元', profit: '-29,076 元', profitRate: '-95.9%', acceptanceTotal: '—', acceptanceActual: '—', acceptanceInvoiced: '—', outputGap: '—' },
  'p-005': { pricing: '包时', unitPrice: '86 元/小时', projectTag: '已结束', cycle: '2026-08-19 至 2026-09-12', expectedTime: '18 个工作日', invoiceStatus: '已开票', paymentStatus: '已到账', internalOutput: '—', externalOutput: '—', totalOutput: '—', internalHours: '1,260 小时', externalHours: '180 小时', attendanceCost: '286,000 元', externalCost: '32,000 元', excessCost: '8,600 元', otherCost: '4,200 元', trialCost: '6,800 元', outputValue: '460,000 元', cost: '337,600 元', profit: '122,400 元', profitRate: '26.6%', acceptanceTotal: '418,600 元', acceptanceActual: '418,600 元', acceptanceInvoiced: '418,600 元', outputGap: '41,400 元' },
};

const PROJECTS = [
  {
    key: 'p-001', projectNo: 'ZJ20260910922', projectName: '星河智能客服项目', mainProject: '智能客服 Agent 评测', demandId: 'REQ-202609-001', customer: '字节', customerManager: '周宁', taskType: '评测', startDate: '2026-09-10', endDate: '—', ability: '代码 / Agent开发', terminal: '字节内部平台', security: 'L4', pm: '王然', pa: '林晓彤', qa: '陈默', deputyPm: '—', mentorPm: '赵子涵', risk: '中', status: '项目进行中', note: '当前按周跟踪产出和人员稳定性。', ruleVersion: 'RULE-000768', byteSign: '已签单', efficiency: '1.0', tencentNo: '—', byteId: 'BD-889201', byteDemandId: 'REQ-BD-7712', byteSubId: 'SUB-01', byteSubProject: '客服多轮评测', managementDoc: '项目管理文档', remitted: '¥ 286,000', progress: '已完成首批试标，进入稳定生产。', incentive: '激励考核细则 v1.0', riskReason: '人员稳定性需持续观察', stageRecords: { initiation: '立项申请已通过，PM已承接', trial: '试标成功，质量达标', quotation: '客户已签单', running: '生产中', acceptance: '尚未开始', invoice: '尚未开始', ended: '尚未结束' }, activity: ['2026-09-20 · PMO更新关键进展', '2026-09-18 · 报价确认并完成签单', '2026-09-12 · 试标成功']
  },
  {
    key: 'p-002', projectNo: 'ZJ20260911880', projectName: '海外内容审核产线', mainProject: '海外内容安全', demandId: 'REQ-202609-002', customer: '腾讯', customerManager: '李想', taskType: '审核', startDate: '2026-09-18', endDate: '—', ability: '英语 + 小语种', terminal: '海外审核平台', security: 'L3', pm: '陈默', pa: '—', qa: '林晓彤', deputyPm: '—', mentorPm: '王然', risk: '低', status: '报价中', note: '等待客户确认第二轮报价。', ruleVersion: 'RULE-000801', byteSign: '不适用', efficiency: '—', tencentNo: 'TX-202609-334', byteId: '—', byteDemandId: '—', byteSubId: '—', byteSubProject: '—', managementDoc: '海外审核项目计划', remitted: '¥ 0', progress: '报价材料已准备，等待客户反馈。', incentive: '—', riskReason: '当前无高风险信号', stageRecords: { initiation: '立项申请已通过', trial: '试标成功', quotation: '第二轮报价中', running: '尚未进入项目运行', acceptance: '尚未开始', invoice: '尚未开始', ended: '尚未结束' }, activity: ['2026-09-19 · 提交第二轮报价', '2026-09-18 · 试标成功']
  },
  {
    key: 'p-003', projectNo: 'ZJ20260912006', projectName: '语音质检专项', mainProject: '语音数据质量项目', demandId: 'REQ-202609-003', customer: '字节', customerManager: '周宁', taskType: 'ASR/TTS', startDate: '2026-09-12', endDate: '—', ability: '小语种', terminal: '语音质检平台', security: 'L4', pm: '林晓彤', pa: '赵子涵', qa: '陈默', deputyPm: '—', mentorPm: '—', risk: '高', status: '项目暂停', note: '客户暂停新批次，保留已交付数据。', stale: true, ruleVersion: 'RULE-000768', byteSign: '已签单', efficiency: '0.8', tencentNo: '—', byteId: 'BD-889425', byteDemandId: 'REQ-BD-7788', byteSubId: 'SUB-02', byteSubProject: '语音质检第二批', managementDoc: '暂停复盘记录', remitted: '¥ 92,400', progress: '等待客户确认恢复时间。', incentive: '—', riskReason: '项目暂停，需确认后续资源安排', stageRecords: { initiation: '立项申请已通过', trial: '试标成功', quotation: '报价完成', running: '项目暂停', acceptance: '已完成阶段交付', invoice: '尚未开始', ended: '尚未结束' }, activity: ['2026-09-20 · 项目状态变更为暂停', '2026-09-17 · 完成阶段交付']
  },
  {
    key: 'p-004', projectNo: 'ZJ20260913041', projectName: '数学 OCR 试标项目', mainProject: '数学数据专项', demandId: 'REQ-202609-006', customer: '阿里', customerManager: '赵子涵', taskType: '图像', startDate: '2026-09-19', endDate: '—', ability: '英语', terminal: '客户试标平台', security: 'L2', pm: '王然', pa: '—', qa: '林晓彤', deputyPm: '—', mentorPm: '陈默', risk: '中', status: '试标中', note: '第一批样本已提交，等待结果。', ruleVersion: 'RULE-000820', byteSign: '不适用', efficiency: '—', tencentNo: '—', byteId: '—', byteDemandId: '—', byteSubId: '—', byteSubProject: '—', managementDoc: '试标计划', remitted: '¥ 0', progress: '已提交第一批样本。', incentive: '—', riskReason: '试标结果待确认', stageRecords: { initiation: '立项申请已通过', trial: '试标进行中', quotation: '尚未开始', running: '尚未开始', acceptance: '尚未开始', invoice: '尚未开始', ended: '尚未结束' }, activity: ['2026-09-20 · 提交第一批试标样本']
  },
  {
    key: 'p-005', projectNo: 'ZJ20260819018', projectName: '海外内容审核一期', mainProject: '海外内容安全', demandId: 'REQ-202608-019', customer: '腾讯', customerManager: '李想', taskType: '审核', startDate: '2026-08-19', endDate: '2026-09-12', ability: '英语 + 小语种', terminal: '海外审核平台', security: 'L3', pm: '李想', pa: '—', qa: '陈默', deputyPm: '—', mentorPm: '—', risk: '低', status: '项目结束', note: '完全验收并已开票。', ruleVersion: 'RULE-000701', byteSign: '不适用', efficiency: '1.1', tencentNo: 'TX-202608-901', byteId: '—', byteDemandId: '—', byteSubId: '—', byteSubProject: '—', managementDoc: '结项归档文档', remitted: '¥ 418,600', progress: '项目已完成结项归档。', incentive: '海外审核激励细则', riskReason: '无', stageRecords: { initiation: '立项申请已通过', trial: '试标成功', quotation: '客户已签单', running: '项目运行完成', acceptance: '最终验收完成', invoice: '已开票', ended: '项目结束' }, activity: ['2026-09-12 · 项目结束', '2026-09-10 · 完成最终验收', '2026-09-08 · 完成开票']
  },
  {
    key: 'p-006', projectNo: 'ZJ20260914003', projectName: '多语种语音采集', mainProject: '多语种数据采集', demandId: 'REQ-202609-005', customer: '海天瑞声', customerManager: '周宁', taskType: '采集/采标', startDate: '2026-09-20', endDate: '—', ability: '小语种', terminal: '—', security: 'L4', pm: '林晓彤', pa: '—', qa: '—', deputyPm: '—', mentorPm: '—', risk: '低', status: '立项申请中', note: '等待PMO确认人员配置。', ruleVersion: 'RULE-000833', byteSign: '不适用', efficiency: '—', tencentNo: '—', byteId: '—', byteDemandId: '—', byteSubId: '—', byteSubProject: '—', managementDoc: '—', remitted: '¥ 0', progress: '需求已承接，准备立项。', incentive: '—', riskReason: 'PM资源待确认', stageRecords: { initiation: '立项申请中', trial: '尚未开始', quotation: '尚未开始', running: '尚未开始', acceptance: '尚未开始', invoice: '尚未开始', ended: '尚未结束' }, activity: ['2026-09-20 · 发起立项申请']
  },
  {
    key: 'p-007', projectNo: 'ZJ20260915022', projectName: '电商图像质检试标', mainProject: '电商视觉质检', demandId: 'REQ-202609-008', customer: '京东', customerManager: '赵子涵', taskType: '图像', startDate: '2026-09-15', endDate: '—', ability: '英语', terminal: '客户试标平台', security: 'L2', pm: '陈默', pa: '—', qa: '林晓彤', deputyPm: '—', mentorPm: '王然', risk: '高', status: '试标失败', note: '第一轮样本准确率未达客户门槛。', ruleVersion: 'RULE-000846', byteSign: '不适用', efficiency: '—', tencentNo: '—', byteId: '—', byteDemandId: '—', byteSubId: '—', byteSubProject: '—', managementDoc: '试标失败复盘', remitted: '¥ 0', progress: '等待客户反馈复测窗口。', incentive: '—', riskReason: '试标失败，需完成复盘', stageRecords: { initiation: '立项申请已通过', trial: '试标失败', quotation: '未进入报价', running: '尚未开始', acceptance: '尚未开始', invoice: '尚未开始', ended: '尚未结束' }, activity: ['2026-09-20 · 试标结果标记为失败', '2026-09-18 · 提交试标样本']
  },
  {
    key: 'p-008', projectNo: 'ZJ20260916017', projectName: '中文答案可用性评测', mainProject: '中文内容评测', demandId: 'REQ-202609-009', customer: '字节', customerManager: '周宁', taskType: '评测', startDate: '2026-09-16', endDate: '—', ability: '代码 / Agent开发', terminal: '字节内部平台', security: 'L4', pm: '王然', pa: '林晓彤', qa: '陈默', deputyPm: '—', mentorPm: '赵子涵', risk: '中', status: '已立项', note: '立项完成，等待客户确认生产排期。', ruleVersion: 'RULE-000852', byteSign: '已签单', efficiency: '—', tencentNo: '—', byteId: 'BD-889612', byteDemandId: 'REQ-BD-7812', byteSubId: 'SUB-03', byteSubProject: '中文答案评测', managementDoc: '立项评审记录', remitted: '¥ 36,000', progress: '已完成资源预排和项目交底。', incentive: '—', riskReason: '排期待客户确认', stageRecords: { initiation: '立项申请已通过', trial: '试标成功', quotation: '报价完成', running: '已立项，尚未生产', acceptance: '尚未开始', invoice: '尚未开始', ended: '尚未结束' }, activity: ['2026-09-20 · 立项申请审批通过', '2026-09-19 · 完成报价确认']
  },
];

function statusRank(status) {
  if (status === '试标失败') return 1;
  if (status === '项目暂停') return 5;
  const rank = STATUS_ORDER.indexOf(status);
  return rank < 0 ? 0 : rank;
}

function stageState(project, stageKey) {
  const current = project.status;
  if (current === '试标失败' && stageKey === 'trial') return 'failed';
  if (current === '项目暂停' && stageKey === 'running') return 'paused';
  const currentRank = statusRank(current);
  const stageRank = { initiation: 0, trial: 1, quotation: 2, running: 4, acceptance: 7, invoice: 9, ended: 10 }[stageKey];
  if (current === '立项申请中') return stageKey === 'initiation' ? 'current' : 'pending';
  if (current === '试标中') return stageKey === 'initiation' ? 'done' : stageKey === 'trial' ? 'current' : 'pending';
  if (current === '试标成功') return stageRank <= 1 ? 'done' : stageKey === 'quotation' ? 'current' : 'pending';
  if (current === '报价中') return stageRank < 2 ? 'done' : stageKey === 'quotation' ? 'current' : 'pending';
  if (current === '已立项' || current === '项目进行中') return stageRank < 4 ? 'done' : stageKey === 'running' ? 'current' : 'pending';
  if (current === '项目验收中') return stageRank < 7 ? 'done' : stageKey === 'acceptance' ? 'current' : 'pending';
  if (current === '待开票') return stageRank < 9 ? 'done' : stageKey === 'invoice' ? 'current' : 'pending';
  if (current === '已开票') return stageRank < 10 ? 'done' : stageKey === 'ended' ? 'current' : 'pending';
  if (current === '项目结束') return 'done';
  if (current === '项目暂停') return stageRank < 4 ? 'done' : 'pending';
  return currentRank >= stageRank ? 'done' : 'pending';
}

const stateLabels = { done: '已完成', current: '进行中', pending: '未完成', failed: '试标失败', paused: '项目暂停' };

function StatusDots({ project, onNavigate }) {
  return <div className="project-status-dots" onClick={event => event.stopPropagation()}>{PROJECT_STAGES.map(stage => {
    const state = stageState(project, stage.key);
    const label = `${stage.label} · ${stateLabels[state]}`;
    return <Tooltip title={label} key={stage.key}><button className={`status-dot ${state}`} aria-label={label} onClick={() => { if (stage.key === 'running' || stage.key === 'ended') { message.info(`${project.projectName} · ${stage.label}记录在项目详情中查看`); return; } onNavigate(stage.page, project); }}><span /></button></Tooltip>;
  })}</div>;
}

function StatusTag({ status }) {
  const color = status === '项目结束' ? 'blue' : status === '项目暂停' ? 'gold' : status === '试标失败' ? 'red' : status.includes('中') || status === '已立项' ? 'green' : 'default';
  return <Tag color={color}>{status}</Tag>;
}

function FieldValue({ project, fieldKey }) {
  const value = project[fieldKey] ?? MERGED_FIELD_VALUES[project.key]?.[fieldKey];
  if (fieldKey === 'status') return <StatusTag status={value} />;
  if (fieldKey === 'projectNo' || fieldKey === 'projectName' || fieldKey === 'mainProject') return <strong>{value || '—'}</strong>;
  if (fieldKey === 'managementDoc' || fieldKey === 'incentive') return value && value !== '—' ? <a href="#document" onClick={event => { event.preventDefault(); message.info(`打开：${value}`); }}>{value} <ExternalLink size={12} /></a> : <span className="field-empty">—</span>;
  return value ? <span>{value}</span> : <span className="field-empty">—</span>;
}

function FieldBlock({ project, group }) {
  return <div className="project-field-group"><h4>{group.title}</h4><div className="project-field-grid">{group.keys.map(key => { const field = MAIN_FIELDS.find(item => item.key === key); return <div className="project-field" key={key}><label>{field.label}</label><FieldValue project={project} fieldKey={key} /></div>; })}</div></div>;
}
function personOutput(project, row) {
  const person = row.person;
  return { 日期: row.date, 人员姓名: person.name, 人员类型: person.type, 项目角色: person.role, 所属PM: person.manager, 职位: person.title, 内容分类: project.taskType, 计价方式: project.pricing || MERGED_FIELD_VALUES[project.key]?.pricing || '—', 出勤工时: row.hours, 是否在项: row.hours > 0 ? '在项' : '不在项', 产出量: row.output, 有效产量: row.effective, 待确认有效产量: '—', 结算工时: row.settle, 结算出勤: row.settle, 有效出勤工时: '待确认', 单价: project.unitPrice || MERGED_FIELD_VALUES[project.key]?.unitPrice || '—', 试标成本: person.role === '标注' ? 0 : '—', 人员产值: '待确认', 人员成本: row.cost, 验收追溯: '尚未验收', 同步状态: '同步成功' };
}
function RolePeople({ project }) {
  const people = projectPeople(project);
  const [role, setRole] = React.useState('全部');
  const visible = people.filter(item => role === '全部' || item.role === role).sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  return <div className="role-filter-block"><div className="output-role-filter"><span>按角色筛选</span><Select aria-label="按角色筛选" value={role} onChange={setRole} options={['全部', ...ROLE_ORDER].map(value => ({ value, label: value }))} /></div>{visible.length ? <div className="people-role-list">{visible.map(item => <div key={`${item.role}-${item.name}`}><b>{ROLE_ORDER.indexOf(item.role) + 1}</b><span><strong>{item.name}</strong><small>{item.role} · {item.type}</small></span></div>)}</div> : <Empty description="当前项目还没有人员角色记录" />}</div>;
}
function OutputPeople({ project }) {
  const [mode, setMode] = React.useState('day');
  const [day, setDay] = React.useState(dayjs('2026-09-24'));
  const [range, setRange] = React.useState([dayjs('2026-09-19'), dayjs('2026-09-24')]);
  const [query, setQuery] = React.useState('');
  const bounds = mode === 'day' ? [day, day] : mode === 'week' ? businessWeek(dayjs('2026-09-24')) : mode === 'month' ? [dayjs('2026-09-01'), dayjs('2026-09-30')] : range;
  const rows = outputRows(project).filter(row => {
    const date = dayjs(row.date);
    const inRange = bounds[0] && bounds[1] && !date.isBefore(bounds[0], 'day') && !date.isAfter(bounds[1], 'day');
    return inRange && (!query.trim() || [row.person.name, row.person.role, row.person.type].some(value => String(value).includes(query.trim())));
  }).map(row => ({ ...personOutput(project, row), key: row.key }));
  const columns = OUTPUT_FIELDS.map((label, index) => ({ title: `${index + 1}. ${label}`, dataIndex: label, width: label === '验收追溯' ? 150 : 120 }));
  return <div className="output-people-panel"><div className="output-table-toolbar"><Segmented aria-label="产量时间范围" value={mode} onChange={setMode} options={[{ label: '日', value: 'day' }, { label: '周', value: 'week' }, { label: '月', value: 'month' }, { label: '自定义', value: 'custom' }]} />{mode === 'day' && <DatePicker value={day} onChange={value => value && setDay(value)} allowClear={false} aria-label="选择日期" />}{mode === 'week' && <span className="range-readonly">上周五至本周四 · {bounds[0].format('M月D日')} 至 {bounds[1].format('M月D日')}</span>}{mode === 'month' && <span className="range-readonly">2026年9月</span>}{mode === 'custom' && <DatePicker.RangePicker value={range} onChange={value => value?.[0] && value?.[1] && setRange(value)} allowClear={false} aria-label="自定义时间段" />}<Input prefix={<Search size={14} />} allowClear value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索姓名、角色、人员类型" aria-label="搜索人员产量" /></div><Table rowKey="key" columns={columns} dataSource={rows} pagination={{ pageSize: 8, showSizeChanger: false }} scroll={{ x: 2800 }} locale={{ emptyText: <Empty description="所选时间没有人员产量" /> }} /></div>;
}
function PauseReasonModal({ open, onCancel, onSubmit }) {
  const [form] = Form.useForm();
  return <Modal title="发起项目暂停" open={open} okText="确认暂停" onCancel={onCancel} onOk={() => form.validateFields().then(values => { onSubmit(values.reason); form.resetFields(); })}><Form form={form} layout="vertical"><Form.Item name="reason" label="暂停原因" rules={[{ required: true, message: '请填写暂停原因' }]}><Input.TextArea rows={3} /></Form.Item></Form></Modal>;
}
function ProjectDetail({ project, role, onClose, onNavigate, onEdit, onStatusHistory, onStart, onPause, onResume, onAccept }) {
  const [section, setSection] = React.useState('全部');
  const [outputOpen, setOutputOpen] = React.useState(false);
  const [pausing, setPausing] = React.useState(false);
  if (!project) return null;
  const own = role === 'PMO' || project.pm === '王然';
  const sections = ['全部', ...FIELD_GROUPS.map(group => group.title)];
  const activeGroups = section === '全部' ? FIELD_GROUPS : FIELD_GROUPS.filter(group => group.title === section);
  const tabItems = PROJECT_STAGES.slice(0, 6).map(stage => ({ key: stage.key, label: <span className="detail-tab-label">{stage.label}<ChevronRight size={13} /></span>, children: <div className="stage-record"><div className="stage-record-status"><StatusTag status={stageState(project, stage.key) === 'failed' ? '试标失败' : stageState(project, stage.key) === 'paused' ? '项目暂停' : project.stageRecords[stage.key] || '未开始'} /><span>{project.stageRecords[stage.key]}</span></div><div className="stage-record-actions"><Button type="link" icon={<ArrowUpRight size={14} />} onClick={() => onNavigate(stage.page, project)}>进入{stage.label}管理</Button></div><div className="stage-record-note">该阶段页面将定位到当前项目：{project.projectNo}</div></div> }));
  return <div className="detail-screen"><div className="detail-screen-bar"><div className="detail-screen-main"><button className="detail-back" onClick={onClose}>返回列表</button><div className="detail-screen-kicker">项目主库 · {project.projectNo}</div><h1>{project.projectName}</h1></div><Space className="detail-screen-actions">{own && project.status === '已立项' && <Button type="primary" onClick={() => onStart(project)}>开始执行</Button>}{own && project.status === '项目进行中' && <Button onClick={() => setPausing(true)}>项目暂停</Button>}{own && project.status === '项目进行中' && <Button onClick={() => onAccept(project)}>发起验收</Button>}{own && project.status === '项目暂停' && <Button type="primary" onClick={() => onResume(project)}>恢复执行</Button>}{own && project.status === '项目暂停' && <Button onClick={() => onAccept(project)}>直接验收</Button>}<Button icon={<History size={15} />} onClick={onStatusHistory}>状态记录</Button><Button type="primary" icon={<EditIcon />} onClick={onEdit}>编辑项目</Button></Space></div>
    <div className="project-detail-hero"><div className="project-detail-head"><div><div className="project-detail-customer">{project.customer} · {project.taskType} · {project.security}</div><div className="project-detail-subtitle">主项目：{project.mainProject}</div></div><StatusTag status={project.status} /></div><div className="project-detail-stat-row"><div><small>PM</small><strong>{project.pm}</strong></div><div><small>起始日期</small><strong>{project.startDate}</strong></div><div><small>风险等级</small><strong>{project.risk}</strong></div><div><small>项目人效</small><strong>{project.efficiency}</strong></div></div></div>
    <section className="detail-section"><div className="detail-section-heading"><div><p className="panel-kicker">项目流程</p><h3>状态节点</h3></div><div className="status-legend"><span><i className="legend-dot done" />已完成</span><span><i className="legend-dot current" />进行中</span><span><i className="legend-dot pending" />未完成</span></div></div><div className="detail-stage-flow">{PROJECT_STAGES.map((stage, index) => { const state = stageState(project, stage.key); return <React.Fragment key={stage.key}><button className="detail-stage" onClick={() => { if (stage.key === 'running' || stage.key === 'ended') { message.info(`${stage.label}记录在项目详情中查看`); return; } onNavigate(stage.page, project); }}><span className={`status-dot ${state}`}><span /></span><small>{stage.label}</small></button>{index < PROJECT_STAGES.length - 1 && <i className="detail-stage-line" />}</React.Fragment>; })}</div></section>
    <section className="detail-section"><div className="detail-section-heading"><div><p className="panel-kicker">项目详情</p><h3>按分类查看</h3></div><button className="detail-link" onClick={() => { onNavigate('requirements', project); message.info(`查看关联需求：${project.demandId}`); }}><Link2 size={14} /> 项目需求标识：{project.demandId}</button></div><Tabs activeKey={section} onChange={setSection} items={sections.map(item => ({ key: item, label: item }))} /><div className="project-field-groups">{section === '项目角色' && <RolePeople project={project} />}{activeGroups.map(group => <FieldBlock project={project} group={group} key={group.title} />)}{section === '产量与出勤' && <div className="output-entry"><span>查看项目人员的产量与出勤</span><Button type="primary" onClick={() => setOutputOpen(value => !value)}>{outputOpen ? '收起人员详情' : '详情'}</Button></div>}{section === '产量与出勤' && outputOpen && <OutputPeople project={project} />}</div></section>
    <section className="detail-section"><div className="detail-section-heading"><div><p className="panel-kicker">业务记录</p><h3>阶段记录入口</h3></div></div><Tabs items={tabItems} className="project-record-tabs" /></section>
    <section className="detail-section"><div className="detail-section-heading"><div><p className="panel-kicker">项目需求来源</p><h3>关联记录</h3></div></div><div className="related-records"><button onClick={() => { onNavigate('requirements', project); message.info(`打开项目需求记录 ${project.demandId}`); }}><FileText size={16} /><span><strong>{project.demandId}</strong><small>项目需求记录</small></span><ChevronRight size={15} /></button><button onClick={() => message.info('人员存在表将在项目人员模块接入')}><UsersRound size={16} /><span><strong>项目人员存在表</strong><small>项目人员与资源记录</small></span><ChevronRight size={15} /></button><button onClick={() => message.info('管理文档将在文档服务接入后打开')}><FolderOpen size={16} /><span><strong>{project.managementDoc}</strong><small>项目管理文档</small></span><ChevronRight size={15} /></button></div></section>
    <section className="detail-section"><div className="detail-section-heading"><div><p className="panel-kicker">最近动态</p><h3>项目状态变更</h3></div></div><div className="project-activity">{project.activity.map(item => <div key={item}><span /><p>{item}</p></div>)}</div></section>
    {project.stale && <div className="quote-wait-box">产出数据已超过 7 天未更新。可以发起项目暂停，也可以直接发起验收。</div>}
    <PauseReasonModal open={pausing} onCancel={() => setPausing(false)} onSubmit={reason => { setPausing(false); onPause(project, reason); }} />
  </div>;
}

function EditIcon() { return <SlidersHorizontal size={15} />; }

const LIST_COLUMN_OPTIONS = [
  { key: 'projectNo', label: '项目编号' }, { key: 'projectName', label: '项目名称' }, { key: 'customer', label: '客户' },
  { key: 'pm', label: 'PM' }, { key: 'taskType', label: '任务类型' }, { key: 'status', label: '项目状态' },
  { key: 'security', label: '密级' }, { key: 'risk', label: '风险等级' }, { key: 'startDate', label: '起始日期' },
  { key: 'endDate', label: '结束日期' }, { key: 'stages', label: '项目阶段' },
];

function ProjectEditModal({ project, open, onCancel, onSave }) {
  const [form] = Form.useForm();
  React.useEffect(() => { if (project && open) form.setFieldsValue(project); }, [project, open, form]);
  return <Modal title={<span><Edit3 size={16} /> 编辑项目资料 <em className="modal-count">{project?.projectNo}</em></span>} open={open} onCancel={onCancel} onOk={() => form.validateFields().then(values => onSave({ ...project, ...values }))} okText="保存修改" width={650} destroyOnHidden>
    <Form form={form} layout="vertical" className="project-edit-form">
      <Row gutter={12}><Col span={12}><Form.Item name="projectName" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}><Input /></Form.Item></Col><Col span={12}><Form.Item name="mainProject" label="主项目名称"><Input /></Form.Item></Col></Row>
      <Row gutter={12}><Col span={8}><Form.Item name="customer" label="客户"><Input /></Form.Item></Col><Col span={8}><Form.Item name="pm" label="PM"><Input /></Form.Item></Col><Col span={8}><Form.Item name="security" label="密级"><Select options={['L2', 'L3', 'L4'].map(value => ({ value, label: value }))} /></Form.Item></Col></Row>
      <Row gutter={12}><Col span={8}><Form.Item name="status" label="项目状态"><Select options={STATUS_ORDER.map(value => ({ value, label: value }))} /></Form.Item></Col><Col span={8}><Form.Item name="risk" label="风险等级"><Select options={['低', '中', '高'].map(value => ({ value, label: value }))} /></Form.Item></Col><Col span={8}><Form.Item name="endDate" label="结束日期"><Input placeholder="未结束可留空" /></Form.Item></Col></Row>
      <Form.Item name="progress" label="关键进展"><Input.TextArea rows={2} /></Form.Item><Form.Item name="note" label="备注"><Input.TextArea rows={2} /></Form.Item>
    </Form>
  </Modal>;
}

function NewProjectModal({ open, onCancel, onCreate }) {
  const [form] = Form.useForm();
  return <Modal title={<span><BriefcaseBusiness size={16} /> 新建项目示例</span>} open={open} onCancel={onCancel} onOk={() => form.validateFields().then(values => { onCreate(values); form.resetFields(); })} okText="创建项目" width={650} destroyOnHidden>
    <p className="modal-help-copy">正式系统中项目由立项申请转入主库；此处提供一条完整的前端交互示例，创建后会出现在列表中。</p>
    <Form form={form} layout="vertical"><Row gutter={12}><Col span={12}><Form.Item name="projectName" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}><Input placeholder="例如：多模态评测专项" /></Form.Item></Col><Col span={12}><Form.Item name="mainProject" label="主项目名称"><Input placeholder="例如：多模态数据项目" /></Form.Item></Col></Row><Row gutter={12}><Col span={8}><Form.Item name="customer" label="客户" rules={[{ required: true, message: '请输入客户' }]}><Input /></Form.Item></Col><Col span={8}><Form.Item name="pm" label="PM"><Input /></Form.Item></Col><Col span={8}><Form.Item name="taskType" label="任务类型"><Input placeholder="评测 / 标注" /></Form.Item></Col></Row><Row gutter={12}><Col span={8}><Form.Item name="security" label="密级" initialValue="L3"><Select options={['L2', 'L3', 'L4'].map(value => ({ value, label: value }))} /></Form.Item></Col><Col span={8}><Form.Item name="risk" label="风险等级" initialValue="低"><Select options={['低', '中', '高'].map(value => ({ value, label: value }))} /></Form.Item></Col><Col span={8}><Form.Item name="startDate" label="起始日期" initialValue="2026-09-20"><Input /></Form.Item></Col></Row></Form>
  </Modal>;
}

function ColumnConfigModal({ open, value, onCancel, onSave }) {
  const [checked, setChecked] = React.useState(value);
  React.useEffect(() => setChecked(value), [value, open]);
  return <Modal title={<span><SlidersHorizontal size={16} /> 配置列表字段</span>} open={open} onCancel={onCancel} onOk={() => onSave(checked)} okText="应用配置"><p className="modal-help-copy">默认字段保留项目编号、项目名称和项目阶段；其余字段可以按当前工作习惯显示或隐藏。</p><Checkbox.Group value={checked} onChange={values => setChecked(values)} options={LIST_COLUMN_OPTIONS.map(item => ({ value: item.key, label: item.label }))} className="column-config-grid" /></Modal>;
}

function StatusHistoryModal({ project, open, onClose }) {
  if (!project) return null;
  return <Modal title={<span><History size={16} /> 状态变更记录 <em className="modal-count">{project.projectNo}</em></span>} open={open} onCancel={onClose} footer={<Button onClick={onClose}>关闭</Button>}><div className="status-history-list">{project.activity.map(item => <div className="status-history-item" key={item}><span className="history-dot" /><div><strong>{item.split(' · ')[1] || item}</strong><small>{item.split(' · ')[0]}</small></div></div>)}</div><div className="status-history-stage-grid">{PROJECT_STAGES.map(stage => <div key={stage.key}><span className={`status-dot ${stageState(project, stage.key)}`}><span /></span><small>{stage.label}</small><b>{project.stageRecords[stage.key]}</b></div>)}</div></Modal>;
}

function BulkProjectModal({ open, count, onCancel, onSubmit }) {
  const [field, setField] = React.useState('risk');
  const [value, setValue] = React.useState('中');
  return <Modal title={<span><ListChecks size={16} /> 批量管理 <em className="modal-count">已选 {count} 个项目</em></span>} open={open} onCancel={onCancel} onOk={() => onSubmit(field, value)} okText="确认修改"><p className="modal-help-copy">批量修改只影响当前示例数据，正式接入后会按权限记录操作人和变更日志。</p><Select value={field} onChange={next => { setField(next); setValue(next === 'risk' ? '中' : '项目进行中'); }} options={[{ value: 'risk', label: '批量修改风险等级' }, { value: 'status', label: '批量修改项目状态' }]} style={{ width: '100%', marginBottom: 12 }} />{field === 'risk' ? <Select value={value} onChange={setValue} options={['低', '中', '高'].map(item => ({ value: item, label: item }))} style={{ width: '100%' }} /> : <Select value={value} onChange={setValue} options={STATUS_ORDER.map(item => ({ value: item, label: item }))} style={{ width: '100%' }} />}</Modal>;
}

const STAGE_FILTERS = [['all', '全部阶段'], ['initiation', '立项申请'], ['trial', '试标'], ['quotation', '报价'], ['running', '项目执行'], ['acceptance', '验收'], ['invoice', '开票']];
function currentStage(project) { return PROJECT_STAGES.find(stage => stageState(project, stage.key) === 'current')?.key || 'ended'; }
export function ProjectMasterPage({ role = 'PMO', onRoleChange, onNavigate }) {
  const [projects, setProjects] = React.useState(PROJECTS);
  const [selected, setSelected] = React.useState(null);
  const [query, setQuery] = React.useState('');
  const [filters, setFilters] = React.useState({ status: 'all', customer: 'all', risk: 'all', security: 'all', pm: 'all', stage: 'all' });
  const [dateRange, setDateRange] = React.useState(null);
  const [showFilters, setShowFilters] = React.useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = React.useState([]);
  const [visibleKeys, setVisibleKeys] = React.useState(LIST_COLUMN_OPTIONS.map(item => item.key));
  const [modal, setModal] = React.useState(null);
  const filtered = projects.filter(project => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || [project.projectNo, project.projectName, project.mainProject, project.customer, project.pm, project.demandId].some(value => String(value).toLowerCase().includes(q));
    const matchesDate = !dateRange || (project.startDate !== '—' && (!dateRange[1] || project.startDate <= dateRange[1].format('YYYY-MM-DD')) && (!dateRange[0] || project.endDate === '—' || project.endDate >= dateRange[0].format('YYYY-MM-DD')));
    const matchesRole = role !== 'PM' || project.pm === '王然';
    return matchesRole && matchesQuery && matchesDate && (filters.stage === 'all' || currentStage(project) === filters.stage) && (filters.status === 'all' || project.status === filters.status) && (filters.customer === 'all' || project.customer === filters.customer) && (filters.risk === 'all' || project.risk === filters.risk) && (filters.security === 'all' || project.security === filters.security) && (filters.pm === 'all' || project.pm === filters.pm);
  });
  const navigate = (page, project) => { if (page === 'projects') { if (project) setSelected(project); return; } onNavigate?.(page); message.success(`已跳转至${page === 'initiation' ? '立项申请' : page === 'trial' ? '试标管理' : page === 'quotation' ? '报价管理' : page === 'acceptance' ? '验收管理' : '开票管理'}${project ? ` · ${project.projectNo}` : ''}`); };
  const stamp = () => dayjs().format('YYYY-MM-DD HH:mm');
  const changeStatus = (project, status, text) => { const next = { ...project, status, stale: false, activity: [`${stamp()} · ${text}`, ...(project.activity || [])] }; updateProject(next); message.success(text); };
  const openProject = project => setSelected(project);
  const updateProject = next => { setProjects(current => current.map(item => item.key === next.key ? next : item)); setSelected(next); setModal(null); message.success('项目资料已保存，列表已同步'); };
  const createProject = values => { const key = `p-${Date.now()}`; const project = { key, projectNo: `ZJ${Date.now().toString().slice(-8)}`, projectName: values.projectName, mainProject: values.mainProject || '待补充', demandId: `REQ-${Date.now().toString().slice(-6)}`, customer: values.customer, customerManager: '—', taskType: values.taskType || '其他', startDate: values.startDate || '2026-09-20', endDate: '—', ability: '待补充', terminal: '—', security: values.security || 'L3', pm: values.pm || '待分配', pa: '—', qa: '—', deputyPm: '—', mentorPm: '—', risk: values.risk || '低', status: '立项申请中', note: '新建项目示例记录，等待立项申请。', ruleVersion: '待配置', byteSign: '不适用', efficiency: '—', tencentNo: '—', byteId: '—', byteDemandId: '—', byteSubId: '—', byteSubProject: '—', managementDoc: '—', remitted: '¥ 0', progress: '已创建，等待立项申请。', incentive: '—', riskReason: '新建项目待评估', stageRecords: { initiation: '立项申请中', trial: '尚未开始', quotation: '尚未开始', running: '尚未开始', acceptance: '尚未开始', invoice: '尚未开始', ended: '尚未结束' }, activity: [`2026-09-20 · 创建项目记录`] }; setProjects(current => [project, ...current]); setModal(null); setSelected(project); message.success('项目已创建并打开详情'); };
  const exportProjects = () => { const rows = selectedRowKeys.length ? filtered.filter(item => selectedRowKeys.includes(item.key)) : filtered; const headers = ['项目编号', '项目名称', '客户', 'PM', '任务类型', '项目状态', '密级', '风险等级', '起始日期', '结束日期']; const csv = [headers, ...rows.map(item => headers.map(header => ({ '项目编号': item.projectNo, '项目名称': item.projectName, 客户: item.customer, PM: item.pm, 任务类型: item.taskType, 项目状态: item.status, 密级: item.security, 风险等级: item.risk, 起始日期: item.startDate, 结束日期: item.endDate }[header] || '')))].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n'); const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'MMOS-项目主库.csv'; anchor.click(); URL.revokeObjectURL(url); message.success(`已导出 ${rows.length} 个项目`); };
  const bulkSubmit = (field, value) => { setProjects(current => current.map(item => selectedRowKeys.includes(item.key) ? { ...item, [field]: value } : item)); setSelectedRowKeys([]); setModal(null); message.success(`已批量修改 ${selectedRowKeys.length} 个项目`); };
  const baseColumns = {
    projectNo: { title: '项目编号', dataIndex: 'projectNo', width: 138, fixed: 'left', render: value => <span className="project-no-cell">{value}</span> },
    projectName: { title: '项目名称', dataIndex: 'projectName', width: 196, fixed: 'left', render: (value, record) => <button className="project-name-link" onClick={event => { event.stopPropagation(); openProject(record); }}><span className="project-name-icon"><BriefcaseBusiness size={15} /></span><span><strong>{value}</strong><small>{record.mainProject}</small></span></button> },
    customer: { title: '客户', dataIndex: 'customer', width: 92 }, pm: { title: 'PM', dataIndex: 'pm', width: 80 }, taskType: { title: '任务类型', dataIndex: 'taskType', width: 92 },
    status: { title: '项目状态', dataIndex: 'status', width: 150, render: (value, record) => <Space size={4}><StatusTag status={value} />{record.stale && <Tag color="error">产出超7天</Tag>}</Space> }, security: { title: '密级', dataIndex: 'security', width: 68, render: value => <Tag className="security-tag">{value}</Tag> }, risk: { title: '风险等级', dataIndex: 'risk', width: 80, render: value => <Tag color={value === '高' ? 'red' : value === '中' ? 'orange' : 'green'}>{value}</Tag> },
    startDate: { title: '起始日期', dataIndex: 'startDate', width: 104 }, endDate: { title: '结束日期', dataIndex: 'endDate', width: 104 }, stages: { title: '项目阶段', key: 'stages', width: 270, render: (_, record) => <StatusDots project={record} onNavigate={navigate} /> },
  };
  const columns = visibleKeys.map(key => baseColumns[key]).filter(Boolean).concat([{ title: '操作', key: 'action', width: 82, fixed: 'right', render: (_, record) => <Button type="link" size="small" onClick={event => { event.stopPropagation(); openProject(record); }}>查看详情</Button> }]);
  const counts = { total: projects.length, running: projects.filter(item => ['项目进行中', '已立项', '项目暂停'].includes(item.status)).length, risk: projects.filter(item => item.risk === '高').length, pending: projects.filter(item => ['立项申请中', '试标中', '报价中', '试标失败'].includes(item.status)).length };
  if (selected) return <div className="project-master-page"><ProjectDetail project={selected} role={role} onClose={() => setSelected(null)} onNavigate={navigate} onEdit={() => setModal('edit')} onStatusHistory={() => setModal('history')} onStart={project => changeStatus(project, '项目进行中', '提交开始执行，项目进入项目进行中')} onPause={(project, reason) => changeStatus({ ...project, pauseReason: reason }, '项目暂停', `发起项目暂停：${reason}`)} onResume={project => changeStatus(project, '项目进行中', '恢复执行，项目回到项目进行中')} onAccept={project => onNavigate?.(`acceptance:${project.key}:${project.projectNo}`)} /><ProjectEditModal project={selected} open={modal === 'edit'} onCancel={() => setModal(null)} onSave={updateProject} /><StatusHistoryModal project={selected} open={modal === 'history'} onClose={() => setModal(null)} /></div>;
  return <div className="project-master-page">
    <div className="project-page-heading"><div><p className="eyebrow">项目 · 主数据</p><h1>项目主库</h1><p className="subtitle">{role === 'PM' ? '只显示本人承接的项目。' : '显示全部项目。'} PMO 与 PM 的操作范围按身份区分。</p></div><Space><div className="trial-role-switch"><span>演示身份</span><Select aria-label="演示身份" size="small" value={role} onChange={onRoleChange} options={[{ value: 'PMO', label: 'PMO · 林晓彤' }, { value: 'PM', label: 'PM · 王然' }, { value: '财务', label: '财务 · 赵敏' }]} /></div><Button icon={<Download size={15} />} onClick={exportProjects}>导出{selectedRowKeys.length ? ` (${selectedRowKeys.length})` : ''}</Button><Button type="primary" icon={<BriefcaseBusiness size={15} />} onClick={() => setModal('new')}>新建项目</Button></Space></div>
    <Row gutter={[12, 12]} className="project-stat-grid"><Col xs={12} md={6}><Card bordered={false}><div className="project-stat"><span className="stat-icon blue"><BriefcaseBusiness size={16} /></span><span><small>项目总数</small><strong>{counts.total}</strong></span></div></Card></Col><Col xs={12} md={6}><Card bordered={false}><div className="project-stat"><span className="stat-icon green"><Check size={16} /></span><span><small>进行中项目</small><strong>{counts.running}</strong></span></div></Card></Col><Col xs={12} md={6}><Card bordered={false}><div className="project-stat"><span className="stat-icon amber"><ListFilter size={16} /></span><span><small>待推进阶段</small><strong>{counts.pending}</strong></span></div></Card></Col><Col xs={12} md={6}><Card bordered={false}><div className="project-stat"><span className="stat-icon red"><CircleAlert size={16} /></span><span><small>高风险项目</small><strong>{counts.risk}</strong></span></div></Card></Col></Row>
    <Card bordered={false} className="project-master-card"><div className="project-list-toolbar"><Space className="project-search"><Input prefix={<Search size={15} />} allowClear value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索项目名称、编号、客户、PM" /></Space><Space wrap><Select aria-label="阶段筛选" value={filters.stage} onChange={value => setFilters(current => ({ ...current, stage: value }))} options={STAGE_FILTERS.map(([value, label]) => ({ value, label }))} /><Button icon={<Filter size={15} />} type={showFilters ? 'primary' : 'default'} onClick={() => setShowFilters(value => !value)}>筛选</Button><Button icon={<SlidersHorizontal size={15} />} onClick={() => setModal('columns')}>列配置</Button><Button icon={<ListChecks size={15} />} disabled={!selectedRowKeys.length} onClick={() => setModal('bulk')}>批量管理{selectedRowKeys.length ? ` (${selectedRowKeys.length})` : ''}</Button></Space></div>{showFilters && <div className="project-filter-panel"><DatePicker.RangePicker value={dateRange} onChange={setDateRange} format="YYYY-MM-DD" allowClear placeholder={['开始日期', '结束日期']} /><Select value={filters.pm} onChange={value => setFilters(current => ({ ...current, pm: value }))} options={[{ value: 'all', label: '全部项目经理' }, ...Array.from(new Set(projects.map(item => item.pm))).map(value => ({ value, label: value }))]} /><Select value={filters.status} onChange={value => setFilters(current => ({ ...current, status: value }))} options={[{ value: 'all', label: '全部项目状态' }, ...STATUS_ORDER.map(value => ({ value, label: value }))]} /><Select value={filters.customer} onChange={value => setFilters(current => ({ ...current, customer: value }))} options={[{ value: 'all', label: '全部客户' }, ...Array.from(new Set(projects.map(item => item.customer))).map(value => ({ value, label: value }))]} /><Select value={filters.risk} onChange={value => setFilters(current => ({ ...current, risk: value }))} options={[{ value: 'all', label: '全部风险' }, { value: '低', label: '低风险' }, { value: '中', label: '中风险' }, { value: '高', label: '高风险' }]} /><Select value={filters.security} onChange={value => setFilters(current => ({ ...current, security: value }))} options={[{ value: 'all', label: '全部密级' }, { value: 'L2', label: 'L2' }, { value: 'L3', label: 'L3' }, { value: 'L4', label: 'L4' }]} /><Button type="link" onClick={() => { setFilters({ status: 'all', customer: 'all', risk: 'all', security: 'all', pm: 'all' }); setDateRange(null); }}>清除条件</Button></div>}<div className="project-list-meta"><span>当前显示 <strong>{filtered.length}</strong> / {projects.length} 个项目</span><span className="project-legend"><i className="legend-dot done" />已完成 <i className="legend-dot current" />进行中 <i className="legend-dot pending" />未完成 <i className="legend-dot failed" />试标失败 <i className="legend-dot paused" />项目暂停</span></div><Table rowKey="key" rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }} columns={columns} dataSource={filtered} pagination={{ pageSize: 6, showSizeChanger: false }} scroll={{ x: 1510 }} locale={{ emptyText: <Empty description="没有符合条件的项目" /> }} onRow={record => ({ onClick: () => openProject(record) })} /></Card>
    <NewProjectModal open={modal === 'new'} onCancel={() => setModal(null)} onCreate={createProject} /><ColumnConfigModal open={modal === 'columns'} value={visibleKeys} onCancel={() => setModal(null)} onSave={value => { setVisibleKeys(['projectNo', 'projectName', ...value.filter(key => !['projectNo', 'projectName'].includes(key))]); setModal(null); message.success('列表字段已更新'); }} /><BulkProjectModal open={modal === 'bulk'} count={selectedRowKeys.length} onCancel={() => setModal(null)} onSubmit={bulkSubmit} />
  </div>;
}
