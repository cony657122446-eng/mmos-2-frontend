# MMOS 2.0 前端品牌基线

版本：V2.0（2026-10-22）

本版依据用户提供的 `erp-light-theme.css`、正式 SVG Logo 和珍珠白 / 天空蓝规范，替代 V1.1 中深色侧栏与蓝紫主色的旧方向。

## 品牌资产

- 正式 Logo：`public/mmos-2.0-logo.svg`，与 `../outputs/branding/mmos-2.0-logo.svg` 完全一致。
- 保留完整条带图标、MUCHEN 字标和 Management OS 副标题，保持 SVG 比例与轮廓，不重新排字。
- 透明 SVG 直接置于浅色导航，无额外白色承托块。
- Logo SHA256：`BFD4EA78EDF978C5F951111862F041C955477B2105BE66569ACC181C8B382D15`。

## 当前视觉方向

85% 简洁企业软件 + 15% 柔和科技视觉；珍珠白底、天空蓝主色、低饱和青色辅助、少量紫色。避免大面积渐变、霓虹、重阴影和装饰性业务数据。

| 类别 | Token / 值 |
|---|---|
| 页面 / 光晕 | `#F4F8FE` / `#E9F3FD` |
| 卡片 / 浅底 | `#FFFFFF` / `#F8FBFF` |
| 蓝 / 青 / 紫 | `#3579F6` / `#2FC6D4` / `#7761F5` |
| 成功 / 警告 / 错误 | `#15B88A` / `#F5A442` / `#F06570` |
| 正文 / 强调 | `#192A46` / `#101D33` |
| 原始次级文字 | `#72839F`，小字号说明使用可读性更强的 `#5E718F` |
| 边框 / 分隔 | `#E7EFF9` / `#EEF3FA` |
| 侧栏 / 顶栏 | 224px / 64px |
| 卡片 / 控件圆角 | 16px / 8px |

当前导航和主要按钮使用略深的蓝色渐变（`#2868DB` → `#3274E8`），保证白色文字对比度；普通链接使用 `#2268E8`。成功、警告、危险标签使用浅色底及相应深色文字，并保留明确标签。

## 实现入口

- `src/theme/erp-light-theme.css`：原样保存的用户 CSS，作为 token 来源。
- `src/theme/mmos-theme.css`：限定于 `.mmos-erp-theme` 的现有组件兼容层。
- `src/theme/ThemeProvider.jsx`：Ant Design 主题、静态弹层主题、显示密度；ECharts 从相同 CSS token 读取配色。
- `index.html` 的 body 加作用域，使挂载到 body 的弹窗、日期面板和消息也能使用主题。
- 字体：Inter、PingFang SC、Microsoft YaHei、Noto Sans CJK SC、系统无衬线；数字使用 tabular-nums。未新增外部字体下载依赖。
- “紧凑 / 舒适”仅控制显示密度，表格上下内边距为 10px / 14px，存储键 `mmos.ui.density.v1`。

## 延续规则

后续页面沿用此主题、Logo 与现有 React / Ant Design / ECharts 技术栈。保留路由、权限、操作顺序、业务字段与存储契约。移动端使用折叠导航和表格内滚动；窄屏固定操作列解除固定，避免覆盖业务列。

验证与限制见 [THEME-CHANGELOG.md](THEME-CHANGELOG.md)。
