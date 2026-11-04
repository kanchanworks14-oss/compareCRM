// public-forms/src/pages/FormsPage.jsx — the single public page, /forms/.
// All three forms live here behind tabs; ?form=customer|developer|agent picks
// one (default customer), so every form has a shareable link. The customer
// form also accepts ?propertyId=…&propertyTitle=… from property pages.
//
// The three forms stay mounted (inactive ones are hidden), so switching tabs
// keeps what the visitor has typed. Field ids are prefixed per form, so they
// never clash.
import { useEffect, useState } from "react";
import EnquiryForm from "../components/EnquiryForm.jsx";
import PageShell from "../components/PageShell.jsx";
import { AgentIcon, BuildingIcon, CheckIcon, HomeIcon } from "../components/Icons.jsx";
import { agentForm } from "../forms/agentForm.js";
import { customerForm } from "../forms/customerForm.js";
import { developerForm } from "../forms/developerForm.js";
import { propertyContext } from "../lib/query.js";

export const FORMS = [
  {
    key: "customer", config: customerForm, icon: HomeIcon, tone: "blue", tab: "Buy or rent",
    title: "Customer property enquiry", docTitle: "Property Enquiry",
    intro: "Tell us what kind of property you're looking for and our team will get back to you.",
    notes: [
      "A property advisor reviews your requirements.",
      "We call or email you with matching projects.",
      "We help you arrange site visits when you're ready.",
    ],
  },
  {
    key: "developer", config: developerForm, icon: BuildingIcon, tone: "violet", tab: "List a project",
    title: "Developer project submission", docTitle: "List Your Project",
    intro: "Share your details and the project you'd like to list. Our team reviews every submission before it goes live.",
    notes: [
      "Our listings team reviews your project details.",
      "We may ask for RERA registration and approvals.",
      "Once approved, your project is listed on Compare Projects.",
    ],
  },
  {
    key: "agent", config: agentForm, icon: AgentIcon, tone: "green", tab: "For agents",
    title: "Agent property submission", docTitle: "Agent Property Submission",
    intro: "Register your details and the property you represent. Our team reviews every submission.",
    notes: [
      "Our team verifies the listing and your agent details.",
      "We contact you to confirm pricing and availability.",
      "Approved properties are shared with matching buyers.",
    ],
  },
];

const KEYS = FORMS.map((f) => f.key);
const formFromUrl = () => {
  const key = new URLSearchParams(location.search).get("form");
  return KEYS.includes(key) ? key : KEYS[0];
};

export default function FormsPage() {
  const [active, setActive] = useState(formFromUrl);
  const [initial] = useState(propertyContext);
  const current = FORMS.find((f) => f.key === active);

  useEffect(() => {
    const onPop = () => setActive(formFromUrl());
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    document.title = `${current.docTitle} | Compare Projects`;
  }, [current]);

  // Switch tab and record it in the URL (keeping other params such as propertyId).
  const select = (key) => {
    if (key === active) return;
    const q = new URLSearchParams(location.search);
    q.set("form", key);
    history.pushState(null, "", `?${q}`);
    setActive(key);
  };

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const onTabKey = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    const next = KEYS[(KEYS.indexOf(active) + step + KEYS.length) % KEYS.length];
    select(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  const Icon = current.icon;
  return (
    <PageShell page={active} onSelect={select}>
      <section className={`page-head tone-${current.tone}`}>
        <div className="container">
          <div className="form-tabs" role="tablist" aria-label="Enquiry forms" onKeyDown={onTabKey}>
            {FORMS.map(({ key, tab, icon: TabIcon }) => (
              <button
                key={key} id={`tab-${key}`} type="button" role="tab" className="form-tab"
                aria-selected={key === active} aria-controls={`panel-${key}`} tabIndex={key === active ? 0 : -1}
                onClick={() => select(key)}
              >
                <TabIcon size={18} /> {tab}
              </button>
            ))}
          </div>
          <div className="page-head-row">
            <span className="choice-icon"><Icon size={30} /></span>
            <div>
              <h1>{current.title}</h1>
              <p>{current.intro}</p>
            </div>
          </div>
        </div>
      </section>
      <div className="container form-layout">
        <div>
          {FORMS.map(({ key, config }) => (
            <div key={key} id={`panel-${key}`} role="tabpanel" aria-labelledby={`tab-${key}`} hidden={key !== active}>
              <EnquiryForm config={config} initial={key === "customer" ? initial : undefined} />
            </div>
          ))}
        </div>
        <aside className="side-panel">
          <h2>What happens next</h2>
          <ul>{current.notes.map((n) => <li key={n}><CheckIcon size={18} /><span>{n}</span></li>)}</ul>
          <p className="side-small">No account or password needed. Fields marked * are required.</p>
        </aside>
      </div>
    </PageShell>
  );
}
