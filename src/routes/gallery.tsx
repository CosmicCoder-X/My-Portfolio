import { createFileRoute } from '@tanstack/react-router'
import { allGalleries } from 'content-collections'
import { useMemo, useState } from 'react'
import { optimizedImage, optimizedSrcSet } from '@/lib/image'

export const Route = createFileRoute('/gallery')({
  component: Gallery,
})

function Gallery() {
  const categories = useMemo(
    () => ['All', ...Array.from(new Set(allGalleries.map((g) => g.category)))],
    [],
  )
  const [active, setActive] = useState('All')

  const shots =
    active === 'All'
      ? allGalleries
      : allGalleries.filter((g) => g.category === active)

  return (
    <div className="px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="eyebrow text-rust-bright">Process, ephemera, evidence</p>
        <h1 className="mt-4 font-display text-5xl font-semibold sm:text-6xl">
          Gallery
        </h1>
        <p className="mt-4 max-w-xl text-lg text-ink/70">
          Nine frames from the worktable — the parts of the process that
          usually stay off the portfolio.
        </p>

        <div className="mt-10 flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActive(category)}
              className={`eyebrow border px-4 py-2 transition-colors ${
                active === category
                  ? 'border-rust bg-rust text-paper'
                  : 'border-line text-ink/60 hover:border-rust-bright hover:text-rust-bright'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="mt-10 columns-1 gap-4 sm:columns-2 lg:columns-3">
          {shots.map((shot) => (
            <figure
              key={shot._meta.path}
              className="group relative mb-4 break-inside-avoid overflow-hidden bg-paper-raised"
            >
              <img
                src={optimizedImage(shot.image, { width: 700 })}
                srcSet={optimizedSrcSet(shot.image, [400, 700, 1000])}
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                alt={shot.title}
                loading="lazy"
                width={shot.width}
                height={shot.height}
                className="block w-full transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <figcaption className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-paper/95 via-paper/10 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="eyebrow text-rust-bright">
                  {shot.category}
                </span>
                <span className="mt-1 font-display text-base text-ink">
                  {shot.title}
                </span>
                <span className="mt-1 text-sm text-ink/70">
                  {shot.caption}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  )
}
