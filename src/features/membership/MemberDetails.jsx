
import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Pencil,
  RefreshCw,
  UserRound,
  Users,
} from 'lucide-react'
import {
  getMemberDirectory,
  updateMember,
  updateMemberGroups,
} from '../../services/membershipService'
import GroupMultiSelect from './GroupMultiSelect'

const inputClass =
  'mt-1.5 min-h-[42px] w-full rounded-[10px] border border-[#e5e5e7] bg-white px-3 py-2 text-[12px] text-[#25262c] outline-none focus:border-[#9b9da5]'

const labelClass = 'block text-[11.5px] font-semibold text-[#53555e]'

const STATUS_OPTIONS = [
  'Active',
  'Inactive',
  'Deceased',
  'Transferred',
  'Left Church',
  'Removed',
]

function displayValue(value) {
  return value === null || value === undefined || value === ''
    ? 'Not Recorded'
    : String(value)
}

function formatDate(value) {
  if (!value) return 'Not Recorded'

  const date = new Date(`${value}T00:00:00`)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
}

function Detail({ label, value }) {
  return (
    <div className="min-w-0 border-b border-[#f2f2f3] py-3">
      <p className="text-[11px] font-medium text-[#888a93]">{label}</p>
      <p className="mt-1 break-words text-[12.5px] font-semibold text-[#25262c]">
        {displayValue(value)}
      </p>
    </div>
  )
}

function FormField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  options,
  required = false,
}) {
  return (
    <label className={labelClass}>
      {label}
      {required && <span className="ml-1 text-red-500">*</span>}

      {options ? (
        <select
          name={name}
          value={value ?? ''}
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
      ) : (
        <input
          name={name}
          type={type}
          value={value ?? ''}
          onChange={onChange}
          required={required}
          className={inputClass}
        />
      )}
    </label>
  )
}


