"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createPatient, type ActionState } from "../actions";

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
        "Save Patient"
      )}
    </button>
  );
}

const initialState: ActionState = {};

export default function IntakeForm() {
  const [state, formAction] = useActionState(createPatient, initialState);

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
              placeholder="Alex"
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
                defaultValue=""
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
            className="w-full rounded-xl border border-[#d8c9ba] bg-white/70 px-3.5 py-2.5 text-sm text-[#513a2e] placeholder-[#9b8070] outline-none transition focus:border-[#9b6a4b] focus:ring-2 focus:ring-[#9b6a4b]/40"
          />
        </div>
      </section>

      <div className="flex items-center justify-end gap-3 border-t border-[#e8d9cc] pt-6">
        <Link
          href="/info"
          className="rounded-xl border border-[#d8c9ba] px-5 py-2.5 text-sm font-medium text-[#513a2e] transition hover:bg-[#f0e6d8]"
        >
          Cancel
        </Link>
        <SubmitButton />
      </div>
    </form>
  );
}
