"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { updatePatient, type ActionState } from "../actions";
import {
  centsToDollars,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  MAJOR_SERVICES,
  MAJOR_SERVICE_LABELS,
} from "@/lib/validatePatient";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  dob: Date;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  insurer: string;
  memberId: string;
  authLimit: number;
  visitsUsed: number;
  statusNotes: string | null;
  copayCents: number | null;
  deductibleCents: number | null;
  deductibleMetCents: number | null;
  paymentStatus: string | null;
  outstandingBalanceCents: number | null;
  lastPaymentDate: Date | null;
  paymentMethod: string | null;
  services: string[];
  servicesOther: string | null;
};

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
  defaultValue,
  hasError,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      required={required}
      defaultValue={defaultValue}
      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-[#513a2e] placeholder-[#9b8070] outline-none transition focus:ring-2 focus:ring-[#9b6a4b]/40 ${
        hasError
          ? "border-rose-400 bg-rose-50/50 focus:border-rose-400"
          : "border-[#d8c9ba] bg-white/70 focus:border-[#9b6a4b]"
      }`}
      {...rest}
    />
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
        "Save Changes"
      )}
    </button>
  );
}

const initialState: ActionState = {};

function toDateInputValue(date: Date): string {
  return date.toISOString().split("T")[0];
}

export default function EditForm({ patient }: { patient: Patient }) {
  const updateWithId = updatePatient.bind(null, patient.id);
  const [state, formAction] = useActionState(updateWithId, initialState);
  const [checkedServices, setCheckedServices] = useState<string[]>(
    patient.services ?? [],
  );

  return (
    <form action={formAction} noValidate className="space-y-8">
      {state.message && (
        <div
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          role="alert"
        >
          {state.message}
        </div>
      )}

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
              defaultValue={patient.firstName}
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
              defaultValue={patient.lastName}
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
              defaultValue={toDateInputValue(patient.dob)}
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
              defaultValue={patient.phone}
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
              defaultValue={patient.email}
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
              defaultValue={patient.address}
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
              defaultValue={patient.city}
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
                defaultValue={patient.state}
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-[#513a2e] outline-none transition focus:ring-2 focus:ring-[#9b6a4b]/40 ${
                  state.errors?.state
                    ? "border-rose-400 bg-rose-50/50 focus:border-rose-400"
                    : "border-[#d8c9ba] bg-white/70 focus:border-[#9b6a4b]"
                }`}
              >
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
                defaultValue={patient.zip}
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
              defaultValue={patient.insurer}
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
              defaultValue={patient.memberId}
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
              defaultValue={patient.authLimit}
              hasError={!!state.errors?.authLimit}
            />
            <FieldError messages={state.errors?.authLimit} />
          </div>
          <div>
            <Label htmlFor="visitsUsed">Visits Used</Label>
            <div className="flex items-center gap-2 rounded-xl border border-[#d8c9ba] bg-[#f5ede4]/60 px-3.5 py-2.5 text-sm text-[#765d4e]">
              <span>{patient.visitsUsed}</span>
              <span className="text-xs text-[#9b8070]">(managed by the system)</span>
            </div>
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
            defaultValue={patient.statusNotes ?? ""}
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
              defaultValue={centsToDollars(patient.copayCents)}
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
              defaultValue={centsToDollars(patient.deductibleCents)}
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
              defaultValue={centsToDollars(patient.deductibleMetCents)}
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
              defaultValue={centsToDollars(patient.outstandingBalanceCents)}
              hasError={!!state.errors?.outstandingBalance}
            />
            <FieldError messages={state.errors?.outstandingBalance} />
          </div>
          <div>
            <Label htmlFor="paymentStatus">Payment Status</Label>
            <select
              id="paymentStatus"
              name="paymentStatus"
              defaultValue={patient.paymentStatus ?? ""}
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
              defaultValue={patient.paymentMethod ?? ""}
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
              defaultValue={
                patient.lastPaymentDate
                  ? patient.lastPaymentDate.toISOString().split("T")[0]
                  : ""
              }
              hasError={!!state.errors?.lastPaymentDate}
            />
            <FieldError messages={state.errors?.lastPaymentDate} />
          </div>
        </div>
      </section>

      {/* Major Services */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#9b6a4b]">
          Major Services
        </h3>
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
              defaultValue={patient.servicesOther ?? ""}
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

      <div className="flex items-center justify-end gap-3 border-t border-[#e8d9cc] pt-6">
        <Link
          href={`/info/${patient.id}`}
          className="rounded-xl border border-[#d8c9ba] px-5 py-2.5 text-sm font-medium text-[#513a2e] transition hover:bg-[#f0e6d8]"
        >
          Cancel
        </Link>
        <SubmitButton />
      </div>
    </form>
  );
}
