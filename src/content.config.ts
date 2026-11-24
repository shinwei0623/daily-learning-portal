import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const word = z.object({
  word: z.string(),
  pos: z.string(),
  def_zh: z.string(),
  def_en: z.string(),
  kk: z.string(),
  ipa: z.string(),
  example: z.string(),
  example_zh: z.string(),
  audio: z.string().optional(),
});

const english = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/english' }),
  schema: z.object({
    date: z.string(),
    level: z.enum(['junior', 'senior']),
    slot: z.number().int().min(1).max(2),
    title: z.string(),
    title_zh: z.string(),
    topic: z.string(),
    words: z.array(word).length(5),
  }),
});

const source = z.object({
  title: z.string(),
  url: z.string().url(),
  note: z.string().optional(),
});

const yilan = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/yilan' }),
  schema: z.object({
    date: z.string(),
    title: z.string(),
    image: z.string(),
    image_alt: z.string(),
    image_author: z.string(),
    image_credit: z.string(),
    image_license: z.string(),
    image_license_url: z.string().url(),
    image_source_url: z.string().url(),
    sources: z.array(source).min(1),
  }),
});

export const collections = { english, yilan };
