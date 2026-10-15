// ABOUTME: The app's top-level sections in navigation order, shared by the sidebar, the mobile
// ABOUTME: tab bar and More sheet, and the top bar's page title.
import {
  Activity,
  BookOpen,
  Calendar,
  FileText,
  FlaskConical,
  HeartHandshake,
  Home,
  type LucideIcon,
  Stethoscope,
  BellRing,
} from "lucide-react";

export type NavPath =
  | "/"
  | "/labs"
  | "/plan"
  | "/documents"
  | "/team"
  | "/learn"
  | "/activity"
  | "/circle"
  | "/reminders";

export type NavItem = {
  to: NavPath;
  label: string;
  icon: LucideIcon;
  /** "tab" sits in the mobile bottom bar; "more" sits in the More sheet. */
  mobile: "tab" | "more";
};

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Today", icon: Home, mobile: "tab" },
  { to: "/labs", label: "Labs", icon: FlaskConical, mobile: "tab" },
  { to: "/plan", label: "Plan", icon: Calendar, mobile: "tab" },
  { to: "/documents", label: "Documents", icon: FileText, mobile: "tab" },
  { to: "/team", label: "Team", icon: Stethoscope, mobile: "more" },
  { to: "/learn", label: "Learn", icon: BookOpen, mobile: "more" },
  { to: "/activity", label: "Activity", icon: Activity, mobile: "more" },
  { to: "/circle", label: "Care circle", icon: HeartHandshake, mobile: "more" },
  { to: "/reminders", label: "Reminders", icon: BellRing, mobile: "more" },
];

/** The nav item a pathname belongs to: an exact match for "/", otherwise the section prefix. */
export function navItemForPath(pathname: string): NavItem | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/") return NAV_ITEMS[0];
  return NAV_ITEMS.find(
    (item) => item.to !== "/" && (path === item.to || path.startsWith(`${item.to}/`)),
  );
}
