import { loadWorkspace, saveWorkspace } from './financeWorkspace.js';

export const money = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const cents = n => Math.round(Number(n) * 100);
export const today = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const must = (condition, reason) => { if (!condition) throw new Error(reason); };
export const banks = ['中国银行', '农村商业银行', '工商银行', '招商银行'];
export const cashAmount = row => money(row.income || row.expense || 0);
export const processed = row => row.transferId ? cashAmount(row) : money((row.allocations || []).reduce((sum, a) => sum + Number(a.amount), 0) + (row.exemptions || []).reduce((sum, a) => sum + Number(a.amount), 0));
export const unallocated = row => money(cashAmount(row) - processed(row));
export const treatment = row => unallocated(row) === 0 ? '已处理' : processed(row) > 0 ? '部分处理' : '待关联';
export const accountBalance = (state, account) => money(Number(account.openingAmount || 0) + state.journal.filter(r => r.accountId === account.key && r.date >= account.openingDate && !r.opening).reduce((sum, r) => sum + Number(r.income || 0) - Number(r.expense || 0), 0));
export const paid = (state, key) => money(state.journal.reduce((sum, r) => sum + (r.allocations || []).filter(a => a.target === key || a.approvalKey === key).reduce((s, a) => s + Number(a.amount), 0), 0));
export const payable = row => row.result === '审批通过' && row.status === '已读取' && (row.type !== '项目付款' || !!row.projectNo) && Number(row.amount) > 0;
export function recompute(state, previous) {
  if (!previous) return state;
  const incomePaid=(s,key)=>money(s.journal.filter(j=>j.income>0).reduce((total,j)=>total+(j.allocations||[]).filter(a=>a.target===key&&a.type==='开票').reduce((n,a)=>n+Number(a.amount),0),0));
  return {...state,invoices:state.invoices.map(row=>{
    if(!row.invoiceNo)return row;
    const prior=previous.invoices.find(i=>i.key===row.key),delta=money(incomePaid(state,row.key)-incomePaid(previous,row.key));
    if(!delta)return row;
    const received=money(Number(prior?.received ?? incomePaid(previous,row.key))+delta);
    const dates=state.journal.filter(j=>j.income>0&&(j.allocations||[]).some(a=>a.target===row.key&&a.type==='开票')).map(j=>j.date);
    return {...row,received,arrivedAt:received>0?[prior?.arrivedAt,...dates].filter(Boolean).sort().at(-1)||'':''};
  })};
}
export function saveBank(previous, next, action, role = '财务') {
  must(role === '财务', '本操作仅财务可执行');
  const saved = saveWorkspace(previous, next, action);
  globalThis.dispatchEvent?.(new Event('mmos:bank-updated'));
  return saved;
}
export function ensureBankPreview(state, day = today()) {
  if (state.bankPreviewVersion) return state;
  const month = day.slice(0, 7);
  const accounts = banks.map((bank, index) => ({ key: `bank-${index + 1}`, bank, number: ['102100189638', '310001016882', '3100023109000188621', '121905668810203'][index], name: '重庆沐晨信息技术有限公司', company: '重庆沐晨', branch: `${bank}重庆分行`, currency: 'CNY', openingDate: `${month}-01`, openingAmount: [100000, 60000, 80000, 50000][index], confirmedBy: '财务 · 赵敏', confirmedAt: `${month}-01 09:00` }));
  const specs = [
    ['PF202611001', '星河智能客服项目', 'ZJ20260910922', '王然', 10000, '审批通过', '读取成功'],
    ['PF202611002', '多语种语料质量评测', 'ZJ20260911880', '陈默', 6800, '审批通过', '部分成功'],
    ['PF202611003', '广告文案改写', 'ZJ20260626004', '王然', 4200, '审批通过', '读取失败'],
    ['PF202611004', '语音质检专项', 'ZJ20260912006', '林晓彤', 3600, '审批中', '未读取'],
    ['PF202611005', '双语文本质量评测', 'ZJ20261111001', '李想', 2800, '审批拒绝', '未读取'],
    ['PF202610006', '星河智能客服项目', 'ZJ20260910922', '王然', 5600, '审批通过', '读取成功'],
  ];
  const approvals = specs.map((v, i) => ({ key: `parttime-${i + 1}`, number: v[0], title: `${v[1]}项目付款`, projectName: v[1], projectNo: v[2], pm: v[3], applicant: v[3], amount: v[4], result: v[5], status: '已读取', type: '项目付款', parttime: true, applicationDate: `${month}-${String(i + 3).padStart(2, '0')}`, approvedAt: v[5] === '审批通过' ? `${month}-${String(i + 4).padStart(2, '0')}` : '', attachmentStatus: v[6], attachmentError: ['部分成功','读取失败'].includes(v[6]) ? '结算附件下载超时，已读内容保留' : '', lastSuccess: `${day} 09:15`, lastAttempt: `${day} 09:15`, costStatus: v[5] === '审批通过' ? '归集成功' : '待归集', attachments: v[5] === '审批通过' ? [{ id: `att-${i}-1`, name: '发佣明细.xlsx', status: v[6] === '读取失败' ? '读取失败' : '读取成功' }, ...(i < 2 ? [{ id: `att-${i}-2`, name: '发佣明细（补充）.xlsx', status: i === 1 ? '读取失败' : '读取成功' }] : [])] : [] }));
  const names = ['沈思远', '许佳宁', '周雨桐', '林知夏', '陈子衡'];
  const people = names.map((name, i) => ({ key: `external-pay-${i + 1}`, name, employeeNo: `WB0000${281 + i}`, idNumber: `00000019980${i + 1}15001${i}`, category: '外部人员' }));
  const details = approvals.flatMap((a, i) => a.attachments.filter(att => att.status === '读取成功').flatMap(att => [0, 1].map((_, j) => ({ key: `${a.key}:${att.id}:${j + 2}`, approvalKey: a.key, attachmentId: att.id, sheet: '打款明细（请在此表填写）', line: j + 2, name: people[(i + j) % people.length].name, idNumber: people[(i + j) % people.length].idNumber, amount: j ? 2300 : 2700, note: j ? '第二阶段标注任务' : '第一阶段质量验收', personKey: '', issue: i === 1 && j === 1 ? '历史同名人员需财务联系PMO核实' : '' }))));
  const journal = [
    { key: 'bank-preview-income', accountId: 'bank-1', date: `${month}-06`, time: '10:23:18', income: 12000, expense: 0, payer: '北京字跳网络技术有限公司', summary: '星河智能客服服务费', sourceType: '银行导入', bankId: 'BOC202611060031', allocations: [] },
    { key: 'bank-preview-parttime', accountId: 'bank-1', date: `${month}-07`, time: '14:16:22', income: 0, expense: 4000, payer: '项目服务人员', summary: '星河项目付款', sourceType: '银行导入', bankId: 'BOC202611070028', allocations: [{ target: 'parttime-1', approvalKey: 'parttime-1', type: '项目付款', name: specs[0][1], amount: 3000 }] },
    { key: 'bank-preview-fee', accountId: 'bank-1', date: `${month}-08`, income: 0, expense: 60, payer: '中国银行', summary: '企业网银服务费', sourceType: '银行导入', allocations: [], exemptions: [{ key: 'fee-1', category: '银行手续费', amount: 60, note: '月度服务费' }] },
    { key: 'bank-preview-transfer-out', accountId: 'bank-1', date: `${month}-09`, income: 0, expense: 20000, payer: accounts[1].name, summary: '公司账户资金划转', sourceType: '银行导入', allocations: [] },
    { key: 'bank-preview-transfer-in', accountId: 'bank-2', date: `${month}-09`, income: 20000, expense: 0, payer: accounts[0].name, summary: '公司账户资金划入', sourceType: '银行导入', allocations: [] },
  ];
  return { ...state, bankPreviewVersion: 1, projectPaymentCosts: approvals.filter(a=>a.result==='审批通过').map(a=>({key:`cost:${a.key}`,approvalKey:a.key,projectNo:a.projectNo,amount:a.amount,date:a.approvedAt,source:'项目付款审批'})), bankAccounts: accounts, importBatches: [], transfers: [], parttimePeople: people, parttimeDetails: details, approvals: [...(state.approvals || []), ...approvals], journal: [...state.journal, ...journal] };
}
export function loadBankWorkspace(role = '财务') {
  must(['财务', '人事'].includes(role), '无权读取财务付款记录');
  const state = loadWorkspace();
  if (state.bankPreviewVersion) return state;
  return saveWorkspace(state, ensureBankPreview(state), '初始化银行账户及项目付款预览');
}
export function putAccount(state, values) {
  const next = structuredClone(state);
  must(values.number && values.company && values.bank && values.name, '请填写公司主体、银行、账户名称及账号');
  must(!next.bankAccounts.some(a => a.key !== values.key && a.number === String(values.number)), '银行账号已存在');
  const existing = next.bankAccounts.find(a => a.key === values.key);
  if (existing && next.journal.some(j => j.accountId === existing.key)) must(existing.number === values.number && existing.company === values.company, '已有流水的账户不能修改账号及公司主体');
  if (values.openingDate || values.openingAmount != null) must(/^\d{4}-\d{2}-\d{2}$/.test(values.openingDate || '') && !Number.isNaN(Date.parse(values.openingDate)) && values.openingAmount != null && Number.isFinite(Number(values.openingAmount)), '请同时填写有效期初日期与金额');
  const row = { ...existing, ...values, key: values.key || id('account'), currency: 'CNY', number: String(values.number) };
  next.bankAccounts = [...next.bankAccounts.filter(a => a.key !== row.key), row];
  return next;
}
export function putCash(state, values) {
  const next = structuredClone(state), old = next.journal.find(r => r.key === values.key);
  must(!old?.transferId, '请先解除内部转账配对');
  const account = next.bankAccounts.find(a => a.key === values.accountId);
  must(account, '请选择银行账户');
  must(account.openingDate && account.openingAmount != null, '请先确认账户期初日期和金额');
  must(/^\d{4}-\d{2}-\d{2}$/.test(values.date) && !Number.isNaN(Date.parse(values.date)) && new Date(values.date).toISOString().slice(0,10) === values.date, '实际日期无效');
  must(Number.isFinite(Number(values.amount)) && Number(values.amount) > 0 && cents(values.amount) / 100 === Number(values.amount), '金额必须为最多两位小数的正数');
  must(values.summary?.trim() && values.payer?.trim(), '请填写摘要及收付款人');
  if (old) {
    must(cents(values.amount) >= cents(processed(old)), '金额不能小于已处理金额，请先调整关联');
    must(processed(old) === 0 || (old.income > 0) === (values.direction === '收入'), '已处理流水不能修改方向');
    must(old.sourceType !== '银行导入' || old.accountId === values.accountId, '银行来源流水不能直接更改本方账户');
  }
  const row = { ...old, key: old?.key || id('cash'), accountId: account.key, date: values.date, income: values.direction === '收入' ? Number(values.amount) : 0, expense: values.direction === '支出' ? Number(values.amount) : 0, payer: values.payer, summary: values.summary, note: values.note || '', sourceType: old?.sourceType || '手工补录', original: old?.original || (old?.sourceType === '银行导入' ? { ...old } : undefined), allocations: old?.allocations || [], exemptions: old?.exemptions || [] };
  next.journal = old ? next.journal.map(r => r.key === old.key ? row : r) : [...next.journal, row];
  return recompute(next,state);
}
export function allocate(state, rowKey, links, exemptions) {
  const next = structuredClone(state), row = next.journal.find(r => r.key === rowKey);
  must(row && !row.transferId, '流水不存在或已经配对内部转账');
  must(links.every(a => Number(a.amount) > 0 && Number.isFinite(Number(a.amount)) && cents(a.amount)/100===Number(a.amount)) && exemptions.every(a => Number(a.amount) > 0 && Number.isFinite(Number(a.amount)) && cents(a.amount)/100===Number(a.amount) && a.category), '分配金额须大于零，无需关联须填写类别');
  must(cents([...links, ...exemptions].reduce((s, a) => s + Number(a.amount), 0)) <= cents(cashAmount(row)), '处理金额超过流水金额');
  row.allocations = []; row.exemptions = [];
  for (const link of links) {
    const target = row.income > 0 ? next.invoices.find(a => a.key === link.target && a.invoiceNo) : next.approvals.find(a => a.key === link.target && payable(a));
    must(target, '请选择已开票记录或已通过且金额项目明确的付款审批');
    const total = row.income > 0 ? target.taxIncluded : target.amount;
    const previousPaid=paid(state,target.key);
    const legacyBase=row.income>0?Number(target.received ?? previousPaid)-previousPaid:0;
    must(cents(legacyBase + paid(next, target.key)) + cents(link.amount) <= cents(total), '超过业务剩余可关联金额');
    row.allocations.push({ ...link, key: link.key || id('link'), type: row.income > 0 ? '开票' : target.type, name: target.projectName, ...(row.expense > 0 ? { approvalKey: target.key } : {}) });
  }
  row.exemptions = exemptions.map(a => ({ ...a, key: a.key || id('exempt') }));
  return recompute(next,state);
}
export function deleteCash(state, keys) {
  const next = structuredClone(state), failures = [];
  next.journal = next.journal.filter(row => {
    if (!keys.includes(row.key)) return true;
    if (processed(row) > 0 || row.opening) { failures.push(`${row.summary}：请先解除关联、无需关联或转账配对`); return true; }
    return false;
  });
  return { state: recompute(next,state), failures, removed: state.journal.length - next.journal.length };
}
export function pairTransfer(state, outKey, inKey) {
  const next = structuredClone(state), out = next.journal.find(r => r.key === outKey), incoming = next.journal.find(r => r.key === inKey);
  must(out?.expense > 0 && incoming?.income > 0 && cents(out.expense) === cents(incoming.income), '须选择金额相同的转出与转入流水');
  const a = next.bankAccounts.find(r => r.key === out.accountId), b = next.bankAccounts.find(r => r.key === incoming.accountId);
  must(a && b && a.key !== b.key && a.company === b.company, '内部转账须为同主体不同人民币账户');
  must(processed(out) === 0 && processed(incoming) === 0, '请先解除两边已有处理分配');
  out.transferId = incoming.transferId = id('transfer');
  return next;
}
export function unpairTransfer(state, key) {
  const next = structuredClone(state), transfer = next.journal.find(r => r.key === key)?.transferId;
  must(transfer, '未找到转账配对');
  next.journal.forEach(r => { if (r.transferId === transfer) delete r.transferId; }); return next;
}
export function duplicateStatus(state, row) {
  const all = state.journal.filter(r => !r.opening && r.accountId === row.accountId);
  const same = all.find(r => (r.sourceFingerprint === row.sourceFingerprint && row.sourceFingerprint) || (r.bankId && row.bankId && r.bankId === row.bankId));
  const equal = r => r.date === row.date && cents(r.income) === cents(row.income) && cents(r.expense) === cents(row.expense) && (r.payer || '') === (row.payer || '');
  if (same) return { kind: equal(same) ? '明确重复' : '标识冲突', existingKey: same.key };
  const similar = all.find(equal);
  return similar ? { kind: '疑似重复', existingKey: similar.key } : { kind: '正常' };
}
export function importCash(state, preview, accountId, decisions = {}, opening = {}) {
  const next = structuredClone(state), account = next.bankAccounts.find(a => a.key === accountId);
  must(account, '请选择本方账户');
  if (!account.openingDate) {
    must(/^\d{4}-\d{2}-\d{2}$/.test(opening.date || '') && !Number.isNaN(Date.parse(opening.date)) && new Date(opening.date).toISOString().slice(0,10) === opening.date && opening.amount !== undefined && opening.amount !== null && Number.isFinite(Number(opening.amount)), '首次导入须确认期初日期及该日开始前余额');
    account.openingDate = opening.date; account.openingAmount = Number(opening.amount); account.confirmedAt = new Date().toISOString(); account.confirmedBy = '财务 · 赵敏';
  }
  const results = [];
  for (const source of preview.rows) {
    if (source.error) { results.push({ line: source.line, status: '异常', reason: source.error }); continue; }
    const row = { ...source, accountId, sourceType: '银行导入' }, duplicate = duplicateStatus(next, row), choice = decisions[source.line];
    if (duplicate.kind === '明确重复' || choice === 'skip') { results.push({ line: source.line, status: '跳过', reason: duplicate.kind }); continue; }
    if (duplicate.kind === '标识冲突' && choice === 'new') { results.push({line:source.line,status:'待确认',reason:'相同银行标识存在冲突，不能直接作为新流水'}); continue; }
    if (duplicate.kind !== '正常' && !['new', 'replace'].includes(choice)) { results.push({ line: source.line, status: '待确认', reason: duplicate.kind }); continue; }
    if (source.balanceDifference && !decisions.balance) { results.push({ line: source.line, status: '待确认', reason: '余额差异待确认' }); continue; }
    let allocations = [], exemptions = [];
    if (choice === 'replace' && duplicate.existingKey) {
      const old = next.journal.find(r => r.key === duplicate.existingKey);
      if (old.transferId || cents(processed(old)) > cents(cashAmount(row)) || (processed(old) > 0 && (old.income > 0) !== (row.income > 0))) { results.push({ line: source.line, status: '异常', reason: '已有分配无法转移，请先解除配对或更正关联' }); continue; }
      allocations = old.allocations || []; exemptions = old.exemptions || [];
      next.journal = next.journal.filter(r => r.key !== old.key);
    }
    next.journal.push({ ...row, key: id('bank-cash'), allocations, exemptions, original: { ...source }, fileName: preview.fileName });
    results.push({ line: source.line, status: '已入账', reason: '' });
  }
  const success = results.filter(r => ['跳过','已入账'].includes(r.status)).length;
  const batch = { key: id('batch'), fileName: preview.fileName, accountId, time: new Date().toISOString(), status: success === results.length ? '全部处理完成' : success ? '部分成功' : '失败', results, warnings: preview.warnings || [] };
  next.importBatches.push(batch);
  // A failed first batch does not initialize an account.
  if (!state.bankAccounts.find(a => a.key === accountId).openingDate && !results.some(r => r.status === '已入账')) next.bankAccounts = next.bankAccounts.map(a => a.key === accountId ? structuredClone(state.bankAccounts.find(b => b.key === accountId)) : a);
  return { state: recompute(next,state), batch };
}
