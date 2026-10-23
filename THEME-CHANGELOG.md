# 珍珠白 / 天空蓝主题交付

日期：2026-10-22。预览：[本地前端](http://localhost:8080/?page=overview)。

## 变更清单

| 文件 | 内容 |
|---|---|
| `src/theme/erp-light-theme.css` | 原样接入用户 CSS，集中定义颜色、布局和圆角变量 |
| `src/theme/mmos-theme.css` | 浅色 AppShell、卡片、状态、表单、表格、详情与响应式兼容样式 |
| `src/theme/ThemeProvider.jsx` | Ant Design token、静态弹层、紧凑/舒适显示偏好；提供图表颜色读取 |
| `src/main.jsx`、`index.html` | 挂载主题与样式作用域、更新浏览器主题色 |
| `src/components/AppShell.jsx` | 顶部显示密度切换；导航当前页辅助语义；保留原 SVG 与菜单权限逻辑 |
| `src/components/OverviewPage.jsx` | 白色 tooltip，蓝/青/紫序列，清晰轴线与标签；手机标签角度、减弱动画偏好 |
| `src/styles.css` | 移除外部 Google 字体导入，原字体名称改用 Inter；原结构样式保留 |
| `FinanceWorkspacePage.jsx`、`FinanceSources.jsx`、`FinanceJournal.jsx`、`FinanceCosts.jsx`（均位于 `src/components/`） | 财务金额、成本及结算数量列右对齐 |
| `src/components/FinanceFile.jsx` | 附件说明使用统一次级文字色 |
| `BRAND_BASELINE.md` | V2.0 品牌基线替代旧深色方案 |

未新增组件库。Logo 的 public 文件与用户指定 SVG 的 SHA256 完全一致；CSS 副本 SHA256 为 `E7631B6A72268338B13B57CA43F828613079342112AC6D48EBC9EC69C06A3EC3`，与 Downloads 原文件一致。业务数据、路由分支、权限判断和接口契约未改动。

## 验证结果

| 检查 | 结果与范围 |
|---|---|
| 生产构建 | `npm run build` 通过；保留既有大包提示，JS 约 2.63MB，gzip 约 838KB |
| 数据回归 | `node --test src/data/*.test.js`：25/25 通过 |
| 本地服务 | 8080 返回 HTTP 200；浏览器实际渲染已检查 |
| 页面覆盖 | 总览、需求、项目主库、立项、试标、报价、产出出勤、验收、财务七模块均检查；现有待办使用同一基础组件主题 |
| 导航与权限 | 手机导航展开、选择页面后收起；PMO 财务菜单仅两项；刷新后 PMO 进入发票页显示权限提示；财务角色显示七项 |
| 搜索 / 分类 / 分页 | 项目搜索“星河”返回 1 条，分页可进入第 2 页；发票“待开票”与 `DEMO-YS-001` 搜索组合返回 1 条 |
| 公共弹层 | 字段配置弹窗、角色下拉、日期弹层可打开关闭且主题一致 |
| 显示密度 | 舒适行内边距 14px，紧凑 10px；刷新保持所选密度；结束时恢复紧凑 |
| 财务详情 | 项目、开票等分类切换与全部内容编辑可用；编辑仍在详情中 |
| 校验 / 取消 | 清空模拟发票含税金额并保存，出现“含税金额必填”；恢复并取消后原金额 12,000 和原附件状态保留 |
| 上传 / 下载 | 编辑态选择本地 PNG 后显示文件名及预览入口，随后取消、未保存附件；项目 CSV 导出成功且读取为 8 行 |
| 图表 | 当月筛选更新统计；自定义日期入口可展开；点击柱体显示阶段名和数量 tooltip |
| 响应式 | 1440、1280、1024、390px 检查；1024 项目 4 指标同排；390 财务页文档无横向溢出，宽表仅在内部滚动、固定列解除固定 |
| 运行状态 | 完整刷新财务页无运行错误；开发期间有既存 AntD deprecated API 提示以及入口热更新 createRoot 提示，刷新后后者不再出现 |

## 重要页面截图

- [经营总览（桌面）](../outputs/theme-20261022/overview-desktop.png)
- [项目主库（桌面）](../outputs/theme-20261022/projects-desktop.png)
- [发票与回款（桌面）](../outputs/theme-20261022/finance-invoices-desktop.png)
- [发票详情（桌面）](../outputs/theme-20261022/finance-detail-desktop.png)
- [发票编辑（桌面）](../outputs/theme-20261022/finance-editor-desktop.png)
- [客户台账（桌面）](../outputs/theme-20261022/customers-desktop.png)
- [职位成本（桌面）](../outputs/theme-20261022/costs-desktop.png)
- [经营总览（手机）](../outputs/theme-20261022/overview-mobile.png)
- [财务列表（手机）](../outputs/theme-20261022/finance-invoices-mobile.png)
- [发票详情（手机）](../outputs/theme-20261022/finance-detail-mobile.png)
- [图表提示框](../outputs/theme-20261022/chart-tooltip-desktop.png)
- [日期控件](../outputs/theme-20261022/date-picker-desktop.png)

## 已知限制

- 当前仍是本地交互演示。未接入真实登录、后端鉴权、飞书数据接口和生产文件服务；相应生产流程无法在本次验证。
- 总览继续使用已有的演示数据；本次未新增任何参考图中的订单、销售或地图概念数据，也未改变统计业务口径。
- 原有全局搜索、需求列表搜索/筛选、部分总览快捷按钮属于展示入口，没有完整处理逻辑。已实际确认需求搜索未筛选，并核对其原代码未绑定状态；本次视觉改造保留现状。
- 现有表格未提供列排序配置；排序和不存在的 AI 助手不能作为已验证功能。有效业务提交主要由 25 项数据回归覆盖，浏览器检查了失败校验与取消，未为验收新建或改写业务记录。
- 未打包 Inter 字体，按设备字体列表回退；不同操作系统的中文字形可能略有不同。
- 旧组件仍使用 Ant Design 已弃用的部分属性；这属于后续兼容性整理，不影响本次构建和可见操作。
- 主题和下述折叠修复已纳入 2026-10-23 GitHub 同步版本；截图仍保存在本地 outputs 目录，未作为源代码资产上传。

## 连续性记录

本轮已更新 Wiki 的主题来源页、MMOS 项目状态、Logo 历史说明和索引，并新增主题适配候选经验。Wiki 健康检查 0 错误；68 项历史格式/候选提醒和本轮 1 项候选经验提醒保留，未扩展为全库整理。

## 2026-10-23 项目管理折叠修复

原网格折叠仅改变透明度，多个子按钮的隐式行仍占高度。现对关闭的 `.subnav` 使用 `display:none`，同时移除隐藏按钮的键盘焦点。浏览器验证收起高度为 0，重新展开显示 5 项，重新收起仍无留白；生产构建通过。
