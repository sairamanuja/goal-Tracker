"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { PageWrapper } from "@/components/shared/page-wrapper";
import type { Role } from "@/generated/prisma";
import type { NotificationItem } from "./notification-bell";

interface SidebarProviderProps {
  role: Role;
  userName: string;
  userEmail: string;
  department?: string | null;
  initialNotifications: NotificationItem[];
  children: React.ReactNode;
}

export function SidebarProvider({
  role,
  userName,
  userEmail,
  department,
  initialNotifications,
  children,
}: SidebarProviderProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem("sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        role={role}
        userName={userName}
        collapsed={collapsed}
        onToggle={toggle}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          userName={userName}
          userEmail={userEmail}
          role={role}
          department={department}
          notifications={initialNotifications}
          onMobileMenuOpen={() => setMobileOpen(true)}
        />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <PageWrapper>{children}</PageWrapper>
        </main>
      </div>
    </div>
  );
}
