import { brand, navLinks } from '@/data'

const legalLinks = [
  { label: 'Privacy', href: '#privacy' },
  { label: 'Terms', href: '#terms' },
  { label: 'Disclaimer', href: '#disclaimer' },
  { label: 'Contact', href: '#contact' },
]

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="footer" id="contact">
      <div className="footer__inner">
        <div className="footer__brand">
          <a href="#home" className="footer__logo">
            {brand.name}
          </a>
          <p className="footer__tagline">{brand.tagline}</p>
          <p className="footer__supporting">{brand.supporting}</p>
        </div>

        <div className="footer__cols">
          <div>
            <h3>Explore</h3>
            <ul>
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Legal</h3>
            <ul>
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="footer__legal" id="disclaimer">
        <p>{brand.disclaimer}</p>
        <p id="privacy">
          © {year} {brand.name}. All rights reserved.
        </p>
        <p id="terms" className="footer__legal-note">
          Lottery results and analysis are provided for informational purposes
          only. Please play responsibly and follow the laws in your jurisdiction.
        </p>
      </div>
    </footer>
  )
}

export default Footer
