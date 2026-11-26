#!/usr/bin/env node
/**
 * 每日產文：英語兩程度各兩篇、宜蘭一則（必須依據已提供來源改寫）。
 * 需要環境變數 GEMINI_API_KEY（建議）或 OPENAI_API_KEY。
 * 用法：node scripts/generate-daily.mjs [--date YYYY-MM-DD] [--force]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(path.join(root, '.env'));

const args = new Set(process.argv.slice(2));
const dateArg = process.argv.includes('--date')
  ? process.argv[process.argv.indexOf('--date') + 1]
  : null;
const force = args.has('--force');
const date = dateArg || taipeiDateISO();

const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
const geminiFallbacks = [...new Set([
  process.env.GEMINI_MODEL,
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
].filter(Boolean))];
let geminiModel = geminiFallbacks[0];
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const REQUEST_TIMEOUT_MS = 75_000;
const RETRYABLE_HTTP = new Set([429, 500, 502, 503, 504]);

if (!geminiKey && !openaiKey) {
  console.log(`沒有可用的 LLM 鑰匙，略過 ${date} 的自動產文。
請在 GitHub Actions secrets 或本機 .env 設定以下其中一個：
  GEMINI_API_KEY   （建議，Google AI Studio / Gemini API）
  OPENAI_API_KEY   （備用）
可選：GEMINI_MODEL（預設 ${geminiModel}）、OPENAI_MODEL（預設 ${openaiModel}）。`);
  process.exit(0);
}

const englishDir = path.join(root, 'src/content/english');
const yilanDir = path.join(root, 'src/content/yilan');
const englishExists = existsSync(path.join(englishDir, `${date}-junior-1.md`));
const yilanExists = existsSync(path.join(yilanDir, `${date}.md`));
if (englishExists && yilanExists && !force) {
  console.log(`${date} 的內容已存在。若要重產，請加 --force。`);
  process.exit(0);
}

const juniorBank = JSON.parse(readFileSync(path.join(root, 'src/data/wordbank-junior.json'), 'utf8'));
const seniorBank = JSON.parse(readFileSync(path.join(root, 'src/data/wordbank-senior.json'), 'utf8'));
const topicsFile = path.join(root, 'src/data/yilan-topics.json');
const topicsDoc = JSON.parse(readFileSync(topicsFile, 'utf8'));

const usedWords = collectUsedWords(englishDir);
const banned = 'politics, political, election, religion, god, temple, church, war, kill, weapon, violence, drug, gambling, horror, terror, suicide, adult, dating app';

try {
  if (!englishExists || force) {
    await generateEnglish('junior', juniorBank.words, 2);
    await generateEnglish('senior', seniorBank.words, 2);
  } else {
    console.log(`${date} 英語短文已存在，略過。`);
  }
  if (!yilanExists || force) {
    await generateYilan();
  } else {
    console.log(`${date} 宜蘭見聞已存在，略過。`);
  }
  console.log(`完成 ${date} 的產文。`);
} catch (err) {
  console.error(err);
  process.exit(1);
}

async function generateEnglish(level, bank, storyCount) {
  const picks = pickUnused(bank, usedWords, 5 * storyCount);
  if (picks.length < 5 * storyCount) {
    throw new Error(`${level} 字庫可用單字不足`);
  }
  const groups = [];
  for (let i = 0; i < storyCount; i++) groups.push(picks.slice(i * 5, i * 5 + 5));

  const prompt = `You write short English learning stories for Taiwan ${level === 'junior' ? 'junior-high (cefr A1-A2)' : 'senior-high (cefr B1-B2)'} students.
Return ONLY a JSON array with ${storyCount} objects. No markdown fence.
Each object:
{
  "title": English title,
  "title_zh": Traditional Chinese title,
  "topic": one of sports, music, food, nature, hobbies, school-life,
  "story": 90-110 English words. Wrap each target word in **word** the first time it appears. Informal, friendly, everyday teen life. Do NOT mention politics, religion, violence, weapons, drugs, dating, or copyrighted character/brand names (no specific anime, game, or pop-star names).
  "words": array of 5 objects in the same order as given:
    { "word", "pos", "def_zh" (Traditional Chinese), "def_en" (short), "kk" (Taiwan KK phonetic, e.g. [ˋpræktɪs]), "ipa", "example" (one English sentence), "example_zh" }
}
Story 1 must use exactly these words in the story: ${groups[0].map((w) => w.word).join(', ')}
Story 2 must use exactly these words in the story: ${groups[1].map((w) => w.word).join(', ')}
Chinese must be Traditional Chinese (臺灣用字).`;

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = await callLLM(prompt);
      const stories = extractJson(raw);
      if (!Array.isArray(stories) || stories.length !== storyCount) {
        throw new Error(`${level} 回傳不是 ${storyCount} 篇 JSON`);
      }
      stories.forEach((story, i) => writeEnglish(level, i + 1, story, groups[i]));
      return;
    } catch (err) {
      lastErr = err;
      console.log(`${level} 產文第 ${attempt} 次未通過檢查：${err.message}`);
      if (attempt === 3) throw lastErr;
    }
  }
  throw lastErr;
}

function writeEnglish(level, slot, story, expected) {
  if (!story.words || story.words.length !== 5) throw new Error(`${level} #${slot} 單字不是 5 個`);
  const text = String(story.story || '').replace(/\*\*/g, '');
  const n = text.trim().split(/\s+/).length;
  if (n < 80 || n > 130) throw new Error(`${level} #${slot} 字數 ${n}，應介於 80–130`);
  const lower = text.toLowerCase();
  for (const w of expected) {
    if (!lower.includes(w.word.toLowerCase())) {
      throw new Error(`${level} #${slot} 短文未出現目標字 ${w.word}`);
    }
  }
  const words = story.words.map((item) => {
    const audioRel = `audio/${item.word.toLowerCase()}.mp3`;
    downloadAudio(item.word, path.join(root, 'public', audioRel));
    return {
      word: item.word,
      pos: item.pos,
      def_zh: item.def_zh,
      def_en: item.def_en,
      kk: item.kk,
      ipa: item.ipa,
      example: item.example,
      example_zh: item.example_zh,
      audio: audioRel,
    };
  });
  const fm = [
    '---',
    `date: "${date}"`,
    `level: ${level}`,
    `slot: ${slot}`,
    `title: ${yamlQ(story.title)}`,
    `title_zh: ${yamlQ(story.title_zh)}`,
    `topic: ${yamlQ(story.topic || 'hobbies')}`,
    'words:',
    ...words.flatMap((w) => [
      `  - word: ${yamlQ(w.word)}`,
      `    pos: ${yamlQ(w.pos)}`,
      `    def_zh: ${yamlQ(w.def_zh)}`,
      `    def_en: ${yamlQ(w.def_en)}`,
      `    kk: ${yamlQ(w.kk)}`,
      `    ipa: ${yamlQ(w.ipa)}`,
      `    example: ${yamlQ(w.example)}`,
      `    example_zh: ${yamlQ(w.example_zh)}`,
      `    audio: ${yamlQ(w.audio)}`,
    ]),
    '---',
    '',
    String(story.story).trim(),
    '',
  ].join('\n');
  mkdirSync(englishDir, { recursive: true });
  writeFileSync(path.join(englishDir, `${date}-${level}-${slot}.md`), fm, 'utf8');
  console.log('wrote english', level, slot);
}

