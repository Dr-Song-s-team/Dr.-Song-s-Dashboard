import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import MetricsForm from "./MetricsForm";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const email = await prisma.email.findUnique({
    where: { id },
    select: { subject: true },
  });
  return {
    title: email ? `Metrics — ${email.subject}` : "Metrics — Dr. Song",
  };
}

export default async function EmailMetricsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();

  const { id } = await params;

  const email = await prisma.email.findUnique({
    where: { id },
    select: { id: true, subject: true },
  });

  if (!email) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-4">
        <Link
          href="/email"
          className="text-sm font-medium text-[#765d4e] hover:text-[#7a5138] hover:underline"
        >
          ← Back to inbox
        </Link>

        <span className="text-[#d8c9ba]" aria-hidden="true">·</span>

        <Link
          href={`/email/${id}`}
          className="text-sm font-medium text-[#765d4e] hover:text-[#7a5138] hover:underline"
        >
          ← Back to email
        </Link>
      </div>

      <MetricsForm emailId={email.id} emailSubject={email.subject} />
    </div>
  );
}
