import { useEffect, useMemo, useState } from "react";
import { X, UserRound, Users, Heart } from "lucide-react";
import { addMemberToMembershipWithGroups } from "../../services/membershipService";
import GroupMultiSelect from "./GroupMultiSelect";

const initialForm = {
  name: "",
  gender: "Female",
  date_of_birth: "",
  marital_status: "Single",
  baptism_status: "Unknown",
  date_of_baptism: "",
  occupation_or_studying: "",
  phone_number: "",
  email: "",
  relationship_to_head: "",
  date_of_marriage: "",
};

const inputClass =
  "mt-1.5 w-full rounded-[10px] border border-[#e5e5e7] bg-white px-3 py-2.5 text-[13px] text-[#131418] outline-none transition placeholder:text-[#a0a1a8] focus:border-[#4f70e8] focus:ring-2 focus:ring-[#4f70e8]/10";

const labelClass = "block text-[12px] font-semibold text-[#53555e]";

function Field({
  label,
  name,
  form,
  onChange,
  type = "text",
  required = false,
  placeholder = "",
  disabled = false,
}) {
  return (
    <label className={labelClass}>
      {label}
      {required && <span className="ml-1 text-red-500">*</span>}

      <input
        name={name}
        type={type}
        value={form[name] ?? ""}
        onChange={onChange}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        className={`${inputClass} disabled:cursor-not-allowed disabled:bg-[#f4f4f5] disabled:text-[#777984]`}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  form,
  onChange,
  options,
  required = false,
  disabled = false,
}) {
  return (
    <label className={labelClass}>
      {label}
      {required && <span className="ml-1 text-red-500">*</span>}

      <select
        name={name}
        value={form[name] ?? ""}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`${inputClass} disabled:cursor-not-allowed disabled:bg-[#f4f4f5]`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="rounded-xl border border-[#ececed] bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e9edfd] text-[#3457d5]">
          <Icon size={16} />
        </span>

        <div>
          <h3 className="text-[13px] font-bold text-[#131418]">{title}</h3>

          {subtitle && (
            <p className="mt-1 text-[11.5px] leading-5 text-[#777984]">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export default function AddMemberModal({
  membershipRowId,
  membership,
  branches = [],
  relationships = [],
  onClose,
  onCreated,
}) {
  const resolvedMembershipId = membershipRowId ?? membership?.id ?? null;
  const headMemberId = membership?.head_member_id ?? null;

  const headWeddingDate = useMemo(() => {
    if (!headMemberId) return "";

    const relationship = relationships.find(
      (item) =>
        item.relationship_type === "Spouse" &&
        item.date_of_marriage &&
        (item.member_id === headMemberId ||
          item.related_member_id === headMemberId),
    );

    return relationship?.date_of_marriage ?? "";
  }, [relationships, headMemberId]);

  const [form, setForm] = useState(() => ({
    ...initialForm,
    date_of_marriage: headWeddingDate,
  }));

  const [assignmentType, setAssignmentType] = useState("main");
  const [branchSuffix, setBranchSuffix] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [error, setError] = useState("");

  const existingSuffixes = useMemo(
    () =>
      branches
        .filter((branch) => branch.branch_status === "Active")
        .map((branch) => branch.suffix?.toUpperCase())
        .filter(Boolean),
    [branches],
  );

  const isSpouse = form.relationship_to_head === "Spouse";
  const needsWeddingDate = isSpouse || form.marital_status === "Married";

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => {
      const next = {
        ...current,
        [name]: value,
      };

      if (name === "relationship_to_head" && value === "Spouse") {
        next.marital_status = "Married";

        if (!next.date_of_marriage && headWeddingDate) {
          next.date_of_marriage = headWeddingDate;
        }
      }

      if (name === "relationship_to_head" && value !== "Spouse") {
        // Do not silently keep a date copied from the head's marriage.
        if (current.relationship_to_head === "Spouse" && headWeddingDate) {
          next.date_of_marriage = "";
        }
      }

      if (name === "marital_status" && value !== "Married") {
        if (current.relationship_to_head !== "Spouse") {
          next.date_of_marriage = "";
        }
      }

      return next;
    });

    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!resolvedMembershipId) {
      setError(
        "The membership ID is missing. Close this window and reopen Add Member from the membership profile.",
      );
      return;
    }

    if (!form.name.trim()) {
      setError("Enter the member name.");
      return;
    }

    if (!form.gender) {
      setError("Select the member gender.");
      return;
    }

    if (
      !["Unknown", "Baptised", "Not Baptised"].includes(form.baptism_status)
    ) {
      setError("Select a valid baptism status.");
      return;
    }

    if (needsWeddingDate && !form.date_of_marriage) {
      setError("Enter the wedding date before saving.");
      return;
    }

    if (isSpouse && !form.date_of_marriage && !headWeddingDate) {
      setError("A wedding date is required when adding a spouse.");
      return;
    }

    const suffix =
      assignmentType === "branch" ? branchSuffix.trim().toUpperCase() : null;

    if (assignmentType === "branch" && !suffix) {
      setError("Select a branch letter.");
      return;
    }

    if (suffix && !/^[A-Z]$/.test(suffix)) {
      setError("A branch suffix must be a single letter from A to Z.");
      return;
    }

    if (suffix && existingSuffixes.includes(suffix)) {
      setError(
        `Branch ${suffix} already exists. Select another available letter.`,
      );
      return;
    }

    setSaving(true);

    try {
      await addMemberToMembershipWithGroups({
        membershipRowId: resolvedMembershipId,
        branchSuffix: suffix,
        relationshipToHead: form.relationship_to_head || null,
        dateOfMarriage: needsWeddingDate ? form.date_of_marriage : null,
        groupIds: selectedGroupIds,
        member: {
          name: form.name.trim(),
          gender: form.gender || null,
          date_of_birth: form.date_of_birth || null,
          marital_status: isSpouse ? "Married" : form.marital_status,
          baptism_status: form.baptism_status,
          date_of_baptism: form.date_of_baptism || null,
          occupation_or_studying: form.occupation_or_studying.trim() || null,
          phone_number: form.phone_number.trim() || null,
          email: form.email.trim() || null,
        },
      });

      await onCreated?.();
      onClose();
    } catch (err) {
      setError(err.message || "Could not add this member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/45 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-member-title"
        className="my-auto max-h-[94vh] w-full max-w-[790px] overflow-y-auto rounded-2xl border border-[#ececed] bg-[#fafafa] shadow-[0_28px_80px_rgba(0,0,0,0.2)]"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#ececed] bg-white px-5 py-4 sm:px-7">
          <div>
            <h2
              id="add-member-title"
              className="text-[17px] font-extrabold text-[#131418]"
            >
              Add member
            </h2>

            <p className="mt-1 text-[12px] text-[#777984]">
              Add a person to this membership.
            </p>

            <p className="mt-2 text-[11px] text-[#92939b]">
              Membership number:{" "}
              <span className="font-semibold text-[#53555e]">
                {membership?.membership_number || "Not assigned"}
              </span>
              {membership?.membership_id && (
                <>
                  {" · "}Permanent ID:{" "}
                  <span className="font-mono">{membership.membership_id}</span>
                </>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close add member form"
            className="rounded-lg border border-[#ececed] p-2 text-[#53555e] transition hover:bg-[#f4f4f5] disabled:opacity-50"
          >
            <X size={17} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-7">
          <Section
            icon={UserRound}
            title="Personal information"
            subtitle="The database generates the person's permanent Person ID."
          >
            <Field
              label="Full name"
              name="name"
              form={form}
              onChange={handleChange}
              required
              placeholder="Enter full name"
            />

            <SelectField
              label="Gender"
              name="gender"
              form={form}
              onChange={handleChange}
              required
              options={[
                { value: "Male", label: "Male" },
                { value: "Female", label: "Female" },
                { value: "Other", label: "Other" },
                {
                  value: "Prefer not to say",
                  label: "Prefer not to say",
                },
              ]}
            />

            <Field
              label="Date of birth"
              name="date_of_birth"
              form={form}
              onChange={handleChange}
              type="date"
            />

            <SelectField
              label="Marital status"
              name="marital_status"
              form={form}
              onChange={handleChange}
              required
              disabled={isSpouse}
              options={[
                { value: "Single", label: "Single" },
                { value: "Married", label: "Married" },
                { value: "Widowed", label: "Widowed" },
                { value: "Divorced", label: "Divorced" },
                { value: "Separated", label: "Separated" },
                { value: "Unknown", label: "Unknown" },
              ]}
            />

            <SelectField
              label="Baptism status"
              name="baptism_status"
              form={form}
              onChange={handleChange}
              required
              options={[
                { value: "Unknown", label: "Unknown" },
                { value: "Baptised", label: "Baptised" },
                { value: "Not Baptised", label: "Not Baptised" },
              ]}
            />

            <Field
              label="Date of baptism"
              name="date_of_baptism"
              form={form}
              onChange={handleChange}
              type="date"
            />

            <Field
              label="Occupation / studying"
              name="occupation_or_studying"
              form={form}
              onChange={handleChange}
              placeholder="Occupation or course"
            />

            <Field
              label="Personal phone"
              name="phone_number"
              form={form}
              onChange={handleChange}
              type="tel"
            />

            <Field
              label="Personal email"
              name="email"
              form={form}
              onChange={handleChange}
              type="email"
            />

            <SelectField
              label="Relationship to household head"
              name="relationship_to_head"
              form={form}
              onChange={handleChange}
              required
              options={[
                { value: "", label: "Select relationship" },
                { value: "Spouse", label: "Spouse" },
                { value: "Son", label: "Son" },
                { value: "Daughter", label: "Daughter" },
                { value: "Father", label: "Father" },
                { value: "Mother", label: "Mother" },
                { value: "Brother", label: "Brother" },
                { value: "Sister", label: "Sister" },
                { value: "Grandparent", label: "Grandparent" },
                { value: "Grandchild", label: "Grandchild" },
                { value: "Guardian", label: "Guardian" },
                { value: "Other", label: "Other" },
              ]}
            />

            {needsWeddingDate && (
              <div className="sm:col-span-2">
                <Field
                  label="Wedding date"
                  name="date_of_marriage"
                  form={form}
                  onChange={handleChange}
                  type="date"
                  required
                  disabled={isSpouse && Boolean(headWeddingDate)}
                />

                {isSpouse && headWeddingDate ? (
                  <p className="mt-2 text-[11px] leading-5 text-emerald-700">
                    <Heart size={12} className="mr-1 inline" />
                    Using the wedding date already recorded for the household
                    head.
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] leading-5 text-[#777984]">
                    Enter the wedding date. It is saved with the spouse
                    relationship.
                  </p>
                )}
              </div>
            )}
          </Section>

          <Section
            icon={Users}
            title="Household assignment"
            subtitle="Choose the main household or assign the person to a lettered branch."
          >
            <button
              type="button"
              onClick={() => {
                setAssignmentType("main");
                setBranchSuffix("");
              }}
              className={`rounded-xl border p-3.5 text-left transition ${
                assignmentType === "main"
                  ? "border-[#6681ff] bg-[#f1f3ff] ring-1 ring-[#6681ff]"
                  : "border-[#e9e9eb] bg-white hover:bg-[#f8f8f9]"
              }`}
            >
              <span className="block text-[12px] font-bold text-[#131418]">
                Main household
              </span>
              <span className="mt-1 block text-[11px] text-[#777984]">
                No branch suffix
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAssignmentType("branch")}
              className={`rounded-xl border p-3.5 text-left transition ${
                assignmentType === "branch"
                  ? "border-[#6681ff] bg-[#f1f3ff] ring-1 ring-[#6681ff]"
                  : "border-[#e9e9eb] bg-white hover:bg-[#f8f8f9]"
              }`}
            >
              <span className="block text-[12px] font-bold text-[#131418]">
                Lettered branch
              </span>
              <span className="mt-1 block text-[11px] text-[#777984]">
                Example: Branch A
              </span>
            </button>

            {assignmentType === "branch" && (
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  Branch letter
                  <select
                    value={branchSuffix}
                    onChange={(event) => setBranchSuffix(event.target.value)}
                    required
                    className={inputClass}
                  >
                    <option value="">Select an available letter</option>

                    {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => (
                      <option
                        key={letter}
                        value={letter}
                        disabled={existingSuffixes.includes(letter)}
                      >
                        {letter}
                        {existingSuffixes.includes(letter)
                          ? " (already used)"
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </Section>

          <GroupMultiSelect
            selectedIds={selectedGroupIds}
            onChange={setSelectedGroupIds}
            disabled={saving}
          />

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] leading-5 text-red-700"
            >
              {error}
            </p>
          )}

          <footer className="flex flex-col-reverse gap-2 border-t border-[#ececed] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-[10px] border border-[#e5e5e7] bg-white px-5 py-3 text-[12px] font-semibold text-[#53555e] transition hover:bg-[#f4f4f5] disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-[10px] bg-[#191a1f] px-5 py-3 text-[12px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving member…" : "Save member"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
