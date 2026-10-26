import dayjs from 'dayjs';

const cents = value => value === '' || value == null ? 0 : typeof value === 'number' || typeof value === 'string' ? Math.round(Number(value) * 100) : NaN;
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && dayjs(value).isValid() && dayjs(value).format('YYYY-MM-DD') === value;
const asMoney = values => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value / 100]));

export function journalRange(period, today) {
  if (period === 'all') return null;
  const date = dayjs(today);
  return [period === 'recent' ? date.subtract(2, 'month').startOf('month').format('YYYY-MM-DD') : date.startOf(period === 'year' ? 'year' : 'month').format('YYYY-MM-DD'), today];
}

export function summarizeJournal(journal, { range = null, payer = 'all', grain = 'month' } = {}) {
  const excluded = [], entries = [];
  let openingCount = 0;
  for (const row of journal) {
    if (row.opening) { openingCount++; continue; }
    if (payer !== 'all' && row.payer !== payer) continue;
    if (!validDate(row.date)) { excluded.push({ ...row, reason: '日期缺失或无效，无法归入期间' }); continue; }
    if (range && (row.date < range[0] || row.date > range[1])) continue;
    const income = cents(row.income), expense = cents(row.expense);
    if (![income, expense].every(n => Number.isSafeInteger(n) && n >= 0) || income > 0 && expense > 0) {
      excluded.push({ ...row, reason: '收支金额无效或同时存在收入和支出' }); continue;
    }
    if (!income && !expense) continue;
    const amount = income || expense;
    const links = row.allocations || [];
    const invalidLinks = !Array.isArray(links) || links.some(link => !Number.isSafeInteger(cents(link?.amount)) || cents(link?.amount) <= 0);
    const allocated = invalidLinks ? 0 : links.reduce((sum, link) => sum + cents(link.amount), 0);
    const allocationIssue = invalidLinks || allocated > amount;
    entries.push({ ...row, income: income / 100, expense: expense / 100, amount: amount / 100, direction: income ? '收入' : '支出',
      linked: allocationIssue ? 0 : allocated / 100, unlinked: allocationIssue ? 0 : (amount - allocated) / 100,
      allocationIssue, allocationPending: allocationIssue ? amount / 100 : 0 });
  }
  const totals = { income: 0, expense: 0, linked: 0, unlinked: 0, allocationPending: 0 };
  const buckets = new Map(), expenseTypes = new Map(), incomePayers = new Map();
  for (const row of entries) {
    for (const key of Object.keys(totals)) totals[key] += cents(row[key]);
    const bucketKey = grain === 'day' ? row.date : row.date.slice(0, 7);
    const bucket = buckets.get(bucketKey) || { income: 0, expense: 0 };
    bucket.income += cents(row.income); bucket.expense += cents(row.expense); buckets.set(bucketKey, bucket);
    if (row.income) incomePayers.set(row.payer || '未填写付款人', (incomePayers.get(row.payer || '未填写付款人') || 0) + cents(row.income));
    if (row.expense) {
      if (row.allocationIssue) expenseTypes.set('关联待核对', (expenseTypes.get('关联待核对') || 0) + cents(row.expense));
      else {
        for (const link of row.allocations || []) { const name = link.type || '其他已关联'; expenseTypes.set(name, (expenseTypes.get(name) || 0) + cents(link.amount)); }
        if (row.unlinked) expenseTypes.set('未关联支出', (expenseTypes.get('未关联支出') || 0) + cents(row.unlinked));
      }
    }
  }
  const groups = map => [...map].map(([name, value]) => ({ name, value: value / 100 })).sort((a, b) => b.value - a.value);
  const trends = [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, ...asMoney(value), net: (value.income - value.expense) / 100 }));
  return { rows: entries.sort((a, b) => b.date.localeCompare(a.date)), excluded, openingCount,
    totals: { ...asMoney(totals), net: (totals.income - totals.expense) / 100, count: entries.length }, trends,
    expenseTypes: groups(expenseTypes), incomePayers: groups(incomePayers) };
}
