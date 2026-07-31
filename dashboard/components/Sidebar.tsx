"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 19.5c.6-3 2.8-4.75 5.5-4.75s4.9 1.75 5.5 4.75" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M14.75 19.5c.4-2.1 1.8-3.4 3.75-3.4 1.1 0 2.05.4 2.75 1.15" />
    </svg>
  );
}

function FormsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 3h6l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M14 3v4h4M9 13h6M9 17h4" />
    </svg>
  );
}

const navLinks = [
  {
    label: "Email",
    href: "/",
    icon: <EmailIcon className="size-5" />,
  },
  {
    label: "Calendar",
    href: "/calendar",
    icon: <CalendarIcon className="size-5" />,
  },
  {
    label: "Patient/Admin Info",
    href: "/info",
    icon: <UsersIcon className="size-5" />,
  },
  {
    label: "Forms/Reports",
    href: "/forms",
    icon: <FormsIcon className="size-5" />,
  },
];

export default function Sidebar({ title = "Dashboard" }: { title?: string }) {
  const [isOpen, setIsOpen] = useState(true);
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/") || pathname === href;
  }

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
          onClick={() => setIsOpen(!isOpen)}
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-[#fffaf2] transition hover:border-[#d8b79d]/60 hover:bg-[#9b6a4b]/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fffaf2] ${
            isOpen ? "ml-auto" : ""
          }`}
          aria-label="Toggle Sidebar"
          aria-expanded={isOpen}
        >
          <span aria-hidden="true" className="text-sm">
            {isOpen ? "←" : "→"}
          </span>
        </button>
      </div>

      <nav
        className={`flex-1 space-y-2 overflow-y-auto ${isOpen ? "p-3" : "px-2 py-3"}`}
        aria-label="Main navigation"
      >
        {navLinks.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={!isOpen ? item.label : undefined}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center rounded-2xl border transition-all duration-200 ${
                isOpen
                  ? "gap-3 px-3 py-3"
                  : "justify-center px-0 py-2.5"
              } ${
                active
                  ? "border-[#f3e8da]/35 bg-[#fffaf2]/20 shadow-sm"
                  : "border-transparent hover:border-white/20 hover:bg-white/10"
              }`}
            >
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  active
                    ? "bg-[#fffaf2] text-[#76503b]"
                    : "bg-[#143e54]/45 text-[#f7eee3] group-hover:bg-[#9b6a4b]"
                }`}
                aria-hidden="true"
              >
                {item.icon}
              </span>
              {isOpen && (
                <span className="truncate text-sm font-medium tracking-wide">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {isOpen && (
        <div className="m-3 rounded-2xl border border-white/15 bg-[#143e54]/35 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#d8c6b5]">
            Secure workspace
          </p>
          <p className="mt-1 text-sm text-[#fffaf2]/90">Administrative access</p>
        </div>
      )}
    </aside>
  );
}
