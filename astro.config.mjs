// @ts-check
import { defineConfig } from 'astro/config';

// 員工帳號若以專案頁（username.github.io/repo）發布，建置時請設 BASE_PATH=/repo-name/
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site: process.env.SITE_URL || undefined,
  base,
  trailingSlash: 'always',
});
