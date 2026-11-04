// public-forms/src/components/Icons.jsx — small inline SVG icons (no icon font, no network).
const Svg = ({ children, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const HomeIcon = (p) => <Svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></Svg>;
export const BuildingIcon = (p) => <Svg {...p}><path d="M4 21V5l8-2v18" /><path d="M12 8h8v13" /><path d="M7.5 8h1M7.5 12h1M7.5 16h1M15.5 12h1M15.5 16h1" /><path d="M2 21h20" /></Svg>;
export const AgentIcon = (p) => <Svg {...p}><circle cx="12" cy="7.5" r="3.5" /><path d="M5 21v-1.5A5.5 5.5 0 0 1 10.5 14h3a5.5 5.5 0 0 1 5.5 5.5V21" /><path d="m12 14 1.2 2.5L12 21l-1.2-4.5Z" /></Svg>;
export const CheckIcon = (p) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
export const ArrowIcon = (p) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const AlertIcon = (p) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5.5M12 16.2v.3" /></Svg>;
export const MenuIcon = (p) => <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>;
export const CloseIcon = (p) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
