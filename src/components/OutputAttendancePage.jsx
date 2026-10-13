import React from 'react';
import { Button, Card, DatePicker, Empty, Form, Input, InputNumber, Modal, Segmented, Select, Space, Table, Tabs, Tag, message } from 'antd';
import { Plus, Search, ShieldCheck } from 'lucide-react';
import dayjs from 'dayjs';

const PM_NAME = '王然';
const projects = [
  { projectNo: 'ZJ20260910922', projectName: '星河智能客服项目', customer: '字节', pm: '王然', pa: '林晓彤' },
  { projectNo: 'ZJ20260911880', projectName: '海外内容审核产线', customer: '腾讯', pm: '陈默', pa: '—' },
  { projectNo: 'ZJ20260912006', projectName: '语音质检专项', customer: '字节', pm: '林晓彤', pa: '赵子涵' },
];
const outputFields = ['日期', '项目编号', '项目名称', '人员姓名', '员工编号', '人员类型', '项目角色', '出勤工时', '是否在项', '产出量', '有效产量', '待确认有效产量', '结算工时', '同步状态', '最近抓取时间'];
const attendanceFields = ['员工编号', '人员姓名', '员工类型', '项目编号', '所在项目', '工资天数', '出勤总天数', '提成/绩效', '其他额外发放金额', '备注', '条目状态'];
const peopleSeed = {
  ZJ20260910922: [
    ['E001', '王然', '线上', 'PM', 8, 0], ['E002', '林晓彤', '线上', 'PA', 8, 0], ['E003', '陈默', '线上', 'QA', 8, 1200],
    ['E004', '周启明', '线下', '质检', 8, 2400], ['E005', '孙磊', '线下', '标注', 8, 6800], ['E006', '李倩', '线下', '标注', 6, 3100],
  ],
  ZJ20260911880: [['E101', '陈默', '线上', 'PM', 8, 0], ['E102', '周宁', '线下', '标注', 8, 2600], ['E103', '吴迪', '线下', '标注', 7, 1900]],
  ZJ20260912006: [['E201', '林晓彤', '线上', 'PM', 8, 0], ['E202', '赵子涵', '线上', 'PA', 8, 0], ['E203', '孙磊', '线下', '标注', 8, 4200]],
};
function nowStamp() { return dayjs().format('YYYY-MM-DD HH:mm'); }
function outputRows() {
  return projects.flatMap(project => (peopleSeed[project.projectNo] || []).flatMap(person => [0, 1, 2].map(offset => {
    const date = dayjs('2026-09-24').subtract(offset, 'day').format('YYYY-MM-DD');
    const output = Math.round(person[5] * (offset === 1 ? 0.8 : 1));
    return { key: `${project.projectNo}-${person[0]}-${date}`, date, projectNo: project.projectNo, projectName: project.projectName, pm: project.pm, name: person[1], employeeNo: person[0], type: person[2], role: person[3], hours: person[4], output, effective: output, pending: '—', settle: person[4], sync: offset === 2 && person[0] === 'E006' ? '待确认' : '同步成功', fetchedAt: `${date} 00:05` };
  })));
}
const initialAttendance = [
  { key: 'att-1', projectNo: 'ZJ20260910922', projectName: '星河智能客服项目', pm: '王然', month: '2026-08', source: '在线表格', submittedAt: '2026-09-02 11:20', timing: '按时', status: '读取成功', current: true, link: 'https://feishu.cn/sheets/attendance-001', error: '', rows: [] },
  { key: 'att-2', projectNo: 'ZJ20260910922', projectName: '星河智能客服项目', pm: '王然', month: '2026-09', source: '手工录入', submittedAt: '2026-09-25 16:40', timing: '按时', status: '手工提交成功', current: true, link: '', error: '', rows: [] },
  { key: 'att-3', projectNo: 'ZJ20260911880', projectName: '海外内容审核产线', pm: '陈默', month: '2026-08', source: '在线表格', submittedAt: '2026-09-05 09:12', timing: '逾期', status: '待审批', current: false, link: 'https://feishu.cn/sheets/attendance-002', error: '', rows: [] },
  { key: 'att-4', projectNo: 'ZJ20260912006', projectName: '语音质检专项', pm: '林晓彤', month: '2026-08', source: '在线表格', submittedAt: '2026-09-03 18:02', timing: '按时', status: '已驳回', current: false, link: 'https://feishu.cn/sheets/attendance-003', error: '出勤总天数与表格合计不一致', rows: [] },
];
function buildRows(projectNo, duplicate = false) {
  const project = projects.find(item => item.projectNo === projectNo);
  const rows = (peopleSeed[projectNo] || []).map(person => ({ employeeNo: person[0], name: person[1], employeeType: person[2], projectNo, projectName: project.projectName, payDays: 22, attendanceDays: person[4] > 0 ? 21 : 0, bonus: '', extra: '', note: '', state: '有效' }));
  if (duplicate && rows[0]) rows.push({ ...rows[0], state: '重复条目' });
  return rows;
}
initialAttendance.forEach(item => { item.rows = buildRows(item.projectNo, item.key === 'att-4'); });

