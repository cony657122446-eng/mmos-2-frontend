# MMOS 2.0 前端演示包

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

打开 `http://localhost:5173/`。

页面入口：`?page=overview`、`?page=requirements`、`?page=projects`、`?page=initiation`、`?page=trial`、`?page=todos`。

## 构建预览

```powershell
npm run build
npm run preview
```

压缩包不包含 `node_modules`；解压后执行 `npm install` 即可恢复依赖。
