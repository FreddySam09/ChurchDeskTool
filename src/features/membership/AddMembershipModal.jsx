import { useState, useEffect } from "react";
import { X, UserRound, MapPin, Phone, Hash } from "lucide-react";
import { createMembershipWithHead, getNextMembershipNumber, } from "../../services/membershipService";

import {
  getMembershipHeadPhotoUrl,
  uploadMembershipHeadPhoto,
  deleteMembershipHeadPhoto,
  validateMembershipHeadPhoto,
} from "../../services/membership/membershipPhotoService";


const initialForm = {
  membership_number: "",
  name: "",
  gender: "",
  date_of_birth: "",
  marital_status: "Single",
  baptism_status: "Unknown",
  date_of_baptism: "",
  occupation_or_studying: "",
  phone_number: "",
  email: "",
  door_number: "",
  street_name: "",
  area: "",
  city: "",
  pincode: "",
  landmark: "",
  primary_phone_number: "",
  alternate_phone_number: "",
  household_email: "",
  year_joined: String(new Date().getFullYear()),
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
  hint = "",
}) {
  return (
    <label className={labelClass}>
      {label}
      {required && <span className="ml-1 text-red-500">*</span>}

      <input
        name={name}
        type={type}
        value={form[name]}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClass}
      />

      {hint && (
        <span className="mt-1 block text-[10px] font-normal leading-4 text-[#92939b]">
          {hint}
        </span>
      )}
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
}) {
  return (
    <label className={labelClass}>
      {label}
      {required && <span className="ml-1 text-red-500">*</span>}

      <select
        name={name}
        value={form[name]}
        onChange={onChange}
        required={required}
        className={inputClass}
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

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-xl border border-[#ececed] p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e9edfd] text-[#3457d5]">
          <Icon size={16} />
        </span>

        <h3 className="text-[13px] font-bold text-[#131418]">{title}</h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{children}</div>
    </section>
  );
}

export default function AddMembershipModal({ onClose, onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [numberLoading, setNumberLoading] = useState(true);
  
  const [headPhotoFile, setHeadPhotoFile] = useState(null);
  const [headPhotoPreview, setHeadPhotoPreview] = useState(null);


useEffect(() => {
  let cancelled = false;

  async function loadNextNumber() {
    setNumberLoading(true);

    try {
      const nextNumber = await getNextMembershipNumber();

      if (!cancelled) {
        setForm((current) => ({
          ...current,
          membership_number: current.membership_number || nextNumber,
        }));
      }
    } catch (err) {
      if (!cancelled) {
        setError(
          err.message || "Could not determine the next membership number."
        );
      }
    } finally {
      if (!cancelled) {
        setNumberLoading(false);
      }
    }
  }

  loadNextNumber();

  return () => {
    cancelled = true;
  };
}, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: name === "membership_number" ? value.toUpperCase() : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      const result = await createMembershipWithHead({
        head: {
          name: form.name,
          gender: form.gender,
          date_of_birth: form.date_of_birth,
          marital_status: form.marital_status,
          baptism_status: form.baptism_status,
          date_of_baptism: form.date_of_baptism,
          occupation_or_studying: form.occupation_or_studying,
          phone_number: form.phone_number,
          email: form.email,
        },
        membership: {
          membership_number: form.membership_number.trim(),
          door_number: form.door_number,
          street_name: form.street_name,
          area: form.area,
          city: form.city,
          pincode: form.pincode,
          landmark: form.landmark,
          primary_phone_number: form.primary_phone_number || form.phone_number,
          alternate_phone_number: form.alternate_phone_number,
          email: form.household_email || form.email,
          year_joined: form.year_joined,
        },
      });

      
      let savedPhotoPath = null;

      if (headPhotoFile) {
        const membershipRecordId =
          result?.id ??
          result?.membership?.id ??
          result?.membership_record?.id ??
          result?.membership_id;

        if (!membershipRecordId) {
          throw new Error(
            "Membership was created, but its record ID was not returned. The photo could not be uploaded."
          );
        }

        savedPhotoPath = await uploadMembershipHeadPhoto(
          headPhotoFile,
          membershipRecordId
        );

        try {
          // Persist the Storage path using the existing membership update RPC.
          const { updateMembership } = await import(
            "../../services/membershipService"
          );

          await updateMembership(membershipRecordId, {
            head_photo_path: savedPhotoPath,
          });
        } catch (photoSaveError) {
          // Avoid leaving an orphaned upload if saving its path fails.
          await deleteMembershipHeadPhoto(savedPhotoPath).catch(() => {});
          throw photoSaveError;
        }
      }

      setCreated(result);
      await onCreated?.();

    } catch (err) {
      setError(err.message || "Could not create this membership.");
    } finally {
      setSaving(false);
    }
  }

  
  function handleHeadPhotoChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      validateMembershipHeadPhoto(file);

      setHeadPhotoFile(file);

      setHeadPhotoPreview((currentPreview) => {
        if (currentPreview?.startsWith("blob:")) {
          URL.revokeObjectURL(currentPreview);
        }

        return URL.createObjectURL(file);
      });

      setError("");
    } catch (err) {
      event.target.value = "";
      setError(err.message || "Could not select this image.");
    }
  }

  function clearHeadPhoto() {
    setHeadPhotoFile(null);

    setHeadPhotoPreview((currentPreview) => {
      if (currentPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(currentPreview);
      }

      return null;
    });
  }


  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/45 p-1.5 backdrop-blur-[2px] sm:p-3 lg:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-membership-title"
        className="my-auto w-full max-w-[790px] overflow-hidden rounded-2xl border border-[#ececed] bg-[#f9f9fa] shadow-[0_28px_80px_rgba(0,0,0,0.2)]"
      >
        <header className="flex items-start justify-between border-b border-[#ececed] bg-white px-5 py-5 sm:px-7">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4f70e8]">
              Membership management
            </p>

            <h2
              id="add-membership-title"
              className="text-xl font-extrabold text-[#131418]"
            >
              {created ? "Membership created" : "Add membership"}
            </h2>

            <p className="mt-1 text-[12px] text-[#777984]">
              {created
                ? "Your membership has been added to the active register."
                : "Enter the current register number and the head of membership details."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-lg p-2 text-[#777984] hover:bg-[#f2f2f3] disabled:opacity-50"
          >
            <X size={19} />
          </button>
        </header>

        {created ? (
          <div className="p-6 sm:p-8">
            <div className="rounded-xl border border-[#bde7cd] bg-[#eaf8ef] p-5">
              <p className="text-sm font-bold text-[#18794e]">
                Saved successfully
              </p>

              <p className="mt-3 text-[12px] text-[#276749]">
                Annual membership number
              </p>

              <p className="mt-1 font-mono text-3xl font-extrabold text-[#145c3b]">
                {created.membership_number}
              </p>

              <p className="mt-1 text-[12px] text-[#276749]">
                Annual register: {created.annual_register_year}
              </p>

              <div className="mt-4 border-t border-[#bde7cd] pt-3">
                <p className="text-[12px] text-[#276749]">
                  Permanent Membership ID
                </p>
                <p className="mt-1 font-mono text-lg font-bold text-[#145c3b]">
                  {created.membership_id}
                </p>

                <p className="mt-3 text-[12px] text-[#276749]">
                  Person ID: {created.person_id}
                </p>
              </div>
            </div>

            <p className="mt-4 text-[12px] leading-5 text-[#777984]">
              The annual number belongs to this year's register. Permanent IDs
              remain unchanged if the annual number is revised in a future
              register.
            </p>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[10px] bg-[#1a1b20] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-black"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
            <Section icon={Hash} title="Annual register">
              <label className={labelClass}>
  Membership number
  <span className="ml-1 text-red-500">*</span>

  <input
    name="membership_number"
    type="text"
    value={form.membership_number}
    onChange={handleChange}
    required
    autoComplete="off"
    placeholder={numberLoading ? "Calculating next number..." : "e.g. 1"}
    className={inputClass}
  />

  <span className="mt-1 block text-[10px] font-normal leading-4 text-[#92939b]">
    {numberLoading
      ? "Finding the next available number..."
      : `Suggested next number: ${form.membership_number || "â€”"}. You can edit it if required.`}
  </span>
</label>
              <Field
                label="Year joined"
                name="year_joined"
                form={form}
                onChange={handleChange}
                type="number"
                required
              />
            </Section>

            <Section icon={UserRound} title="Head of membership">
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
                  { value: "", label: "Select gender" },
                  { value: "Male", label: "Male" },
                  { value: "Female", label: "Female" },
                  { value: "Other", label: "Other" },
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
                options={[
                  { value: "Single", label: "Single" },
                  { value: "Married", label: "Married" },
                  { value: "Widowed", label: "Widowed" },
                  { value: "Divorced", label: "Divorced" },
                ]}
              />

              <SelectField
                label="Baptism status"
                name="baptism_status"
                form={form}
                onChange={handleChange}
                options={[
                  { value: "Unknown", label: "Unknown" },
                  { value: "Baptised", label: "Baptised" },
                  { value: "Not baptised", label: "Not baptised" },
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
            </Section>

            <Section icon={MapPin} title="Household address">
              <Field
                label="Door number"
                name="door_number"
                form={form}
                onChange={handleChange}
              />

              <Field
                label="Street name"
                name="street_name"
                form={form}
                onChange={handleChange}
              />

              <Field
                label="Area"
                name="area"
                form={form}
                onChange={handleChange}
              />

              <Field
                label="City"
                name="city"
                form={form}
                onChange={handleChange}
              />

              <Field
                label="Pincode"
                name="pincode"
                form={form}
                onChange={handleChange}
                inputMode="numeric"
              />

              <Field
                label="Landmark"
                name="landmark"
                form={form}
                onChange={handleChange}
              />
            </Section>

            <Section icon={Phone} title="Household contact">
              <Field
                label="Primary phone"
                name="primary_phone_number"
                form={form}
                onChange={handleChange}
                type="tel"
              />

              <Field
                label="Alternate phone"
                name="alternate_phone_number"
                form={form}
                onChange={handleChange}
                type="tel"
              />

              <Field
                label="Household email"
                name="household_email"
                form={form}
                onChange={handleChange}
                type="email"
              />
            </Section>

            
            <section className="rounded-xl border border-[#ececed] bg-white p-4 sm:p-5">
              <div className="mb-3">
                <h3 className="text-[13px] font-bold text-[#131418]">
                  Head of Membership Photo
                </h3>
                <p className="mt-1 text-[11px] text-[#92939b]">
                  JPG, PNG or WebP. Maximum file size: 1 MB.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#ececed] bg-[#f5f5f6]">
                  {headPhotoPreview ? (
                    <img
                      src={headPhotoPreview}
                      alt="Head of membership preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound size={36} className="text-[#a0a1a8]" />
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer rounded-lg border border-[#e5e5e7] px-4 py-2.5 text-[12px] font-semibold text-[#30313a] hover:bg-[#f7f7f8]">
                    Choose photo
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleHeadPhotoChange}
                      className="hidden"
                      disabled={saving}
                    />
                  </label>

                  {headPhotoFile && (
                    <button
                      type="button"
                      onClick={clearHeadPhoto}
                      disabled={saving}
                      className="rounded-lg px-3 py-2.5 text-[12px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>
            </section>


            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] leading-5 text-red-700"
              >
                {error}
              </div>
            )}

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ececed] pt-4">
              <p className="max-w-[330px] text-[11px] leading-5 text-[#92939b]">
                Permanent IDs are generated by the database. The annual number
                is recorded in the active register.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="rounded-[10px] border border-[#e5e5e7] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#53555e] hover:bg-[#f4f4f5]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-[10px] bg-[#1a1b20] px-5 py-2.5 text-[12px] font-semibold text-white hover:bg-black disabled:opacity-60"
                >
                  {saving ? "Savingâ€¦" : "Create membership"}
                </button>
              </div>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}

