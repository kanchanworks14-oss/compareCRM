// public-forms/src/components/SiteFooter.jsx
import { Brand, NAV, navClick } from "./SiteHeader.jsx";

export default function SiteFooter({ onSelect }) {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-about">
          <Brand />
          <p>Compare Projects helps buyers, developers and agents find the right property match. Send us an enquiry and our team will get in touch.</p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <b>Enquiry forms</b>
          {NAV.map((n) => <a key={n.page} href={n.href} onClick={navClick(onSelect, n.page)}>{n.label}</a>)}
        </nav>
        <div className="footer-note">
          <b>Your privacy</b>
          <p>We use your details only to respond to your enquiry. We never share them without your consent.</p>
        </div>
      </div>
      <div className="container footer-bottom">© {new Date().getFullYear()} Compare Projects. All rights reserved.</div>
    </footer>
  );
}
