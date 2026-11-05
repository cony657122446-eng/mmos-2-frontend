import React from 'react';
import { Alert, Button, Card, Form, Input, Result, Select, Space, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { INTAKE_FIELDS, validateIntake } from '../data/hrIntake';
import { hrAction } from '../data/hrWorkspace';

function LocalAttachment({value,onChange,pdf}) {
  const [busy,setBusy]=React.useState(false);
  return <Upload accept={pdf?'.pdf':undefined} maxCount={1} fileList={value?[{uid:value.name,name:value.name,status:'done'}]:[]} onRemove={()=>onChange(undefined)} beforeUpload={file=>{
    if(pdf&&!/\.pdf$/i.test(file.name)){message.error('银行卡附件请使用PDF');return Upload.LIST_IGNORE;}
    setBusy(true); const reader=new FileReader(); reader.onload=()=>{onChange({name:file.name,type:file.type,data:reader.result});setBusy(false);}; reader.onerror=()=>{message.error('文件读取失败，请重试');setBusy(false);};reader.readAsDataURL(file);return false;
  }}><Button icon={<UploadOutlined/>} loading={busy}>选择{pdf?'PDF':'附件'}</Button></Upload>;
}
export default function HrIntakeForm() {
  const [form]=Form.useForm(), values=Form.useWatch([],form)||{}, [done,setDone]=React.useState(false),[error,setError]=React.useState(''), [busy,setBusy]=React.useState(false);
  const requestId=React.useRef(`intake-${crypto.randomUUID()}`);
  const [recruitmentNo]=React.useState(()=>(new URLSearchParams(window.location.search).get('recruitmentNo')||'').trim());
  async function submit(v){setBusy(true);setError('');try{const errors=validateIntake(v);if(errors.length)throw Error(errors.join('；'));hrAction('资料填写人','intake.submit',{requestId:requestId.current,values:v});setDone(true);}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <main className="hr-intake-public erp-app" style={{maxWidth:1000,margin:'32px auto',padding:24}}><img src="/mmos-2.0-logo.svg" alt="MMOS 2.0" style={{width:180}}/><h1>入职资料收集</h1>{done?<Result status="success" title="你的入职资料已提交" subTitle="如需补充或更正，请联系人事处理。"/>:<><Alert type="info" showIcon title="交互预览 · 请使用模拟资料" description="本地保存用于流程测试。招聘编号由填写链接自动带入，无需本人填写或手动选择人员；缺少编号时仍可先提交资料，等待来源补齐。正式网页发布和附件存储尚待接入。" style={{marginBottom:20}}/>{error&&<Alert type="error" showIcon title="未能提交，请检查" description={error} style={{marginBottom:16}}/>}<Form layout="vertical" form={form} onFinish={submit} initialValues={{recruitmentNo,residentType:'中国大陆居民',hasFormerName:'没有曾用名'}}>
    {[...new Set(INTAKE_FIELDS.map(f=>f.group))].map(group=><Card key={group} title={group} style={{marginBottom:16}}><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:'0 24px'}}>{INTAKE_FIELDS.filter(f=>f.group===group&&(!f.when||f.when(values))).map(f=><Form.Item key={f.key} name={f.key} label={f.label} extra={f.key==='recruitmentNo'?(recruitmentNo?'已从专属填写链接自动带入；如编号有误，请联系人事。':'尚未带入招聘编号，资料可先提交并保留待匹配；请联系人事核对来源。'):undefined} rules={f.required?[{required:true,message:`请填写${f.label}`}]:[]}>
      {f.type==='file'?<LocalAttachment pdf={f.pdf}/>:f.type==='date'?<Input type="date"/>:f.options?<Select showSearch optionFilterProp="label" allowClear={!f.required} options={f.options.map(value=>({value,label:value}))}/>:<Input autoComplete="off" readOnly={f.key==='recruitmentNo'} placeholder={f.key==='recruitmentNo'?'等待来源自动带入':undefined}/>}
    </Form.Item>)}</div></Card>)}<Space><Button type="primary" size="large" htmlType="submit" loading={busy}>提交本人资料</Button><span>提交前请核对当前证件及银行分支的资料。</span></Space>
  </Form></>}</main>;
}
