"use client";

import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Menu } from "lucide-react";
import type { Role } from "@/generated/prisma";
import { NotificationBell, type NotificationItem } from "./notification-bell";

interface TopbarProps {
  userName: string;
  userEmail: string;
  role: Role;
  department?: string | null;
  notifications: NotificationItem[];
  onMobileMenuOpen?: () => void;
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function Topbar({
  userName,
  userEmail,
  role,
  department,
  notifications,
  onMobileMenuOpen,
}: TopbarProps) {
  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 md:px-6">
      {/* Mobile: hamburger + logo */}
      <div className="flex items-center gap-2 md:hidden">
        <button
          onClick={onMobileMenuOpen}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
          G
        </div>
        <span className="font-semibold text-sm">GoalTrack</span>
      </div>

      {/* Desktop spacer */}
      <div className="hidden md:block" />

      <div className="flex items-center gap-3">
        {department && (
          <span className="hidden sm:flex items-center bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
            {department}
          </span>
        )}
        <NotificationBell notifications={notifications} />
        <DropdownMenu>
          <DropdownMenuTrigger className="relative h-8 w-8 rounded-full border-none bg-transparent cursor-pointer">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {initials(userName)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
                  <p className="text-xs leading-none text-muted-foreground capitalize">
                    {role.toLowerCase()}
                  </p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="cursor-pointer text-destructive"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
