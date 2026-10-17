
import { useMemo, useState } from 'react'
import { GitBranch, X } from 'lucide-react'
import { createBranchFromMember } from '../../services/membershipService'

const inputClass =
  'mt-1.5 w-full rounded-[10px] border border-[#e5e5e7] bg-white px-3 py-2.5 text-[13px] text-[#131418] outline-none focus:border-[#4f70e8] focus:ring-2 focus:ring-[#4f70e8]/10'

export default function CreateBranchFromMemberModal({
  membership,
  members,
  branches,
  onClose,
  onCreated,
}) {
  const eligibleMembers = useMemo(
    () =>
      (members || [])
        .filter((member) => !member.branch_id && !member.is_head)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [members],
  )

  const usedSuffixes = useMemo(
    () =>
      new Set(
        (branches || []).map((branch) =>
          String(branch.suffix || '').toUpperCase(),
        ),
      ),
    [branches],
  )

  const firstAvailableSuffix = useMemo(() => {
    for (let code = 65; code <= 90; code += 1) {
      const suffix = String.fromCharCode(code)
      if (!usedSuffixes.has(suffix)) return suffix
    }
    return ''
  }, [usedSuffixes])

  const [memberId, setMemberId] = useState('')
  const [suffix, setSuffix] = useState(firstAvailableSuffix)
  const [branchName, setBranchName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!memberId) {
      setError('Choose the existing member who will head the branch.')
      return
    }

    if (!/^[A-Z]$/.test(suffix)) {
      setError('Choose one unused uppercase letter from A to Z.')
      return
    }

    if (usedSuffixes.has(suffix)) {
      setError(`Branch ${suffix} already exists for this membership.`)
      return
    }

    setSaving(true)

    try {
      await createBranchFromMember({
        membershipRowId: membership.id,
        memberId,
        suffix,
        branchName: branchName.trim() || null,
      })

      await onCreated()
    } catch (err) {
      setError(err.message || 'Could not create the branch.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-branch-title"
        className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-[#ececed] bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#ececed] px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef1ff] text-[#536bd6]">
              <GitBranch size={18} />
            </span>

            <div>
              <h2
                id="create-branch-title"
                className="text-[16px] font-bold text-[#131418]"
              >
                Create branch from existing member
              </h2>

              <p className="mt-1 text-[12px] leading-5 text-[#777984]">
                Select a person already in this membership. They will become
                the branch head and be moved into the new branch.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-lg border border-[#ececed] p-2 text-[#53555e] hover:bg-[#f4f4f5] disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="rounded-xl border border-[#ececed] bg-[#fafafa] p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#92939b]">
              Parent membership
            </p>

            <p className="mt-1 text-[15px] font-bold text-[#131418]">
              {membership.membership_number || 'Number not assigned'}
            </p>

            <p className="mt-1 text-[11px] text-[#777984]">
              New branch number: {membership.membership_number || '—'}
              {suffix || '?'}
            </p>
          </div>

          <label className="block text-[12px] font-semibold text-[#53555e]">
            Existing member / branch head *

            <select
              required
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
              className={inputClass}
            >
              <option value="">Select a main-membership member</option>

              {eligibleMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} · {member.person_id || 'No Person ID'}
                  {member.relationship_to_head
                    ? ` · ${member.relationship_to_head}`
                    : ''}
                </option>
              ))}
            </select>

            {eligibleMembers.length === 0 && (
              <span className="mt-1.5 block font-normal leading-5 text-[#aa382d]">
                No eligible main-membership members are available. The
                membership head and members already assigned to a branch are
                excluded.
              </span>
            )}
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-[12px] font-semibold text-[#53555e]">
              Branch suffix *

              <select
                required
                value={suffix}
                onChange={(event) => setSuffix(event.target.value)}
                className={inputClass}
              >
                <option value="">Choose suffix</option>

                {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => (
                  <option
                    key={letter}
                    value={letter}
                    disabled={usedSuffixes.has(letter)}
                  >
                    {letter}
                    {usedSuffixes.has(letter) ? ' (already used)' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[12px] font-semibold text-[#53555e]">
              Branch name (optional)

              <input
                value={branchName}
                onChange={(event) => setBranchName(event.target.value)}
                maxLength={100}
                placeholder="e.g. Joseph family"
                className={inputClass}
              />
            </label>
          </div>

          <div className="rounded-xl border border-[#f3dfad] bg-[#fffaf0] p-3 text-[11px] leading-5 text-[#805d17]">
            This operation keeps the person's permanent Person ID and the
            parent membership's permanent Membership ID. It changes the
            person's current structure assignment to the new branch.
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] leading-5 text-red-700"
            >
              {error}
            </p>
          )}

          <footer className="flex flex-col-reverse gap-2 border-t border-[#ececed] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-[10px] border border-[#e5e5e7] px-4 py-2.5 text-[12px] font-semibold text-[#53555e] hover:bg-[#f4f4f5] disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving || !memberId || !suffix || eligibleMembers.length === 0
              }
              className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#191a1f] px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              <GitBranch size={15} />
              {saving ? 'Creating branch…' : 'Create branch'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
