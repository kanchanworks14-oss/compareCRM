// app/src/lib/constants.js — labels and fixed values shared by the dashboard.
//
// Lead types (database enum LeadType): customer, developer, agent, owner.
export const ROLES = { ADMIN: "admin", MANAGER: "sales_manager", REP: "sales_rep" };
export const MANAGERS = [ROLES.ADMIN, ROLES.MANAGER];
export const ROLE_LABEL = { admin: "Super Admin", sales_manager: "Sales Manager", sales_rep: "Sales Representative" };
export const ROLE_SHORT = { admin: "SA", sales_manager: "SM", sales_rep: "SR" };

export const STAGES = ["new", "contacted", "qualified", "converted", "rejected"];
export const STAGE_COLORS = { new: "#4389f5", contacted: "#8b68e8", qualified: "#21b99a", converted: "#f6a544", rejected: "#e06c7c" };
export const VISIT_STATUSES = { scheduled: "Scheduled", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" };
export const MANUAL_ACTIVITY_TYPES = { note: "Note", call: "Call", email: "Email", whatsapp: "WhatsApp", meeting: "Meeting" };

export const ACTIVITY_LABEL = {
  ...MANUAL_ACTIVITY_TYPES,
  stage_change: "Status changed", assignment: "Assignment", follow_up_scheduled: "Follow-up scheduled",
  follow_up_completed: "Follow-up completed", follow_up_reopened: "Follow-up reopened",
  site_visit_scheduled: "Site visit scheduled", site_visit_updated: "Site visit updated", submission_review: "Submission review",
};

export const META_LABEL = {
  location: "Preferred location", budget: "Budget", propertyType: "Property type", message: "Message",
  companyName: "Company / developer", projectLocation: "Project location", projectType: "Project type",
  totalUnits: "Total units", reraNumber: "RERA number", possession: "Possession", agencyName: "Agency name",
  listingType: "Listing type", expectedPrice: "Expected price",
};

export const SOURCE_LABEL = {
  crm_customer_form: "CRM customer form",
  crm_developer_form: "CRM developer form",
  crm_agent_form: "CRM agent form",
  crm_broker_form: "CRM agent form (old)", // source of Agent leads saved before the agent rename
};
