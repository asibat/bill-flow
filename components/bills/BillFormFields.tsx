"use client";

import { validateStructuredComm, formatStructuredComm } from "@/lib/utils";
import type { BillFormData } from "@/types";

function fieldValue(val: unknown): string {
  if (val === null || val === undefined || val === "null") return "";
  return String(val);
}

interface BillFormFieldsProps {
  form: BillFormData;
  setForm: (f: BillFormData) => void;
  required?: boolean;
}

export function BillFormFields({
  form,
  setForm,
  required,
}: BillFormFieldsProps) {
  const set =
    (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value });

  const structured = fieldValue(form.structured_comm);
  const isValid = structured
    ? validateStructuredComm(formatStructuredComm(structured))
    : null;

  return (
    <div className="card p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Payee Name {required && "*"}</label>
          <input
            className="input"
            value={fieldValue(form.payee_name)}
            onChange={set("payee_name")}
            required={required}
            placeholder="e.g. VIVAQUA"
          />
        </div>
        <div>
          <label className="label">Amount (&euro;) {required && "*"}</label>
          <input
            className="input"
            type="number"
            step="0.01"
            value={fieldValue(form.amount)}
            onChange={set("amount")}
            required={required}
            placeholder="45.00"
          />
        </div>
      </div>
      <div>
        <label className="label">Due Date {required && "*"}</label>
        <input
          className="input"
          type="date"
          value={fieldValue(form.due_date)}
          onChange={set("due_date")}
          required={required}
        />
      </div>
      <div>
        <label className="label flex items-center gap-2">
          Structured Communication
          {structured && isValid !== null && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${isValid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
            >
              {isValid ? "✓ Valid" : "⚠ Invalid — check your bill"}
            </span>
          )}
        </label>
        <input
          className="input font-mono"
          value={fieldValue(form.structured_comm)}
          onChange={set("structured_comm")}
          placeholder="+++XXX/XXXX/XXXXX+++"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">IBAN</label>
          <input
            className="input font-mono"
            value={fieldValue(form.iban)}
            onChange={set("iban")}
            placeholder="BE52 0960 1178 4309"
          />
        </div>
        <div>
          <label className="label">BIC / SWIFT</label>
          <input
            className="input font-mono"
            value={fieldValue(form.bic)}
            onChange={set("bic")}
            placeholder="GKCCBEBB"
          />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <input
          className="input"
          value={fieldValue(form.notes)}
          onChange={set("notes")}
          placeholder="Optional notes"
        />
      </div>
    </div>
  );
}
