import React from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Empty, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, Tag, message } from 'antd';
import { getHrView, hrAction, subscribeHr, isHrReferenceActive } from '../data/hrWorkspace';
import { INTAKE_FIELDS } from '../data/hrIntake';

export function useHrView(role) {
  const empty={people:[],projectPeople:[],candidates:[],onboarding:[],intakes:[],projects:[],locations:[],audit:[]};
  const read=()=>{try{return getHrView(role);}catch{return empty;}};
  const [stored,setView]=React.useState(read),[error,setError]=React.useState('');
  const view=stored.role===role?stored:read();
  const refresh=React.useCallback(()=>{try{setView(getHrView(role));setError('');}catch(e){setError(e.message);}},[role]);
  React.useEffect(()=>{refresh();return subscribeHr(refresh);},[refresh]);
  return {view,error,refresh};
}
const options = values => values.map(value=>({value,label:value}));
const show = v => v===true?'是':v===false?'否':v||'待核对';
function projectName(view,p){return (p.projectIds||[]).map(id=>view.projects.find(x=>x.id===id)?.name||id).join('、')||'待核对';}
function intakeFormUrl(recruitmentNo='') {
  const url=new URL('/?page=hr-intake-form',window.location.origin);
  if(recruitmentNo.trim())url.searchParams.set('recruitmentNo',recruitmentNo.trim());
  return url.href;
}
async function copyIntakeLink(recruitmentNo='') {
  try{await navigator.clipboard.writeText(intakeFormUrl(recruitmentNo));message.success('填写链接已复制（本地预览地址）');}
  catch{message.error('复制失败，请打开填写页后复制地址');}
}
function PersonalIntakeLink({person}) {
  if(!person.recruitmentNo?.trim())return null;
  return <Space wrap><Button onClick={()=>window.open(intakeFormUrl(person.recruitmentNo),'_blank','noopener')}>打开专属资料填写页</Button><Button onClick={()=>copyIntakeLink(person.recruitmentNo)}>复制专属填写链接</Button></Space>;
}

export function TrainingAction({person,role,onSaved}) {
  const [open,setOpen]=React.useState(false),[form]=Form.useForm(), [error,setError]=React.useState('');
  const revision=React.useRef();
  const result=Form.useWatch('result',form),day1=Form.useWatch('day1',form),days=Form.useWatch('subsidyDays',form);
  if(!person || person.canTrain===false || !['人事','HR','PM'].includes(role) || !person.day1)return null;
  const correcting=role!=='PM', terminal=!!person.trainingResult&&person.trainingResult!=='待确定'||person.day1==='淘汰';
  if(role==='PM'&&terminal)return null;
  const first=person.day1==='培训中';
  const save=async()=>{try{const v=await form.validateFields();if(role==='PM'&&!first)delete v.day1;if(v.day1==='淘汰')v.result='';if(v.result!=='淘汰'&&v.day1!=='淘汰')delete v.subsidyDays;hrAction(role,'training.update',{personId:person.id,expectedRevision:revision.current,...v});message.success('培训记录已保存');setOpen(false);onSaved?.();}catch(e){if(e.message)setError(e.message);}};
  return <><Button size="small" type="link" onClick={()=>{revision.current=getHrView(role).revision;form.setFieldsValue({day1:person.day1,result:person.trainingResult||undefined,subsidyDays:person.subsidyDays,reason:''});setError('');setOpen(true);}}>{correcting?'核对培训':first?'第1天评定':'第2天评定'}</Button><Modal title={`${person.name} · ${correcting?'培训核对':first?'第1天评定':'第2天评定'}`} open={open} onCancel={()=>setOpen(false)} onOk={save} okText="保存评定" destroyOnHidden><Alert type="info" showIcon title={first?'第一天通过后进入第二天，尚不进入入职清单。':'第二天18:00前提交评定；通过后衔接同一次入职清单。'} style={{marginBottom:16}}/>{terminal&&<Alert type="warning" title="已有下游记录的更正需要核对影响，保留原办理和应发记录。" style={{marginBottom:12}}/>}{error&&<Alert type="error" title={error}/>}<Form layout="vertical" form={form}>
    {(first||correcting)&&<Form.Item name="day1" label="第一天状态" rules={[{required:true}]}><Select options={options(['培训中','通过','淘汰'])}/></Form.Item>}
    {(!first||correcting)&&day1!=='淘汰'&&<Form.Item name="result" label="第二天培训结果" rules={correcting?[]:[{required:true}]}><Select allowClear options={options(['通过','淘汰','培训储备'])}/></Form.Item>}
    {(result==='淘汰'||day1==='淘汰')&&<><Form.Item name="subsidyDays" label="实际补贴天数" rules={[{required:true}]}><InputNumber min={0} step={0.5} style={{width:'100%'}}/></Form.Item><p>培训补贴应发：{Number.isFinite(days)&&days>0?`¥${(days*80).toFixed(2)}`:'待核对'}（80元/天，尚未付款）</p></>}
    {correcting&&<Form.Item name="reason" label="核对更正原因" rules={[{required:true,whitespace:true,message:'请填写核对依据与原因'}]}><Input.TextArea rows={3}/></Form.Item>}
  </Form></Modal></>;
}

