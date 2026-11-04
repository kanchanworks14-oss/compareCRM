// public-forms/src/components/SiteHeader.jsx — brand + links to the three forms.
// The links are real URLs (/forms/?form=…); on the forms page a plain click
// switches the tab in place instead of reloading.
import { useState } from "react";
import { CloseIcon, MenuIcon } from "./Icons.jsx";

export const NAV = [
  { page: "customer", href: "/forms/?form=customer", label: "Buy or rent" },
  { page: "developer", href: "/forms/?form=developer", label: "List a project" },
  { page: "agent", href: "/forms/?form=agent", label: "For agents" },
];

// Click handler for a NAV link: switch in place unless the visitor wants a new tab/window.
export const navClick = (onSelect, page, after) => (e) => {
  if (!onSelect || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  onSelect(page);
  after?.();
  scrollTo({ top: 0 });
};

export function Brand() {
  return (
    <a className="brand" href="/forms/" aria-label="Compare Projects — enquiry forms">
      <span className="brand-mark">CP</span>
      <span className="brand-text"><b>Compare Projects</b><small>Property enquiries</small></span>
    </a>
  );
}

export default function SiteHeader({ page, onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <button className="menu-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="site-nav" aria-label={open ? "Close menu" : "Open menu"}>
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
        <nav id="site-nav" className={`site-nav${open ? " open" : ""}`} aria-label="Enquiry forms">
          {NAV.map((n) => (
            <a
              key={n.page} href={n.href} className={n.page === page ? "active" : undefined}
              aria-current={n.page === page ? "page" : undefined}
              onClick={navClick(onSelect, n.page, () => setOpen(false))}
            >
              {n.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