async function generateYilan() {
  const withImage = topicsDoc.topics.filter((t) => t.image?.download_url);
  const unused = withImage.filter((t) => !(t.used_on || []).length);
  const unusedToday = withImage.filter((t) => !(t.used_on || []).includes(date));
  const topic = unused[0] || unusedToday[0];
  if (!topic) {
    throw new Error('沒有「已備妥授權圖片、且尚未用盡」的宜蘭題目。請先在 src/data/yilan-topics.json 補上 download_url 與授權資訊。');
  }
  const excerpts = topic.sources
    .map((s, i) => `來源${i + 1}「${s.title}」 ${s.url}\n${s.excerpt}`)
    .join('\n\n');
  const prompt = `你是嚴謹的臺灣史地寫手。只能根據下列來源摘錄改寫一則宜蘭介紹，不得添加摘錄中沒有的事實、數字、人名、地名或年代。
請用臺灣繁體中文，全文（含標點）不超過 300 字，語氣平實，適合張貼在校園公布欄。不要出現政治評價或宗教勸募。
回傳純 JSON（不要用 markdown 圍欄）：
{ "title": "標題", "body": "正文" }

來源摘錄：
${excerpts}`;

  const raw = await callLLM(prompt);
  const article = extractJson(raw);
  const body = String(article.body || '').trim();
  const compact = body.replace(/\s+/g, '');
  if (!body) throw new Error('宜蘭正文是空的');
  if (compact.length > 300) throw new Error(`宜蘭正文 ${compact.length} 字，超過 300`);
  const sourceText = topic.sources.map((s) => s.excerpt).join('\n');
  const extraNums = [...compact.matchAll(/\d+(?:\.\d+)?/g)]
    .map((m) => m[0])
    .filter((n) => !sourceText.includes(n));
  if (extraNums.length) {
    throw new Error(`宜蘭正文出現來源沒有的數字：${extraNums.join(', ')}`);
  }

  const imgRel = `images/yilan/${date}-${topic.id}.jpg`;
  const imgPath = path.join(root, 'public', imgRel);
  downloadAndResize(topic.image.download_url, imgPath);

  const fm = [
    '---',
    `date: "${date}"`,
    `title: ${yamlQ(article.title || topic.title_hint)}`,
    `image: ${yamlQ(imgRel)}`,
    `image_alt: ${yamlQ(topic.image.alt)}`,
    `image_author: ${yamlQ(topic.image.author)}`,
    `image_credit: ${yamlQ(topic.image.credit)}`,
    `image_license: ${yamlQ(topic.image.license)}`,
    `image_license_url: ${yamlQ(topic.image.license_url)}`,
    `image_source_url: ${yamlQ(topic.image.file_page)}`,
    'sources:',
    ...topic.sources.flatMap((s) => [
      `  - title: ${yamlQ(s.title)}`,
      `    url: ${s.url}`,
      `    note: ${yamlQ('本文僅改寫此頁公開說明，未另增史實。')}`,
    ]),
    '---',
    '',
    body,
    '',
  ].join('\n');
  mkdirSync(yilanDir, { recursive: true });
  writeFileSync(path.join(yilanDir, `${date}.md`), fm, 'utf8');
  topic.used_on = [...new Set([...(topic.used_on || []), date])];
  writeFileSync(topicsFile, JSON.stringify(topicsDoc, null, 2) + '\n', 'utf8');
  console.log('wrote yilan', topic.id, compact.length, 'chars');
}

