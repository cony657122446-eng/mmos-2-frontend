// 本地预览表单；字段与分支来自人事基础管理交付文档 8.2。
export const residentTypes = ['中国大陆居民', '港澳居民', '台胞居民', '外籍人士'];
export const banks = ['招商银行', '浙商银行', '其他银行'];
export const ethnicities = '其他（外籍人士及其他未包含民族）,汉族,蒙古族,回族,藏族,维吾尔族,苗族,彝族,壮族,布依族,朝鲜族,满族,侗族,瑶族,白族,土家族,哈尼族,哈萨克族,傣族,黎族,傈僳族,佤族,畲族,高山族,拉祜族,水族,东乡族,纳西族,景颇族,柯尔克孜族,土族,达斡尔族,仫佬族,羌族,布朗族,撒拉族,毛南族,仡佬族,锡伯族,阿昌族,普米族,塔吉克族,怒族,乌孜别克族,俄罗斯族,鄂温克族,德昂族,保安族,裕固族,京族'.split(',');
const field = (key, label, group, options, extra = {}) => ({ key, label, group, options, required: true, ...extra });
export const INTAKE_FIELDS = [
  field('recruitmentNo', '招聘编号', '入职匹配信息', null, { required: false }),
  field('name', '姓名', '基本与身份'), field('phone', '联系方式', '基本与身份'),
  field('residentType', '人员类别', '基本与身份', residentTypes), field('gender', '性别', '基本与身份', ['男','女']),
  field('hasFormerName', '是否存在曾用名', '基本与身份', ['有曾用名','没有曾用名']),
  field('formerName', '曾用名', '基本与身份', null, { when: v => v.hasFormerName === '有曾用名' }),
  ...['身份证号','回乡证','台胞证','护照号'].map((label,i) => field(['idNumber','returnPermit','taiwanPermit','passport'][i],label,'基本与身份',null,{when:v=>v.residentType===residentTypes[i]})),
  ...[['entryDate','首次入境时间'],['exitDate','预计离境时间']].map(([key,label])=>field(key,label,'基本与身份',null,{type:'date',when:v=>residentTypes.slice(1).includes(v.residentType)})),
  field('identityAttachment','证件附件','基本与身份',null,{type:'file'}),
  field('address','联系地址','联系信息'), field('emergencyName','紧急联系人','联系信息'), field('emergencyRelation','紧急联系关系','联系信息'), field('emergencyPhone','紧急联系人电话号码','联系信息'),
  field('education','学历','教育与能力',['大专','成人本科','本科','研究生','硕士研究生']), field('school','学校','教育与能力'), field('major','专业','教育与能力'),
  field('graduation','毕业年月','教育与能力',[...Array.from({length:10},(_,i)=>`${2029-i}年6月`),'2019年及往届']),
  field('english','英语水平','教育与能力',['无','CET4','CET6','TEM4','TEM8','雅思6.5及以上','托福100及以上','俄语专业八级','英语四、六级 TOPIK5级 朝鲜语专四、专八']),
  field('educationAttachment','学历证明附件','教育与能力',null,{type:'file'}), field('bank','银行','银行资料',banks),
  ...banks.flatMap((bank,i)=>[['card','卡号'],['branch','开户行信息'],['attachment','卡正反面pdf文件']].map(([suffix,label])=>field(`bank${i}_${suffix}`,`${bank}${label}`,'银行资料',null,{when:v=>v.bank===bank,type:suffix==='attachment'?'file':undefined,pdf:suffix==='attachment'}))),
  field('politics','政治面貌','补充信息',['群众','共青团员','预备党员','正式党员'],{required:false}), field('ethnicity','民族','补充信息',ethnicities,{required:false}), field('nativePlace','籍贯','补充信息',null,{required:false}),
];
export function validateIntake(values) {
  return INTAKE_FIELDS.filter(f=>!f.when||f.when(values)).flatMap(f=>{
    const v=values[f.key];
    if(f.required && (v==null || (typeof v==='string'&&!v.trim()) || (f.type==='file'&&(!v.name||!v.data)))) return [`请填写${f.label}`];
    if(v && f.type==='date' && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v)) || new Date(v).toISOString().slice(0,10)!==v)) return [`${f.label}日期无效`];
    if(v && f.options && !f.options.includes(v)) return [`${f.label}选项无效`];
    if(f.type==='file'&&v&&f.pdf&&!/\.pdf$/i.test(v.name||'')) return [`${f.label}须为PDF`];
    return [];
  });
}
