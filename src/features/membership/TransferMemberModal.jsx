
import { useEffect, useState } from "react";
import { ArrowRightLeft, RefreshCw, X } from "lucide-react";
import {
  getMembershipDirectory,
  transferMembershipMember,
} from "../../services/membershipService";

const inputClass =
  "mt-1.5 min-h-[42px] w-full rounded-[10px] border border-[#e5e5e7] bg-white px-3 py-2 text-[12px] text-[#25262c] outline-none focus:border-[#9b9da5] disabled:cursor-not-allowed disabled:bg-[#f4f4f5]";

const labelClass =
  "block text-[11.5px] font-semibold text-[#53555e]";

function getToday() {
  const now = new Date();
  const localDate = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000,
  );

  return localDate.toISOString().slice(0, 10);
}

function formatMembershipNumber(membership) {
  return membership.membership_number == null
    ? "Number not assigned"
    : `Membership ${membership.membership_number}`;
}

export default function TransferMemberModal({
  member,
  onClose,
  onTransferred,
}) {
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    destinationMembershipId: "",
    effectiveDate: getToday(),
    relationshipToHead: "",
    reason: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadMemberships() {
      setLoading(true);
      setError("");

      try {
        const result = await getMembershipDirectory();

        if (cancelled) return;

        const directory = result.memberships ?? [];

        const destinations = directory
          .filter(
            (item) =>
              item.id !== member.membership_row_id &&
              item.membership_status === "Active" &&
              item.head_member_id,
          )
          .sort((a, b) =>
            String(a.membership_number ?? "").localeCompare(
              String(b.membership_number ?? ""),
              undefined,
              { numeric: true },
            ),
          );

        setMemberships(destinations);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message || "Could not load destination memberships.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (member?.membership_row_id && !member.is_head) {
      loadMemberships();
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [member]);

  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (member.is_head) {
      setError(
        "This person is the membership head. Use Change Head first.",
      );
      return;
    }

    if (!member.membership_row_id) {
      setError("This person has no current membership assignment.");
      return;
    }

    if (!form.destinationMembershipId) {
      setError("Select a destination membership.");
      return;
    }

    if (form.effectiveDate > getToday()) {
      setError("The effective date cannot be in the future.");
      return;
    }

    if (
      form.relationshipToHead === "Spouse" &&
      !member.date_of_marriage
    ) {
      // The existing marriage relationship and date are preserved.
      // This transfer form does not create or rewrite spouse relationships.
    }

    setSaving(true);

    try {
      await transferMembershipMember({
        memberId: member.id,
        sourceMembershipId: member.membership_row_id,
        destinationMembershipId: form.destinationMembershipId,
        effectiveDate: form.effectiveDate,
        relationshipToHead: form.relationshipToHead,
        reason: form.reason,
      });

      setSuccess(true);
      await onTransferred();
    } catch (err) {
      setError(err.message || "The transfer could not be completed.");
    } finally {
      setSaving(false);
    }
  }

  const sourceNumber = member.display_membership_number || "—";

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-black/45 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-member-title"
        className="my-auto max-h-[94vh] w-full max-w-[600px] overflow-y-auto rounded-2xl border border-[#ececed] bg-[#fafafa] shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#ececed] bg-white px-5 py-4 sm:px-7">
          <div>
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#eeeeef] text-[#34353b]">
              <ArrowRightLeft size={18} />
            </div>

            <h2
              id="transfer-member-title"
              className="text-[17px] font-extrabold text-[#131418]"
            >
              Transfer Membership
            </h2>

            <p className="mt-1 text-[12px] text-[#777984]">
              Move this person to another membership while retaining
              their permanent person record.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close transfer dialog"
            className="rounded-lg border border-[#ececed] p-2 text-[#53555e] hover:bg-[#f4f4f5] disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </header>

        {member.is_head ? (
          <div className="space-y-4 p-5 sm:p-7">
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-5 text-amber-800">
              This person is the head of their current membership.
              Use the existing Change Head workflow before transferring
              them.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-[10px] bg-[#191a1f] px-5 py-3 text-[12px] font-semibold text-white"
            >
              Close
            </button>
          </div>
        ) : !member.membership_row_id ? (
          <div className="space-y-4 p-5 sm:p-7">
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-5 text-amber-800">
              This person has no current membership assignment to
              transfer.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-[10px] bg-[#191a1f] px-5 py-3 text-[12px] font-semibold text-white"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-7">
            <section className="rounded-xl border border-[#ececed] bg-white p-4">
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#888a93]">
                Person being transferred
              </p>

              <p className="mt-1 text-[15px] font-bold text-[#131418]">
                {member.name}
              </p>

              <p className="mt-1 text-[11.5px] text-[#777984]">
                Person ID: {member.person_id || "Not recorded"}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#f2f2f3] pt-3">
                <div>
                  <p className="text-[10.5px] text-[#888a93]">
                    Current membership
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-[#25262c]">
                    {sourceNumber}
                  </p>
                </div>

                <div>
                  <p className="text-[10.5px] text-[#888a93]">
                    Current relationship
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-[#25262c]">
                    {member.relationship_to_head || "Not recorded"}
                  </p>
                </div>
              </div>
            </section>

            <label className={labelClass}>
              Destination Membership
              <span className="ml-1 text-red-500">*</span>

              <select
                name="destinationMembershipId"
                value={form.destinationMembershipId}
                onChange={updateField}
                required
                disabled={loading || saving}
                className={inputClass}
              >
                <option value="">
                  {loading
                    ? "Loading memberships..."
                    : "Select destination membership"}
                </option>

                {memberships.map((membership) => (
                  <option key={membership.id} value={membership.id}>
                    {formatMembershipNumber(membership)} —{" "}
                    {membership.head_name || "Head not recorded"}
                  </option>
                ))}
              </select>
            </label>

            {!loading && memberships.length === 0 && (
              <p className="text-[11.5px] leading-5 text-[#777984]">
                No other active main memberships are available.
                Branch memberships are not supported by this transfer
                workflow.
              </p>
            )}

            <label className={labelClass}>
              Relationship to Destination Head
              <span className="ml-1 text-red-500">*</span>

              <select
                name="relationshipToHead"
                value={form.relationshipToHead}
                onChange={updateField}
                required
                disabled={saving}
                className={inputClass}
              >
                <option value="">Select relationship</option>
                <option value="Spouse">Spouse</option>
                <option value="Son">Son</option>
                <option value="Daughter">Daughter</option>
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Brother">Brother</option>
                <option value="Sister">Sister</option>
                <option value="Grandfather">Grandfather</option>
                <option value="Grandmother">Grandmother</option>
                <option value="Grandson">Grandson</option>
                <option value="Granddaughter">Granddaughter</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label className={labelClass}>
              Effective Date
              <span className="ml-1 text-red-500">*</span>

              <input
                type="date"
                name="effectiveDate"
                value={form.effectiveDate}
                onChange={updateField}
                max={getToday()}
                required
                disabled={saving}
                className={inputClass}
              />
            </label>

            <label className={labelClass}>
              Reason for Transfer
              <span className="ml-1 text-red-500">*</span>

              <textarea
                name="reason"
                value={form.reason}
                onChange={updateField}
                required
                minLength={3}
                maxLength={1000}
                rows={3}
                disabled={saving}
                placeholder="For example, transferred to spouse's independent membership."
                className={`${inputClass} resize-y`}
              />
            </label>

            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-[11.5px] font-bold text-amber-900">
                Before you confirm
              </p>

              <p className="mt-1 text-[11.5px] leading-5 text-amber-800">
                The transfer should close the old assignment and create
                the new assignment without deleting the person's record
                or existing spouse relationships. Confirm the destination
                and effective date carefully.
              </p>
            </section>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] leading-5 text-red-700"
              >
                {error}
              </p>
            )}

            {success && (
              <p
                role="status"
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-800"
              >
                The transfer was completed.
              </p>
            )}

            <footer className="flex flex-col-reverse gap-2 border-t border-[#ececed] pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-[10px] border border-[#e5e5e7] bg-white px-5 py-3 text-[12px] font-semibold text-[#53555e] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving || loading || memberships.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#191a1f] px-5 py-3 text-[12px] font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <RefreshCw size={14} className="animate-spin" />}
                {saving ? "Transferring..." : "Confirm Transfer"}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
