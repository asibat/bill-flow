"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  validateStructuredComm,
  formatStructuredComm,
  formatAmount,
} from "@/lib/utils";
import { format } from "date-fns";
import type { Bill } from "@/types";

function getIngestionMethodLabel(method: Bill["ingestion_method"]): string | null {
  switch (method) {
    case "doccle_html_pdf":
      return "Doccle page + PDF"
    case "email_attachment":
      return "Forwarded email attachment"
    case "email_body_text":
      return "Forwarded email body"
    case "upload_pdf":
      return "Uploaded PDF"
    case "upload_image":
      return "Uploaded image"
    case "manual_entry":
      return "Manual entry"
    default:
      return null
  }
}

interface BillEditableDetailsProps {
  bill: Bill;
  defaultEditing?: boolean;
}

export function BillEditableDetails({
  bill,
  defaultEditing = false,
}: BillEditableDetailsProps) {
  const [editing, setEditing] = useState(defaultEditing);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    payee_name: bill.payee_name,
    amount: bill.amount,
    due_date: bill.due_date,
    iban: bill.iban ?? "",
    bic: bill.bic ?? "",
    structured_comm: bill.structured_comm ?? "",
    notes: bill.notes ?? "",
  });
  const router = useRouter();

  const set =
    (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value });

  const commFormatted = form.structured_comm
    ? formatStructuredComm(form.structured_comm)
    : "";
  const commValid = commFormatted
    ? validateStructuredComm(commFormatted)
    : null;

  async function save() {
    setSaving(true);
    const structured = form.structured_comm
      ? formatStructuredComm(form.structured_comm)
      : null;
    await fetch(`/api/bills/${bill.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payee_name: form.payee_name,
        amount: parseFloat(String(form.amount)),
        due_date: form.due_date,
        iban: form.iban || null,
        bic: form.bic || null,
        structured_comm: structured,
        structured_comm_valid: structured
          ? validateStructuredComm(structured)
          : null,
        notes: form.notes || null,
        needs_review: false,
      }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  function cancel() {
    setForm({
      payee_name: bill.payee_name,
      amount: bill.amount,
      due_date: bill.due_date,
      iban: bill.iban ?? "",
      bic: bill.bic ?? "",
      structured_comm: bill.structured_comm ?? "",
      notes: bill.notes ?? "",
    });
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            Bill Details
          </h2>
          <button
            onClick={() => setEditing(true)}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium"
          >
            Edit
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <DetailRow label="Payee" value={bill.payee_name} />
          <DetailRow
            label="Amount"
            value={formatAmount(bill.amount, bill.currency)}
          />
          <DetailRow
            label="Due Date"
            value={format(new Date(bill.due_date), "d MMMM yyyy")}
          />
          <DetailRow label="Source" value={bill.source} />
          {bill.extraction_confidence !== null && (
            <DetailRow
              label="Extraction Confidence"
              value={`${Math.round((bill.extraction_confidence ?? 0) * 100)}%`}
            />
          )}
          {getIngestionMethodLabel(bill.ingestion_method) && (
            <DetailRow
              label="Ingestion"
              value={getIngestionMethodLabel(bill.ingestion_method)!}
            />
          )}
          {bill.payee_id && <DetailRow label="Vendor Match" value="Matched to vendor directory" />}
          {bill.needs_review && <DetailRow label="Review Status" value="Needs your confirmation" />}
          {bill.iban && <DetailRow label="IBAN" value={bill.iban} />}
          {bill.bic && <DetailRow label="BIC" value={bill.bic} />}
          {bill.structured_comm && (
            <DetailRow
              label="Structured Comm"
              value={bill.structured_comm}
            />
          )}
          {bill.language_detected && (
            <DetailRow
              label="Language"
              value={bill.language_detected.toUpperCase()}
            />
          )}
          {bill.wire_reference && (
            <DetailRow label="Wire Reference" value={bill.wire_reference} />
          )}
          {bill.paid_at && (
            <DetailRow
              label="Paid At"
              value={format(new Date(bill.paid_at), "d MMM yyyy HH:mm")}
            />
          )}
          {bill.notes && <DetailRow label="Notes" value={bill.notes} />}
        </dl>
      </div>
    );
  }

  return (
    <div className="card p-5 mb-6 border-2 border-brand-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">
          Edit Bill Details
        </h2>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Payee Name *</label>
            <input
              className="input"
              value={form.payee_name}
              onChange={set("payee_name")}
              required
            />
          </div>
          <div>
            <label className="label">Amount *</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={form.amount}
              onChange={set("amount")}
              required
            />
          </div>
        </div>
        <div>
          <label className="label">Due Date *</label>
          <input
            className="input"
            type="date"
            value={form.due_date}
            onChange={set("due_date")}
            required
          />
        </div>
        <div>
          <label className="label flex items-center gap-2">
            Structured Communication
            {form.structured_comm && commValid !== null && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${commValid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
              >
                {commValid ? "Valid" : "Invalid"}
              </span>
            )}
          </label>
          <input
            className="input font-mono"
            value={form.structured_comm}
            onChange={set("structured_comm")}
            placeholder="+++XXX/XXXX/XXXXX+++"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">IBAN</label>
            <input
              className="input font-mono"
              value={form.iban}
              onChange={set("iban")}
              placeholder="BE52 0960 1178 4309"
            />
          </div>
          <div>
            <label className="label">BIC / SWIFT</label>
            <input
              className="input font-mono"
              value={form.bic}
              onChange={set("bic")}
              placeholder="GKCCBEBB"
            />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <input
            className="input"
            value={form.notes}
            onChange={set("notes")}
            placeholder="Optional notes"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button onClick={cancel} className="btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 font-medium">{value}</dd>
    </>
  );
}