export function OnboardingDetail({person,role,onNavigate}) {
  const [form]=Form.useForm(), [error,setError]=React.useState('');
  React.useEffect(()=>form.setFieldsValue({intent:person.intent,locationId:person.locationId,reason:''}),[person.id,person.intent,person.locationId,form]);
  const revision=React.useRef(getHrView(role).revision);
  const {view}=useHrView(role),hr=['人事','HR'].includes(role);
  const save=async()=>{try{const values=await form.validateFields();hrAction(role,'onboarding.update',{personId:person.id,expectedRevision:revision.current,...values});revision.current=getHrView(role).revision;message.success('办理信息已保存，并重新核对准入条件');setError('');}catch(e){if(e.message)setError(e.message);}};
  return <>{!person.masterCreated && person.accountActive===false && person.accountCreatedAt && Date.now()-Date.parse(person.accountCreatedAt)>72*3600000 && <Alert type="warning" showIcon title="账号创建成功已超过72小时仍未激活，待人事确认入职意愿" description="确认前不执行账号清理或生成退出补贴。" style={{marginBottom:16}}/>}<Descriptions bordered size="small" column={2} items={[
    ['员工编号',person.employeeNo],['招聘编号',person.recruitmentNo],['资料匹配',person.intakeMatchStatus||'等待匹配'],['关联资料序号',person.intakeSerial||person.intakeId||'暂无'],['匹配说明',person.intakeMatchIssue||'按唯一招聘编号自动匹配'],['办理状态',person.checklistStatus],['入职意愿',person.intent],['组织号激活',person.accountActive==null?'结果待核对':person.accountActive?'已激活':'未激活'],['合同签署',person.contractSigned==null?'结果待核对':person.contractSigned?'已签署':'未签署'],['资料完整',person.materialsComplete==null?'关联待核对':person.materialsComplete?'完整':'不完整'],['具体缺失项',(person.missingFields||[]).join('、')||'无'],['主库建档',person.masterCreated?'已建档':'未建档'],['企业账号',person.enterpriseAccount||person.corporateAccount],['创建成功时间',person.accountCreatedAt],['退出跟进',person.exitFollowup||'无'],['资料整合',person.integrationStatus||person.integrationIssue||person.reviewReason||(person.materialsComplete?'资料已齐备':'待办理')]
  ].map(([label,children])=>({key:label,label,children:show(children)}))}/>
    <Alert style={{margin:'16px 0'}} type="info" title="建档需同时满足：人事确认入职、组织号实际激活、资料完整。合同未签时可建档为待入职。"/>
    {error&&<Alert type="error" title={error}/>}{hr&&<Form layout="vertical" form={form}><Form.Item name="intent" label="人事确认入职意愿" rules={[{required:true}]}><Select options={options(['确认入职','不入职'])}/></Form.Item><Form.Item name="locationId" label="工作地点"><Select allowClear options={view.locations.filter(l=>isHrReferenceActive(l)).map(l=>({value:l.id,label:l.name}))}/></Form.Item><Form.Item name="reason" label="办理说明 / 依据"><Input.TextArea rows={2}/></Form.Item><Button type="primary" onClick={save}>保存并核对办理结果</Button></Form>}
    {!hr&&<p>请跟进本人有权项目的异常，将处理线索交人事核对。实际账号、资料和签署结果补齐后自动解除异常。</p>}
    {hr&&<Space wrap style={{marginTop:16}}><Button onClick={()=>onNavigate?.('hr-intakes')}>查看入职资料表</Button><PersonalIntakeLink person={person}/></Space>}
  </>;
}

