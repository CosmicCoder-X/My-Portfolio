# Marisol Fenn — Portfolio

A personal portfolio site for a visual artist and designer: a home page, an about page, a project showcase, an image gallery, and a contact page with social links.

## Design

Dark, warm, editorial — a serif display face (Fraunces) paired with Work Sans, a rust accent color, a fixed film-grain overlay, and an asymmetric masonry gallery. The nav, hero, and gallery are all custom-built rather than pulled from a component library.

## Stack

- [TanStack Start](https://tanstack.com/start) (React 19 + file-based routing) on Vite 7
- Tailwind CSS 4 (CSS-first theme in `src/styles.css`)
- [Content Collections](https://www.content-collections.dev/) for type-safe markdown (`content/projects`, `content/gallery`)
- [Netlify Image CDN](https://docs.netlify.com/image-cdn/overview/) for on-demand image resizing/format negotiation
- [Netlify Forms](https://docs.netlify.com/forms/setup/) for the contact form
- Deployed on Netlify

## Running locally

```bash
npm install
npm run dev
```

The dev server runs on port 3000 by default (or use `netlify dev` to emulate the full Netlify platform, including Image CDN and Forms).

## Adding content

- **New project**: add a markdown file to `content/projects/` with `title`, `year`, `medium`, `description`, `tags`, `image`, `imageAlt`, and a short `content` body.
- **New gallery shot**: add a markdown file to `content/gallery/` with `title`, `category`, `caption`, `image`, `width`, `height`.

No code changes are needed — both pages read directly from the content collections.

## Build

```bash
npm run build
```

See `AGENTS.md` for a fuller architecture overview.
