export const CONTRACT_FIELDS = ["合同编号", "申请编号", "合同名称", "合同类型", "合同扫描件", "双签合同附件", "合同附件（超链接）", "申请事由", "工位数", "合同状态", "签订日期", "合同开始日期", "合同到期日期", "甲方名称", "乙方名称", "甲方银行账户信息", "乙方银行账户信息（含账号、开户行、名称）", "单价", "数量（面积/台数等）", "合同总金额", "标的物（项目/用途/地点）", "合同主要条款（付款周期/单价/计价方式/付款周期及方式等）", "负责人", "创建人", "创建时间", "最后更新时间", "合同期", "AI提取结果", "合同扫描件附件", "人工已复核", "智能文档处理错误", "智能文档处理文件ID", "智能文档处理状态", "合同月数", "月均费用", "预算科目", "本月费用", "采购发生月份", "采购发生金额", "是否物资采购"];
export function contractProjection(row) {
  return { key: row.key, sourceId: row.sourceId, readAt: row.readAt, readError: row.readError, ...Object.fromEntries(CONTRACT_FIELDS.map(field => [field, row[field]])) };
}
export function mergeContracts(current, incoming) {
  const rows = new Map(current.map(row => [row.sourceId || row.key, contractProjection(row)]));
  const errors = [];
  for (const row of incoming) {
    if (!row.sourceId || row.readError) { errors.push({ sourceId: row.sourceId, reason: row.readError || '缺少源记录身份' }); continue; }
    rows.set(row.sourceId, contractProjection({ ...row, key: row.sourceId }));
  }
  return { rows: [...rows.values()], errors };
}