function statusTag(status) {
  const color = { '同步成功': 'success', '待确认': 'warning', '读取成功': 'success', '手工提交成功': 'success', '待读取': 'processing', '待审批': 'purple', '已驳回': 'error', '读取失败': 'error' }[status];
  return <Tag color={color || 'default'}>{status}</Tag>;
}

function OutputTab({ role }) {
  const [records] = React.useState(outputRows);
  const [sheets, setSheets] = React.useState({ ZJ20260910922: 'https://feishu.cn/sheets/output-001', ZJ20260911880: 'https://feishu.cn/sheets/output-002', ZJ20260912006: '' });
  const [query, setQuery] = React.useState('');
  const [projectNo, setProjectNo] = React.useState('all');
  const [day, setDay] = React.useState(dayjs('2026-09-24'));
  const [selected, setSelected] = React.useState(null);
  const [uploading, setUploading] = React.useState(false);
  const mine = records.filter(item => role !== 'PM' || item.pm === PM_NAME);
  const visibleProjects = projects.filter(item => mine.some(row => row.projectNo === item.projectNo));
  const summary = visibleProjects.map(project => {
    const rows = mine.filter(item => item.projectNo === project.projectNo && item.date === day.format('YYYY-MM-DD'));
    return { ...project, key: project.projectNo, people: rows.length, output: rows.reduce((sum, item) => sum + item.output, 0), pending: rows.filter(item => item.sync === '待确认').length, fetchedAt: rows[0]?.fetchedAt || '—' };
  }).filter(item => projectNo === 'all' || item.projectNo === projectNo).filter(item => !query.trim() || [item.projectNo, item.projectName, item.pm].some(value => String(value).includes(query.trim())));
  const people = mine.filter(item => item.projectNo === selected?.projectNo && item.date === day.format('YYYY-MM-DD'));
  if (selected) return <div className="detail-screen"><div className="detail-screen-bar"><div className="detail-screen-main"><button className="detail-back" onClick={() => setSelected(null)}>返回项目列表</button><div className="detail-screen-kicker">{selected.projectNo} · {day.format('YYYY-MM-DD')}</div><h1>{selected.projectName}</h1></div><Space><Tag>每日 00:00 自动抓取</Tag>{['PM', 'PA', 'PMO'].includes(role) && <Button onClick={() => setUploading(selected.projectNo)}>上传产出表</Button>}</Space></div><div className="quote-wait-box">当前产出表：{sheets[selected.projectNo] || '尚未上传。上传后系统按项目映射规则每日抓取。'}</div><Table rowKey="key" dataSource={people} pagination={false} scroll={{ x: 1600 }} columns={outputFields.map(label => ({ title: label, dataIndex: { 日期: 'date', 项目编号: 'projectNo', 项目名称: 'projectName', 人员姓名: 'name', 员工编号: 'employeeNo', 人员类型: 'type', 项目角色: 'role', 出勤工时: 'hours', 是否在项: 'hours', 产出量: 'output', 有效产量: 'effective', 待确认有效产量: 'pending', 结算工时: 'settle', 同步状态: 'sync', 最近抓取时间: 'fetchedAt' }[label], width: 120, render: label === '是否在项' ? value => Number(value) > 0 ? '在项' : '不在项' : label === '同步状态' ? statusTag : undefined }))} /></div>;
  return <Card variant="borderless" className="trial-work-card"><div className="trial-list-toolbar"><Space><DatePicker value={day} allowClear={false} onChange={value => value && setDay(value)} aria-label="产出日期" /><Select aria-label="筛选项目" value={projectNo} onChange={setProjectNo} options={[{ value: 'all', label: '全部项目' }, ...visibleProjects.map(item => ({ value: item.projectNo, label: item.projectName }))]} /><Input prefix={<Search size={14} />} allowClear value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索项目编号、名称、PM" aria-label="搜索产出项目" /></Space>{['PM', 'PA', 'PMO'].includes(role) && <Button type="primary" onClick={() => setUploading(visibleProjects[0]?.projectNo || '')}>上传产出表</Button>}</div><Table rowKey="key" dataSource={summary} pagination={false} locale={{ emptyText: <Empty description="所选日期没有产出记录" /> }} onRow={record => ({ onClick: () => setSelected(record) })} columns={[{ title: '项目编号', dataIndex: 'projectNo', width: 150 }, { title: '项目名称', dataIndex: 'projectName', render: (value, record) => <button className="trial-name-link" onClick={() => setSelected(record)}><span><strong>{value}</strong><small>{record.customer} · {record.pm}</small></span></button> }, { title: '日期', render: () => day.format('YYYY-MM-DD'), width: 120 }, { title: '人员条目', dataIndex: 'people', width: 100 }, { title: '产出量合计', dataIndex: 'output', width: 120 }, { title: '待确认', dataIndex: 'pending', width: 90 }, { title: '产出表', width: 110, render: (_, record) => sheets[record.projectNo] ? '已上传' : '未上传' }, { title: '最近抓取', dataIndex: 'fetchedAt', width: 150 }, { title: '同步状态', render: (_, record) => statusTag(record.pending ? '待确认' : '同步成功'), width: 110 }]} /><UploadOutput open={Boolean(uploading)} projectNo={uploading} projects={visibleProjects} currentLink={sheets[uploading]} onCancel={() => setUploading(false)} onSave={(no, link) => { setSheets(current => ({ ...current, [no]: link })); setUploading(false); message.success('产出表已保存，系统将于每日 00:00 按映射规则抓取'); }} /></Card>;
}
function UploadOutput({ open, projectNo, projects, currentLink, onCancel, onSave }) {
  const [form] = Form.useForm();
  React.useEffect(() => { if (open) form.setFieldsValue({ projectNo, link: currentLink || '' }); }, [open, projectNo, currentLink, form]);
  return <Modal title="上传产出表" open={open} okText="保存产出表" onCancel={onCancel} onOk={() => form.validateFields().then(values => onSave(values.projectNo, values.link))}><p className="modal-help-copy">PM 或 PA 上传本人负责项目的飞书产出表。原始表字段不要求统一，系统按该项目的映射规则每日自动抓取。</p><Form form={form} layout="vertical"><Form.Item name="projectNo" label="项目" rules={[{ required: true, message: '请选择项目' }]}><Select options={projects.map(item => ({ value: item.projectNo, label: `${item.projectNo} · ${item.projectName}` }))} /></Form.Item><Form.Item name="link" label="飞书产出表链接" rules={[{ required: true, message: '请填写产出表链接' }]}><Input placeholder="粘贴飞书表格链接" /></Form.Item></Form></Modal>;
}

