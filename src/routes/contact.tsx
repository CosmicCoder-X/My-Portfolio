import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowUpRight, Send } from 'lucide-react'

export const Route = createFileRoute('/contact')({
  component: Contact,
})

const SOCIALS = [
  { n: '01', label: 'Email', value: 'hello@marisolfenn.art', href: 'mailto:hello@marisolfenn.art' },
  { n: '02', label: 'Instagram', value: '@marisolfenn', href: 'https://instagram.com/marisolfenn' },
  { n: '03', label: 'Are.na', value: 'are.na/marisol-fenn', href: 'https://are.na/marisol-fenn' },
  { n: '04', label: 'LinkedIn', value: 'in/marisolfenn', href: 'https://linkedin.com/in/marisolfenn' },
]

function Contact() {
  const [submitted, setSubmitted] = useState(false)

  return (
    <div className="px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="eyebrow text-rust-bright">Get in touch</p>
        <h1 className="mt-4 max-w-2xl font-display text-5xl font-semibold sm:text-6xl">
          Working on something with texture? Tell me about it.
        </h1>

        <div className="mt-16 grid gap-16 sm:grid-cols-[1fr_1fr]">
          <div>
            <ul className="flex flex-col">
              {SOCIALS.map((social) => (
                <li key={social.n} className="border-b border-line/70">
                  <a
                    href={social.href}
                    target={social.href.startsWith('http') ? '_blank' : undefined}
                    rel={social.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="group flex items-center justify-between gap-4 py-6 transition-colors hover:text-rust-bright"
                  >
                    <span className="flex items-baseline gap-4">
                      <span className="eyebrow text-ink/40">{social.n}</span>
                      <span className="font-display text-2xl">
                        {social.label}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-sm text-ink/60 group-hover:text-rust-bright">
                      {social.value}
                      <ArrowUpRight
                        size={16}
                        className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      />
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            <p className="mt-8 text-sm leading-relaxed text-ink/60">
              Based in Providence, RI. Usually replies within a couple of
              days — faster if there's a deadline involved.
            </p>
          </div>

          <div className="bg-paper-raised p-8">
            {submitted ? (
              <div className="flex h-full flex-col items-start justify-center gap-3">
                <span className="font-display text-3xl">Message sent.</span>
                <p className="text-ink/70">
                  Thanks for writing — I'll get back to you shortly.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="eyebrow mt-4 text-rust-bright hover:text-sand"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form
                name="contact"
                method="POST"
                data-netlify="true"
                netlify-honeypot="bot-field"
                onSubmit={(e) => {
                  e.preventDefault()
                  const form = e.currentTarget
                  const formData = new FormData(form)
                  fetch('/contact.html', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams(
                      formData as unknown as Record<string, string>,
                    ).toString(),
                  }).then(() => setSubmitted(true))
                }}
                className="flex flex-col gap-6"
              >
                <input type="hidden" name="form-name" value="contact" />
                <p hidden>
                  <label>
                    Don't fill this out: <input name="bot-field" />
                  </label>
                </p>

                <label className="flex flex-col gap-2">
                  <span className="eyebrow text-ink/60">Name</span>
                  <input
                    type="text"
                    name="name"
                    required
                    className="border-b border-line bg-transparent py-2 text-lg outline-none transition-colors placeholder:text-ink/30 focus:border-rust-bright"
                    placeholder="Your name"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="eyebrow text-ink/60">Email</span>
                  <input
                    type="email"
                    name="email"
                    required
                    className="border-b border-line bg-transparent py-2 text-lg outline-none transition-colors placeholder:text-ink/30 focus:border-rust-bright"
                    placeholder="your@email.com"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="eyebrow text-ink/60">Message</span>
                  <textarea
                    name="message"
                    required
                    rows={5}
                    className="resize-none border-b border-line bg-transparent py-2 text-lg outline-none transition-colors placeholder:text-ink/30 focus:border-rust-bright"
                    placeholder="What are you working on?"
                  />
                </label>

                <button
                  type="submit"
                  className="mt-2 inline-flex w-fit items-center gap-2 bg-rust px-6 py-3 font-display text-sm font-semibold text-paper transition-colors hover:bg-rust-bright"
                >
                  <Send size={16} />
                  Send message
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
