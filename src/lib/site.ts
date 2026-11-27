const env = import.meta.env as ImportMetaEnv & {
  BRAND?: string;
  BRAND_LINK_LABEL?: string;
  BRAND_LINK_URL?: string;
  SUPPORTER_TEXT?: string;
};

export const SITE_NAME = '日日學';
export const SITE_TAGLINE = '每天兩篇英語短文，再看一則宜蘭見聞';

export const BRAND = env.BRAND === 'charming' ? 'charming' : 'ylsh';

export const BRAND_LINK_LABEL = env.BRAND_LINK_LABEL || '宜蘭高中員生合作社網站';
export const BRAND_LINK_URL =
  env.BRAND_LINK_URL ||
  'https://script.google.com/a/gapp.ylsh.ilc.edu.tw/macros/s/AKfycbwEMKdzTTplSslhxRL39Ejtn8k2TckMfv5Bt12dbzuHda6aNT-W9JtN6O-LP5lrqfPh/exec';
export const SUPPORTER_TEXT = env.SUPPORTER_TEXT || '日日學網站由宜蘭高中員生合作社支持建置';

/** 與 BRAND_LINK_LABEL 相同；保留舊名稱以免既有引用失效。 */
export const COOP_SITE_LABEL = BRAND_LINK_LABEL;
/** 與 BRAND_LINK_URL 相同；保留舊名稱以免既有引用失效。 */
export const COOP_SITE_URL = BRAND_LINK_URL;

export const LEVELS = {
  junior: { id: 'junior' as const, label: '入門', short: '入門', words: '基礎約 2,000 字' },
  senior: { id: 'senior' as const, label: '普通', short: '普通', words: '進階約 6,005 字' },
};

export type LevelId = keyof typeof LEVELS;

export function isLevelId(value: string): value is LevelId {
  return value === 'junior' || value === 'senior';
}

export const CEEC_NOTICE =
  '普通程度單字範圍依大學入學考試中心《高中英文參考詞彙表》（111 學年度起適用）；入門程度依十二年國教課綱英語文領域附錄五。該字表著作權屬財團法人大學入學考試中心基金會，本站僅供非營利學習使用，並註明出處。';