function AttendanceTab({ role }) {
  const [records, setRecords] = React.useState(initialAttendance);
  const [query, setQuery] = React.useState('');
  const [selectedKey, setSelectedKey] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [manual, setManual] = React.useState(null);
  const [rejectKey, setRejectKey] = React.useState('');
  const mine = records.filter(item => role === 'PMO' || role === '人事' || item.pm === PM_NAME || (role === 'PA' && projects.find(project => project.projectNo === item.projectNo)?.pa === '林晓彤'));
  const visible = mine.filter(item => !query.trim() || [item.projectNo, item.projectName, item.pm, item.month].some(value => String(value).includes(query.trim())));
  const selected = records.find(item => item.key === selectedKey);
  const submit = values => {
    const month = values.month.format('YYYY-MM');
    if (records.some(item => item.projectNo === values.projectNo && item.month === month && ['待读取', '待审批'].includes(item.status))) { message.error('该项目该月已有待读取或待审批记录，不能重复提交'); return; }
    if (values.source === '手工录入') { setCreating(false); setManual({ projectNo: values.projectNo, month, rows: buildRows(values.projectNo).map(item => ({ ...item, payDays: null, attendanceDays: null })) }); return; }
    const project = projects.find(item => item.projectNo === values.projectNo);
    const submittedAt = nowStamp();
    const overdue = dayjs(submittedAt).isAfter(dayjs(month).add(1, 'month').date(3).endOf('day'));
    const created = { key: `att-${Date.now()}`, projectNo: project.projectNo, projectName: project.projectName, pm: project.pm, month, source: values.source, submittedAt, timing: overdue ? '逾期' : '按时', status: values.source === '在线表格' ? '待读取' : overdue ? '待审批' : '手工提交成功', current: false, link: values.link || '', error: '', rows: values.source === '手工录入' ? buildRows(project.projectNo) : [] };
    setRecords(current => [created, ...current]);
    setCreating(false);
    message.success(created.status === '待读取' ? '已提交，等待读取' : created.status === '待审批' ? '逾期修改已提交，等待人事审批' : '手工录入已生效');
  };
  const readSheet = record => {
    const rows = buildRows(record.projectNo, record.key.endsWith('3'));
    const valid = rows.some(item => item.state === '有效');
    const next = records.map(item => item.key === record.key ? { ...item, rows, status: valid ? (item.timing === '逾期' ? '待审批' : '读取成功') : '读取失败', error: valid ? '' : '没有有效人员行', current: valid && item.timing !== '逾期' } : item);
    setRecords(next);
    message.success(valid ? '读取完成，异常行未进入有效出勤' : '读取失败，当前有效记录不变');
  };
  const submitManual = () => {
    const missing = manual.rows.some(item => item.payDays === null || item.attendanceDays === null);
    const missingNote = manual.rows.some(item => item.extra && !String(item.note || '').trim());
    if (missing) { message.error('必须填写全部人员的工资天数和出勤总天数'); return; }
    if (missingNote) { message.error('其他额外发放金额有值时，备注必填'); return; }
    const project = projects.find(item => item.projectNo === manual.projectNo);
    const submittedAt = nowStamp();
    const overdue = dayjs(submittedAt).isAfter(dayjs(manual.month).add(1, 'month').date(3).endOf('day'));
    const created = { key: `att-${Date.now()}`, projectNo: project.projectNo, projectName: project.projectName, pm: project.pm, month: manual.month, source: '手工录入', submittedAt, timing: overdue ? '逾期' : '按时', status: overdue ? '待审批' : '手工提交成功', current: !overdue, link: '', error: '', rows: manual.rows.map(item => ({ ...item, state: '有效' })) };
    setRecords(current => [created, ...current.map(item => item.projectNo === created.projectNo && item.month === created.month ? { ...item, current: false } : item)]);
    setManual(null);
    message.success(overdue ? '全部人员已提交，等待人事审批' : '全部人员已提交并生效');
  };
  const changeManual = (employeeNo, field, value) => setManual(current => ({ ...current, rows: current.rows.map(item => item.employeeNo === employeeNo ? { ...item, [field]: value } : item) }));
  const resubmit = record => {
    if (records.some(item => item.projectNo === record.projectNo && item.month === record.month && ['待读取', '待审批'].includes(item.status))) { message.error('该项目该月已有待处理记录，不能重新提交'); return; }
    setSelectedKey('');
    setManual({ projectNo: record.projectNo, month: record.month, rows: (record.rows.length ? record.rows : buildRows(record.projectNo)).map(item => ({ ...item, state: '有效' })) });
  };
  const reject = (record, reason) => { setRecords(current => current.map(item => item.key === record.key ? { ...item, status: '已驳回', current: false, error: reason } : item)); setRejectKey(''); message.success('已驳回，不直接修改原字段'); };
  const approve = record => { setRecords(current => current.map(item => item.projectNo === record.projectNo && item.month === record.month ? { ...item, current: item.key === record.key, status: item.key === record.key ? (item.source === '在线表格' ? '读取成功' : '手工提交成功') : item.status } : item)); message.success('审批通过，已成为当前有效记录'); };
  if (manual) { const project = projects.find(item => item.projectNo === manual.projectNo); return <div className="detail-screen"><div className="detail-screen-bar"><div className="detail-screen-main"><button className="detail-back" onClick={() => setManual(null)}>返回列表</button><div className="detail-screen-kicker">{project.projectNo} · {manual.month}</div><h1>手工录入 · {project.projectName}</h1></div><Button type="primary" onClick={submitManual}>提交全部人员</Button></div><p className="modal-help-copy">当前项目共 {manual.rows.length} 人。已提交记录不能直接改原字段；修改后会生成一条新的全部人员提交记录。</p><Table rowKey="employeeNo" dataSource={manual.rows} pagination={false} scroll={{ x: 1200 }} columns={[{ title: '员工编号', dataIndex: 'employeeNo', width: 110 }, { title: '人员姓名', dataIndex: 'name', width: 110 }, { title: '员工类型', dataIndex: 'employeeType', width: 100 }, { title: '工资天数', dataIndex: 'payDays', width: 120, render: (value, row) => <InputNumber min={0} value={value} onChange={next => changeManual(row.employeeNo, 'payDays', next)} aria-label={`${row.name}工资天数`} /> }, { title: '出勤总天数', dataIndex: 'attendanceDays', width: 130, render: (value, row) => <InputNumber min={0} value={value} onChange={next => changeManual(row.employeeNo, 'attendanceDays', next)} aria-label={`${row.name}出勤总天数`} /> }, { title: '提成/绩效', dataIndex: 'bonus', width: 120, render: (value, row) => <Input value={value} onChange={event => changeManual(row.employeeNo, 'bonus', event.target.value)} aria-label={`${row.name}提成绩效`} /> }, { title: '其他额外发放金额', dataIndex: 'extra', width: 150, render: (value, row) => <Input value={value} onChange={event => changeManual(row.employeeNo, 'extra', event.target.value)} aria-label={`${row.name}额外发放`} /> }, { title: '备注', dataIndex: 'note', render: (value, row) => <Input value={value} onChange={event => changeManual(row.employeeNo, 'note', event.target.value)} aria-label={`${row.name}备注`} /> }]} /></div>; }
  if (selected) return <div className="detail-screen"><div className="detail-screen-bar"><div className="detail-screen-main"><button className="detail-back" onClick={() => setSelectedKey('')}>返回项目月度列表</button><div className="detail-screen-kicker">{selected.projectNo} · {selected.month}</div><h1>{selected.projectName}</h1></div><Space>{statusTag(selected.status)}<Tag>{selected.timing}</Tag>{selected.current && <Tag color="blue">当前有效</Tag>}</Space></div>{selected.error && <div className="quote-reject-box"><strong>处理说明</strong><p>{selected.error}</p></div>}<div className="quote-field-grid"><div><small>提交方式</small><strong>{selected.source}</strong></div><div><small>提交时间</small><strong>{selected.submittedAt}</strong></div><div><small>表格链接</small><strong>{selected.link || '—'}</strong></div></div><Space style={{ margin: '12px 0' }}>{['PM', 'PA', 'PMO'].includes(role) && !['待读取', '待审批'].includes(selected.status) && <Button onClick={() => resubmit(selected)}>编辑并重新提交</Button>}{role !== '人事' && selected.status === '待读取' && <Button type="primary" onClick={() => readSheet(selected)}>读取表格</Button>}{role === '人事' && selected.status === '待审批' && <Button type="primary" onClick={() => approve(selected)}>审批通过</Button>}{role === '人事' && ['读取成功', '手工提交成功', '待审批'].includes(selected.status) && selected.timing === '逾期' && <Button danger onClick={() => setRejectKey(selected.key)}>驳回</Button>}</Space><Table rowKey={row => `${row.employeeNo}-${row.state}`} dataSource={selected.rows} pagination={false} scroll={{ x: 1400 }} locale={{ emptyText: <Empty description="尚未读取或录入人员条目" /> }} columns={attendanceFields.map(label => ({ title: label, dataIndex: { 员工编号: 'employeeNo', 人员姓名: 'name', 员工类型: 'employeeType', 项目编号: 'projectNo', 所在项目: 'projectName', 工资天数: 'payDays', 出勤总天数: 'attendanceDays', '提成/绩效': 'bonus', 其他额外发放金额: 'extra', 备注: 'note', 条目状态: 'state' }[label], width: 130, render: label === '条目状态' ? value => <Tag color={value === '有效' ? 'success' : 'error'}>{value}</Tag> : value => value || '—' }))} /><RejectBox open={rejectKey === selected.key} onCancel={() => setRejectKey('')} onSubmit={reason => reject(selected, reason)} /></div>;
  return <><Card variant="borderless" className="trial-work-card"><div className="trial-list-toolbar"><Input prefix={<Search size={14} />} allowClear value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索项目、统计月、PM" aria-label="搜索出勤提报" style={{ width: 260 }} /><Space><span className="trial-permission-chip">{role === '人事' ? '人事审批逾期记录' : 'PM / PA 提交本人负责项目'}</span>{['PM', 'PA', 'PMO'].includes(role) && <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>提交出勤</Button>}</Space></div><Table rowKey="key" dataSource={visible} pagination={false} onRow={record => ({ onClick: event => { if (event.target.closest('button')) return; setSelectedKey(record.key); } })} columns={[{ title: '项目编号', dataIndex: 'projectNo', width: 150 }, { title: '项目名称', dataIndex: 'projectName', width: 180 }, { title: 'PM', dataIndex: 'pm', width: 90 }, { title: '统计月', dataIndex: 'month', width: 100 }, { title: '提交方式', dataIndex: 'source', width: 110 }, { title: '提交时间', dataIndex: 'submittedAt', width: 150 }, { title: '时限', dataIndex: 'timing', width: 80, render: value => <Tag color={value === '按时' ? 'success' : 'warning'}>{value}</Tag> }, { title: '状态', dataIndex: 'status', width: 130, render: statusTag }, { title: '当前有效', dataIndex: 'current', width: 100, render: value => value ? '是' : '否' }, { title: '操作', width: 100, render: (_, record) => <Button type="link" size="small" onClick={() => setSelectedKey(record.key)}>人员条目</Button> }]} /></Card><CreateAttendance open={creating} role={role} onCancel={() => setCreating(false)} onSubmit={submit} /></>;
}

