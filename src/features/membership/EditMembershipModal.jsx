
import { useEffect, useState } from "react";
import {
  X,
  MapPin,
  Phone,
  Hash,
  UserRound,
  Camera,
  CalendarDays,
} from "lucide-react";

import { updateMembership } from "../../services/membershipService";

import {
  getMembershipHeadPhotoUrl,
  uploadMembershipHeadPhoto,
  deleteMembershipHeadPhoto,
  validateMembershipHeadPhoto,
} from "../../services/membership/membershipPhotoService";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-[#e5e5e7] bg-white px-3.5 py-3 text-[13px] text-[#202127] outline-none transition placeholder:text-[#a0a1a8] focus:border-[#6079df] focus:ring-2 focus:ring-[#6079df]/10 disabled:cursor-not-allowed disabled:bg-[#f4f4f5]";

const labelClass =
  "block w-full text-[12px] font-semibold text-[#53555e]";

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder = "",
  hint = "",
  disabled = false,
  min,
  max,
}) {
  return (
    <label className={labelClass}>
      {label}
      {required && <span className="ml-1 text-red-500">*</span>}

      <input
        name={name}
        type={type}
        value={value ?? ""}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        className={inputClass}
      />

      {hint && (
        <span className="mt-1.5 block text-[11px] font-normal leading-5 text-[#858792]">
          {hint}
        </span>
      )}
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
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
        value={value ?? ""}
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

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-2xl border border-[#e9e9ec] bg-white p-4 sm:p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef0ff] text-[#526bd5]">
          <Icon size={17} />
        </span>

        <div className="min-w-0">
          <h3 className="text-[13px] font-bold text-[#202127]">
            {title}
          </h3>

          {description && (
            <p className="mt-1 text-[11px] leading-5 text-[#858792]">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {children}
      </div>
    </section>
  );
}

function toFormValue(value) {
  return value == null ? "" : String(value);
}

function createInitialForm(membership) {
  return {
    membership_number: toFormValue(membership?.membership_number),
    membership_status: toFormValue(
      membership?.membership_status || "Active",
    ),

    door_number: toFormValue(membership?.door_number),
    floor_number: toFormValue(membership?.floor_number),
    apartment_name: toFormValue(membership?.apartment_name),
    block_number: toFormValue(membership?.block_number),
    street_name: toFormValue(membership?.street_name),
    area: toFormValue(membership?.area),
    city: toFormValue(membership?.city),
    pincode: toFormValue(membership?.pincode),
    landmark: toFormValue(membership?.landmark),

    primary_phone_number: toFormValue(
      membership?.primary_phone_number,
    ),
    alternate_phone_number: toFormValue(
      membership?.alternate_phone_number,
    ),
    email: toFormValue(membership?.email),

    year_joined: toFormValue(membership?.year_joined),
    head_photo_path: toFormValue(membership?.head_photo_path),
  };
}

export default function EditMembershipModal({
  membership,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(() =>
    createInitialForm(membership),
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [headPhotoFile, setHeadPhotoFile] = useState(null);
  const [removeHeadPhoto, setRemoveHeadPhoto] = useState(false);

  const [headPhotoPreview, setHeadPhotoPreview] = useState(() =>
    getMembershipHeadPhotoUrl(membership?.head_photo_path),
  );

  useEffect(() => {
    setForm(createInitialForm(membership));
    setHeadPhotoFile(null);
    setRemoveHeadPhoto(false);
    setHeadPhotoPreview(
      getMembershipHeadPhotoUrl(membership?.head_photo_path),
    );
    setError("");
  }, [membership]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]:
        name === "membership_number"
          ? value.toUpperCase()
          : value,
    }));

    setError("");
  }

  function handleHeadPhotoChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      validateMembershipHeadPhoto(file);

      setHeadPhotoFile(file);
      setRemoveHeadPhoto(false);

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
    setRemoveHeadPhoto(true);

    setHeadPhotoPreview((currentPreview) => {
      if (currentPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(currentPreview);
      }

      return null;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!membership?.id) {
      setError("Membership record ID is missing.");
      return;
    }

    const number = String(form.membership_number ?? "").trim();

    if (number && !/^[0-9]+$/.test(number)) {
      setError("Membership number must contain digits only.");
      return;
    }

    const yearJoinedValue = String(
      form.year_joined ?? "",
    ).trim();

    const year = yearJoinedValue
      ? Number(yearJoinedValue)
      : null;

    if (
      yearJoinedValue &&
      (!Number.isInteger(year) || year < 1800 || year > 2200)
    ) {
      setError("Enter a valid year joined.");
      return;
    }

    setSaving(true);

    let uploadedPhotoPath = null;

    try {
      let newPhotoPath = form.head_photo_path || null;

      if (headPhotoFile) {
        uploadedPhotoPath = await uploadMembershipHeadPhoto(
          headPhotoFile,
          membership.membership_id || membership.id,
        );

        newPhotoPath = uploadedPhotoPath;
      } else if (removeHeadPhoto) {
        newPhotoPath = null;
      }

      await updateMembership(membership.id, {
        membership_number: number || null,
        membership_status: form.membership_status,

        door_number: form.door_number.trim() || null,
        // floor_number: form.floor_number.trim() || null,
        // apartment_name: form.apartment_name.trim() || null,
        // block_number: form.block_number.trim() || null, rpc needs to be updated before uncommenting these 3 lines
        street_name: form.street_name.trim() || null,
        area: form.area.trim() || null,
        city: form.city.trim() || null,
        pincode: form.pincode.trim() || null,
        landmark: form.landmark.trim() || null,

        primary_phone_number:
          form.primary_phone_number.trim() || null,

        alternate_phone_number:
          form.alternate_phone_number.trim() || null,

        email: form.email.trim() || null,
        year_joined: year,
        head_photo_path: newPhotoPath,
      });

      const oldPhotoPath = membership.head_photo_path;

      if (
        oldPhotoPath &&
        oldPhotoPath !== newPhotoPath &&
        (headPhotoFile || removeHeadPhoto)
      ) {
        await deleteMembershipHeadPhoto(oldPhotoPath).catch(
          (deleteError) => {
            console.error(
              "Could not delete the old membership photo:",
              deleteError,
            );
          },
        );
      }

      uploadedPhotoPath = null;

      await onSaved?.();
      onClose();
    } catch (err) {
      // Do not leave an uploaded but unreferenced image behind.
      if (uploadedPhotoPath) {
        await deleteMembershipHeadPhoto(
          uploadedPhotoPath,
        ).catch(() => {});
      }

      setError(
        err.message || "Could not update this membership.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/45 p-2 backdrop-blur-[2px] sm:p-5"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !saving
        ) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-membership-title"
        className="my-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border border-[#e9e9ec] bg-[#f8f8fa] shadow-[0_28px_80px_rgba(0,0,0,0.22)] sm:max-h-[calc(100dvh-2.5rem)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#ececed] bg-white px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6579d9]">
              Membership management
            </p>

            <h2
              id="edit-membership-title"
              className="text-[19px] font-extrabold tracking-tight text-[#202127]"
            >
              Edit membership
            </h2>

            <p className="mt-1 text-[12px] leading-5 text-[#858792]">
              Update the household's register, address and contact
              information.
            </p>

            <p className="mt-2 break-all font-mono text-[10px] text-[#92939b]">
              Permanent ID: {membership?.membership_id || membership?.id}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close edit membership"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#ececed] text-[#666873] transition hover:bg-[#f4f4f5] disabled:opacity-50"
          >
            <X size={17} />
          </button>
        </header>

        <form
          id="edit-membership-form"
          onSubmit={handleSubmit}
          className="min-h-0 space-y-4 overflow-y-auto p-3.5 sm:p-5"
        >
          <Section
            icon={Hash}
            title="Membership information"
            description="Update the annual register number and membership status."
          >
            <Field
              label="Membership number"
              name="membership_number"
              value={form.membership_number}
              onChange={handleChange}
              placeholder="e.g. 101"
            />

            <SelectField
              label="Membership status"
              name="membership_status"
              value={form.membership_status}
              onChange={handleChange}
              required
              options={[
                { value: "Active", label: "Active" },
                { value: "Inactive", label: "Inactive" },
                { value: "Transferred", label: "Transferred" },
                { value: "Closed", label: "Closed" },
              ]}
            />

            <Field
              label="Year joined"
              name="year_joined"
              type="number"
              value={form.year_joined}
              onChange={handleChange}
              placeholder="Optional"
              min="1800"
              max="2200"
            />
          </Section>

          <Section
            icon={Camera}
            title="Head of membership photo"
            description="Upload or remove the photograph displayed on the membership profile."
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#e9e9ec] bg-[#f4f4f6]">
                {headPhotoPreview ? (
                  <img
                    src={headPhotoPreview}
                    alt="Head of membership"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserRound
                    size={36}
                    className="text-[#a0a1a8]"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-[#30313a]">
                  Membership photograph
                </p>

                <p className="mt-1 text-[11px] leading-5 text-[#858792]">
                  JPG, PNG or WebP. The existing photograph will
                  remain unchanged unless you select or remove it.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#e5e5e7] bg-white px-3.5 py-2.5 text-[11px] font-semibold text-[#30313a] transition hover:bg-[#f7f7f8]">
                    <Camera size={14} />
                    Choose photo

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleHeadPhotoChange}
                      className="hidden"
                      disabled={saving}
                    />
                  </label>

                  {headPhotoPreview && (
                    <button
                      type="button"
                      onClick={clearHeadPhoto}
                      disabled={saving}
                      className="rounded-xl px-3 py-2.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Section>

          <Section
            icon={MapPin}
            title="Household address"
            description="Keep each address component in its own field."
          >
            <Field
              label="Door number"
              name="door_number"
              value={form.door_number}
              onChange={handleChange}
              placeholder="e.g. 12A"
            />

            <Field
              label="Floor number"
              name="floor_number"
              value={form.floor_number}
              onChange={handleChange}
              placeholder="Optional"
            />

            <Field
              label="Apartment / house name"
              name="apartment_name"
              value={form.apartment_name}
              onChange={handleChange}
              placeholder="Optional"
            />

            <Field
              label="Block number"
              name="block_number"
              value={form.block_number}
              onChange={handleChange}
              placeholder="Optional"
            />

            <Field
              label="Street name"
              name="street_name"
              value={form.street_name}
              onChange={handleChange}
            />

            <Field
              label="Area"
              name="area"
              value={form.area}
              onChange={handleChange}
            />

            <Field
              label="City"
              name="city"
              value={form.city}
              onChange={handleChange}
            />

            <Field
              label="Pincode"
              name="pincode"
              value={form.pincode}
              onChange={handleChange}
              inputMode="numeric"
            />

            <Field
              label="Landmark"
              name="landmark"
              value={form.landmark}
              onChange={handleChange}
            />
          </Section>

          <Section
            icon={Phone}
            title="Household contact"
            description="These numbers and email are used as the household's primary contact details."
          >
            <Field
              label="Primary phone"
              name="primary_phone_number"
              value={form.primary_phone_number}
              onChange={handleChange}
              type="tel"
            />

            <Field
              label="Alternate phone"
              name="alternate_phone_number"
              value={form.alternate_phone_number}
              onChange={handleChange}
              type="tel"
            />

            <Field
              label="Household email"
              name="email"
              value={form.email}
              onChange={handleChange}
              type="email"
            />
          </Section>

          <Section
            icon={CalendarDays}
            title="Permanent record"
            description="Permanent identifiers are managed by the system and cannot be edited here."
          >
            <div className="rounded-xl bg-[#f6f7fb] p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#858792]">
                Permanent membership ID
              </p>

              <p className="mt-1 break-all font-mono text-[13px] font-bold text-[#30313a]">
                {membership?.membership_id || "Not available"}
              </p>

              <p className="mt-2 text-[11px] leading-5 text-[#858792]">
                Changing the annual membership number will not
                change this permanent ID or the head of membership.
              </p>
            </div>
          </Section>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-[12px] leading-5 text-red-700"
            >
              {error}
            </div>
          )}
        </form>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#ececed] bg-white p-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-10 rounded-xl border border-[#e5e5e7] bg-white px-5 py-2.5 text-[12px] font-semibold text-[#53555e] transition hover:bg-[#f4f4f5] disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            form="edit-membership-form"
            disabled={saving}
            className="min-h-10 rounded-xl bg-[#202127] px-5 py-2.5 text-[12px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving changes..." : "Save changes"}
          </button>
        </footer>
      </section>
    </div>
  );
}
