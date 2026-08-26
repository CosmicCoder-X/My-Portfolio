import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const writeups = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writeups' }),
  schema: z.object({
    title: z.string(),
    // Which box / room / challenge this is
    target: z.string(),
    // easy | medium | hard | insane
    difficulty: z.enum(['easy', 'medium', 'hard', 'insane']),
    date: z.coerce.date(),
    // Short one-line summary shown in listings
    summary: z.string(),
    // Skills a hiring manager would search for
    tags: z.array(z.string()).default([]),
    // Which role this evidences: pentest | soc | appsec | llm | forensics
    role: z.enum(['pentest', 'soc', 'appsec', 'llm', 'forensics']).default('pentest'),
    // Problem / Action / Outcome — the case-study frame
    problem: z.string(),
    action: z.string(),
    outcome: z.string(),
    draft: z.boolean().default(false),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { writeups, blog };
