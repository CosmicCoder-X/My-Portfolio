import { createFileRoute } from '@tanstack/react-router'
import { allProjects } from 'content-collections'
import { optimizedImage } from '@/lib/image'

export const Route = createFileRoute('/work')({
  component: Work,
})

function Work() {
  return (
    <div className="px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="eyebrow text-rust-bright">Selected work, 2022 — 2024</p>
        <h1 className="mt-4 font-display text-5xl font-semibold sm:text-6xl">
          Case studies
        </h1>
        <p className="mt-4 max-w-xl text-lg text-ink/70">
          Five projects that made it out of the studio intact — identity
          systems, printed matter, and one installation that ran for eleven
          nights.
        </p>

        <div className="mt-16 flex flex-col gap-24">
          {allProjects.map((project, i) => {
            const reverse = i % 2 === 1
            return (
              <article
                key={project._meta.path}
                className="grid gap-8 border-t border-line/70 pt-10 sm:grid-cols-2 sm:gap-14"
              >
                <div
                  className={`overflow-hidden bg-paper-raised ${
                    reverse ? 'sm:order-2' : ''
                  }`}
                >
                  <img
                    src={optimizedImage(project.image, {
                      width: 900,
                      height: 1125,
                      fit: 'cover',
                    })}
                    alt={project.imageAlt}
                    loading="lazy"
                    className="aspect-[4/5] w-full object-cover"
                  />
                </div>

                <div
                  className={`flex flex-col ${
                    reverse ? 'sm:order-1' : ''
                  } sm:justify-center`}
                >
                  <div className="flex items-center gap-3 text-ink/40">
                    <span className="eyebrow">{project.year}</span>
                    <span className="h-px w-8 bg-line" />
                    <span className="eyebrow">{project.medium}</span>
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">
                    {project.title}
                  </h2>
                  <p className="mt-4 leading-relaxed text-ink/75">
                    {project.description}
                  </p>
                  <p className="mt-4 border-l-2 border-rust pl-4 text-sm italic leading-relaxed text-sand">
                    {project.content}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                      <span
                        key={tag}
                        className="eyebrow border border-line px-2.5 py-1 text-ink/60"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
