export const SITE_NAME = '日日學';
export const SITE_TAGLINE = '每天兩篇英語短文，再看一則宜蘭見聞';

export const COOP_SITE_LABEL = '宜蘭高中員生合作社網站';
export const COOP_SITE_URL =
  'https://script.google.com/a/gapp.ylsh.ilc.edu.tw/macros/s/AKfycbwEMKdzTTplSslhxRL39Ejtn8k2TckMfv5Bt12dbzuHda6aNT-W9JtN6O-LP5lrqfPh/exec';

export const LEVELS = {
  junior: { id: 'junior' as const, label: '國中', short: '國中', words: '課綱約 2,000 字' },
  senior: { id: 'senior' as const, label: '高中', short: '高中', words: '學測參考詞彙 6,005 字' },
};

export type LevelId = keyof typeof LEVELS;

export function isLevelId(value: string): value is LevelId {
  return value === 'junior' || value === 'senior';
}

export const CEEC_NOTICE =
  '高中單字範圍依大學入學考試中心《高中英文參考詞彙表》（111 學年度起適用）；國中範圍依十二年國教課綱英語文領域附錄五。該字表著作權屬財團法人大學入學考試中心基金會，本站僅供非營利學習使用，並註明出處。';
