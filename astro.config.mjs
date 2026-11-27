// @ts-check
import { defineConfig } from 'astro/config';

// 員工帳號若以專案頁（username.github.io/repo）發布，建置時請設 BASE_PATH=/repo-name/
const base = process.env.BASE_PATH || '/';

/** @type {const} */
const brandPresets = {
  ylsh: {
    linkLabel: '宜蘭高中員生合作社網站',
    linkUrl:
      'https://script.google.com/a/gapp.ylsh.ilc.edu.tw/macros/s/AKfycbwEMKdzTTplSslhxRL39Ejtn8k2TckMfv5Bt12dbzuHda6aNT-W9JtN6O-LP5lrqfPh/exec',
    supporterText: '日日學網站由宜蘭高中員生合作社支持建置',
  },
  charming: {
    linkLabel: 'Charming 粉專',
    linkUrl: 'https://www.facebook.com/share/1E33LuxjmU/?mibextid=wwXIfr',
    supporterText: '日日學網站由 Charming 支持分享',
  },
};

const brand = process.env.BRAND === 'charming' ? 'charming' : 'ylsh';
const preset = brandPresets[brand];
const brandLinkLabel = process.env.BRAND_LINK_LABEL || preset.linkLabel;
const brandLinkUrl = process.env.BRAND_LINK_URL || preset.linkUrl;
const supporterText = process.env.SUPPORTER_TEXT || preset.supporterText;

export default defineConfig({
  site: process.env.SITE_URL || undefined,
  base,
  trailingSlash: 'always',
  vite: {
    define: {
      'import.meta.env.BRAND': JSON.stringify(brand),
      'import.meta.env.BRAND_LINK_LABEL': JSON.stringify(brandLinkLabel),
      'import.meta.env.BRAND_LINK_URL': JSON.stringify(brandLinkUrl),
      'import.meta.env.SUPPORTER_TEXT': JSON.stringify(supporterText),
    },
  },
});
