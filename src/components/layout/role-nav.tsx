import type { Role } from "@/generated/prisma";
import {
  LayoutDashboard,
  Target,
  CheckSquare,
  Users,
  CalendarClock,
  TrendingUp,
  AlertTriangle,
  FileBarChart,
  Share2,
  ScrollText,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: React.ElementType;
};

export const navByRole: Record<Role, NavItem[]> = {
  EMPLOYEE: [
    { title: "My Goals", href: "/employee/goals", icon: Target },
    { title: "Check-Ins", href: "/employee/check-ins", icon: CheckSquare },
  ],
  MANAGER: [
    { title: "Dashboard", href: "/manager/dashboard", icon: LayoutDashboard },
    { title: "My Team", href: "/manager/team", icon: Users },
    { title: "Shared Goals", href: "/manager/shared-goals", icon: Share2 },
  ],
  ADMIN: [
    { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { title: "Goal Cycles", href: "/admin/cycles", icon: CalendarClock },
    { title: "Users", href: "/admin/users", icon: Users },
    { title: "Shared Goals", href: "/admin/shared-goals", icon: Share2 },
    { title: "Audit Log", href: "/admin/audit-log", icon: ScrollText },
    { title: "Reports", href: "/admin/reports", icon: FileBarChart },
    { title: "Analytics", href: "/admin/analytics", icon: TrendingUp },
    { title: "Escalations", href: "/admin/escalations", icon: AlertTriangle },
  ],
};
