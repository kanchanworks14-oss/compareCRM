// app/src/components/Badges.jsx — category, status and review pills.
import { cap, typeClass, typeLabel } from "../lib/format.js";

export const TypeBadge = ({ type }) => <span className={`category-pill cat-${typeClass(type)}`}>{typeLabel(type)}</span>;

export const StageBadge = ({ stage }) => <span className={`status-pill status-${stage}`}>{cap(stage)}</span>;

export const ReviewBadge = ({ review }) =>
  review ? <span className={`status-pill review-${review.status}`}>{cap(review.status === "pending" ? "pending review" : review.status)}</span> : null;
