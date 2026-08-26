import { createFileRoute } from '@tanstack/react-router'
import { optimizedImage } from '@/lib/image'

export const Route = createFileRoute('/about')({
  component: About,
})

const APPROACH = [
  {
    n: '01',
    title: 'Start with the material',
    body: 'Paper stock, kiln temperature, pixel grid — the constraints of the medium decide more of the design than the brief does.',
  },
  {
    n: '02',
    title: 'Leave the seams visible',
    body: 'Registration marks, exposed stitching, a visible brush stroke. Evidence of the hand is the point, not a flaw to sand down.',
  },
  {
    n: '03',
    title: 'Design for the second look',
    body: 'The first glance should be clean. The second glance should reward someone who stays with it — a hidden fold, a typographic joke, a number that means something.',
  },
]

const TIMELINE = [
  { year: '2024', event: 'Undertow, three-channel installation — AS220 Project Space' },
  { year: '2023', event: 'Nine Rooms wayfinding system commissioned by Ledger Hill Residency' },
  { year: '2023', event: 'Marginalia issues 1–4 self-published, risograph' },
  { year: '2022', event: 'Faultline Review redesign, issues 14–19' },
  { year: '2020', event: 'MFA, Graphic Design — Rhode Island School of Design' },
]

const TOOLS = [
  'Risograph',
  'Letterpress',
  'Adobe Creative Suite',
  'Processing',
  'Glaze chemistry',
  'Figma',
  'A very old Nikon FM2',
]

function About() {
  return (
    <div className="px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-[1fr_1.3fr] sm:items-start">
          <div className="overflow-hidden bg-paper-raised sm:sticky sm:top-24">
            <img
              src={optimizedImage('/headshot-on-white.jpg', {
                width: 640,
                height: 800,
                fit: 'cover',
              })}
              alt="Portrait of Marisol Fenn in her studio"
              className="aspect-[4/5] w-full object-cover"
            />
          </div>

          <div>
            <p className="eyebrow text-rust-bright">About</p>
            <h1 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">
              I trust my hands more than my software.
            </h1>
            <div className="mt-6 flex flex-col gap-4 text-lg leading-relaxed text-ink/80">
              <p>
                I'm Marisol Fenn, a visual artist and designer working
                between print, ceramics, and installation out of a converted
                print shop off Westminster Street in Providence. Before
                design school I apprenticed for two years at a bookbindery,
                which is probably why everything I make eventually gets
                stitched, stamped, or fired.
              </p>
              <p>
                My studio practice and my client work borrow from each
                other constantly — a glaze test becomes a packaging color,
                a client's typography becomes a zine layout. I like projects
                where that boundary gets a little blurry.
              </p>
            </div>
          </div>
        </div>

        <section className="mt-24 border-t border-line/70 pt-12">
          <h2 className="font-display text-3xl font-semibold">Approach</h2>
          <div className="mt-8 grid gap-10 sm:grid-cols-3">
            {APPROACH.map((item) => (
              <div key={item.n}>
                <span className="font-display text-4xl text-rust">
                  {item.n}
                </span>
                <h3 className="mt-3 font-display text-xl font-medium">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-24 grid gap-16 border-t border-line/70 pt-12 sm:grid-cols-[1.3fr_1fr]">
          <section>
            <h2 className="font-display text-3xl font-semibold">
              Selected history
            </h2>
            <ul className="mt-8 flex flex-col gap-5">
              {TIMELINE.map((row) => (
                <li
                  key={row.event}
                  className="flex gap-6 border-b border-line/50 pb-5 last:border-none"
                >
                  <span className="eyebrow w-14 shrink-0 text-rust-bright">
                    {row.year}
                  </span>
                  <span className="text-ink/75">{row.event}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-display text-3xl font-semibold">
              Tools &amp; materials
            </h2>
            <ul className="mt-8 flex flex-col gap-3">
              {TOOLS.map((tool) => (
                <li
                  key={tool}
                  className="border-b border-line/50 pb-3 text-ink/75 last:border-none"
                >
                  {tool}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
