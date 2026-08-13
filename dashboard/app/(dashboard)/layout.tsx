"use client";

import { useCallback, useState } from "react";
import Sidebar from "@/components/Sidebar";
import ChatWidget from "@/components/chat/ChatWidget";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isImporting, setIsImporting] = useState(false);

  const handleImportGmail = useCallback(async () => {
    if (isImporting) return;

    setIsImporting(true);

    try {
      const res = await fetch("/api/import-gmail", {
        method: "POST",
        cache: "no-store",
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);

        console.error("Failed to import Gmail:", error);
        return;
      }

      console.log("Gmail import successful");
    } catch (error) {
      console.error("Gmail import failed:", error);
    } finally {
      setIsImporting(false);
    }
  }, [isImporting]);

  return (
    <div className="flex min-h-screen gap-4 p-4">
      <Sidebar
        title="Dashboard"
        onRefresh={handleImportGmail}
        isRefreshing={isImporting}
      />

      <main className="min-w-0 flex-1">
        {children}
      </main>

      <ChatWidget />
    </div>
  );
}