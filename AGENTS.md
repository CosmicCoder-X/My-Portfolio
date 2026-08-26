# AGENTS.md

Architecture notes for AI agents (and humans) working on this codebase.

## Project Overview

A personal portfolio site for a fictional visual artist/designer, Marisol Fenn. Built with TanStack Start (React 19 + file-based routing) and Tailwind CSS 4, deployed on Netlify. The design direction is dark, warm, and editorial — serif display type, a rust accent, a fixed grain overlay, and an asymmetric masonry gallery.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start |
| Frontend | React 19, TanStack Router v1 |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 (CSS-first config in `src/styles.css`) |
| Content | Content Collections (type-safe markdown in `content/`) |
| Images | Netlify Image CDN (`src/lib/image.ts` helper) |
| Forms | Netlify Forms |
| Language | TypeScript 5, strict mode |
| Deployment | Netlify |

## Directory Structure

```
├── content
│   ├── gallery/        # Gallery shots: title, category, caption, image, width, height
│   └── projects/       # Case studies: title, year, medium, description, tags, image, content
├── public
│   ├── contact.html    # Static skeleton form so Netlify detects the AJAX contact form at build time
│   └── headshot-on-white.jpg
├── src
│   ├── components
│   │   ├── Header.tsx  # Sticky nav with mobile menu
│   │   └── Footer.tsx  # Contact CTA + social icons
│   ├── lib
│   │   └── image.ts    # optimizedImage()/optimizedSrcSet() helpers wrapping /.netlify/images
│   ├── routes
│   │   ├── __root.tsx  # Shell: fonts, Header/Footer, meta
│   │   ├── index.tsx   # Home: hero, marquee, featured work, gallery teaser
│   │   ├── about.tsx   # Bio, approach, timeline, tools
│   │   ├── work.tsx    # Project showcase (alternating editorial rows)
│   │   ├── gallery.tsx # Masonry image gallery with category filter
│   │   └── contact.tsx # Social links index + Netlify Forms contact form
│   ├── router.tsx
│   └── styles.css      # Theme tokens, fonts, grain overlay, marquee/rise animations
├── content-collections.ts  # Zod schemas for `projects` and `gallery`
└── netlify.toml             # Build config + Image CDN remote_images allowlist
```

## Key Concepts

### Routing

File-based via TanStack Router (`src/routes/`). `__root.tsx` wraps every route in the shared `Header`/`Footer`.

### Content

Markdown lives in `content/projects` and `content/gallery`, validated against schemas in `content-collections.ts`, and imported as `allProjects` / `allGallery` from the virtual `content-collections` module. Add a new project or gallery shot by dropping a new `.md` file with matching frontmatter — no code changes needed.

### Images

All photography currently points at `picsum.photos` (stable placeholder photography) — swap the `image` frontmatter field for real photos when available. Every `<img>` goes through `optimizedImage()`/`optimizedSrcSet()` (`src/lib/image.ts`), which builds `/.netlify/images` URLs for on-demand resizing/format negotiation. Remote source domains must be allowlisted in `netlify.toml` under `[images].remote_images`.

### Forms

The contact form posts via `fetch` to `/contact.html`, a static hidden-form skeleton in `public/` that lets Netlify's build-time scanner register the `contact` form (client-rendered React forms aren't visible to that scanner). Keep the field names in `contact.tsx` and `contact.html` in sync.

## Conventions

- Components: PascalCase. Routes: kebab-case files under `src/routes/`.
- Tailwind utility classes throughout; theme tokens (`--paper`, `--ink`, `--rust`, fonts) defined once in `src/styles.css` and exposed via `@theme inline`.
- Strict TypeScript, `@/*` path alias for `src/*`.

## Development Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
```
