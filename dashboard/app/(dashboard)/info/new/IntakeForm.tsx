"use client";

import { useActionState, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createPatient, type ActionState } from "../actions";
import type { PatientFields } from "@/lib/validatePatient";
import { PAYMENT_STATUSES, PAYMENT_METHODS, MAJOR_SERVICES, MAJOR_SERVICE_LABELS } from "@/lib/validatePatient";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p className="mt-1 text-xs text-rose-600" role="alert">
      {messages[0]}
    </p>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#7a5138]"
    >
      {children}
    </label>
  );
}

function Input({
  id,
  name,
  type = "text",
  required,
  hasError,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      required={required}
      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-[#513a2e] placeholder-[#9b8070] outline-none transition focus:ring-2 focus:ring-[#9b6a4b]/40 ${
        hasError
          ? "border-rose-400 bg-rose-50/50 focus:border-rose-400"
          : "border-[#d8c9ba] bg-white/70 focus:border-[#9b6a4b]"
      }`}
      {...rest}
    />
  );
}

function StatusAlert({
  tone,
  title,
  message,
}: {
  tone: "success" | "error";
  title: string;
  message: string;
}) {
  const isError = tone === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={`flex gap-3 rounded-xl border-2 px-5 py-4 shadow-sm ${
        isError
          ? "border-rose-500 bg-rose-100 text-rose-950"
          : "border-emerald-500 bg-emerald-100 text-emerald-950"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          isError ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
        }`}
      >
        {isError ? "!" : "✓"}
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-sm">{message}</p>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#9b6a4b] px-6 py-2.5 text-sm font-medium text-[#fffaf2] shadow-sm transition hover:bg-[#7a5138] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b6a4b]"
    >
      {pending ? (
        <>
          <svg
            className="size-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Saving…
        </>
      ) : (
        "Save Patient"
      )}
    </button>
  );
}

const initialState: ActionState = {};
const emptyFields: PatientFields = {
  firstName: "",
  lastName: "",
  dob: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  insurer: "",
  memberId: "",
  authLimit: "",
  statusNotes: "",
  copay: "",
  deductible: "",
  deductibleMet: "",
  paymentStatus: "",
  outstandingBalance: "",
  lastPaymentDate: "",
  paymentMethod: "",
  servicesOther: "",
};

export default function IntakeForm() {
  const [state, formAction] = useActionState(createPatient, initialState);
  const [fields, setFields] = useState(emptyFields);
  const [checkedServices, setCheckedServices] = useState<string[]>([]);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);
  const [autofillSuccess, setAutofillSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFieldChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const key = event.currentTarget.name as Exclude<keyof PatientFields, "services">;
    // React clears `currentTarget` after the event handler returns. Capture the
    // value before the state updater runs so typing does not throw during render.
    const value = event.currentTarget.value;
    setFields((current) => ({ ...current, [key]: value }));
  };

  const uploadIntake = async (file: File) => {
    setAutofillSuccess(false);
    setAutofillError(null);

    if (file.type && file.type !== "application/pdf") {
      setAutofillError("Only PDF intake files can be uploaded.");
      return;
    }

    setIsAutofilling(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/intake/autofill", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        error?: string;
        fields?: Partial<Record<keyof PatientFields, string>>;
      };

      if (!response.ok || !data.fields) {
        throw new Error(data.error || "Autofill failed. Please try another intake PDF.");
      }

      const { services: autofillServices, ...stringFields } = data.fields;
      setFields((current) => ({ ...current, ...stringFields }));
      if (Array.isArray(autofillServices)) {
        setCheckedServices(autofillServices as string[]);
      }
      setAutofillSuccess(true);
    } catch (error) {
      setAutofillError(
        error instanceof Error ? error.message : "Autofill failed. Please try another intake PDF.",
      );
    } finally {
      setIsAutofilling(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) void uploadIntake(file);
    event.currentTarget.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void uploadIntake(file);
  };

  return (
    <form action={formAction} noValidate className="space-y-8">
      {/* Identity */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#9b6a4b]">
          Patient Identity
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="firstName">First Name *</Label>
            <Input
              id="firstName"
              name="firstName"
              required
              autoComplete="given-name"
              placeholder="Alex"
              value={fields.firstName}
              onChange={handleFieldChange}
              hasError={!!state.errors?.firstName}
            />
            <FieldError messages={state.errors?.firstName} />
          </div>
          <div>
            <Label htmlFor="lastName">Last Name *</Label>
            <Input
              id="lastName"
              name="lastName"
              required
              autoComplete="family-name"
              placeholder="Thompson"
              value={fields.lastName}
              onChange={handleFieldChange}
              hasError={!!state.errors?.lastName}
            />
            <FieldError messages={state.errors?.lastName} />
          </div>
          <div>
            <Label htmlFor="dob">Date of Birth *</Label>
            <Input
              id="dob"
              name="dob"
              type="date"
              required
              value={fields.dob}
              onChange={handleFieldChange}
              hasError={!!state.errors?.dob}
            />
            <FieldError messages={state.errors?.dob} />
          </div>
          <div>
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              placeholder="555-0101"
              value={fields.phone}
              onChange={handleFieldChange}
              hasError={!!state.errors?.phone}
            />
            <FieldError messages={state.errors?.phone} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="patient@example.com"
              value={fields.email}
              onChange={handleFieldChange}
              hasError={!!state.errors?.email}
            />
            <FieldError messages={state.errors?.email} />
          </div>
        </div>
      </section>

      {/* Address */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#9b6a4b]">
          Address
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="address">Street Address *</Label>
            <Input
              id="address"
              name="address"
              required
              autoComplete="street-address"
              placeholder="100 Maple St"
              value={fields.address}
              onChange={handleFieldChange}
              hasError={!!state.errors?.address}
            />
            <FieldError messages={state.errors?.address} />
          </div>
          <div>
            <Label htmlFor="city">City *</Label>
            <Input
              id="city"
              name="city"
              required
              autoComplete="address-level2"
              placeholder="Anytown"
              value={fields.city}
              onChange={handleFieldChange}
              hasError={!!state.errors?.city}
            />
            <FieldError messages={state.errors?.city} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="state">State *</Label>
              <select
                id="state"
                name="state"
                required
                value={fields.state}
                onChange={handleFieldChange}
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-[#513a2e] outline-none transition focus:ring-2 focus:ring-[#9b6a4b]/40 ${
                  state.errors?.state
                    ? "border-rose-400 bg-rose-50/50 focus:border-rose-400"
                    : "border-[#d8c9ba] bg-white/70 focus:border-[#9b6a4b]"
                }`}
              >
                <option value="" disabled>
                  State
                </option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <FieldError messages={state.errors?.state} />
            </div>
            <div>
              <Label htmlFor="zip">ZIP *</Label>
              <Input
                id="zip"
                name="zip"
                required
                autoComplete="postal-code"
                placeholder="90001"
                value={fields.zip}
                onChange={handleFieldChange}
                hasError={!!state.errors?.zip}
              />
              <FieldError messages={state.errors?.zip} />
            </div>
          </div>
        </div>
      </section>

      {/* Insurance */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#9b6a4b]">
          Insurance & Authorization
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="insurer">Insurer *</Label>
            <Input
              id="insurer"
              name="insurer"
              required
              placeholder="Anthem"
              value={fields.insurer}
              onChange={handleFieldChange}
              hasError={!!state.errors?.insurer}
            />
            <FieldError messages={state.errors?.insurer} />
          </div>
          <div>
            <Label htmlFor="memberId">Member ID *</Label>
            <Input
              id="memberId"
              name="memberId"
              required
              placeholder="ANT-2024-001"
              value={fields.memberId}
              onChange={handleFieldChange}
              hasError={!!state.errors?.memberId}
            />
            <FieldError messages={state.errors?.memberId} />
          </div>
          <div>
            <Label htmlFor="authLimit">Auth Visit Limit *</Label>
            <Input
              id="authLimit"
              name="authLimit"
              type="number"
              required
              min={0}
              placeholder="24"
              value={fields.authLimit}
              onChange={handleFieldChange}
              hasError={!!state.errors?.authLimit}
            />
            <FieldError messages={state.errors?.authLimit} />
          </div>
        </div>
      </section>

      {/* Notes */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#9b6a4b]">
          Status Notes
        </h3>
        <div>
          <Label htmlFor="statusNotes">Notes (optional)</Label>
          <textarea
            id="statusNotes"
            name="statusNotes"
            rows={3}
            placeholder="Active; next auth renewal due…"
            value={fields.statusNotes}
            onChange={handleFieldChange}
            className="w-full rounded-xl border border-[#d8c9ba] bg-white/70 px-3.5 py-2.5 text-sm text-[#513a2e] placeholder-[#9b8070] outline-none transition focus:border-[#9b6a4b] focus:ring-2 focus:ring-[#9b6a4b]/40"
          />
        </div>
      </section>

      {/* Billing & Payment */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#9b6a4b]">
          Billing &amp; Payment
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="copay">Co-pay ($)</Label>
            <Input
              id="copay"
              name="copay"
              type="number"
              min={0}
              step="0.01"
              placeholder="30.00"
              value={fields.copay}
              onChange={handleFieldChange}
              hasError={!!state.errors?.copay}
            />
            <FieldError messages={state.errors?.copay} />
          </div>
          <div>
            <Label htmlFor="deductible">Annual Deductible ($)</Label>
            <Input
              id="deductible"
              name="deductible"
              type="number"
              min={0}
              step="0.01"
              placeholder="1500.00"
              value={fields.deductible}
              onChange={handleFieldChange}
              hasError={!!state.errors?.deductible}
            />
            <FieldError messages={state.errors?.deductible} />
          </div>
          <div>
            <Label htmlFor="deductibleMet">Deductible Met ($)</Label>
            <Input
              id="deductibleMet"
              name="deductibleMet"
              type="number"
              min={0}
              step="0.01"
              placeholder="750.00"
              value={fields.deductibleMet}
              onChange={handleFieldChange}
              hasError={!!state.errors?.deductibleMet}
            />
            <FieldError messages={state.errors?.deductibleMet} />
          </div>
          <div>
            <Label htmlFor="outstandingBalance">Outstanding Balance ($)</Label>
            <Input
              id="outstandingBalance"
              name="outstandingBalance"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={fields.outstandingBalance}
              onChange={handleFieldChange}
              hasError={!!state.errors?.outstandingBalance}
            />
            <FieldError messages={state.errors?.outstandingBalance} />
          </div>
          <div>
            <Label htmlFor="paymentStatus">Payment Status</Label>
            <select
              id="paymentStatus"
              name="paymentStatus"
              value={fields.paymentStatus}
              onChange={handleFieldChange}
              className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-[#513a2e] outline-none transition focus:ring-2 focus:ring-[#9b6a4b]/40 ${
                state.errors?.paymentStatus
                  ? "border-rose-400 bg-rose-50/50 focus:border-rose-400"
                  : "border-[#d8c9ba] bg-white/70 focus:border-[#9b6a4b]"
              }`}
            >
              <option value="">— Not set —</option>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === "current" && "Current"}
                  {s === "overdue" && "Overdue"}
                  {s === "payment_plan" && "Payment Plan"}
                  {s === "insurance_only" && "Insurance Only"}
                </option>
              ))}
            </select>
            <FieldError messages={state.errors?.paymentStatus} />
          </div>
          <div>
            <Label htmlFor="paymentMethod">Payment Method</Label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              value={fields.paymentMethod}
              onChange={handleFieldChange}
              className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-[#513a2e] outline-none transition focus:ring-2 focus:ring-[#9b6a4b]/40 ${
                state.errors?.paymentMethod
                  ? "border-rose-400 bg-rose-50/50 focus:border-rose-400"
                  : "border-[#d8c9ba] bg-white/70 focus:border-[#9b6a4b]"
              }`}
            >
              <option value="">— Not set —</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m === "cash" && "Cash"}
                  {m === "check" && "Check"}
                  {m === "card_on_file" && "Card on File"}
                  {m === "insurance_only" && "Insurance Only"}
                  {m === "other" && "Other"}
                </option>
              ))}
            </select>
            <FieldError messages={state.errors?.paymentMethod} />
          </div>
          <div>
            <Label htmlFor="lastPaymentDate">Last Payment Date</Label>
            <Input
              id="lastPaymentDate"
              name="lastPaymentDate"
              type="date"
              value={fields.lastPaymentDate}
              onChange={handleFieldChange}
              hasError={!!state.errors?.lastPaymentDate}
            />
            <FieldError messages={state.errors?.lastPaymentDate} />
          </div>
        </div>
      </section>

      <section className="border-t border-[#e8d9cc] pt-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#9b6a4b]">
          Major Services
        </h3>
        <p className="mb-4 text-sm text-[#765d4e]">
          Select all services this patient receives (select at least one if applicable).
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MAJOR_SERVICES.map((svc) => (
            <label
              key={svc}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#d8c9ba] bg-white/70 px-4 py-3 text-sm text-[#513a2e] transition hover:border-[#9b6a4b]/50 hover:bg-[#f0e6d8]/40 has-[:checked]:border-[#9b6a4b] has-[:checked]:bg-[#f0e6d8]/60"
            >
              <input
                type="checkbox"
                name="services"
                value={svc}
                checked={checkedServices.includes(svc)}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setCheckedServices((prev) =>
                    checked ? [...prev, svc] : prev.filter((s) => s !== svc),
                  );
                }}
                className="size-4 rounded accent-[#9b6a4b]"
              />
              <span className="font-medium">{MAJOR_SERVICE_LABELS[svc]}</span>
            </label>
          ))}
        </div>
        {checkedServices.includes("other") && (
          <div className="mt-3">
            <Label htmlFor="servicesOther">Other service — please specify *</Label>
            <Input
              id="servicesOther"
              name="servicesOther"
              placeholder="e.g. Cupping, Moxibustion…"
              value={fields.servicesOther ?? ""}
              onChange={handleFieldChange}
              hasError={!!state.errors?.servicesOther}
            />
            <FieldError messages={state.errors?.servicesOther} />
          </div>
        )}
        {state.errors?.services && (
          <p className="mt-2 text-xs text-rose-600" role="alert">
            {state.errors.services[0]}
          </p>
        )}
      </section>

      <section className="border-t border-[#e8d9cc] pt-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9b6a4b]">
          Upload Intake
        </h3>
        <p className="mt-1 text-sm text-[#765d4e]">
          Drag a completed intake PDF here or choose one from your computer to fill this form.
        </p>
        <div className="mt-4 space-y-3">
          {autofillError && (
            <StatusAlert
              tone="error"
              title="Autofill failed"
              message={autofillError}
            />
          )}
          {autofillSuccess && (
            <StatusAlert
              tone="success"
              title="Intake autofilled"
              message="All required patient fields were filled. Review the information before saving."
            />
          )}
        </div>
        <div
          className={`mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
            isDragging
              ? "border-[#9b6a4b] bg-[#f0e6d8]"
              : "border-[#d8c9ba] bg-white/50"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            onChange={handleFileChange}
          />
          <p className="text-sm font-medium text-[#513a2e]">
            {isAutofilling ? "Reading intake PDF…" : "Drop a PDF here"}
          </p>
          <button
            type="button"
            disabled={isAutofilling}
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 rounded-xl border border-[#9b6a4b] px-5 py-2.5 text-sm font-medium text-[#7a5138] transition hover:bg-[#f0e6d8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAutofilling ? "Autofilling…" : "Choose Intake PDF"}
          </button>
          <p className="mt-3 text-xs text-[#9b8070]">PDF only, up to 10 MB</p>
        </div>
      </section>

      <div className="space-y-4 border-t border-[#e8d9cc] pt-6">
        {state.message && (
          <StatusAlert
            tone="error"
            title="Patient could not be saved"
            message={state.message}
          />
        )}
        {state.errors && Object.keys(state.errors).length > 0 && (
          <StatusAlert
            tone="error"
            title="Patient could not be saved"
            message="Review and correct the highlighted fields before saving again."
          />
        )}
        <div className="flex items-center justify-end gap-3">
        <Link
          href="/info"
          className="rounded-xl border border-[#d8c9ba] px-5 py-2.5 text-sm font-medium text-[#513a2e] transition hover:bg-[#f0e6d8]"
        >
          Cancel
        </Link>
        <SubmitButton />
        </div>
      </div>
    </form>
  );
}
