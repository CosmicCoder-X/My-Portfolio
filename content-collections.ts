import { defineCollection, defineConfig } from '@content-collections/core'
import { z } from 'zod'

const projects = defineCollection({
  name: 'projects',
  directory: 'content/projects',
  include: '**/*.md',
  schema: z.object({
    title: z.string(),
    year: z.string(),
    medium: z.string(),
    description: z.string(),
    tags: z.array(z.string()),
    image: z.string(),
    imageAlt: z.string(),
    link: z.string().optional(),
    content: z.string(),
  }),
})

const gallery = defineCollection({
  name: 'gallery',
  directory: 'content/gallery',
  include: '**/*.md',
  schema: z.object({
    title: z.string(),
    category: z.string(),
    caption: z.string(),
    image: z.string(),
    width: z.number(),
    height: z.number(),
    featured: z.boolean().optional(),
  }),
})

export default defineConfig({
  collections: [projects, gallery],
})