function IntakeRegister({role,view}) {
  const [query,setQuery]=React.useState(''),[selected,setSelected]=React.useState(null);
  const hr=['人事','HR'].includes(role),rows=(view.intakes||[]).filter(p=>`${p.serial||p.id} ${p.name||p.values?.name} ${p.values?.recruitmentNo||p.recruitmentNo||''} ${p.employeeNo||''}`.includes(query));
  const row=(view.intakes||[]).find(p=>p.id===selected);
  return <><Alert type="info" showIcon title="按唯一招聘编号自动匹配入职清单" description="资料与候选信息先后到达均会自动匹配。缺少编号、来源尚未到达或编号冲突时显示具体原因。" style={{marginBottom:16}}/><Card><Space wrap style={{marginBottom:16}}><Input.Search placeholder="搜索姓名、资料序号、员工/招聘编号" value={query} onChange={e=>setQuery(e.target.value)} allowClear style={{width:330}}/>{hr&&<Button onClick={()=>window.open(intakeFormUrl(),'_blank','noopener')}>打开入职资料填写页</Button>}{hr&&<Button onClick={()=>copyIntakeLink()}>复制填写链接</Button>}</Space><Table rowKey="id" dataSource={rows} scroll={{x:1250}} pagination={{pageSize:8}} columns={[
    {title:'资料序号',render:(_,r)=>r.serial||r.id,width:140},{title:'招聘编号',render:(_,r)=>r.values?.recruitmentNo||r.recruitmentNo||'未提供',width:170},{title:'姓名',render:(_,r)=>r.name||r.values?.name,width:140},{title:'自动匹配情况',render:(_,r)=><div><Tag color={r.matchIssue?'warning':r.candidateId?'success':'default'}>{r.status||'等待匹配'}</Tag>{r.matchIssue&&<div style={{fontSize:12,marginTop:4}}>{r.matchIssue}</div>}</div>,width:270},{title:'资料完整状态',render:(_,r)=><Tag color={r.complete?'success':'warning'}>{r.complete?'完整':(r.missingFields||[]).join('、')||'待核对'}</Tag>,width:140},{title:'员工编号',dataIndex:'employeeNo',render:v=>v||'等待匹配',width:150},{title:'联系方式',render:(_,r)=>r.phone||r.values?.phone,width:150},{title:'操作',fixed:'right',width:90,render:(_,r)=><Button type="link" onClick={()=>setSelected(r.id)}>详情</Button>}
  ]}/></Card><Drawer width={800} title="入职资料详情" open={!!row} onClose={()=>setSelected(null)} destroyOnHidden>{row&&<><Alert showIcon type={row.matchIssue?'warning':row.candidateId?'success':'info'} title={row.status||'等待匹配'} description={row.matchIssue||`按招聘编号自动关联${row.employeeNo?`，员工编号：${row.employeeNo}`:''}。`} style={{marginBottom:16}}/><Descriptions column={2} bordered size="small" items={INTAKE_FIELDS.filter(f=>!f.when||f.when(row.values||row)).map(f=>{const value=(row.values||row)[f.key];return {key:f.key,label:f.label,children:value?.name?value.name:show(value)}})}/></>}</Drawer></>;
}

export function HrAnomalyTodos({role,onNavigate}) {
  const {view,error}=useHrView(role);if(!['人事','HR','PM'].includes(role))return null;
  const rows=(role==='人事'?view.onboarding:view.projectPeople.filter(p=>p.checklistCreated)).filter(p=>(p.anomalies||[]).length||p.exitFollowup);
  return <Card title="入职异常待办" style={{marginBottom:16}}><p>以实际办理结果解除异常；培训人员未进入办理节点时不计入异常。</p>{error&&<Alert type="error" title={error}/>}<Table rowKey="id" dataSource={rows} pagination={{pageSize:5}} scroll={{x:700}} columns={[{title:'员工',render:(_,r)=>`${r.name} · ${r.employeeNo}`},{title:'项目',render:(_,r)=>projectName(view,r)},{title:'需跟进事项',render:(_,r)=><Space wrap>{(r.anomalies||[]).map(a=><Tag color="warning" key={a}>{a}</Tag>)}{r.exitFollowup}</Space>},{title:'操作',render:()=> <Button type="link" onClick={()=>onNavigate('hr-onboarding')}>查看办理</Button>}]}/></Card>;
}

