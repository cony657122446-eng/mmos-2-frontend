import React from 'react';
import { ConfigProvider } from 'antd';

const DensityContext = React.createContext({ density: 'compact', setDensity: () => {} });
export const useDisplayDensity = () => React.useContext(DensityContext);
export function readErpTokens() {
  const css = getComputedStyle(document.documentElement);
  const value = name => css.getPropertyValue(`--erp-${name}`).trim();
  return { primary: value('primary'), cyan: value('cyan'), purple: value('purple'), green: value('green'), orange: value('orange'), red: value('red'), text: value('text'), strong: value('text-strong'), border: value('border'), divider: value('divider'), surface: value('surface'), soft: value('surface-soft'), bg: value('bg'), grid: value('chart-grid') };
}
const fontFamily = 'Inter, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif';
function buildTheme(density) {
  const c = readErpTokens();
  return {
    token: { colorPrimary: c.primary, colorInfo: c.primary, colorSuccess: c.green, colorWarning: c.orange, colorError: c.red, colorText: c.text, colorTextHeading: c.strong, colorTextSecondary: '#5E718F', colorTextDescription: '#5E718F', colorBorder: c.border, colorBorderSecondary: c.divider, colorBgContainer: c.surface, colorBgLayout: c.bg, colorBgElevated: c.surface, colorLink: '#2268E8', fontFamily, fontSize: 14, fontSizeSM: 12, borderRadius: 8, borderRadiusLG: 16, controlHeight: 36, boxShadow: '0 6px 24px rgba(34,91,170,.045)', boxShadowSecondary: '0 8px 28px rgba(34,91,170,.12)', motion: !window.matchMedia('(prefers-reduced-motion: reduce)').matches },
    components: {
      Card: { bodyPadding: 20, headerPadding: 20, headerFontSize: 16, headerHeight: 56 },
      Table: { headerBg: '#F2F7FD', headerColor: c.text, borderColor: c.divider, rowHoverBg: c.soft, rowSelectedBg: '#EAF2FF', rowSelectedHoverBg: '#DFEBFE', cellPaddingBlock: density === 'compact' ? 10 : 14, cellPaddingInline: 12, cellFontSize: 13 },
      Button: { primaryShadow: 'none', defaultShadow: 'none', fontWeight: 500 },
      Input: { activeShadow: '0 0 0 3px rgba(53,121,246,.10)' },
      InputNumber: { activeShadow: '0 0 0 3px rgba(53,121,246,.10)' },
      Select: { optionSelectedBg: '#EAF2FF' },
      Segmented: { trackBg: '#F0F5FC', itemSelectedColor: '#2268E8', itemSelectedBg: '#FFFFFF' },
      Tabs: { itemColor: '#5E718F', itemSelectedColor: '#2268E8', itemHoverColor: c.primary, titleFontSize: 14 },
      Descriptions: { labelBg: c.soft },
    },
  };
}
export function ThemeProvider({ children }) {
  const [density, setDensity] = React.useState(() => { try { return localStorage.getItem('mmos.ui.density.v1') === 'comfortable' ? 'comfortable' : 'compact'; } catch { return 'compact'; } });
  const theme = React.useMemo(() => buildTheme(density), [density]);
  React.useEffect(() => {
    document.body.dataset.density = density;
    try { localStorage.setItem('mmos.ui.density.v1', density); } catch { /* Display preferences can remain session-only. */ }
    ConfigProvider.config({ holderRender: content => <ConfigProvider theme={theme}>{content}</ConfigProvider> });
  }, [density, theme]);
  return <DensityContext.Provider value={{ density, setDensity }}><ConfigProvider theme={theme}>{children}</ConfigProvider></DensityContext.Provider>;
}
