import { isByteCustomer } from './customerMaster.js';

export function projectStartupRequirements(project, quotations, customerState) {
  const quote = quotations.find(row => row.projectNo === project.projectNo);
  const signed = Boolean(quote?.confirmResult && quote?.confirmTime && quote?.voucher);
  return [
    { key: 'managementTableUrl', label: '项目管理表链接', complete: Boolean(project.managementTableUrl?.trim()) },
    { key: 'outputTableUrl', label: '产出表链接', complete: Boolean(project.outputTableUrl?.trim()) },
    ...(isByteCustomer(project, customerState) ? [{ key: 'signing', label: '字节签单', complete: signed }] : []),
  ];
}

export function reconcileProjectStartup(project, quotations, customerState, time = new Date().toISOString()) {
  if (project.status !== '待启动') return project;
  if (projectStartupRequirements(project, quotations, customerState).some(item => !item.complete)) return project;
  return {
    ...project,
    status: '项目进行中',
    stageRecords: { ...project.stageRecords, running: '项目进行中' },
    activity: [`${time} · 启动条件已齐备，项目进入项目进行中`, ...(project.activity || [])],
  };
}
