"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, History, FolderTree, User as UserIcon, Scan } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: typeof Camera;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Scanner",
    href: "/scanner",
    icon: Camera,
  },
  {
    label: "History",
    href: "/history",
    icon: History,
  },
  {
    label: "Products",
    href: "/products",
    icon: FolderTree,
  },
  {
    label: "Profile",
    href: "/profile",
    icon: UserIcon,
  },
];

export default function Navigation() {
  const pathname = usePathname();

  const isScannerActive = pathname === "/" || pathname === "/scanner";

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. DESKTOP / TABLET TOP NAVBAR (Visible on md and larger screens)        */}
      {/* ========================================================================= */}
      <header
        className="hidden md:block sticky top-0 z-50 backdrop-blur-md px-6 py-3 border-b"
        style={{
          background: "rgba(15, 15, 20, 0.90)",
          borderColor: "var(--bg-card-hover)",
        }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/scanner"
            className="flex items-center gap-2 font-bold text-lg cursor-pointer flex-shrink-0"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
              style={{ background: "var(--accent)" }}
            >
              <Scan className="w-4 h-4" />
            </div>
            <span>
              Label<span style={{ color: "var(--accent)" }}>Check</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="flex items-center gap-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/scanner" ? isScannerActive : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer min-h-[44px] ${
                    isActive
                      ? "text-white shadow-sm"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
                  }`}
                  style={{
                    background: isActive ? "var(--bg-card)" : "transparent",
                    border: isActive ? "1px solid var(--bg-card-hover)" : "1px solid transparent",
                  }}
                >
                  <Icon
                    className="w-4 h-4"
                    style={{ color: isActive ? "var(--accent-light)" : "currentColor" }}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MOBILE TOP MINIMAL HEADER (Brand Title only, no logout or email)       */}
      {/* ========================================================================= */}
      <header
        className="md:hidden sticky top-0 z-40 backdrop-blur-md px-4 py-2.5 border-b"
        style={{
          background: "rgba(15, 15, 20, 0.92)",
          borderColor: "var(--bg-card-hover)",
        }}
      >
        <div className="flex items-center justify-between">
          <Link href="/scanner" className="flex items-center gap-2 font-bold text-base cursor-pointer">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
              style={{ background: "var(--accent)" }}
            >
              <Scan className="w-3.5 h-3.5" />
            </div>
            <span>
              Label<span style={{ color: "var(--accent)" }}>Check</span>
            </span>
          </Link>
          <div className="text-[10px] text-zinc-400 font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800">
            Legal Metrology
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3. MOBILE FIXED BOTTOM TAB BAR (Exactly 4 tabs, always visible)           */}
      {/* ========================================================================= */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-xl px-2 py-1.5"
        style={{
          background: "rgba(15, 15, 20, 0.95)",
          borderColor: "rgba(255, 255, 255, 0.08)",
          paddingBottom: "max(env(safe-area-inset-bottom, 8px), 8px)",
        }}
      >
        <div className="grid grid-cols-4 max-w-md mx-auto items-center">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/scanner" ? isScannerActive : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer select-none min-h-[50px] relative ${
                  isActive ? "text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {/* Active glow indicator */}
                {isActive && (
                  <div
                    className="absolute -top-1.5 w-6 h-1 rounded-full"
                    style={{
                      background: "var(--accent)",
                      boxShadow: "0 0 10px var(--accent-glow)",
                    }}
                  />
                )}

                <div
                  className={`p-1 rounded-lg transition-transform ${
                    isActive ? "scale-110" : ""
                  }`}
                  style={{
                    color: isActive ? "var(--accent-light)" : "currentColor",
                  }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-[10px] font-medium tracking-tight mt-0.5 ${
                    isActive ? "font-semibold text-purple-300" : ""
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
