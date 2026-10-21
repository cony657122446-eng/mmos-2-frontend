import { invoiceNumber } from './invoiceFields.js';
export function quarterMonths(year, quarter) { return [1, 2, 3].map(offset => `${year}-${String((quarter - 1) * 3 + offset).padStart(2, '0')}`); }
export function applyCostBatch(costs, edits, mode, positions) {
  let rows = [...costs]; const results = [];
  for (const edit of edits) {
    const previous = rows.find(row => row.positionId === edit.positionId && row.month === edit.month);
    const position = positions.find(row => row.key === edit.positionId);
    let error = '';
    if (!position && mode !== 'delete') error = '人事职位来源无效';
    else if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(edit.month)) error = '月份无效';
    else if (mode !== 'delete' && (invoiceNumber(edit.daily) == null || Number(edit.daily) < 0)) error = '整日成本须为有效非负数';
    else if (mode === 'add' && previous) error = '该职位月份已存在，新增不会覆盖';
    else if (mode !== 'add' && !previous) error = '记录已不存在';
    else if (mode !== 'add' && edit.original != null && Number(edit.original) !== Number(previous.daily)) error = '记录已变化，请重新读取';
    if (!error) {
      rows = rows.filter(row => row !== previous);
      if (mode !== 'delete') rows.push({ key: previous?.key || `${edit.positionId}:${edit.month}`, positionId: edit.positionId, position: position.name, month: edit.month, daily: Number(edit.daily) });
    }
    results.push({ ...edit, result: error || '成功', success: !error });
  }
  return { rows, results };
}
