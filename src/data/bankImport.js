import { banks, money, accountBalance } from './bankJournal.js';
const header = v => String(v ?? '').split('[')[0].trim();
const str = v => v == null ? '' : String(v).trim();
const number = v => { const text = str(v).replace(/[,，￥¥\s]/g, ''); if (!text) return 0; if (!/^-?\d+(\.\d{1,2})?$/.test(text)) return NaN; return Number(text); };
const dateValue = v => {
  if (v instanceof Date) return v.toISOString().slice(0,10);
  const match = str(v).match(/^(\d{4})[-/.年]?(\d{2})[-/.月]?(\d{2})/);
  if (!match) return '';
  const result = `${match[1]}-${match[2]}-${match[3]}`;
  return !Number.isNaN(Date.parse(result)) && new Date(result).toISOString().slice(0,10) === result ? result : '';
};
export function parseBankRows(grid, account, fileName = '银行流水.xlsx', sheet = 'Sheet1') {
  let headerIndex = -1, kind = '';
  for (let i = 0; i < Math.min(grid.length, 40); i++) {
    const cells = grid[i].map(header);
    if (cells.includes('借方金额') && cells.includes('贷方金额')) kind = banks[3];
    else if (cells.includes('转入金额') && cells.includes('转出金额')) kind = banks[2];
    else if (cells.includes('收入金额') && cells.includes('支出金额')) kind = banks[1];
    else if (cells.includes('交易金额') && cells.some(x => x.includes('付款人')) && cells.some(x => x.includes('收款人'))) kind = banks[0];
    if (kind) { headerIndex = i; break; }
  }
  if (headerIndex < 0) throw new Error('未识别四家银行的已核验表头，请核对工作表及文件格式');
  if (account.bank !== kind) throw new Error(`文件识别为${kind}，与所选银行不一致`);
  const headers = grid[headerIndex].map(header);
  const col = (row, labels, fallback) => { const index = headers.findIndex(h => labels.includes(h)); return row[index < 0 ? fallback : index]; };
  const warnings = [];
  if (kind === banks[2]) warnings.push('工商银行文件未提供本方账号和币种，请确认归属所选人民币账户。凭证号不参与明确去重。');
  const rows = grid.slice(headerIndex + 1).flatMap((r, offset) => {
    if (!r.some(v => str(v))) return [];
    let date, time = '', income = 0, expense = 0, payer, counterAccount, own, currency, balance, bankId, summary, purpose, note;
    if (kind === banks[0]) {
      date = col(r, ['交易日期'], 10); time = col(r,['交易时间'],11);
      const amount = number(col(r,['交易金额'],13)); income = amount > 0 ? amount : 0; expense = amount < 0 ? -amount : 0;
      if (Number.isNaN(amount)) income = NaN;
      payer = col(r, income > 0 ? ['付款人名称','付款人户名'] : ['收款人名称','收款人户名'], income > 0 ? 5 : 9);
      counterAccount = col(r, income > 0 ? ['付款人账号'] : ['收款人账号'], income > 0 ? 4 : 8);
      own = col(r, ['查询账号','本方账号','查询账户'], -1) || col(r, income > 0 ? ['收款人账号'] : ['付款人账号'], income > 0 ? 8 : 4);
      balance = col(r,['交易后余额','余额'],14); bankId = col(r,['交易流水号'],17) || col(r,['记录标识号'],22);
      summary = col(r,['摘要'],23); purpose = col(r,['用途'],24); note = [col(r,['备注'],26),col(r,['交易附言','附言'],25)].map(str).filter(Boolean).join('；'); currency = col(r,['交易货币','币种'],12);
    } else if (kind === banks[1]) {
      date = col(r,['交易日期'],2); time = str(date).split(/[ T]/)[1] || ''; income = number(col(r,['收入金额'],4)); expense = number(col(r,['支出金额'],5));
      own = col(r,['交易账号'],7); currency = col(r,['币种'],3); balance = col(r,['余额'],6); bankId = col(r,['交易流水号'],1);
      payer = col(r,['对方账户名','对方户名'],9); counterAccount = col(r,['对方账号'],10); purpose = col(r,['用途'],12); note = col(r,['备注'],13); summary = col(r,['摘要'],14);
    } else if (kind === banks[2]) {
      date = col(r,['交易时间'],2); time = str(date).split(/[ T]/)[1] || ''; income = number(col(r,['转入金额'],3)); expense = number(col(r,['转出金额'],4));
      balance = col(r,['余额'],5); payer = col(r,['对方单位'],6); counterAccount = col(r,['对方账号'],1); purpose = col(r,['用途'],7); summary = col(r,['摘要'],8); note = col(r,['附言'],9);
    } else {
      own = col(r,['账号'],0); currency = col(r,['币种'],2); date = col(r,['交易日','交易日期'],3); time = col(r,['时间'],4);
      expense = number(col(r,['借方金额'],7)); income = number(col(r,['贷方金额'],8)); balance = col(r,['余额'],9); bankId = col(r,['流水号'],11);
      payer = col(r,['收付方名称'],19); counterAccount = col(r,['收付方账号'],20); purpose = col(r,['用途'],14); summary = col(r,['摘要'],10);
      note = [col(r,['业务摘要'],16),col(r,['其它摘要'],17),col(r,['扩展摘要'],30)].map(str).filter(Boolean).join('；');
    }
    if (r.some(v => /^(合计|总计|本页合计)$/.test(str(v)))) return [];
    const day = dateValue(date), errors = [];
    if (!day) errors.push('交易日期无法识别');
    if (!Number.isFinite(income) || !Number.isFinite(expense) || income < 0 || expense < 0 || Number(income > 0) + Number(expense > 0) !== 1) errors.push('须为单向有效正金额');
    if (own && str(own).replace(/\s/g,'') !== account.number.replace(/\s/g,'')) errors.push('本方账号与所选账户不符');
    if (currency && !['CNY','人民币','RMB','人民币元','01'].includes(str(currency).toUpperCase())) errors.push('本期仅支持人民币');
    const line = headerIndex + offset + 2;
    return [{ line, sheet, date: day, time: str(time), income, expense, payer: str(payer), counterAccount: str(counterAccount), accountId: account.key, bankId: str(bankId), bankBalance: str(balance) === '' ? null : number(balance), summary: [summary,purpose,note].map(str).filter(Boolean).join(' / '), purpose: str(purpose), note: str(note), raw: Object.fromEntries(headers.map((h,i) => [h || `列${i+1}`,str(r[i])])), error: errors.join('；'), sourceFingerprint: `${account.key}:${kind}:${sheet}:${line}:${JSON.stringify(r)}` }];
  });
  if (!rows.length) throw new Error('没有发现交易明细');
  if (kind === banks[3]) warnings.push('仅按文件实际明细解析；请核对顶部汇总笔数与明细数量，文件可能只包含部分期间。');
  if (rows.some(r => !r.time)) warnings.push('部分记录没有交易时间，余额比较显示未核对，不以任意排序推定一致。');
  return { rows, bank: kind, fileName, warnings, needsAccountConfirm: kind === banks[2] || kind === banks[0] && rows.some(r => !r.raw['查询账号'] && !r.raw['本方账号']) };
}
export async function readBankFile(file, account, state) {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('请选择银行导出的xlsx文件');
  if (file.size > 20 * 1024 * 1024) throw new Error('预览版支持20MB以内文件');
  const Excel = await import('exceljs');
  const workbook = new (Excel.default || Excel).Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  let preview, lastError;
  for (const sheet of workbook.worksheets) {
    const grid = [];
    sheet.eachRow({ includeEmpty: true }, row => { const cells = []; for (let i=1;i<=sheet.columnCount;i++) { const c=row.getCell(i); cells.push(c.value instanceof Date ? c.value : c.text); } grid.push(cells); });
    try { preview = parseBankRows(grid, account, file.name, sheet.name); break; } catch(error) { lastError=error; }
  }
  if (!preview) throw lastError || new Error('工作簿没有可读工作表');
  // Only compare a fully ordered new sequence after the last existing transaction.
  const ordered = preview.rows.filter(r=>!r.error).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const latest = state.journal.filter(r=>r.accountId===account.key).map(r=>r.date+(r.time||'23:59:59')).sort().at(-1) || account.openingDate;
  if (new Set(ordered.map(r=>r.date+r.time)).size===ordered.length && account.openingDate && ordered.every(r=>r.time && r.date>=account.openingDate) && ordered.length && ordered[0].date+ordered[0].time>latest) {
    let balance=accountBalance(state,account);
    for(const row of ordered) { balance=money(balance+row.income-row.expense); if(Number.isFinite(row.bankBalance)&&row.bankBalance!==null) { row.systemBalance=balance; row.balanceDifference=money(row.bankBalance-balance); } }
  }
  return preview;
}
