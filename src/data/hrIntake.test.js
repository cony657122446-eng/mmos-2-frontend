import test from 'node:test';
import assert from 'node:assert/strict';
import { INTAKE_FIELDS, validateIntake, residentTypes, banks } from './hrIntake.js';
const attachment = {name:'模拟材料.pdf',data:'data:application/pdf;base64,dGVzdA=='};
function complete(residentType=residentTypes[0],bank=banks[0]) {
  const v={residentType,bank,hasFormerName:'没有曾用名'};
  for(const f of INTAKE_FIELDS) if(f.required&&!v[f.key]&&(!f.when||f.when(v)))v[f.key]=f.type==='file'?attachment:f.type==='date'?'2026-11-05':f.options?.[0]||'模拟值';
  return v;
}
test('独立入职资料不要求员工编号、候选关联或账号',()=>assert.deepEqual(validateIntake(complete()),[]));
test('四种身份与三家银行仅验证当前适用分支',()=>{for(const type of residentTypes)for(const bank of banks)assert.deepEqual(validateIntake(complete(type,bank)),[]);});
test('英语与学历附件缺失均阻断提交',()=>{const v=complete();delete v.english;delete v.educationAttachment;assert.equal(validateIntake(v).length,2);});
test('非大陆证件的入境离境日期必填，历史隐藏证件不代替当前分支',()=>{const v=complete();v.residentType='外籍人士';assert.equal(validateIntake(v).length,3);});
test('曾用名分支和已读取附件验证',()=>{const v=complete();v.hasFormerName='有曾用名';v.identityAttachment={name:'失败.pdf'};assert.equal(validateIntake(v).length,2);});
test('银行附件必须PDF且其他银行旧字段不能完成新银行分支',()=>{const v=complete();v.bank0_attachment={...attachment,name:'银行卡.png'};assert.equal(validateIntake(v).length,1);v.bank='浙商银行';assert.equal(validateIntake(v).length,3);});

test('非真实日历日期不得通过资料校验',()=>{const v=complete('外籍人士');v.entryDate='2026-02-30';assert.ok(validateIntake(v).some(e=>e.includes('日期无效')));});