function CreateAttendance({ open, role, onCancel, onSubmit }) {
  const [form] = Form.useForm();
  const source = Form.useWatch('source', form);
  const options = projects.filter(item => role === 'PMO' || item.pm === PM_NAME || (role === 'PA' && item.pa === '林晓彤'));
  return <Modal title="提交出勤" open={open} okText="提交全部人员" onCancel={onCancel} onOk={() => form.validateFields().then(onSubmit)}><p className="modal-help-copy">选择一个项目和一个统计月。手工录入一次提交该项目全部人员，不能只提交一部分。已生效字段不能直接修改。</p><Form form={form} layout="vertical" initialValues={{ source: '在线表格', month: dayjs('2026-09') }}><Form.Item name="projectNo" label="项目" rules={[{ required: true, message: '请选择项目' }]}><Select options={options.map(item => ({ value: item.projectNo, label: `${item.projectNo} · ${item.projectName}` }))} /></Form.Item><Form.Item name="month" label="统计月" rules={[{ required: true, message: '请选择统计月' }]}><DatePicker picker="month" style={{ width: '100%' }} /></Form.Item><Form.Item name="source" label="提交方式"><Segmented options={['在线表格', '手工录入']} /></Form.Item>{source !== '手工录入' && <Form.Item name="link" label="飞书在线表格链接" rules={[{ required: true, message: '请填写表格链接' }]}><Input /></Form.Item>}</Form></Modal>;
}
function RejectBox({ open, onCancel, onSubmit }) {
  const [reason, setReason] = React.useState('');
  return <Modal title="驳回逾期出勤" open={open} okText="确认驳回" okButtonProps={{ danger: true }} onCancel={onCancel} onOk={() => { if (!reason.trim()) { message.warning('请填写驳回原因'); return; } onSubmit(reason.trim()); setReason(''); }}><Input.TextArea rows={3} value={reason} onChange={event => setReason(event.target.value)} placeholder="驳回原因必填" /></Modal>;
}

export function OutputAttendancePage({ role = 'PMO', onRoleChange }) {
  const [tab, setTab] = React.useState('output');
  return <div className="trial-page output-attendance-page"><div className="trial-page-heading"><div><p className="eyebrow">项目管理 · 产出与出勤</p><h1>产出与出勤</h1><p className="subtitle">产出由系统每日自动抓取。出勤按一个项目、一个统计月提交，再查看该项目的人员条目。</p></div><div className="trial-role-switch"><ShieldCheck size={14} /><span>演示身份</span><Select aria-label="演示身份" size="small" value={role} onChange={onRoleChange} options={[{ value: 'PMO', label: 'PMO · 林晓彤' }, { value: 'PM', label: 'PM · 王然' }, { value: 'PA', label: 'PA · 林晓彤' }, { value: '人事', label: '人事 · 周宁' }]} /></div></div><Tabs activeKey={tab} onChange={setTab} className="trial-tabs" items={[{ key: 'output', label: '产出收集', children: <OutputTab role={role} /> }, { key: 'attendance', label: '出勤提报', children: <AttendanceTab role={role} /> }]} /></div>;
}
