/** 台北時區的日期工具。建置當下的「今天」以 Asia/Taipei 為準。 */

export function taipeiDateISO(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatZhDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  // 該日中午（台北）對應 04:00 UTC，可穩定得出星期。
  const weekday = new Intl.DateTimeFormat('zh-Hant-TW', {
    timeZone: 'Asia/Taipei',
    weekday: 'long',
  }).format(new Date(Date.UTC(y, m - 1, d, 4, 0, 0)));
  return `${y}年${m}月${d}日（${weekday}）`;
}

export function countChineseChars(text: string): number {
  return text.replace(/\s+/g, '').length;
}

export function countEnglishWords(text: string): number {
  return text
    .replace(/[*_`]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}
