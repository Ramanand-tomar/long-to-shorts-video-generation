"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import {
  Play,
  LogOut,
  LayoutDashboard,
  Film,
  Scissors,
  Calendar,
  Settings,
  Share2,
  Plus
} from "lucide-react";
import UploadModal from "./UploadModal";

interface DbUser {
  id: string;
  clerkUserId: string;
  email: string;
  name: string | null;
  plan: string;
  uploadCount24h: number;
  lastUploadAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DashboardShellProps {
  user: DbUser;
  children: React.ReactNode;
}

export default function DashboardShell({ user, children }: DashboardShellProps) {
  const pathname = usePathname();
  const [uploadOpen, setUploadOpen] = useState(false);

  const navItems: Array<{ name: string; href: string; icon: React.ComponentType<{ className?: string }>; disabled?: boolean }> = [
    { name: "Home", href: "/dashboard", icon: LayoutDashboard },
    { name: "My Videos", href: "/dashboard/videos", icon: Film },
    { name: "Clips", href: "/dashboard/clips", icon: Scissors },
    { name: "Social", href: "/dashboard/social", icon: Share2 },
    { name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex text-white relative">
      {/* Sidebar (Desktop) */}
      <aside className="w-64 border-r border-zinc-900 bg-zinc-950/40 p-6 flex flex-col justify-between hidden md:flex flex-shrink-0">
        <div className="space-y-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-md shadow-violet-500/10 group-hover:scale-105 transition-all">
              <Play className="w-4 h-4 text-white fill-white ml-0.5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              VidShort
            </span>
          </Link>

          <nav className="space-y-1">
            {navItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              if (item.disabled) {
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-600 font-medium text-sm cursor-not-allowed select-none"
                    title="Coming soon in Phase 3 & 4"
                  >
                    <Icon className="w-4.5 h-4.5" />
                    <span>{item.name}</span>
                    <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-500 ml-auto font-bold uppercase tracking-wider scale-90">
                      Soon
                    </span>
                  </div>
                );
              }

              return (
                <Link
                  key={idx}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm border transition-all ${
                    isActive
                      ? "bg-violet-600/10 text-violet-400 border-violet-500/20 shadow-sm"
                      : "text-zinc-400 border-transparent hover:text-white hover:bg-zinc-900/40"
                  }`}
                >
                  <Icon className="w-4.5 h-4.5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile section & sign out */}
        <div className="border-t border-zinc-900 pt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center font-bold text-sm text-violet-300">
              {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-sm truncate">{user.name || "Creator"}</p>
              <p className="text-zinc-500 text-xs truncate capitalize">{user.plan} plan</p>
            </div>
          </div>

          <SignOutButton>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 font-semibold text-sm transition-colors">
              <LogOut className="w-4.5 h-4.5" />
              Sign Out
            </button>
          </SignOutButton>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Topbar */}
        <header className="h-20 border-b border-zinc-900 bg-zinc-950/20 px-6 sm:px-10 flex items-center justify-between flex-shrink-0">
          <div className="md:hidden flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center">
                <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
              </div>
            </Link>
          </div>
          
          <h2 className="hidden md:block text-zinc-400 font-bold text-sm tracking-wide uppercase">
            Workspace
          </h2>

          <div className="flex items-center gap-4 ml-auto">
            <button
              onClick={() => setUploadOpen(true)}
              className="py-2.5 px-4 sm:px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-violet-500/10 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Upload Video</span>
              <span className="sm:hidden">Upload</span>
            </button>

            {/* Avatar / Sign out (Mobile only) */}
            <div className="md:hidden">
              <SignOutButton>
                <button className="p-2.5 rounded-xl border border-zinc-900 text-zinc-400 hover:text-white transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </SignOutButton>
            </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Upload Modal (renders portalled on state change) */}
      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        userPlan={user.plan}
      />
    </div>
  );
}
