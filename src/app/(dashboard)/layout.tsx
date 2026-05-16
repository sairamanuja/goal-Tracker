import { requireAuth } from "@/lib/auth-guard";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { getUserNotifications } from "@/lib/cached-queries";
import type { NotificationItem } from "@/components/layout/notification-bell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();
  const { name, email, role, department, userId } = session.user;

  const rawNotifs = await getUserNotifications(userId);

  const notifications: NotificationItem[] = rawNotifs.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    href: n.href,
    read: n.read,
    createdAt: n.createdAt,
  }));

  return (
    <SidebarProvider
      role={role}
      userName={name ?? ""}
      userEmail={email ?? ""}
      department={department}
      initialNotifications={notifications}
    >
      {children}
    </SidebarProvider>
  );
}
