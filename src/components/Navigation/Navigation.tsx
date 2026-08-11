import { useEffect, useState } from 'react'
import { brand, navLinks } from '@/data'
import { onNavigateClick } from '@/lib/navigation'

export function Navigation() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('#home')

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 16)
      const sections = navLinks.map((l) => l.href.slice(1))
      let current = '#home'
      for (const id of sections) {
        const el = document.getElementById(id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= 120) current = `#${id}`
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header
      className={`nav ${scrolled ? 'nav--scrolled' : ''} ${open ? 'nav--open' : ''}`}
    >
      <div className="nav__inner">
        <a
          href="#home"
          className="nav__logo"
          onClick={(e) => {
            onNavigateClick(e, '#home')
            setOpen(false)
          }}
        >
          <span className="nav__logo-mark" aria-hidden="true" />
          <span className="nav__logo-text">{brand.name}</span>
        </a>

        <nav className="nav__links" aria-label="Primary">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`nav__link ${active === link.href ? 'is-active' : ''}`}
              aria-current={active === link.href ? 'page' : undefined}
              onClick={(e) => onNavigateClick(e, link.href)}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href="#lotteries"
          className="nav__cta btn btn--gold btn--sm"
          onClick={(e) => onNavigateClick(e, '#lotteries')}
        >
          Explore Lotteries
        </a>

        <button
          type="button"
          className="nav__toggle"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div id="mobile-nav" className={`nav__mobile ${open ? 'is-open' : ''}`}>
        <nav aria-label="Mobile">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`nav__mobile-link ${active === link.href ? 'is-active' : ''}`}
              onClick={(e) => {
                onNavigateClick(e, link.href)
                setOpen(false)
              }}
            >
              {link.label}
            </a>
          ))}
          <a
            href="#lotteries"
            className="btn btn--gold"
            onClick={(e) => {
              onNavigateClick(e, '#lotteries')
              setOpen(false)
            }}
          >
            Explore Lotteries
          </a>
        </nav>
      </div>
    </header>
  )
}

export default Navigation
