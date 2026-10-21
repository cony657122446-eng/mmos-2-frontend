import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function inlineHtml() {
  return {
    name: 'inline-html',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const htmlName = Object.keys(bundle).find(name => name.endsWith('.html'));
      const html = bundle[htmlName];
      let source = html.source.toString();
      source = source.replace(/<link\b[^>]*stylesheet[^>]*>/, '').replace(/<script\b[^>]*type="module"[^>]*src="[^"]+"[^>]*><\/script>/, '');
      const publicDir = path.resolve('public');
      for (const item of Object.values(bundle)) {
        if (item.type === 'asset' && item.fileName.endsWith('.css')) {
          let css = item.source.toString();
          for (const file of ['company-logo-official.png', 'company-logo-full.png']) {
            const data = fs.readFileSync(path.join(publicDir, file)).toString('base64');
            css = css.replaceAll(`url('/${file}')`, `url(data:image/png;base64,${data})`).replaceAll(`url(/${file})`, `url(data:image/png;base64,${data})`);
          }
          source = source.replace('</head>', () => `<style>${css.replace(/<\/style/gi, '\\u003c/style')}</style></head>`);
          delete bundle[item.fileName];
        }
      }
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk' && item.fileName.endsWith('.js')) {
          source = source.replace('</body>', () => `<script type="module">${item.code.replace(/<\/script/gi, '\\u003c/script')}</script></body>`);
          delete bundle[item.fileName];
        }
      }
      source = source.replace(/<link\b[^>]*modulepreload[^>]*>/g, '');
      html.source = source;
    },
  };
}

export default defineConfig({
  plugins: [react(), inlineHtml()],
  base: './',
  build: { assetsInlineLimit: 100000000, cssCodeSplit: false, modulePreload: false, outDir: 'standalone', emptyOutDir: true },
});
