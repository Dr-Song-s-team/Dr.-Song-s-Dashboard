export default function Home() {
  return (
    <section className="flex flex-1 items-center justify-center rounded-[2rem] border border-[#8c6349]/10 bg-[#fffaf2]/65 p-8 shadow-[0_24px_70px_rgba(93,63,44,0.08)] backdrop-blur-sm">
      <div className="max-w-xl">
        <p className="mb-4 inline-flex rounded-full bg-[#8d6248]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#7a5138]">
          Clinic operations
        </p>
        <h2 className="text-4xl font-semibold tracking-tight text-[#4a3327] sm:text-5xl">
          Welcome to your dashboard.
        </h2>
        <p className="mt-5 max-w-lg text-base leading-7 text-[#765d4e]">
          Select a section from the navigation to manage messages, appointments,
          patient information, and reports.
        </p>
      </div>
    </section>
  );
}
