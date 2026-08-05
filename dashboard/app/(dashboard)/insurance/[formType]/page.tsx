import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { FORM_TEMPLATES, getSections } from "@/lib/insurance/templates";
import InsuranceForm from "./InsuranceForm";

export const metadata = { title: "Insurance Form — Dr. Song" };

interface PageProps {
  params: Promise<{ formType: string }>;
  searchParams: Promise<{ patientId?: string }>;
}

export default async function InsuranceFormPage(props: PageProps) {
  await connection();
  const params = await props.params;
  const searchParams = await props.searchParams;

  const { formType } = params;
  const { patientId } = searchParams;

  // Validate form type
  const template = FORM_TEMPLATES[formType];
  if (!template) {
    notFound();
  }

  // Validate patient ID
  if (!patientId) {
    redirect("/insurance");
  }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dob: true,
      phone: true,
      email: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      insurer: true,
      memberId: true,
    },
  });

  if (!patient) {
    redirect("/insurance");
  }

  const sections = getSections(template);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a5138]">
            {template.type.replace(/_/g, " ")}
          </p>
          <h2 className="mt-0.5 text-2xl font-semibold tracking-tight text-[#4a3327]">
            {template.title}
          </h2>
          <p className="mt-2 text-sm text-[#765d4e]">{template.description}</p>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-[#9b6a4b]/20 bg-[#fffaf2]/60 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#9b6a4b]/15 text-sm font-bold text-[#7a5138]">
            {patient.firstName[0]}
            {patient.lastName[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[#4a3327]">
              {patient.firstName} {patient.lastName}
            </p>
            <p className="text-sm text-[#765d4e]">
              {patient.email} • DOB: {new Date(patient.dob).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-[#8c6349]/10 bg-[#fffaf2]/80 p-8 shadow-sm backdrop-blur-sm">
        <InsuranceForm template={template} patient={patient} sections={sections} />
      </div>
    </div>
  );
}
