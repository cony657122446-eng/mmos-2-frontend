import { money, paid } from './bankJournal.js';
export const approvalStatus = a => ({审批通过:'已通过',审批中:'进行中',审批拒绝:'已拒绝'}[a.result] || a.result);
export function accrueParttime(state) {
  const next=structuredClone(state); next.projectPaymentCosts ||= [];
  for(const a of next.approvals.filter(a=>a.parttime)) {
    if(a.result==='审批通过' && a.projectNo && Number(a.amount)>0) {
      const old=next.projectPaymentCosts.find(c=>c.approvalKey===a.key);
      if(!old)next.projectPaymentCosts.push({key:`cost:${a.key}`,approvalKey:a.key,projectNo:a.projectNo,amount:a.amount,date:a.approvedAt,source:'项目付款审批'});
      a.costStatus=old && (old.amount!==a.amount||old.projectNo!==a.projectNo)?'来源异常':'归集成功';
    } else a.costStatus=a.result==='审批通过'?'待补充项目或金额':'待归集';
  }
  return next;
}
export function settlementSummary(state,a) {
  const details=(state.parttimeDetails||[]).filter(d=>d.approvalKey===a.key), actual=paid({...state,journal:state.journal.filter(j=>j.expense>0)},a.key);
  return {details,total:money(details.reduce((s,d)=>s+Number(d.amount),0)),paid:actual,unpaid:money(Math.max(0,a.amount-actual)),pending:details.filter(d=>!d.personKey).length,paymentStatus:!actual?'未付款':actual<a.amount?'部分付款':'已付款'};
}
export function retryParttime(state,key,role) {
  if(role!=='财务')throw Error('仅财务可以重试');
  const next=structuredClone(state),a=next.approvals.find(a=>a.key===key);
  if(!a||a.result!=='审批通过')throw Error('仅已通过审批可读取结算附件');
  for(const attachment of a.attachments) {
    if(attachment.status==='读取成功')continue;
    const source=[{name:'周雨桐',idNumber:'000000199803150012',amount:1800,note:'交付验收结算'},{name:'林知夏',idNumber:'000000199804150013',amount:2400,note:'复核作业结算'}];
    source.forEach((d,i)=>{const detailKey=`${a.key}:${attachment.id}:${i+2}`;if(!next.parttimeDetails.some(d=>d.key===detailKey))next.parttimeDetails.push({...d,key:detailKey,approvalKey:a.key,attachmentId:attachment.id,sheet:'打款明细（请在此表填写）',line:i+2,personKey:'',issue:'待人员匹配'});});
    attachment.status='读取成功';
  }
  a.attachmentStatus='读取成功';a.attachmentError='';a.lastAttempt=a.lastSuccess=new Date().toISOString();a.sourceMode='本地预览事件';
  return accrueParttime(next);
}
// Pure matching plan; caller persists new identities to the existing external personnel library.
export function matchParttime(state,hr,key,manual) {
  const next=structuredClone(state),people=[...hr.people,...hr.external],created=[],patches=[];
  const a=next.approvals.find(a=>a.key===key);if(a?.result!=='审批通过')throw Error('仅已通过审批可匹配');
  const details=next.parttimeDetails.filter(d=>d.approvalKey===key);
  const idOf=p=>p.idNumber||p.archive?.idNumber||'';
  for(const d of details) {
    if(d.personKey && people.some(p=>p.id===d.personKey))continue;
    if(manual && manual.detailKey!==d.key)continue;
    let matches=people.filter(p=>idOf(p)===d.idNumber && d.idNumber);
    if(manual) {
      if(!manual.note?.trim())throw Error('请填写与PMO确认身份的依据');
      matches=people.filter(p=>p.id===manual.personKey);
      if(matches.length!==1)throw Error('人员不存在');
      if(idOf(matches[0]) && idOf(matches[0])!==d.idNumber)throw Error('人员已有不同身份证号，不能覆盖');
    }
    if(!matches.length) {
      const same=people.filter(p=>p.name===d.name),ids=new Set(details.filter(r=>r.name===d.name).map(r=>r.idNumber));
      if(same.length===1&&!idOf(same[0])&&ids.size===1&&a.attachments.every(f=>f.status==='读取成功'))matches=same;
      else if(same.length || !d.idNumber) {d.personKey='';d.issue='姓名或身份证存在歧义，须联系PMO确认';continue;}
      else {const p={id:`external-settlement-${crypto.randomUUID()}`,name:d.name,employeeNo:`EXT-${crypto.randomUUID().slice(0,8).toUpperCase()}`,externalNo:'',idNumber:d.idNumber,archive:{idNumber:d.idNumber},category:'外部人员',employeeType:'兼职',projectIds:[],current:false};p.externalNo=p.employeeNo;people.push(p);created.push(p);matches=[p];}
    }
    if(matches.length!==1){d.personKey='';d.issue='身份证匹配到多个人员，须核实';continue;}
    const p=matches[0];if(!idOf(p)){patches.push({id:p.id,idNumber:d.idNumber});p.idNumber=d.idNumber;}
    d.personKey=p.id;d.issue='';d.matchNote=manual?.note||'按完整身份证或唯一历史身份匹配';
  }
  return {state:next,created,patches};
}
