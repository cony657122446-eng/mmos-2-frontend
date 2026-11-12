import React from 'react';
import { displayText } from '../data/displayText';
import { HR_CHANGE_TYPES } from '../data/hrChanges';
import { Alert, Button, Descriptions, Empty, Space, Table, Tabs, Tag } from 'antd';
import { SubsidyDetails } from './HrWorkflowActions';
import { HrPersonnelContractsPanel } from './HrPersonnelContracts';
import { HrAttendancePanel } from './HrAttendance';
import { HrCareerPanel } from './HrCareer';

const filled = value => value !== undefined && value !== null && value !== '';

function display(value, emptyText) {
  value = displayText(value);
  if (!filled(value)) return emptyText;
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return value.length ? value.map(item => typeof item === 'object' ? item.name || item.label || item.value : item).filter(filled).join('、') : emptyText;
  return typeof value === 'object' ? value.name || value.value || emptyText : String(value);
}

function Attachments({ value, emptyText }) {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return items.length ? <Space direction="vertical">{items.map((item, index) => <div key={item.id || `${item.name}-${index}`}>
    {item.data?.startsWith('data:') ? <a href={item.data} download={item.name}>{item.name}</a> : item.url?.startsWith('https://') ? <a href={item.url} target="_blank" rel="noreferrer">{item.name}</a> : item.name || '附件待接入'}
    {(item.source || item.version) && <small className="hr-cell-note">{item.source} {item.version ? `版本 ${item.version}` : ''}</small>}
  </div>)}</Space> : emptyText;
}

function Fields({ title, fields, data, emptyText }) {
  return <Descriptions title={title} bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 20 }} items={fields.map(([key, label, attachment]) => ({
    key, label, children: attachment ? <Attachments value={data[key]} emptyText={emptyText} /> : display(data[key], emptyText),
  }))} />;
}