export default function HrWorkflow({page,role,onNavigate}) {
  const {view,error,refresh}=useHrView(role),[query,setQuery]=React.useState(''),[project,setProject]=React.useState(),[status,setStatus]=React.useState(),[tab,setTab]=React.useState('ongoing'),[selected,setSelected]=React.useState(null),[extra,setExtra]=React.useState({});
  const hr=['人事','HR'].includes(role),intakes=page==='hr-intakes',onboarding=page==='hr-onboarding';
  React.useEffect(()=>{setSelected(null);setQuery('');setStatus(undefined);setProject(undefined);setExtra({});},[page,role]);
  if((intakes||page==='hr-candidates')&&!hr || onboarding&&!['人事','HR','PM','PMO','PA','项目助理','财务'].includes(role))return <Alert type="warning" title="当前身份无此页面查看权限" description="项目侧请从项目人员入口查看授权摘要。"/>;
  if(intakes)return <IntakeRegister role={role} view={view}/>;
  const source=onboarding?(hr?view.onboarding:view.projectPeople.filter(p=>p.checklistCreated)):(hr?view.candidates:view.projectPeople.filter(p=>p.day1));
  const rows=(source||[]).filter(p=>`${p.name} ${p.employeeNo} ${p.recruitmentNo}`.includes(query)&&(!project||p.projectIds.includes(project))&&Object.entries(extra).every(([k,v])=>!v||p[k]===v)&&(!status||(onboarding?p.anomalies?.includes(status):p.trainingStage===status))&&(!onboarding||tab==='all'||tab==='ongoing'&&['办理中','待签合同'].includes(p.checklistStatus)||p.checklistStatus===tab));
  const person=(source||[]).find(p=>p.id===selected);
  const columns=onboarding?[
    {title:'员工编号',dataIndex:'employeeNo',width:150},{title:'招聘编号',dataIndex:'recruitmentNo',width:170},{title:'姓名',dataIndex:'name',width:110},{title:'需求项目',render:(_,r)=>projectName(view,r),width:180},{title:'入职意愿',dataIndex:'intent',render:show},{title:'账号激活',render:(_,r)=>r.accountActive==null?'待核对':r.accountActive?'已激活':'未激活'}, {title:'资料',render:(_,r)=>r.materialsComplete==null?'关联待核对':r.materialsComplete?'完整':(r.missingFields||[]).join('、')||'待补齐'}, {title:'合同',render:(_,r)=>r.contractSigned==null?'待核对':r.contractSigned?'已签署':'未签署'}, {title:'已入主库',render:(_,r)=>r.masterCreated?'是':'否'}, {title:'办理状态',dataIndex:'checklistStatus',render:v=><Tag>{v}</Tag>},
  ]:[{title:'员工编号',dataIndex:'employeeNo',width:150},{title:'招聘编号',dataIndex:'recruitmentNo',width:130},{title:'姓名',dataIndex:'name',width:100},{title:'应聘岗位',dataIndex:'appliedPosition',render:show},{title:'工作地点',render:(_,r)=>view.locations.find(l=>l.id===r.locationId)?.name||'待核对'},{title:'需求项目',render:(_,r)=>projectName(view,r),width:180},{title:'招聘联络人',dataIndex:'recruiter',render:show},{title:'第一天状态',dataIndex:'day1'},{title:'培训结果评定',dataIndex:'trainingResult',render:v=>v||'未评定'}];
  columns.push({title:'操作',fixed:'right',width:190,render:(_,r)=><Space><Button type="link" size="small" onClick={()=>setSelected(r.id)}>详情</Button>{!onboarding&&<TrainingAction person={r} role={role} onSaved={refresh}/>}</Space>});
  return <>{error&&<Alert type="error" title={error}/>}{hr&&!onboarding&&view.sync?.conflicts?.length>0&&<Alert type="warning" showIcon title="招聘编号来源待核对" description={<ul>{view.sync.conflicts.map((issue,index)=><li key={`${issue.sourceId}-${index}`}>{issue.recruitmentNo||'缺少招聘编号'} · {issue.sourceId}：{issue.reason}</li>)}</ul>} style={{marginBottom:16}}/>}{!onboarding&&<Alert type="info" showIcon title="模拟候选来源 · 后续状态在本系统维护" description="正式入口每30分钟读取北京时间当天到岗、第一天培训中且非兼职人员。当前展示内置模拟数据，源接口尚未接入。" style={{marginBottom:16}}/>}{onboarding&&<Tabs activeKey={tab} onChange={setTab} items={[['ongoing','进行中'],['已完成','已完成'],['已终止','已终止'],['all','全部']].map(([key,label])=>({key,label}))}/>}<Card><Space wrap style={{marginBottom:16}}><Input.Search aria-label="搜索人员" placeholder="搜索姓名、员工/招聘编号" value={query} onChange={e=>setQuery(e.target.value)} allowClear style={{width:280}}/><Select aria-label="筛选需求项目" placeholder="全部项目" allowClear style={{width:200}} value={project} onChange={setProject} options={view.projects.map(p=>({value:p.id,label:p.name}))}/><Select aria-label="筛选培训状态或异常" placeholder={onboarding?'全部异常':'全部培训状态'} allowClear style={{width:190}} value={status} onChange={setStatus} options={options(onboarding?['组织号未激活','合同未签署','资料不全']:[...new Set((source||[]).map(p=>p.trainingStage).filter(Boolean))])}/>{!onboarding&&[['appliedPosition','岗位'],['locationId','地点'],['recruiter','招聘联络人']].map(([key,label])=><Select key={key} aria-label={`筛选${label}`} placeholder={`全部${label}`} value={extra[key]} onChange={v=>setExtra({...extra,[key]:v})} allowClear style={{width:160}} options={[...new Set(source.map(p=>p[key]).filter(Boolean))].map(v=>({value:v,label:key==='locationId'?view.locations.find(l=>l.id===v)?.name||v:v}))}/>)}<Tag>{rows.length} 条</Tag></Space><Table rowKey="id" columns={columns} dataSource={rows} scroll={{x:1450}} pagination={{pageSize:8,showSizeChanger:true}} locale={{emptyText:<Empty description="暂无符合条件的人员"/>}}/></Card><Drawer title={person?`${person.name} · ${person.employeeNo}`:'人员详情'} width={850} open={!!person} onClose={()=>setSelected(null)} destroyOnHidden>{person&&(onboarding?<OnboardingDetail person={person} role={role} onNavigate={onNavigate}/>:<><Descriptions bordered column={2} size="small" items={[
    ['招聘编号',person.recruitmentNo],['应聘岗位',person.appliedPosition],['需求项目',projectName(view,person)],['培训阶段',person.trainingStage],['实际培训首日',person.trainingStart],['当前第一天状态',person.day1],['当前第二天结果',person.trainingResult],['补贴天数',person.subsidyDays],['补贴应发',person.subsidyAmount==null?'暂无应发':`¥${person.subsidyAmount}`],['来源系统',person.sourceSystem||'MMOS 1.0（模拟）'],['源记录',person.sourceId],['源第一天状态',person.sourceSnapshot?.day1],['最近读取时间',person.sourceReadAt],['入职摘要',person.checklistStatus],['待核对原因',person.reviewReason]
  ].map(([label,children])=>({key:label,label,children:show(children)}))}/><Space wrap style={{margin:'16px 0'}}>{hr&&<PersonalIntakeLink person={person}/>}<TrainingAction person={person} role={role} onSaved={refresh}/>{person.checklistStatus&&<Button onClick={()=>onNavigate('hr-onboarding')}>查看入职清单</Button>}</Space>{hr&&<><h3>教育履历与能力资料</h3><Descriptions bordered size="small" column={2} items={[['学校',person.school],['专业',person.major],['学历',person.education],['毕业年月',person.graduation],['英语水平',person.english],['招聘联络人',person.recruiter],['招聘跟进',person.candidateNote]].map(([label,children])=>({key:label,label,children:show(children)}))}/></>}<h3>操作记录</h3><Table size="small" rowKey="id" pagination={{pageSize:5}} dataSource={(view.audit||[]).filter(a=>a.personId===person.id||a.objectId===person.id)} columns={[{title:'时间',dataIndex:'at'},{title:'操作人',dataIndex:'actor'},{title:'操作',dataIndex:'type'},{title:'原因',dataIndex:'reason'}]}/></>)}</Drawer></>;
}