async function callLLM(prompt) {
  if (geminiKey) return callGemini(prompt);
  return callOpenAI(prompt);
}

async function callGemini(prompt) {
  const models = [geminiModel, ...geminiFallbacks.filter((m) => m !== geminiModel)];
  let lastErr;
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    for (const delay of [0, 8000]) {
      if (delay) {
        console.log(`Gemini ${model} 暫時忙碌或連線失敗，${delay / 1000} 秒後重試…`);
        await sleep(delay);
      }
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
          if (!text) throw new Error(`Gemini 沒有回傳文字（${model}）`);
          if (geminiModel !== model) {
            console.log(`改用 Gemini 模型 ${model}`);
            geminiModel = model;
          }
          return text;
        }
        const body = await res.text();
        lastErr = new Error(`Gemini ${res.status} (${model}): ${body}`);
        console.log(lastErr.message);
        if (res.status === 404) break;
        if (!RETRYABLE_HTTP.has(res.status)) throw lastErr;
      } catch (err) {
        if (!isRetryableRequestError(err)) throw err;
        lastErr = err;
        console.log(`Gemini ${model} 連線失敗：${describeError(err)}`);
      }
    }
  }
  throw lastErr;
}

async function callOpenAI(prompt) {
  let lastErr;
  for (const [i, delay] of [0, 8000, 20000].entries()) {
    if (delay) {
      console.log(`OpenAI 暫時忙碌或連線失敗，${delay / 1000} 秒後重試（第 ${i} 次）…`);
      await sleep(delay);
    }
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: openaiModel,
          temperature: 0.4,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Reply with JSON only.' },
            { role: 'user', content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
      }
      const body = await res.text();
      lastErr = new Error(`OpenAI ${res.status}: ${body}`);
      console.log(lastErr.message);
      if (!RETRYABLE_HTTP.has(res.status)) throw lastErr;
    } catch (err) {
      if (!isRetryableRequestError(err)) throw err;
      lastErr = err;
      console.log(`OpenAI 連線失敗：${describeError(err)}`);
    }
  }
  throw lastErr;
}

