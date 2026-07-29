"use client";

import React, { useState } from "react";

interface SidebarItem {
  label: string;
  href: string;
  shortLabel: string;
}

interface SidebarProps {
  items: SidebarItem[];
  title?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ items, title = "Dashboard" }) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <aside
      className={`flex min-h-[calc(100vh-2rem)] shrink-0 flex-col overflow-hidden rounded-[2rem] border border-white/35 bg-gradient-to-br from-[#2f7694]/90 via-[#286985]/90 to-[#17465f]/95 text-[#fffaf2] shadow-[0_24px_70px_rgba(69,48,35,0.2)] backdrop-blur-2xl transition-[width] duration-300 ease-out sm:min-h-[calc(100vh-3rem)] ${
        isOpen ? "w-72" : "w-20"
      }`}
    >
      <div
        className={`flex items-center gap-3 border-b border-white/20 ${
          isOpen ? "p-4" : "justify-center p-3"
        }`}
      >
        {isOpen && (
          <>
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#9b6a4b] text-sm font-bold tracking-[0.16em] text-[#fffaf2] shadow-lg shadow-[#173f55]/30">
              DS
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium uppercase tracking-[0.22em] text-[#e8dccb]">
                Clinic portal
              </p>
              <h1 className="truncate text-lg font-semibold">{title}</h1>
            </div>
          </>
        )}
        <button
          type="button"
          onClick={toggleSidebar}
          className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-[#fffaf2] transition hover:border-[#d8b79d]/60 hover:bg-[#9b6a4b]/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fffaf2]"
          aria-label="Toggle Sidebar"
          aria-expanded={isOpen}
        >
          <span aria-hidden="true" className="text-sm">
            {isOpen ? "←" : "→"}
          </span>
        </button>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto p-3" aria-label="Main navigation">
        {items.map((item, index) => (
          <a
            key={item.href}
            href={item.href}
            className={`group flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all duration-200 ${
              index === 0
                ? "border-[#f3e8da]/35 bg-[#fffaf2]/20 shadow-sm"
                : "border-transparent hover:border-white/20 hover:bg-white/10"
            }`}
          >
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold transition-colors ${
                index === 0
                  ? "bg-[#fffaf2] text-[#76503b]"
                  : "bg-[#143e54]/45 text-[#f7eee3] group-hover:bg-[#9b6a4b]"
              }`}
              aria-hidden="true"
            >
              {item.shortLabel}
            </span>
            {isOpen && (
              <span className="truncate text-sm font-medium tracking-wide">
                {item.label}
              </span>
            )}
          </a>
        ))}
      </nav>

      {isOpen && (
        <div className="m-3 rounded-2xl border border-white/15 bg-[#143e54]/35 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#d8c6b5]">
            Secure workspace
          </p>
          <p className="mt-1 text-sm text-[#fffaf2]/90">
            Administrative access
          </p>
        </div>
      )}
    </aside>
  );
};

export default function Home() {
  const navLinks: SidebarItem[] = [
    { label: "Email", href: "/", shortLabel: "E" },
    { label: "Calendar", href: "/calendar", shortLabel: "C" },
    { label: "Patient/Admin Info", href: "/info", shortLabel: "P" },
    { label: "Forms/Reports", href: "/forms", shortLabel: "F" },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f0e8] font-sans text-[#513a2e]">
      <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-[#b8d4df]/45 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 size-96 rounded-full bg-[#cbb199]/25 blur-3xl" />

      <main className="relative flex min-h-screen w-full gap-5 p-4 sm:gap-8 sm:p-6">
        <Sidebar items={navLinks} title="Dr. Song" />
        <section className="flex flex-1 items-center justify-center rounded-[2rem] border border-[#8c6349]/10 bg-[#fffaf2]/65 p-8 shadow-[0_24px_70px_rgba(93,63,44,0.08)] backdrop-blur-sm">
          <div className="max-w-xl">
            <p className="mb-4 inline-flex rounded-full bg-[#8d6248]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#7a5138]">
              Clinic operations
            </p>
            <h2 className="text-4xl font-semibold tracking-tight text-[#4a3327] sm:text-5xl">
              Welcome to your dashboard.
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#765d4e]">
              Select a section from the navigation to manage messages,
              appointments, patient information, and reports.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
