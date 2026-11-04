// public-forms/src/components/PageShell.jsx — header, page content, footer.
import SiteFooter from "./SiteFooter.jsx";
import SiteHeader from "./SiteHeader.jsx";

export default function PageShell({ page, onSelect, children }) {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <SiteHeader page={page} onSelect={onSelect} />
      <main id="main">{children}</main>
      <SiteFooter onSelect={onSelect} />
    </>
  );
}
