import { uid, normalizeInvoice } from './financeWorkspace.js';

export function approveAcceptanceGroup(records, keys, projects, subjects, stamp, role = 'PMO') {
  if (role !== 'PMO') throw new Error('仅 PMO 可以审核验收');
  const selected = records.filter(row => keys.includes(row.key));
  if (!selected.length || selected.length !== new Set(keys).size) throw new Error('请选择有效验收申请');
  if (selected.some(row => row.applyStatus !== '待审核')) throw new Error('只能审核当前待审核的验收，已通过组保持原组合');
  const checked = selected.map(record => {
    const project = projects.find(row => row.projectNo === record.projectNo);
    const subjectKey = record.subjectKey || record.customerKey || project?.subjectKey;
    const subject = subjects.find(row => row.key === subjectKey);
    if (!project || !subject || project.subjectKey !== subject.key || project.groupKey !== subject.groupKey) {
      throw new Error(`${record.acceptanceNo} 的公司主体尚未核实或与当前项目不一致，请由财务或增长部处理`);
    }
    return { record, project, subject };
  });
  if (checked.some(item => item.subject.key !== checked[0].subject.key)) {
    throw new Error(`仅同一公司主体可合并通过。${checked.map(item => `${item.record.acceptanceNo} · ${item.subject.fullName}`).join('；')}`);
  }
  const groupId = uid('acceptance-group');
  const members = selected.map(row => row.key);
  return records.map(record => {
    const item = checked.find(row => row.record.key === record.key);
    if (!item) return record;
    return {
      ...record,
      customerKey: item.subject.key,
      subjectKey: item.subject.key,
      groupKey: item.subject.groupKey,
      subjectName: item.subject.name,
      subjectSnapshot: record.subjectSnapshot || { subjectKey: item.subject.key, subjectName: item.subject.name, fullName: item.subject.fullName },
      applyStatus: '已通过',
      approvedAt: stamp,
      approvedBy: 'PMO · 林晓彤',
      approvalGroupId: groupId,
      groupMemberKeys: members,
      projectStatus: record.type === '最终验收' ? '项目结束' : item.project.status,
      financeSync: '待同步',
      writeError: '',
      activity: [`${stamp} · PMO 审核通过，固定开票组 ${groupId}`, ...(record.activity || [])],
    };
  });
}

function fromAcceptance(acceptance, state) {
  const customer = state.customers.find(row => row.key === (acceptance.subjectKey || acceptance.customerKey));
  if (!customer) throw new Error('公司主体未确定，不能提出新的开票需求');
  return normalizeInvoice({ ...acceptance, key: uid('invoice'), recordNo: acceptance.acceptanceNo, customerKey: customer.key, subjectKey: customer.key, groupKey: customer.groupKey, subjectName: customer.name, subjectActive: customer.active !== false, groupId: acceptance.approvalGroupId, acceptanceType: acceptance.type,
    acceptanceAmount: acceptance.amount, taxIncluded: acceptance.amount, received: 0, invoiceNo: '', invoiceDate: '', voucher: '',
    payer: customer.fullName, taxNo: customer.taxNo, category: customer.invoiceItemName || '', taxCode: customer.taxCode || '',
    ocrAcceptanceNo: acceptance.ocrAcceptanceNo || acceptance.ocrResult?.acceptanceNo || '' }, state.customers);
}

export function invoiceStateForAcceptanceGroup(state, acceptances) {
  if (!acceptances.length || acceptances.some(row => row.applyStatus !== '已通过')) throw new Error('请选择审核通过的验收');
  const groupId = acceptances[0].approvalGroupId;
  if (!groupId || acceptances.some(row => row.approvalGroupId !== groupId)) throw new Error('请按已通过的固定验收组补推');
  const memberKeys = acceptances[0].groupMemberKeys;
  if (!memberKeys || memberKeys.length !== acceptances.length || memberKeys.some(key => !acceptances.some(row => row.key === key))) throw new Error('补推必须包含原组全部分项');
  const subjectKey = acceptances[0].subjectKey;
  if (!subjectKey || acceptances.some(row => row.subjectKey !== subjectKey)) throw new Error('固定组存在不同公司主体，请先核对');
  const existing = state.invoices.filter(row => row.approvalGroupId === groupId);
  if (existing.length === acceptances.length && acceptances.every(row => existing.some(invoice => invoice.acceptanceNo === row.acceptanceNo))) return state;
  let invoices = [...state.invoices];
  for (const acceptance of acceptances) {
    const previous = invoices.find(row => row.acceptanceNo === acceptance.acceptanceNo);
    if (previous && previous.approvalGroupId !== groupId) throw new Error('验收已有其他财务关联，请核对原业务');
    if (!previous) invoices.push(fromAcceptance(acceptance, state));
  }
  return { ...state, invoices };
}
