// app/src/components/ContactCell.jsx — avatar + name + email for lead tables.
import { initials, typeClass } from "../lib/format.js";

const AVATAR_CLASS = { developer: "violet", agent: "green", owner: "orange" };

export default function ContactCell({ lead }) {
  return (
    <div className="contact-cell">
      <span className={`contact-avatar ${AVATAR_CLASS[typeClass(lead.leadType)] || ""}`}>{initials(lead.name)}</span>
      <span><b>{lead.name}</b><small>{lead.email}</small></span>
    </div>
  );
}