function EditMemberModal({ member, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: member.name ?? '',
    gender: member.gender ?? '',
    date_of_birth: member.date_of_birth ?? '',
    marital_status: member.marital_status ?? 'Unknown',
    baptism_status: member.baptism_status ?? 'Unknown',
    date_of_baptism: member.date_of_baptism ?? '',
    occupation_or_studying: member.occupation_or_studying ?? '',
    phone_number: member.phone_number ?? '',
    email: member.email ?? '',
    status: member.status ?? 'Active',
  })

  const [selectedGroupIds, setSelectedGroupIds] = useState(
    () => [...new Set((member.groups ?? []).map((group) => group.id).filter(Boolean))],
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const cleanName = form.name.trim()

    if (!cleanName) {
      setError('Member name is required.')
      return
    }

    setSaving(true)
    setError('')

    try {
      // Update the member's editable personal fields.
      await updateMember(member.id, {
        name: cleanName,
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        marital_status: form.marital_status || null,
        baptism_status: form.baptism_status || null,
        date_of_baptism: form.date_of_baptism || null,
        occupation_or_studying:
          form.occupation_or_studying.trim() || null,
        phone_number: form.phone_number.trim() || null,
        email: form.email.trim() || null,
        status: form.status || null,
      })

      // Synchronise group assignments without deleting assignment history.
      await updateMemberGroups(member.id, selectedGroupIds)

      await onSaved()
      onClose()
    } catch (err) {
      setError(
        err.message ||
          'Could not save the member details and group assignments.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/45 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-member-title"
        className="my-auto max-h-[94vh] w-full max-w-[760px] overflow-y-auto rounded-2xl border border-[#ececed] bg-[#fafafa] shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#ececed] bg-white px-5 py-4 sm:px-7">
          <div>
            <h2
              id="edit-member-title"
              className="text-[17px] font-extrabold text-[#131418]"
            >
              Edit Member
            </h2>
            <p className="mt-1 text-[12px] text-[#777984]">
              Update this person's information and group assignments.
            </p>
            <p className="mt-2 text-[11px] text-[#888a93]">
              Person ID: {displayValue(member.person_id)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-[#ececed] px-3 py-2 text-[12px] text-[#53555e] hover:bg-[#f4f4f5] disabled:opacity-50"
          >
            Close
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 p-4 sm:p-7">
          <section className="rounded-xl border border-[#ececed] bg-white p-4 sm:p-5">
            <h3 className="mb-4 text-[13px] font-bold text-[#131418]">
              Personal Information
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Full Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />

              <FormField
                label="Gender"
                name="gender"
                value={form.gender}
                onChange={handleChange}
                options={[
                  { value: '', label: 'Select gender' },
                  { value: 'Male', label: 'Male' },
                  { value: 'Female', label: 'Female' },
                  { value: 'Other', label: 'Other' },
                  {
                    value: 'Prefer not to say',
                    label: 'Prefer not to say',
                  },
                ]}
              />

              <FormField
                label="Date of Birth"
                name="date_of_birth"
                type="date"
                value={form.date_of_birth}
                onChange={handleChange}
              />

              <FormField
                label="Marital Status"
                name="marital_status"
                value={form.marital_status}
                onChange={handleChange}
                options={[
                  { value: 'Single', label: 'Single' },
                  { value: 'Married', label: 'Married' },
                  { value: 'Widowed', label: 'Widowed' },
                  { value: 'Divorced', label: 'Divorced' },
                  { value: 'Separated', label: 'Separated' },
                  { value: 'Unknown', label: 'Unknown' },
                ]}
              />

              <FormField
                label="Baptism Status"
                name="baptism_status"
                value={form.baptism_status}
                onChange={handleChange}
                options={[
                  { value: 'Unknown', label: 'Unknown' },
                  { value: 'Baptised', label: 'Baptised' },
                  { value: 'Not Baptised', label: 'Not Baptised' },
                ]}
              />

              <FormField
                label="Date of Baptism"
                name="date_of_baptism"
                type="date"
                value={form.date_of_baptism}
                onChange={handleChange}
              />

              <FormField
                label="Occupation / Studying"
                name="occupation_or_studying"
                value={form.occupation_or_studying}
                onChange={handleChange}
              />

              <FormField
                label="Member Status"
                name="status"
                value={form.status}
                onChange={handleChange}
                options={STATUS_OPTIONS.map((status) => ({
                  value: status,
                  label: status,
                }))}
                required
              />

              <FormField
                label="Personal Phone"
                name="phone_number"
                type="tel"
                value={form.phone_number}
                onChange={handleChange}
              />

              <FormField
                label="Personal Email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
              />
            </div>
          </section>

          <GroupMultiSelect
            selectedIds={selectedGroupIds}
            onChange={(groupIds) => {
              setSelectedGroupIds(groupIds)
              setError('')
            }}
            disabled={saving}
          />

          <section className="rounded-xl border border-[#ececed] bg-white p-4 sm:p-5">
            <h3 className="text-[13px] font-bold text-[#131418]">
              Permanent Record
            </h3>
            <p className="mt-2 text-[11.5px] leading-5 text-[#777984]">
              Person ID, membership ID, membership number, and household
              assignment are not editable here. Removing a group ends its
              current assignment; it does not delete the assignment history.
            </p>
          </section>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700"
            >
              {error}
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
              disabled={saving}
              className="rounded-[10px] bg-[#191a1f] px-5 py-3 text-[12px] font-semibold text-white hover:bg-black disabled:opacity-60"
            >
              {saving ? 'Saving changes...' : 'Save Changes'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}


export default function MemberDetails() {
  const { memberId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  const loadMember = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const directory = await getMemberDirectory()
      const found = directory.find((item) => item.id === memberId)

      if (!found) {
        setMember(null)
        setError('This member could not be found.')
        return
      }

      setMember(found)
    } catch (err) {
      setError(err.message || 'Unable to load member details.')
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    loadMember()
  }, [loadMember])

  if (loading) {
    return (
      <div className="flex min-h-[250px] items-center justify-center gap-3 text-[12px] text-[#777984]">
        <RefreshCw size={16} className="animate-spin" />
        Loading member details...
      </div>
    )
  }

  if (error || !member) {
    return (
      <section className="rounded-[16px] border border-[#ececed] bg-white p-6">
        <button
          type="button"
          onClick={() =>
            navigate(location.state?.returnTo || '/members')
          }
          className="mb-4 inline-flex items-center gap-2 text-[12px] font-semibold text-[#53555e]"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <p role="alert" className="text-[13px] font-semibold text-red-700">
          {error || 'Member not found.'}
        </p>
        <button
          type="button"
          onClick={loadMember}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#e5e5e7] px-3 py-2 text-[12px] font-semibold"
        >
          <RefreshCw size={14} />
          Try again
        </button>
      </section>
    )
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() =>
          navigate(location.state?.returnTo || '/members')
        }
        className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#53555e] hover:text-[#131418]"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eeeeef] text-[#53555e]">
            <UserRound size={22} />
          </div>

          <div>
            <h1 className="text-[24px] font-extrabold tracking-[-0.7px] text-[#131418]">
              {member.name}
            </h1>
            <p className="mt-1 text-[12px] text-[#777984]">
              Person ID: {displayValue(member.person_id)}
            </p>
            <div className="mt-2">
              <span className="rounded-full bg-[#eeeeef] px-2.5 py-1 text-[10.5px] font-semibold text-[#53555e]">
                {member.status || 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (member.membership_row_id) {
                navigate(`/memberships/${member.membership_row_id}`)
              }
            }}
            disabled={!member.membership_row_id}
            title={
              member.membership_row_id
                ? 'Open associated membership'
                : 'No current membership is assigned'
            }
            className="inline-flex min-h-[40px] items-center gap-2 rounded-[10px] border border-[#e5e5e7] bg-white px-3.5 py-2 text-[12px] font-semibold text-[#25262c] hover:bg-[#f7f7f8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Users size={15} />
            View Membership
          </button>

          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-[10px] bg-[#191a1f] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-black"
          >
            <Pencil size={15} />
            Edit Member
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1.5fr_1fr]">
        <section className="overflow-hidden rounded-[16px] border border-[#ececed] bg-white">
          <header className="border-b border-[#f2f2f3] px-5 py-4">
            <h2 className="text-[13.5px] font-extrabold text-[#131418]">
              Personal Information
            </h2>
          </header>

          <div className="grid grid-cols-1 gap-x-6 px-5 sm:grid-cols-2">
            <Detail label="Full Name" value={member.name} />
            <Detail label="Permanent Person ID" value={member.person_id} />
            <Detail
              label="Relationship to Household Head"
              value={member.relationship_to_head}
            />
            <Detail label="Gender" value={member.gender} />
            <Detail
              label="Date of Birth"
              value={formatDate(member.date_of_birth)}
            />
            <Detail label="Personal Phone" value={member.phone_number} />
            <Detail label="Personal Email" value={member.email} />
            <Detail label="Marital Status" value={member.marital_status} />
            <Detail label="Baptism Status" value={member.baptism_status} />
            <Detail
              label="Date of Baptism"
              value={formatDate(member.date_of_baptism)}
            />
            <Detail
              label="Occupation / Studying"
              value={member.occupation_or_studying}
            />
            <Detail label="Member Status" value={member.status} />
          </div>
        </section>

        <div className="space-y-5">
          <section className="overflow-hidden rounded-[16px] border border-[#ececed] bg-white">
            <header className="flex items-center justify-between gap-3 border-b border-[#f2f2f3] px-5 py-4">
              <h2 className="text-[13.5px] font-extrabold text-[#131418]">
                Membership Information
              </h2>
              {member.membership_row_id && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/memberships/${member.membership_row_id}`)
                  }
                  className="text-[11px] font-semibold text-[#53555e] hover:text-[#131418]"
                >
                  Open
                </button>
              )}
            </header>

            <div className="px-5">
              <Detail
                label="Membership Number"
                value={member.display_membership_number}
              />
              <Detail label="Permanent Membership ID" value={member.membership_id} />
              <Detail label="Membership Status" value={member.membership_status} />
              <Detail
                label="Area"
                value={[member.membership_area, member.membership_city]
                  .filter(Boolean)
                  .join(', ')}
              />
              {!member.membership_row_id && (
                <p className="py-3 text-[11.5px] text-[#888a93]">
                  No current membership assignment is recorded.
                </p>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-[16px] border border-[#ececed] bg-white">
            <header className="border-b border-[#f2f2f3] px-5 py-4">
              <h2 className="text-[13.5px] font-extrabold text-[#131418]">
                Fellowships / Groups
              </h2>
            </header>

            <div className="p-5">
              {(member.groups ?? []).length ? (
                <div className="space-y-3">
                  {member.groups.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center justify-between gap-3 rounded-[10px] bg-[#f7f7f8] px-3 py-3"
                    >
                      <span className="text-[12px] font-semibold text-[#25262c]">
                        {group.name}
                      </span>
                      {group.role && (
                        <span className="text-right text-[10.5px] text-[#777984]">
                          {group.role}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-[#888a93]">
                  No fellowship assignments recorded.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>

      {editing && (
        <EditMemberModal
          member={member}
          onClose={() => setEditing(false)}
          onSaved={loadMember}
        />
      )}
    </div>
  )
}
