// app/src/routes.jsx — dashboard pages, their nav entries and page titles.
//
// Hash URLs (/#/leads) are used because backend/server.js only serves real
// files; a refresh on /leads would hit its JSON 404.
import { MANAGERS } from "./lib/constants.js";
import DashboardPage from "./pages/DashboardPage.jsx";
import LeadsPage from "./pages/LeadsPage.jsx";
import FollowUpsPage from "./pages/FollowUpsPage.jsx";
import SiteVisitsPage from "./pages/SiteVisitsPage.jsx";
import SubmissionsPage from "./pages/SubmissionsPage.jsx";
import TeamPage from "./pages/TeamPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

// title: [nav/breadcrumb label, page heading, subtitle]
export const ROUTES = [
  { path: "/", icon: "▦", title: ["Overview", "Overview", "What’s happening with your property leads."], element: <DashboardPage /> },
  { path: "/leads", icon: "◉", count: true, title: ["All Leads", "Lead management", "Search, categorize and assign incoming enquiries."], element: <LeadsPage key="all" /> },
  { path: "/customers", icon: "♙", title: ["Customer Leads", "Customer enquiries", "Property requirements from customers."], element: <LeadsPage key="customer" category="customer" /> },
  { path: "/developers", icon: "⌂", title: ["Developer Leads", "Developer leads", "Project owners and developer enquiries."], element: <LeadsPage key="developer" category="developer" /> },
  { path: "/agents", icon: "♧", title: ["Agent Leads", "Agent leads", "Property submissions from agents."], element: <LeadsPage key="agent" category="agent" /> },
  { path: "/follow-ups", icon: "◷", title: ["Follow-ups", "Follow-up queue", "Never miss the next conversation."], element: <FollowUpsPage /> },
  { path: "/site-visits", icon: "⌖", title: ["Site Visits", "Site visit planner", "Schedule and track property visits."], element: <SiteVisitsPage /> },
  { path: "/submissions", icon: "▤", roles: MANAGERS, title: ["Submission Review", "Submission review", "Review projects and properties submitted by developers and agents."], element: <SubmissionsPage /> },
  { section: "MANAGE" },
  { path: "/team", icon: "♧", roles: MANAGERS, title: ["Sales Team", "Team workspace", "Workload and lead assignment across the sales team."], element: <TeamPage /> },
  { path: "/reports", icon: "▥", title: ["Reports & Analytics", "Performance reports", "Lead sources, pipeline and conversion from live data."], element: <ReportsPage /> },
  { path: "/settings", icon: "⚙", title: ["Account & Settings", "Account & settings", "Your account, password and access level."], element: <SettingsPage /> },
];

export const PAGES = ROUTES.filter((r) => r.path);
