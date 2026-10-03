/** أيقونات SVG خفيفة بدون مكتبات خارجية */
import type { ReactNode } from 'react';

type IconProps = { size?: number; className?: string };

function Svg({ size = 20, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconHome(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </Svg>
  );
}

export function IconCart(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="20" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18" cy="20" r="1.5" fill="currentColor" stroke="none" />
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.5L21 8H7" />
    </Svg>
  );
}

export function IconReceipt(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 3h12v18l-2-1.2L14 21l-2-1.2L10 21l-2-1.2L6 21V3z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </Svg>
  );
}

export function IconBoxes(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.3 7 12 12l8.7-5M12 12v9.5" />
    </Svg>
  );
}

export function IconWallet(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H19a1 1 0 0 1 1 1v2" />
      <path d="M3 7.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6H13a2 2 0 0 0 0 4h7" />
      <circle cx="16.5" cy="14" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconChart(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 16v-5M12 16V8M16 16v-3M20 16v-8" />
    </Svg>
  );
}

export function IconPrint(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 9V3h12v6" />
      <path d="M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <path d="M6 13h12v8H6z" />
    </Svg>
  );
}

export function IconSettings(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  );
}

export function IconUsers(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M21 19a4.5 4.5 0 0 0-4.5-4.5" />
    </Svg>
  );
}

export function IconLogout(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M16 8l4 4-4 4M20 12H10" />
    </Svg>
  );
}

export function IconTag(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M20 12 12 4H5v7l8 8 7-7z" />
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconTrend(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 17 10 10l4 4 7-7" />
      <path d="M14 7h7v7" />
    </Svg>
  );
}

export function IconPackage(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3z" />
      <path d="M12 12 4 7.5M12 12l8-4.5M12 12v9" />
    </Svg>
  );
}

export function IconLock(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

export function IconRefresh(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 3v6h-6" />
    </Svg>
  );
}

const SECTION_ICONS = {
  dashboard: IconHome,
  purchases: IconCart,
  sales: IconReceipt,
  inventory: IconBoxes,
  accounting: IconWallet,
  reports: IconChart,
  printing: IconPrint,
  settings: IconSettings,
} as const;

export type SectionIconKey = keyof typeof SECTION_ICONS;

export function SectionIcon({ name, size = 18, className }: { name: SectionIconKey; size?: number; className?: string }) {
  const C = SECTION_ICONS[name] || IconHome;
  return <C size={size} className={className} />;
}
