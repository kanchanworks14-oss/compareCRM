// public-forms/src/lib/query.js — property context passed in the URL,
// e.g. /forms/customer/?propertyId=665f…&propertyTitle=Sea%20View%20Towers
//
// Values are only pre-filled; the backend validates them again. propertyId
// must match the backend rule (letters, digits, _ and -, max 64) or it is
// dropped here rather than causing a submission error.
const PROPERTY_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function propertyContext(search = location.search) {
  const q = new URLSearchParams(search);
  const id = (q.get("propertyId") || "").trim();
  const title = (q.get("propertyTitle") || "").trim().slice(0, 150);
  return {
    propertyId: PROPERTY_ID.test(id) ? id : "",
    propertyTitle: title,
  };
}
