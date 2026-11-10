import { dateValid } from './hrPersonnelContracts.js';

const copy = value => JSON.parse(JSON.stringify(value));
const check = (condition, message) => { if (!condition) throw new Error(message); };
const uid = () => `attendance-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
export const monthValid = month => /^\d{4}-(0[1-9]|1[0-2])$/.test(month || '');
export const previousMonth = day => new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
export const attendanceDays = hours => Number.isFinite(hours) ? (hours / 8).toFixed(3) : '未读取';

export function validateAttendanceSource(rows, people, month) {
  const normalized = [], issues = [], seen = new Map();
  for (const source of rows) {
    const person = people.find(person => person.id === source.personId && person.employeeNo === source.employeeNo);
    const issue = reason => issues.push({ personId: person?.id || '', employeeNo: source.employeeNo || '', date: source.date || '', sourceId: source.id || '', reason });
    if (!person || !source.id) { issue('人员稳定标识或来源记录无法可靠匹配'); continue; }
    if (!dateValid(source.date) || source.date.slice(0, 7) !== month) { issue('考勤日期无效或不属于本次月份'); continue; }
    const rate = { hours: 1, minutes: 1 / 60, seconds: 1 / 3600 }[source.unit];
    if (!rate || typeof source.duration !== 'number' || !Number.isFinite(source.duration) || source.duration < 0) { issue('来源时长或单位无效，未以零覆盖'); continue; }
    const row = { personId: person.id, employeeNo: person.employeeNo, sourceId: source.id, sourcePersonId: source.sourcePersonId || person.id, date: source.date, originalDuration: source.duration, unit: source.unit, hours: source.duration * rate };
    const key = `${person.id}:${source.date}`;
    if (seen.has(key)) {
      const existing = seen.get(key);
      if (!existing || existing.hours !== row.hours || existing.sourcePersonId !== row.sourcePersonId) {
        issue('同一人员同一考勤日来源冲突，保留上次成功值');
        seen.set(key, null);
      }
    } else seen.set(key, row);
  }
  for (const row of seen.values()) if (row) normalized.push(row);
  return { records: normalized, issues };
}

function readSnapshot(state, month, method, actor, readAt, expectedVersion) {
  const store = state.hrAttendance;
  const before = store.months[month];
  check(expectedVersion == null || expectedVersion === (before?.version || 0), '考勤月份版本已变化，请重新读取');
  const source = store.sources[month];
  check(source, '当前月份尚无可读取的来源快照，飞书接口待接入');
  check(!before || Number(source.version) >= Number(before.sourceVersion), '来源版本早于当前成功结果，已保留当前数据');
  const batch = { id: uid(), month, method, actor, readAt, source: source.source, sourceVersion: source.version, status: '读取成功' };
  if (source.error) {
    batch.status = '读取异常'; batch.error = source.error;
    store.batches.unshift(batch);
    if (before) before.lastError = source.error;
    return batch;
  }
  const { records, issues } = validateAttendanceSource(source.rows, state.people, month);
  const key = row => `${row.personId}:${row.date}`;
  const merged = new Map((before?.records || []).map(row => [key(row), { ...copy(row), retained: true }]));
  for (const row of records) merged.set(key(row), row);
  for (const expected of source.expected || []) {
    if (!records.some(row => row.personId === expected.personId && row.date === expected.date)) issues.push({ personId: expected.personId, date: expected.date, reason: '来源缺少该日有效记录，保留上次成功值' });
  }
  const changes = [...merged.values()].filter(row => {
    const old = before?.records.find(previous => key(previous) === key(row));
    return !old || old.hours !== row.hours;
  }).map(row => ({ personId: row.personId, date: row.date, before: before?.records.find(previous => key(previous) === key(row))?.hours ?? null, after: row.hours }));
  const snapshot = {
    version: (before?.version || 0) + 1, month, records: [...merged.values()], issues, changes, readAt, method, actor,
    batchId: batch.id, source: source.source, sourceVersion: source.version, complete: source.complete === true && issues.length === 0,
    coverageEnd: source.coverageEnd || '', lastError: '',
  };
  batch.status = snapshot.complete ? '读取成功' : '部分数据待核对';
  batch.snapshot = copy(snapshot);
  store.batches.unshift(batch);
  store.months[month] = snapshot;
  if (method === '3日自动读取' && !store.originals[month]) store.originals[month] = copy(snapshot);
  return batch;
}

export function ensureHrAttendance(state, day) {
  state.hrAttendance ||= { version: 1, months: {}, originals: {}, batches: [], sources: {} };
  if (state.hrAttendance.previewVersion >= 1) return;
  const people = state.people.filter(person => ['hr-1', 'hr-2', 'hr-4'].includes(person.id) && person.sourceId === `demo-source-${person.id}`);
  const months = [previousMonth(day), day.slice(0, 7)];
  for (const month of months) {
    const rows = people.flatMap((person, index) => Array.from({ length: index === 1 ? 10 : 2 }, (_, offset) => ({
      id: `feishu-attendance-snapshot:${month}:${person.id}:${offset}`, personId: person.id, employeeNo: person.employeeNo,
      sourcePersonId: `source:${person.id}`, date: `${month}-${String(offset + 1).padStart(2, '0')}`,
      duration: index === 1 ? 8 : offset === 0 ? 8 : 1, unit: 'hours',
    })).filter(row => row.date <= day));
    if (people[0] && `${month}-03` <= day) rows.push({ id: `feishu-zero:${month}`, personId: people[0].id, employeeNo: people[0].employeeNo, date: `${month}-03`, duration: 0, unit: 'hours' });
    state.hrAttendance.sources[month] ||= { source: '飞书统计时长快照', version: 1, rows, expected: rows.map(row => ({ personId: row.personId, date: row.date })), complete: true, coverageEnd: month === day.slice(0, 7) ? day : new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10) };
  }
  if (Number(day.slice(-2)) >= 3 && people.length && !state.hrAttendance.months[months[0]]) {
    readSnapshot(state, months[0], '3日自动读取', '系统', `${day.slice(0, 7)}-03`);
    // A later source correction makes the re-read difference operable.
    const source = state.hrAttendance.sources[months[0]];
    const corrected = source.rows.find(row => row.personId === people[0].id && row.duration === 1);
    if (corrected) { corrected.duration = 2; source.version = 2; }
  }
  state.hrAttendance.previewVersion = 1;
}

export function projectHrAttendance(state, people, month, personId, includeUnmatched = false) {
  const store = state.hrAttendance;
  const latest = store.months[month];
  const ids = new Set(people.filter(person => !personId || person.id === personId).map(person => person.id));
  const projectSnapshot = snapshot => snapshot ? {
    ...copy(snapshot), records: snapshot.records.filter(row => ids.has(row.personId)), issues: snapshot.issues.filter(row => ids.has(row.personId) || includeUnmatched && !personId && !row.personId),
    changes: snapshot.changes.filter(row => ids.has(row.personId)),
  } : null;
  const latestSafe = projectSnapshot(latest);
  return {
    month, version: latest?.version || 0, latest: latestSafe, original: projectSnapshot(store.originals[month]),
    rows: people.filter(person => ids.has(person.id)).map(person => {
      const daily = latestSafe?.records.filter(row => row.personId === person.id) || [];
      const issues = latestSafe?.issues.filter(row => row.personId === person.id) || [];
      const hours = daily.length ? daily.reduce((total, row) => total + row.hours, 0) : null;
      return { personId: person.id, name: person.name, employeeNo: person.employeeNo, hours, days: attendanceDays(hours), daily,
        status: !latest ? '未读取' : issues.length ? '部分数据待核对' : !daily.length ? '未取得人员记录' : '已读取',
        issues, readAt: latest?.readAt || '', coverageEnd: latest?.coverageEnd || '' };
    }),
    batches: store.batches.filter(batch => batch.month === month).map(batch => ({
      id: batch.id, method: batch.method, actor: batch.actor, readAt: batch.readAt, status: batch.status, error: batch.error || '',
      snapshot: projectSnapshot(batch.snapshot),
    })),
  };
}

export function applyHrAttendanceAction(state, role, type, payload, day) {
  if (type !== 'attendance.read') return false;
  check(['人事', 'HR'].includes(role), '仅人事可同步或重读考勤');
  check(monthValid(payload.month) && payload.month <= day.slice(0, 7), '请选择有效且不晚于本月的月份');
  ensureHrAttendance(state, day);
  const batch = readSnapshot(state, payload.month, payload.month === day.slice(0, 7) ? '本月手动同步' : '历史月份重读', role, new Date().toISOString(), payload.expectedMonthVersion);
  state.audit.unshift({ id: uid(), actor: role, type, objectId: payload.month, at: batch.readAt, result: batch.status, reason: batch.error || '读取本地来源快照；真实飞书服务待接入', before: null, after: { batchId: batch.id, month: payload.month, method: batch.method } });
  return true;
}