export default function HrPersonnelDetails({ person, role, view, onNavigate, initialTab }) {
  const tabsRef = React.useRef(null);
  React.useEffect(() => {
    if (!initialTab) return;
    const frame = requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [person.id, initialTab]);
  const source = person.historySource || {};
  const emptyText = source.status === '成功' || source.status === 'success' || source.status === '已读取' || source.status === '已同步' ? '暂无资料' : '待接入';
  const sensitive = ['人事', 'HR', '财务'].includes(role);
  const identityAllowed = ['人事', 'HR'].includes(role);
  const archive = { ...person, ...(person.details?.archive || {}) };
  const contracts = person.contracts || person.details?.contracts || [];
  const changes = person.changes || person.details?.changes || [];
  const accounts = person.bankAccounts || person.details?.bankAccounts || [];
  const compensation = person.compensation || person.details?.compensation || {};
  const attendance = (view.attendance || []).filter(row => row.personId === person.id);
  const tabItems = [
    { key: 'archive', label: '人员档案', children: <>
      <Fields title="个人资料" data={archive} emptyText={emptyText} fields={[
        ...(identityAllowed ? [['ethnicity', '民族'], ['politics', '政治面貌'], ['birthday', '生日'], ['nativePlace', '籍贯'], ['hasFormerName', '是否存在曾用名'], ['formerName', '曾用名']] : []), ['address', '联系地址'],
      ]} />
      <Fields title="紧急联系" data={archive} emptyText={emptyText} fields={[
        ['emergencyName', '紧急联系人'], ['emergencyRelation', '紧急联系人关系'], ['emergencyPhone', '紧急联系人电话'],
      ]} />
      {identityAllowed && <>
        <Fields title="证件资料" data={archive} emptyText={emptyText} fields={[
          ['certificateCategory', '人员（证照）类别 · 对应关系待核对'], ['idNumber', '身份证号'], ['returnPermit', '回乡证'], ['taiwanPermit', '台胞证'], ['passport', '护照号'], ['identityAttachment', '证件附件', true], ['residentEntryDate', '首次入境时间'], ['exitDate', '预计离境时间'],
        ]} />
      </>}
      <Fields title="教育资料" data={archive} emptyText={emptyText} fields={[
        ['education', '学历'], ['school', '学校'], ['schoolLevel', '院校等级'], ['major', '专业'], ['majorType', '专业类型'], ['graduation', '毕业年月'], ['educationAttachments', '学历证明附件', true],
      ]} />
      <Fields title="履历与能力" data={archive} emptyText={emptyText} fields={[
        ['resumeAttachments', '简历附件', true], ['resumeSupplement', '简历补充 · 选项待核对'], ['abilityTags', '能力标签'], ['english', '英语水平'],
      ]} />
    </> },
    { key: 'changes', label: '人事变动', children: <>
      <Fields title="入职与试用转正" data={person} emptyText={emptyText} fields={[
        ['checklistStatus', '入职办理状态'], ['onboardingPm', '入职PM'], ['entryDate', '入职日期'], ['probationDate', '试用期开始日期'], ['probationFormulaDate', '试用期开始日期公式来源 · 待核对'], ['plannedRegularizationDate', '计划转正日期 · 来源映射待核对'], ['actualRegularizationDate', '实际转正日期'], ['regularizationType', '转正类型'],
      ]} />
      <Fields title="离职办理" data={person} emptyText={emptyText} fields={[
        ['expectedLastWorkDate', '预计最后工作日期'], ['lastWorkDate', '最后工作日期'], ['resignationEffectiveDate', '离职生效日'], ['resignationReason', '离职原因分类'], ['lastWorkMonth', '最后工作日年月 · 公式待核对'],
      ]} />
      <Table rowKey={(row, index) => row.id || index} size="small" dataSource={changes} pagination={{ pageSize: 5 }} locale={{ emptyText }} columns={[
        { title: '变动类型', dataIndex: 'type' }, { title: '生效日期', dataIndex: 'date' }, { title: '状态', dataIndex: 'status' }, { title: '内容及依据', dataIndex: 'reason' }, { title: '来源', dataIndex: 'source' },
        ...(identityAllowed && onNavigate ? [{ title: '操作', key: 'actions', render: (_, row) => {
          const target = HR_CHANGE_TYPES.find(item => item.key === row.changeType || item.title === row.type);
          return target ? <Button type="link" onClick={() => onNavigate(target.page, { hrChangeRecordId: row.id })}>查看记录</Button> : '—';
        } }] : []),
      ]} />
      <Space wrap style={{ marginTop: 16 }}>{person.checklistCreated && <Button onClick={() => onNavigate?.('hr-onboarding')}>查看关联入职清单</Button>}{identityAllowed && person.intakeId && <Button onClick={() => onNavigate?.('hr-intakes')}>查看关联入职资料</Button>}</Space>
    </> },
    { key: 'contracts', label: '人员合同', children: <>
      <HrPersonnelContractsPanel role={role} personId={person.id} summaryRows={contracts} />
      <Fields title="当前办理签署依据" data={person} emptyText={emptyText} fields={[
        ['contractTaskId', '沐晨法大大任务ID'], ['contractTaskStatus', '沐晨流程状态'], ['contractSigned', '本次办理合同已签署'], ['contractSource', '签署来源'], ['contractStartMonth', '合同开始年月 · 公式待核对'],
      ]} />
    </> },
    { key: 'career', label: '职业履历', children: <HrCareerPanel role={role} personId={person.id} /> },
    { key: 'attendance', label: '飞书月度出勤记录', children: <>
      <HrAttendancePanel role={role} personId={person.id} />
      <Fields title="出勤概况" data={person} emptyText={emptyText} fields={[
        ['attendanceStatus', '人员出勤状态'], ['attendanceRecordId', '出勤记录关联'], ['personnelAnomalies', '人员异常记录 · 来源范围待核对'],
      ]} />
      <h3>原项目出勤记录</h3><Table rowKey={(row, index) => row.id || index} size="small" dataSource={attendance} pagination={{ pageSize: 5 }} locale={{ emptyText: '暂无原项目出勤记录' }} columns={[
        { title: '日期', dataIndex: 'date' }, { title: '项目', dataIndex: 'projectId', render: id => view.projects?.find(p => p.id === id)?.name || id }, { title: '出勤天数', render: (_, row) => row.days ?? row.attendanceDays ?? '待核对' }, { title: '出勤时长', render: (_, row) => row.hours ?? '待核对' }, { title: '来源', dataIndex: 'source' },
      ]} />
    </> },
    { key: 'recruitment', label: '招聘来源', children: <>
      <Fields title="招聘来源" data={person} emptyText={emptyText} fields={[
        ['recruitmentNo', '招聘编号'], ['recruiter', '招聘联络人'], ['recruitmentPlan', '招聘计划'], ['sourceId', '候选来源记录'], ['trainingStart', '原开始培训日期 · 阶段映射待核对'], ['trainingStartMonth', '培训开始年月 · 公式待核对'],
      ]} />
      {identityAllowed && <Button onClick={() => onNavigate?.('hr-candidates')}>查看关联候选记录</Button>}
      <h3>入项培训 <Tag>布局建议</Tag></h3>
      <Fields data={person} emptyText={emptyText} fields={[
        ['arrivalDate', '培训第1天'], ['trainingDay2', '日历第2培训日'], ['trainingDateIssue', '日期核对'], ['day1', '第一天状态'], ['trainingResult', '培训结果评定'], ['trainingPassedDate', '通过日期'], ['trainingEvaluatedAt', '实际操作时间'],
      ]} />
      <SubsidyDetails person={person} audit={view.audit} />
    </> },
  ];
  if (sensitive) {
    tabItems.push({ key: 'banks', label: '银行资料', children: <Table size="small" rowKey={(row, index) => row.id || index} dataSource={accounts} scroll={{ x: 780 }} pagination={{ pageSize: 5 }} locale={{ emptyText }} columns={[
      { title: '银行名称', dataIndex: 'bank' }, { title: '银行卡号', dataIndex: 'cardNumber' }, { title: '开户行信息', render: (_, row) => <>{row.branch || '待核对'}{row.issue && <div><Tag color="warning">{row.issue}</Tag></div>}</> }, { title: '银行卡附件', render: (_, row) => <Attachments value={row.attachments} emptyText={emptyText} /> },
    ]} /> });
    tabItems.push({ key: 'compensation', label: '薪资与保障', children: <>
      {compensation.salaryAuthorized !== true ? <Alert type="info" title="当前账号未取得薪资档案查看授权" style={{ marginBottom: 16 }} /> : <Fields title="薪资档案" data={compensation} emptyText={emptyText} fields={[
        ['salary', '当前薪资'], ['abilityAllowance', '能力补贴'], ['standbyAllowance', '是否享受待岗补贴'],
      ]} />}
      <Fields title="社保与公积金" data={compensation} emptyText={emptyText} fields={[
        ['socialInsuranceStart', '社保购买开始日期'], ['socialInsuranceStop', '社保购买停止日期 · 文本日期待核对'], ['socialInsuranceCompany', '社保单位'], ['housingFund', '是否购买公积金'],
      ]} />
      <Fields title="实习生责任险及成本参考" data={compensation} emptyText={emptyText} fields={[
        ['employerLiabilityInsurance', '雇主责任险 · 适用范围待核对'], ['starPlanCost', '晨星计划结算岗位成本 · 归属待核对'],
      ]} />
    </> });
  }
  tabItems.push({ key: 'projects', label: <span>项目关联 <Tag>建议</Tag></span>, children: <>
    <Fields title="负责人及交付线来源" data={person} emptyText={emptyText} fields={[
      ['projectManagerSource', '项目直属经理'], ['attendanceManagerSource', '当前PM（出勤状态）'], ['deliveryLine', '交付线归属'], ['deliveryLineAuto', '交付线归属（自动）'], ['deliveryLineBackup', '交付线归属备用'], ['deliveryLineNote', '交付线归属备注'],
    ]} />
    <p className="hr-muted">负责人及交付线来源优先级待确认。</p>
    <Table size="small" rowKey={(row, index) => row.id || row.projectId || index} dataSource={[
      ...(person.projectIds || []).map(id => ({ projectId: id, state: '当前在项' })),
      ...(person.endedProjectRelations || []).map(row => ({ ...row, state: '历史关系' })),
    ]} pagination={{ pageSize: 5 }} locale={{ emptyText: <Empty description="暂无项目关系" /> }} columns={[
      { title: '项目', dataIndex: 'projectId', render: id => view.projects?.find(p => p.id === id)?.name || id }, { title: '关系', dataIndex: 'state' }, { title: '结束时间', render: (_, row) => row.endedAt || row.endDate || '—' }, { title: '依据', dataIndex: 'reason' },
    ]} />
  </> });
  return <section className="hr-personnel-tabs" ref={tabsRef}>
    <Alert type={source.error ? 'warning' : 'info'} showIcon title={source.error ? `历史资料读取失败 ${source.error}` : `历史资料来源 ${source.status || '待接入'}`} description={<Space wrap><span>{source.source || '历史资料按人员稳定标识承接'}</span>{source.recordId && <span>来源记录 {source.recordId}</span>}{source.mappingVersion && <span>映射版本 {source.mappingVersion}</span>}{source.lastSuccess && <span>最近成功读取 {source.lastSuccess}</span>}</Space>} style={{ marginBottom: 16 }} />
    <Tabs defaultActiveKey={initialTab} items={tabItems} />
  </section>;
}
