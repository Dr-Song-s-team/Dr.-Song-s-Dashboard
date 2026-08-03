import Link from "next/link";

export default function PatientNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center rounded-[2rem] border border-[#8c6349]/10 bg-[#fffaf2]/65 p-12 text-center shadow-[0_24px_70px_rgba(93,63,44,0.08)] backdrop-blur-sm">
      <div>
        <p className="text-4xl font-bold text-[#9b6a4b]">404</p>
        <p className="mt-2 text-lg font-medium text-[#4a3327]">Patient not found</p>
        <p className="mt-1 text-sm text-[#765d4e]">
          This patient record does not exist or may have been removed.
        </p>
        <Link
          href="/info"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#9b6a4b] px-5 py-2.5 text-sm font-medium text-[#fffaf2] transition hover:bg-[#7a5138]"
        >
          Back to Patient List
        </Link>
      </div>
    </div>
  );
}
