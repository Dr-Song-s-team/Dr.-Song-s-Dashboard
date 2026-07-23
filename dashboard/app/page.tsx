"use client"
import Image from "next/image";
import React, { useState } from 'react';

interface SidebarItem {
  label: string;
  href: string;
}

interface SidebarProps {
  items: SidebarItem[];
  title?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ items, title = "Dashboard" }) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <div className={`flex flex-col h-screen bg-slate-900 text-white transition-all duration-300 ${isOpen ? 'w-64' : 'w-20'}`}>
      
      {/* Header section with toggle button */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        {isOpen && <h1 className="font-bold text-lg truncate">{title}</h1>}
        <button 
          onClick={toggleSidebar} 
          className="p-2 rounded hover:bg-slate-800 ml-auto"
          aria-label="Toggle Sidebar"
        >
          {isOpen ? '◀' : '▶'}
        </button>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {items.map((item, index) => (
          <a
            key={index}
            href={item.href}
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors group"
          >
            {isOpen && <span className="text-sm font-medium transition-opacity duration-200">{item.label}</span>}
          </a>
        ))}
      </nav>
      
    </div>
  );
};

export default function Home() {
  const navLinks: SidebarItem[] = [
    { label: 'Email', href: '/'},
    { label: 'Calendar', href: '/calendar'},
    { label: 'Patient/Admin Info', href: '/info'},
    { label: 'Forms/Reports', href: '/forms'}
  ];

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Sidebar items={navLinks} title="Sections"/>
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          
          
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          
          
        </div>
      </main>
    </div>
  );
}
