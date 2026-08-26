import { Link } from '@tanstack/react-router'
import { Instagram, Mail, ExternalLink } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t border-line/70 bg-paper-raised">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-display text-2xl">
              Let's make something with texture.
            </p>
            <Link
              to="/contact"
              className="mt-2 inline-block eyebrow text-rust-bright hover:text-sand"
            >
              Start a conversation →
            </Link>
          </div>

          <div className="flex gap-5">
            <a
              href="mailto:hello@marisolfenn.art"
              className="text-ink/60 transition-colors hover:text-rust-bright"
              aria-label="Email"
            >
              <Mail size={18} />
            </a>
            <a
              href="https://instagram.com/marisolfenn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink/60 transition-colors hover:text-rust-bright"
              aria-label="Instagram"
            >
              <Instagram size={18} />
            </a>
            <a
              href="https://are.na/marisol-fenn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink/60 transition-colors hover:text-rust-bright"
              aria-label="Are.na"
            >
              <ExternalLink size={18} />
            </a>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line/70 pt-6 text-xs text-ink/40 sm:flex-row sm:justify-between">
          <span>© {'2026'} Marisol Fenn. Providence, RI.</span>
          <span>Site built with grain, ink, and a little bit of Tailwind.</span>
        </div>
      </div>
    </footer>
  )
}
