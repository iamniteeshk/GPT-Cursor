import { brand, navLinks } from '@/data'
import { onNavigateClick } from '@/lib/navigation'

const exploreLinks = [
  { label: 'Lotteries', href: '#lotteries' },
  { label: 'Apps', href: '#apps' },
  { label: 'Insights', href: '#insights' },
]

const companyLinks = [
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
]

const legalLinks = [
  { label: 'Privacy', href: '#privacy' },
  { label: 'Terms', href: '#terms' },
  { label: 'Disclaimer', href: '#disclaimer' },
]

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="footer" id="contact">
      <div className="footer__inner">
        <div className="footer__brand">
          <a
            href="#home"
            className="footer__logo"
            onClick={(e) => onNavigateClick(e, '#home')}
          >
            {brand.name}
          </a>
          <p className="footer__tagline">{brand.tagline}</p>
          <p className="footer__supporting">{brand.supporting}</p>
        </div>

        <div className="footer__cols">
          <div>
            <h3>Explore</h3>
            <ul>
              {exploreLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(e) => onNavigateClick(e, link.href)}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Company</h3>
            <ul>
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(e) => onNavigateClick(e, link.href)}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Legal</h3>
            <ul>
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(e) => onNavigateClick(e, link.href)}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="footer__legal" id="disclaimer">
        <p>{brand.disclaimer}</p>
        <p id="privacy">
          Privacy: LottoERY processes only information needed to operate this
          website and its applications. We do not sell personal data. Contact us
          for privacy inquiries.
        </p>
        <p id="terms" className="footer__legal-note">
          Terms: Please play responsibly and follow the laws in your
          jurisdiction. Lottery information and features may vary by region.
          LottoERY does not sell lottery tickets.
        </p>
        <p>
          © {year} {brand.name}. All rights reserved.
        </p>
        <p className="footer__credit">{brand.credit}</p>
        <nav className="footer__mini" aria-label="Footer">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => onNavigateClick(e, link.href)}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}

export default Footer
