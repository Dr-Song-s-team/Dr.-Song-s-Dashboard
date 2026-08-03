import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f0e8] font-sans text-[#513a2e]">
      <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-[#b8d4df]/45 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 size-96 rounded-full bg-[#cbb199]/25 blur-3xl" />
      <div className="relative flex min-h-screen w-full gap-5 p-4 sm:gap-8 sm:p-6">
        <Sidebar title="Dr. Song" />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
