import { createFileRoute, Link } from '@tanstack/react-router'
import { allProjects, allGalleries } from 'content-collections'
import { ArrowUpRight } from 'lucide-react'
import { optimizedImage } from '@/lib/image'

export const Route = createFileRoute('/')({
  component: Home,
})

const TICKER = [
  'IDENTITY',
  'RISOGRAPH',
  'INSTALLATION',
  'TYPOGRAPHY',
  'PACKAGING',
  'SIGNAGE',
]

function Home() {
  const featured = allProjects.slice(0, 3)
  const galleryPreview = allGalleries.slice(0, 4)

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden px-5 pb-20 pt-16 sm:px-8 sm:pt-24">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow rise-in text-rust-bright">
            Visual artist &amp; designer — Providence, RI
          </p>
          <h1 className="rise-in mt-6 font-display text-[13vw] font-semibold leading-[0.92] tracking-tight sm:text-[9vw] lg:text-[7.5rem]">
            Marisol
            <br />
            <span className="ml-[6vw] italic text-rust sm:ml-24">Fenn</span>
          </h1>
          <div className="mt-10 grid gap-8 sm:grid-cols-[1.1fr_0.9fr] sm:items-end">
            <p
              className="rise-in max-w-md text-lg leading-relaxed text-ink/80"
              style={{ animationDelay: '120ms' }}
            >
              I make identities, zines, and installations that look like
              they were touched by hand — because most of them were. Working
              out of a converted print shop off Westminster Street.
            </p>
            <div
              className="rise-in flex flex-wrap gap-4"
              style={{ animationDelay: '220ms' }}
            >
              <Link
                to="/work"
                className="inline-flex items-center gap-2 bg-rust px-6 py-3 font-display text-sm font-semibold text-paper transition-colors hover:bg-rust-bright"
              >
                See the work
                <ArrowUpRight size={16} />
              </Link>
              <Link
                to="/gallery"
                className="inline-flex items-center gap-2 border border-line px-6 py-3 font-display text-sm font-semibold text-ink transition-colors hover:border-rust-bright hover:text-rust-bright"
              >
                Open the gallery
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee */}
      <div className="overflow-hidden border-y border-line/70 bg-paper-raised py-4">
        <div className="marquee-track flex w-max shrink-0 gap-10 whitespace-nowrap">
          {[...TICKER, ...TICKER].map((word, i) => (
            <span
              key={`${word}-${i}`}
              className="eyebrow flex items-center gap-10 text-ink/50"
            >
              {word}
              <span className="text-rust">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* Featured work */}
      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-baseline justify-between border-b border-line/70 pb-6">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">
              Selected work
            </h2>
            <Link
              to="/work"
              className="eyebrow hidden text-ink/60 hover:text-rust-bright sm:inline"
            >
              All projects →
            </Link>
          </div>

          <div className="mt-10 grid gap-10 sm:grid-cols-3">
            {featured.map((project, i) => (
              <Link
                key={project._meta.path}
                to="/work"
                className="group block"
              >
                <div
                  className={`overflow-hidden bg-paper-raised ${
                    i === 1 ? 'sm:mt-8' : ''
                  }`}
                >
                  <img
                    src={optimizedImage(project.image, {
                      width: 640,
                      height: 800,
                      fit: 'cover',
                    })}
                    alt={project.imageAlt}
                    loading="lazy"
                    className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="mt-4 flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-xl font-medium">
                    {project.title}
                  </h3>
                  <span className="eyebrow shrink-0 text-ink/40">
                    {project.year}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink/60">{project.medium}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery teaser */}
      <section className="border-t border-line/70 bg-paper-raised px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">
              From the studio
            </h2>
            <Link
              to="/gallery"
              className="eyebrow text-ink/60 hover:text-rust-bright"
            >
              Full gallery →
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {galleryPreview.map((shot) => (
              <div key={shot._meta.path} className="overflow-hidden">
                <img
                  src={optimizedImage(shot.image, {
                    width: 400,
                    height: 500,
                    fit: 'cover',
                  })}
                  alt={shot.title}
                  loading="lazy"
                  className="aspect-[4/5] w-full object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
