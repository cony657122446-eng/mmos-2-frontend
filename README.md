# MMOS 2.0 前端演示包

## 当前版本 · 2026-10-26

- 经营看板：环比及比较明细、趋势独立项目配置、项目金额/利润率图按经理筛选、详细周报及PM待核对联动。
- PMO待办分为「我的待办」「项目经理待办列表」，后者支持按经理筛选；PM仅见本人事项。
- 财务工作台保留「财务概览」「经营看板」双页签。财务概览包含实际收入、实际支出、收支净额及趋势/支出构成/付款人排行；支持期间筛选和日记账追溯。
- 财务可查看公司全部经营图表和周报并配置图表项目，不显示待核对事项卡和经营异常提醒横幅；周报编辑及审批仍按原角色职责。
- 当前为浏览器本地模拟数据与演示角色，真实后端、鉴权及同步服务尚未接入。财务概览未修改或导入飞书远端财务记录。

详细交互说明见 [经营看板](OPERATIONS-PREVIEW.md) 和 [财务工作台](FINANCE-DASHBOARD.md)，后续修订以各文档末尾最新记录为准。

## 目录

- `src/`：React 页面、组件、交互逻辑和示例数据
- `public/`：公司 Logo 等静态资源
- `dist/`：已构建的 Vite 静态产物
- `package.json` / `package-lock.json`：依赖和启动脚本
- `BRAND_BASELINE.md`：品牌视觉基线

## 启动开发环境

```powershell
npm install
npm run dev
```

打开 `http://localhost:8080/`。

页面入口：`?page=overview`、`?page=requirements`、`?page=projects`、`?page=initiation`、`?page=trial`、`?page=todos`。

## 构建预览

```powershell
npm run build
npm run preview
```

压缩包不包含 `node_modules`；解压后执行 `npm install` 即可恢复依赖。

## 财务交互版本 · 2026-10-21

财务七个菜单、客户开票资料、同客户合票、回款分配、季度职位成本、审批与兼职结算、合同查询均可交互。进入财务身份页面会自动填入模拟测试数据；修改保存在当前浏览器。真实飞书/人事等接口仍待接入。

测试：`node --test src/data/*.test.js`。详见 [模拟操作说明](FINANCE-DEMO.md) 和 [财务对齐记录](FINANCE-DOC-ALIGNMENT.md)。测试发票附件：[demo-invoice.pdf](public/demo-invoice.pdf)。
