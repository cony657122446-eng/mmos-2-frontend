import {loadHr,updateHrWorkspace} from './hrWorkspace.js';
import {dateValid,nextDay} from './hrPersonnelContracts.js';
export const renewalToday=()=>new Date(Date.now()+28800000).toISOString().slice(0,10);
export const daysBetween=(from,to)=>Math.round((Date.parse(to)-Date.parse(from))/86400000);
export const renewalStates=['待人事核对','待员工确认','待PM确认','待发放合同','签署中','待人事办理','人事办理中','已完成','不续签'];
export const finished=r=>['已完成','不续签'].includes(r.status);
const must=(test,text)=>{if(!test)throw Error(text);};
export function renewalTerm(end){must(dateValid(end),'原合同结束日期无效');const start=nextDay(end),[y,m,d]=start.split('-').map(Number),target=new Date(Date.UTC(y,m+2,1)),last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();target.setUTCDate(Math.min(d,last));return {start,end:nextDay(target.toISOString().slice(0,10),-1)};}
export function ensureRenewals(state,day=renewalToday()) {
 if(state.renewalPreviewVersion)return state;
 const next=structuredClone(state);next.renewals=[];next.personnelContracts||=[];
 const candidates=[...next.people.filter(p=>p.employeeType?.includes('实习')).slice(0,7),...next.people.filter(p=>p.employeeType==='全职').slice(0,3)];
 const stages=['待员工确认','待PM确认','待发放合同','签署中','待人事核对','已完成','不续签'];
 candidates.forEach((p,i)=>{const intern=p.employeeType.includes('实习'),end=nextDay(day,[-3,5,10,2,20,15,25,8,-2,30][i]),term=renewalTerm(end),type=intern?(p.employeeType.includes('在校')?'实习生协议':'兼职劳务合同'):'劳动合同';
 let old=next.personnelContracts.filter(c=>c.personId===p.id&&c.endDate&&!c.deleted).sort((a,b)=>b.endDate.localeCompare(a.endDate))[0];
 if(!old){old={id:`renewal-old-${p.id}`,personId:p.id,employeeNo:p.employeeNo,type,number:`HT2026${String(i+101)}`,owner:'重庆沐晨',form:'电子合同',startDate:nextDay(end,-90),endDate:end,termType:'固定期限',signed:true,signedAt:`${nextDay(end,-91)}T10:00:00+08:00`,evidence:'本地合同资料样例',files:[],history:[],version:1,deleted:false};next.personnelContracts.push(old);}
 const period=renewalTerm(old.endDate),status=intern?stages[i%7]:(i%2?'待人事办理':'人事办理中');
 next.renewals.push({id:`renewal-${p.id}`,personId:p.id,employeeNo:p.employeeNo,name:p.name,kind:intern?'实习生':'全职',employeeType:p.employeeType,oldContractId:old.id,oldNumber:old.number,oldEnd:old.endDate,...period,type,company:'重庆沐晨',pm:p.manager||'王然',salary:Number(p.compensation?.salary)|| (intern?180:7800),unit:intern?'元/天':'元/月',status,round:1,stageAt:nextDay(day,-4),createdAt:day,employeeOpinion:['待PM确认','待发放合同','签署中','已完成'].includes(status)?'同意':'',pmOpinion:['待发放合同','签署中','已完成'].includes(status)?'同意':'',taskId:['签署中','已完成'].includes(status)?`LOCAL-RENEWAL-${i+1}`:'',archiveStatus:status==='已完成'?'待归档':'—',exception:status==='待人事核对'?'原合同签约资料需核实':status==='已完成'?'全部签署完成，合同PDF待归档':'',resultSource:status==='不续签'?'员工意见':'',history:[{at:day,actor:'来源快照',action:`纳入续签，当前${status}`,round:1}],rounds:[],files:[],source:'本地预览快照'});
 });
 for(const r of next.renewals.filter(r=>r.status==='已完成')){r.newContractId=`renewal-contract-${r.id}-1`;r.number=`XQ-${r.employeeNo}-1`;r.signedAt=`${day}T09:00:00+08:00`;next.personnelContracts.push({id:r.newContractId,personId:r.personId,employeeNo:r.employeeNo,replacesId:r.oldContractId,number:r.number,startDate:r.start,endDate:r.end,type:r.type,owner:r.company,form:'电子合同',termType:'固定期限',signed:true,signedAt:r.signedAt,evidence:'本地签署结果快照',taskId:r.taskId,files:[],history:[],version:1,deleted:false});}
 next.renewalPreviewVersion=1;return next;
}
export function reconcileRenewalPm(state){const next=structuredClone(state);for(const r of next.renewals||[]){if(r.status!=='待PM确认')continue;const pm=next.people.find(p=>p.id===r.personId)?.manager||'';if(r.observedPm===undefined)r.observedPm=pm;else if(pm!==r.observedPm){r.history.push({at:new Date().toISOString(),actor:'人员主库',action:'assign',reason:`归属PM由${r.pm||'空'}变为${pm||'空'}`,round:r.round});r.pm=pm;r.observedPm=pm;r.assignedPm=false;}}return next;}
export function loadRenewals(){const state=loadHr(),next=reconcileRenewalPm(ensureRenewals(state));return JSON.stringify(state)===JSON.stringify(next)?state:updateHrWorkspace(()=>next,state.revision);}
export function handler(r){return r.status==='待员工确认'||r.status==='签署中'&&r.signProgress!=='员工已签，公司待签'?r.name:r.status==='待PM确认'?(r.pm||'待人事指定PM'):'人事';}
export function signingProfile(state,r){
 const p=state.people.find(p=>p.id===r.personId)||{},a={...p.archive,...p.intakeProfile};
 return {name:p.name,gender:p.gender||a.gender,idType:a.idType||p.idType,idNumber:a.idNumber||p.idNumber,phone:p.phone||a.phone,address:a.address,school:a.school||p.school,major:a.major||p.major,education:a.education||p.education,department:state.departments?.find(d=>d.id===p.departmentId)?.name,position:state.positions?.find(d=>d.id===p.positionId)?.name,location:state.locations?.find(d=>d.id===p.locationId)?.name,bankAccounts:structuredClone(p.bankAccounts||[]),capturedAt:new Date().toISOString()};
}
export function firstReminderDay(createdAt){
 if(!createdAt)return '';
 const time=Date.parse(createdAt.includes('T')?createdAt:`${createdAt}T00:00:00+08:00`);
 if(!Number.isFinite(time))return '';
 const local=new Date(time+28800000),date=local.toISOString().slice(0,10);
 return local.getUTCHours()>=10?nextDay(date):date;
}
export function reminderPlan(r,day=renewalToday()) {
 if(finished(r))return [];
 const left=daysBetween(day,r.oldEnd),elapsed=daysBetween(r.stageAt,day),reasons=[];
 if(firstReminderDay(r.createdAt)===day&&left>=1&&left<=30)reasons.push({reason:'首次纳入续签',recipients:r.kind==='全职'?['全部人事']:[handler(r)]});
 if([30,25,20,15,10,5,4,3,2,1,0].includes(left)||left<0)reasons.push({reason:left<0?`逾期${-left}天`:left===0?'合同今日到期':`距到期${left}天`,recipients:left<=0||r.kind==='全职'||r.status==='人事办理中'?['全部人事',...(left===0?[handler(r)]:[])]:[handler(r)]});
 if(['待员工确认','待PM确认','签署中'].includes(r.status)&&elapsed===3)reasons.push({reason:'阶段停留第3天',recipients:[handler(r)]});if(['待员工确认','待PM确认','签署中'].includes(r.status)&&elapsed===7)reasons.push({reason:'阶段停留第7天',recipients:['全部人事']});
 const merged=new Map();for(const e of reasons)for(const p of e.recipients)merged.set(p,[...(merged.get(p)||[]),e.reason]);return [...merged].map(([recipient,why])=>({key:`${r.id}:${day}:${recipient}`,recipient,reason:why.join('；'),at:`${day} 10:00 (北京时间)`,status:'待发送 · 未接通知服务'}));
}
export function renewalReduce(state,id,action,payload={},role='人事',day=renewalToday()) {
 const next=structuredClone(state),r=next.renewals.find(r=>r.id===id);must(r,'续签不存在');
 must(role==='人事'||role==='PM'&&['pm-agree','pm-reject'].includes(action)&&r.pm==='王然','无此续签操作权限');
 const was=r.status,now=new Date().toISOString();const change=status=>{r.status=status;r.stageAt=day;};
 if(action==='pm-agree'||action==='pm-reject'){must(role==='PM','须由当前PM确认');must(r.status==='待PM确认','当前不在PM确认阶段');r.pmOpinion=action==='pm-agree'?'同意':'不同意';r.pmConfirmedAt=now;r.pmConfirmedBy=r.pm;change(action==='pm-agree'?'待发放合同':'不续签');if(action==='pm-reject'){must(payload.reason?.trim(),'请填写不续签原因');r.resultSource='PM拒绝';}}
 else if(action==='employee-agree'||action==='employee-reject'){must(r.status==='待员工确认','当前不在员工确认阶段');r.employeeOpinion=action==='employee-agree'?'同意':'不同意';r.employeeConfirmedAt=now;if(action==='employee-agree'){const p=next.people.find(p=>p.id===r.personId);r.salary=Number(p?.compensation?.salary)||r.salary;r.unit='元/天';r.salarySnapshotAt=now;}else r.resultSource='员工选择';change(action==='employee-agree'?'待PM确认':'不续签');}
 else if(action==='assign'){must(r.status==='待PM确认','仅待PM确认时可转交');must(payload.pm,'请选择PM');r.pm=payload.pm;r.assignedPm=true;r.observedPm=next.people.find(p=>p.id===r.personId)?.manager||'';}
 else if(action==='restart'){must(!r.taskId&&!finished(r),'合同已发出或流程已结束，不能重新发起');must(payload.reason?.trim(),'请填写重新发起原因');r.rounds.push({...r,rounds:[],history:[]});r.round+=1;r.employeeOpinion=r.pmOpinion='';change('待员工确认');}
 else if(action==='manual'){must(!r.taskId&&!finished(r),'合同已发出或已结束，不能转人工');must(payload.reason?.trim(),'请填写转人工原因');change('人事办理中');}
 else if(action==='check'){must(r.status==='待人事核对','无需执行核对');must(dateValid(payload.oldEnd),'请核实原合同结束日期');r.oldEnd=payload.oldEnd;Object.assign(r,renewalTerm(r.oldEnd));const old=next.personnelContracts.find(c=>c.id===r.oldContractId);must(old,'请先在人员合同管理补齐原合同');old.endDate=r.oldEnd;r.exception='';change(r.kind==='全职'?'待人事办理':'待员工确认');}
 else if(action==='issue'){must(r.status==='待发放合同'&&r.employeeOpinion==='同意'&&r.pmOpinion==='同意','双方均同意后才能发放');must(!r.taskId,'已有任务，请查询结果');r.signingSnapshot=signingProfile(next,r);r.taskId=`LOCAL-${crypto.randomUUID()}`;r.signProgress='待双方签署';change('签署中');}
 else if(action==='employee-signed'){must(r.status==='签署中','当前未签署中');r.signProgress='员工已签，公司待签';}
 else if(action==='termination-request'){must(r.status==='签署中','仅签署中的任务可申请终止');must(payload.reason?.trim(),'请填写终止原因');r.terminationRequested=true;r.exception='任务终止结果待核实';}
 else if(action==='terminated'){must(r.status==='签署中'&&r.terminationRequested,'须先登记终止申请');change('不续签');r.resultSource='任务终止结果';r.exception='';}
 else if(action==='no-renew'){must(['待人事办理','人事办理中'].includes(r.status),'须在人工办理阶段登记');must(payload.reason?.trim(),'请填写不续签依据');change('不续签');r.resultSource='人事登记';}
 else if(action==='complete'||action==='manual-complete'){
  const manual=action==='manual-complete';must(manual?['待人事办理','人事办理中'].includes(r.status):r.status==='签署中','当前阶段不能登记完成');
  if(manual){must(payload.number&&payload.company&&payload.type&&payload.signedAt&&Number(payload.salary)>0&&payload.unit,'请完整填写合同编号、单位、类型、签署时间及薪资');const termType=payload.termType||'固定期限';must(['固定期限','无固定期限'].includes(termType),'期限类型无效');must(dateValid(payload.start)&&(termType==='无固定期限'? !payload.end&&payload.openEndedEvidence?.trim():dateValid(payload.end)&&payload.end>=payload.start),'合同起止日期无效，无固定期限须填写原文依据且不填结束日期');r.termType=termType;r.openEndedEvidence=payload.openEndedEvidence||'';must(payload.file?.data?.startsWith('data:application/pdf;base64,JVBER'),'请上传已签PDF');must(Number.isFinite(Date.parse(payload.signedAt))&&dateValid(payload.signedAt.slice(0,10)),'签署完成时间无效');must(Number.isFinite(Number(payload.salary))&&['元/天','元/月','元/小时'].includes(payload.unit),'薪资或计薪单位无效');for(const key of ['number','company','type','signedAt','salary','unit','start','end'])r[key]=payload[key];}
  else {r.number=`XQ-${r.employeeNo}-${r.round}`;r.signedAt=now;r.signProgress='全部所需签署已完成';}
  const cid=`renewal-contract-${r.id}-${r.round}`;must(!next.personnelContracts.some(c=>c.id===cid),'本轮合同已经登记');
  next.personnelContracts.push({id:cid,personId:r.personId,employeeNo:r.employeeNo,replacesId:r.oldContractId,number:r.number,startDate:r.start,endDate:r.end||'',type:r.type,owner:r.company,form:'电子合同',termType:r.termType||'固定期限',openEndedEvidence:r.openEndedEvidence||'',signed:true,signedAt:r.signedAt,evidence:manual?'人事登记已签合同':`本地预览任务结果 ${r.taskId}`,taskId:r.taskId,files:payload.file?[payload.file]:[],history:[],version:1,deleted:false,salary:r.salary,salaryUnit:r.unit});r.newContractId=cid;r.archiveStatus=payload.file?'已归档':'待归档';r.exception=payload.file?'':'合同PDF待归档';change('已完成');
 }
 else if(action==='archive'){must(r.status==='已完成','完成签署后才能补归档');must(payload.file?.data?.startsWith('data:application/pdf;base64,JVBER'),'请上传已签PDF');const c=next.personnelContracts.find(c=>c.id===r.newContractId);must(c,'请先核实本次签署合同记录');c.files=[payload.file];r.archiveStatus='已归档';r.exception='';}
 else throw Error('不支持的续签操作');
 r.notifications ||= [];
 const notify=action==='employee-agree'?{recipient:r.pm||'全部人事',text:`请确认是否同意${r.name}续签，请前往MMOS待办。`}:action==='employee-reject'||action==='terminated'?{recipient:`${r.name}、${r.pm}`,text:`${r.name}已确定不续签，请办理离职。`}:action==='pm-reject'?{recipient:r.name,text:'续签被拒，请办理离职。'}:null;
 if(notify)r.notifications.push({...notify,key:`${r.id}:${r.round}:${action}`,at:now,status:'待发送 · 未接通知服务'});
 r.history.push({at:now,actor:role==='PM'?r.pm:action.startsWith('employee-')||['issue','complete','terminated'].includes(action)?'本地预览事件':'人事 · 周宁',action,from:was,to:r.status,reason:payload.reason||'',round:r.round});return next;
}
export function saveRenewal(state,id,action,payload,role){return updateHrWorkspace(s=>renewalReduce(s,id,action,payload,role),state.revision);}