function isRetryableRequestError(err) {
  const msg0 = String(err?.message || '');
  if (msg0.startsWith('Gemini ') || msg0.startsWith('OpenAI ')) {
    const status = Number((msg0.match(/^(?:Gemini|OpenAI) (\d+)/) || [])[1]);
    return RETRYABLE_HTTP.has(status);
  }
  let cur = err;
  const seen = new Set();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const name = String(cur.name || '');
    const code = String(cur.code || '');
    const msg = String(cur.message || '');
    if (name === 'ReferenceError' || name === 'SyntaxError' || name === 'RangeError') return false;
    if (name === 'AbortError' || name === 'TimeoutError') return true;
    if (name === 'TypeError' && /fetch failed/i.test(msg)) return true;
    if (
      code === 'UND_ERR_HEADERS_TIMEOUT' ||
      code === 'UND_ERR_BODY_TIMEOUT' ||
      code === 'UND_ERR_CONNECT_TIMEOUT' ||
      code === 'UND_ERR_SOCKET' ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNRESET' ||
      code === 'ECONNREFUSED' ||
      code === 'EPIPE' ||
      code === 'EAI_AGAIN' ||
      code === 'ENOTFOUND'
    ) {
      return true;
    }
    if (/headers timeout|body timeout|connect timeout|socket hang up|fetch failed|the operation was aborted/i.test(msg)) {
      return true;
    }
    cur = cur.cause;
  }
  return false;
}

function describeError(err) {
  const parts = [err?.name, err?.message, err?.code, err?.cause?.code, err?.cause?.message].filter(Boolean);
  return [...new Set(parts)].join(' / ');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJson(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.search(/[\[{]/);
  if (start < 0) throw new Error('找不到 JSON');
  return JSON.parse(trimmed.slice(start));
}

function collectUsedWords(dir) {
  const used = new Set();
  if (!existsSync(dir)) return used;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const text = readFileSync(path.join(dir, name), 'utf8');
    for (const m of text.matchAll(/^\s+- word:\s+"?([^"\n]+)"?/gm)) {
      used.add(m[1].trim().toLowerCase());
    }
  }
  return used;
}

function pickUnused(bank, used, n) {
  const rest = bank.filter((w) => !used.has(w.word.toLowerCase()));
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const chosen = rest.slice(0, n);
  chosen.forEach((w) => used.add(w.word.toLowerCase()));
  return chosen;
}

function downloadAudio(word, dest) {
  mkdirSync(path.dirname(dest), { recursive: true });
  if (existsSync(dest) && readFileSync(dest).length > 1000) return;
  const urls = [
    `https://ssl.gstatic.com/dictionary/static/sounds/20200429/${word}--_us_1.mp3`,
    `https://ssl.gstatic.com/dictionary/static/sounds/20200429/${word}--_gb_1.mp3`,
    `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${word}--_us_1.mp3`,
  ];
  for (const url of urls) {
    const r = spawnSync('curl', ['-fsSL', '-A', 'DailyLearningPortal/1.0', '-o', dest, url], { encoding: 'utf8' });
    if (r.status === 0 && existsSync(dest) && readFileSync(dest).length > 1000) return;
  }
  console.warn('找不到辭典音檔，將改用瀏覽器朗讀：', word);
}

function downloadAndResize(url, dest) {
  mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = dest + '.orig';
  const r = spawnSync('curl', ['-fsSL', '-A', 'DailyLearningPortal/1.0 (educational)', '-o', tmp, url], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`下載圖片失敗：${url}\n${r.stderr}`);
  const py = `
from PIL import Image
im = Image.open(${JSON.stringify(tmp)}).convert('RGB')
im.thumbnail((1800, 1800))
im.save(${JSON.stringify(dest)}, quality=86, optimize=True)
`;
  const p = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  if (p.status !== 0) throw new Error(`縮圖失敗：${p.stderr || p.stdout}`);
  try { unlinkSync(tmp); } catch {}
}

function yamlQ(value) {
  const s = String(value ?? '');
  if (/[:#{}[\],&*?]|^\s|\s$|"|'/.test(s) || s === '') return JSON.stringify(s);
  return s;
}

function taipeiDateISO(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function loadDotEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
