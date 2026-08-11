import type { MouseEvent } from 'react'

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Smooth-scroll to an in-page id (supports #id or id). */
export function scrollToId(target: string) {
  const id = target.startsWith('#') ? target.slice(1) : target
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  })
  if (el instanceof HTMLElement) {
    const prev = el.getAttribute('tabindex')
    if (prev === null) el.setAttribute('tabindex', '-1')
    el.focus({ preventScroll: true })
    if (prev === null) {
      el.addEventListener(
        'blur',
        () => {
          el.removeAttribute('tabindex')
        },
        { once: true },
      )
    }
  }
}

export function onNavigateClick(
  event: MouseEvent<HTMLAnchorElement>,
  href: string,
) {
  if (!href.startsWith('#')) return
  event.preventDefault()
  scrollToId(href)
  history.pushState(null, '', href)
}
