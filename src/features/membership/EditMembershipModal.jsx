
import { useEffect, useState } from 'react'
import { X, MapPin, Phone, Hash, UserRound } from 'lucide-react'
import { updateMembership } from '../../services/membershipService'

const inputClass =
  'mt-1.5 w-full rounded-[10px] border border-[#e5e5e7] bg-white px-3 py-2.5 text-[13px] text-[#131418] outline-none transition placeholder:text-[#a0a1a8] focus:border-[#4f70e8] focus:ring-2 focus:ring-[#4f70e8]/10'

const labelClass = 'block text-[12px] font-semibold text-[#53555e]'

function Field({
  label,
  name,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder = '',
}) {
  return (
    <label className={labelClass}>
      {label}
      {required && <span className="ml-1 text-red-500">*</span>}
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className={inputClass}
      />
    </label>
  )
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-xl border border-[#ececed] bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e9edfd] text-[#3457d5]">
          <Icon size={16} />
        </span>
        <h3 className="text-[13px] font-bold text-[#131418]">{title}</h3>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {children}
      </div>
    </section>
  )
}

function toFormValue(value) {
  return value == null ? '' : String(value)
}

export default function EditMembershipModal({
  membership,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm({
      membership_number: toFormValue(membership.membership_number),
      membership_status: toFormValue(
        membership.membership_status || 'Active',
      ),
      door_number: toFormValue(membership.door_number),
      street_name: toFormValue(membership.street_name),
      area: toFormValue(membership.area),
      city: toFormValue(membership.city),
      pincode: toFormValue(membership.pincode),
      landmark: toFormValue(membership.landmark),
      primary_phone_number: toFormValue(membership.primary_phone_number),
      alternate_phone_number: toFormValue(membership.alternate_phone_number),
      email: toFormValue(membership.email),
      year_joined: toFormValue(
        membership.year_joined || new Date().getFullYear(),
      ),
      head_photo_path: toFormValue(membership.head_photo_path),
    })
  }, [membership])

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!membership?.id) {
      setError('Membership record ID is missing.')
      return
    }

    const year = Number(form.year_joined)

    if (!Number.isInteger(year) || year < 1800 || year > 2200) {
      setError('Enter a valid year joined.')
      return
    }

    const number = form.membership_number.trim()

    if (number && !/^[0-9]+$/.test(number)) {
      setError('Membership number must contain digits only.')
      return
    }

    setSaving(true)

    try {
      await updateMembership(membership.id, {
        membership_number: number || null,
        membership_status: form.membership_status,
        door_number: form.door_number.trim() || null,
        street_name: form.street_name.trim() || null,
        area: form.area.trim() || null,
        city: form.city.trim() || null,
        pincode: form.pincode.trim() || null,
        landmark: form.landmark.trim() || null,
        primary_phone_number: form.primary_phone_number.trim() || null,
        alternate_phone_number: form.alternate_phone_number.trim() || null,
        email: form.email.trim() || null,
        year_joined: year,
        head_photo_path: form.head_photo_path.trim() || null,
      })

      await onSaved?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Could not update this membership.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose()
      }}
    >
      <section className="my-auto max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#ececed] bg-[#fafafa] shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#ececed] bg-white px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-[18px] font-bold tracking-[-0.3px] text-[#131418]">
              Edit membership
            </h2>
            <p className="mt-1 text-[12px] text-[#777984]">
              Update membership number, status, address and contact details.
            </p>
            <p className="mt-2 font-mono text-[11px] text-[#92939b]">
              Permanent ID: {membership.membership_id || membership.id}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close edit membership"
            className="rounded-lg border border-[#ececed] p-2 text-[#53555e] transition hover:bg-[#f4f4f5] disabled:opacity-50"
          >
            <X size={17} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
          <Section icon={Hash} title="Membership information">
            <Field
              label="Membership number"
              name="membership_number"
              value={form.membership_number ?? ''}
              onChange={handleChange}
              placeholder="e.g. 1"
            />

            <label className={labelClass}>
              Membership status
              <select
                name="membership_status"
                value={form.membership_status ?? 'Active'}
                onChange={handleChange}
                className={inputClass}
                required
              >
                {['Active', 'Inactive', 'Transferred', 'Closed'].map(
                  (status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ),
                )}
              </select>
            </label>

            <Field
              label="Year joined"
              name="year_joined"
              type="number"
              value={form.year_joined ?? ''}
              onChange={handleChange}
              required
            />

            <Field
              label="Head photo storage path"
              name="head_photo_path"
              value={form.head_photo_path ?? ''}
              onChange={handleChange}
              placeholder="Storage path (optional)"
            />
          </Section>

          <Section icon={MapPin} title="Address">
            <Field
              label="Door number"
              name="door_number"
              value={form.door_number ?? ''}
              onChange={handleChange}
            />
            <Field
              label="Street name"
              name="street_name"
              value={form.street_name ?? ''}
              onChange={handleChange}
            />
            <Field
              label="Area"
              name="area"
              value={form.area ?? ''}
              onChange={handleChange}
            />
            <Field
              label="City"
              name="city"
              value={form.city ?? ''}
              onChange={handleChange}
            />
            <Field
              label="Pincode"
              name="pincode"
              value={form.pincode ?? ''}
              onChange={handleChange}
              inputMode="numeric"
            />
            <Field
              label="Landmark"
              name="landmark"
              value={form.landmark ?? ''}
              onChange={handleChange}
            />
          </Section>

          <Section icon={Phone} title="Household contact">
            <Field
              label="Primary phone"
              name="primary_phone_number"
              value={form.primary_phone_number ?? ''}
              onChange={handleChange}
              type="tel"
            />
            <Field
              label="Alternate phone"
              name="alternate_phone_number"
              value={form.alternate_phone_number ?? ''}
              onChange={handleChange}
              type="tel"
            />
            <Field
              label="Household email"
              name="email"
              value={form.email ?? ''}
              onChange={handleChange}
              type="email"
            />
          </Section>

          <Section icon={UserRound} title="Permanent record">
            <div className="sm:col-span-2">
              <p className="text-[12px] leading-6 text-[#777984]">
                The permanent membership ID and head member are not editable
                here. Changing the membership number does not change the
                permanent ID.
              </p>
            </div>
          </Section>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] leading-5 text-red-700"
            >
              {error}
            </div>
          )}

          <footer className="flex flex-wrap justify-end gap-2 border-t border-[#ececed] pt-4">
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
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
