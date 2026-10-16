
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Users,
  Plus,
  Search,
  Pencil,
  RefreshCw,
  UserPlus,
  UserMinus,
  X,
  FolderOpen,
  Check,
  AlertCircle,
} from 'lucide-react'
import {
  getChurchGroups,
  createChurchGroup,
  updateChurchGroup,
  getMembers,
  getGroupAssignments,
  saveMemberGroupAssignments,
} from '../../services/membershipService'

const inputClass =
  'mt-1.5 min-h-[42px] w-full rounded-[10px] border border-[#e5e5e7] bg-white px-3 py-2 text-[12px] text-[#25262c] outline-none transition focus:border-[#7b88c9] focus:ring-2 focus:ring-[#7b88c9]/10'

const labelClass = 'block text-[11.5px] font-semibold text-[#53555e]'

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(`${value}T00:00:00`)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
}

function ErrorMessage({ children }) {
  if (!children) return null

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[12px] leading-5 text-red-700"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function GroupModal({ group, onClose, onSaved }) {
  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const [status, setStatus] = useState(group?.group_status ?? 'Active')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      if (group) {
        await updateChurchGroup(group.id, {
          name,
          description,
          groupStatus: status,
        })
      } else {
        await createChurchGroup({ name, description })
      }

      await onSaved()
      onClose()
    } catch (err) {
      setError(err.message || 'Could not save this group.')
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
        aria-labelledby="group-modal-title"
        className="my-auto w-full max-w-[500px] overflow-hidden rounded-2xl border border-[#ececed] bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-[#ececed] px-5 py-4">
          <div>
            <h2
              id="group-modal-title"
              className="text-[16px] font-bold text-[#131418]"
            >
              {group ? 'Edit group' : 'Create group'}
            </h2>
            <p className="mt-1 text-[12px] text-[#777984]">
              Manage the group name and availability.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-lg border border-[#ececed] p-2 text-[#53555e] hover:bg-[#f4f4f5]"
          >
            <X size={16} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <label className={labelClass}>
            Group name <span className="text-red-500">*</span>
            <input
              autoFocus
              required
              maxLength={100}
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
              placeholder="e.g. Youth Fellowship"
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            Description <span className="font-normal text-[#92939b]">(optional)</span>
            <textarea
              rows={3}
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add a short note if needed"
              className={inputClass}
            />
          </label>

          {group && (
            <label className={labelClass}>
              Status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={inputClass}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <span className="mt-1 block font-normal leading-5 text-[#92939b]">
                Inactive groups cannot receive new assignments. Existing
                assignments are preserved.
              </span>
            </label>
          )}

          <ErrorMessage>{error}</ErrorMessage>

          <footer className="flex flex-col-reverse gap-2 border-t border-[#ececed] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-[10px] border border-[#e5e5e7] px-4 py-2.5 text-[12px] font-semibold text-[#53555e] hover:bg-[#f4f4f5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#191a1f] px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              <Check size={15} />
              {saving ? 'Saving…' : group ? 'Save changes' : 'Create group'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function AssignmentModal({ group, members, assignedIds, onClose, onAssigned }) {
  const [query, setQuery] = useState('')
  const [memberId, setMemberId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const availableMembers = useMemo(() => {
    const search = query.trim().toLowerCase()

    return members
      .filter((member) => !assignedIds.has(member.id))
      .filter((member) => {
        if (!search) return true

        return [
          member.name,
          member.person_id,
          member.phone_number,
          member.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(search)
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [members, assignedIds, query])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!memberId) {
      setError('Select a member first.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await saveMemberGroupAssignments({
        memberId,
        groupId: group.id,
      })

      await onAssigned()
      onClose()
    } catch (err) {
      setError(err.message || 'Could not assign this member.')
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
        aria-labelledby="assignment-modal-title"
        className="my-auto w-full max-w-[540px] overflow-hidden rounded-2xl border border-[#ececed] bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-[#ececed] px-5 py-4">
          <div>
            <h2
              id="assignment-modal-title"
              className="text-[16px] font-bold text-[#131418]"
            >
              Add a member
            </h2>
            <p className="mt-1 text-[12px] text-[#777984]">
              Assign an existing person to {group.name}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-lg border border-[#ececed] p-2 text-[#53555e] hover:bg-[#f4f4f5]"
          >
            <X size={16} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <label className={labelClass}>
            Search members
            <span className="relative mt-1.5 block">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#92939b]"
              />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setMemberId('')
                  setError('')
                }}
                placeholder="Name, Person ID, phone or email"
                className={`${inputClass} mt-0 pl-9`}
              />
            </span>
          </label>

          <div className="max-h-[300px] overflow-y-auto rounded-xl border border-[#ececed]">
            {availableMembers.length ? (
              availableMembers.map((member) => (
                <label
                  key={member.id}
                  className={`flex cursor-pointer items-center gap-3 border-b border-[#f0f0f1] px-3.5 py-3 last:border-b-0 hover:bg-[#f8f8f9] ${
                    memberId === member.id ? 'bg-[#f1f3ff]' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="member"
                    value={member.id}
                    checked={memberId === member.id}
                    onChange={() => {
                      setMemberId(member.id)
                      setError('')
                    }}
                    className="accent-[#536bd6]"
                  />
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eeeeef] text-[12px] font-bold text-[#53555e]">
                    {(member.name || '?').trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold text-[#25262c]">
                      {member.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[10.5px] text-[#888a93]">
                      {member.person_id || 'No Person ID'}
                      {member.status ? ` · ${member.status}` : ''}
                    </span>
                  </span>
                </label>
              ))
            ) : (
              <p className="px-4 py-8 text-center text-[12px] text-[#888a93]">
                No unassigned members match this search.
              </p>
            )}
          </div>

          <ErrorMessage>{error}</ErrorMessage>

          <footer className="flex flex-col-reverse gap-2 border-t border-[#ececed] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-[10px] border border-[#e5e5e7] px-4 py-2.5 text-[12px] font-semibold text-[#53555e] hover:bg-[#f4f4f5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !memberId}
              className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#191a1f] px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              <UserPlus size={15} />
              {saving ? 'Adding…' : 'Add to group'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export default function GroupsPage() {
  const outletContext = useOutletContext() || {}
  const globalSearch = outletContext.searchValue || ''

  const [groups, setGroups] = useState([])
  const [members, setMembers] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [assignments, setAssignments] = useState([])
  const [groupSearch, setGroupSearch] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [groupModal, setGroupModal] = useState(null)
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [endingAssignmentId, setEndingAssignmentId] = useState('')

  const selectedGroup =
    groups.find((group) => group.id === selectedGroupId) ?? null

  const loadBase = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [groupRows, memberRows] = await Promise.all([
        getChurchGroups({ activeOnly: false }),
        getMembers(),
      ])

      setGroups(groupRows)
      setMembers(memberRows)

      setSelectedGroupId((current) => {
        if (current && groupRows.some((group) => group.id === current)) {
          return current
        }

        return groupRows.find((group) => group.group_status === 'Active')?.id
          ?? groupRows[0]?.id
          ?? ''
      })
    } catch (err) {
      setError(err.message || 'Unable to load groups and members.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAssignments = useCallback(async (groupId) => {
    if (!groupId) {
      setAssignments([])
      return
    }

    setDetailsLoading(true)

    try {
      const rows = await getGroupAssignments(groupId)
      setAssignments(rows)
    } catch (err) {
      setError(err.message || 'Unable to load group members.')
    } finally {
      setDetailsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBase()
  }, [loadBase])

  useEffect(() => {
    loadAssignments(selectedGroupId)
  }, [selectedGroupId, loadAssignments])

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  )

  const assignedIds = useMemo(
    () => new Set(assignments.map((assignment) => assignment.member_id)),
    [assignments],
  )

  const visibleGroups = useMemo(() => {
    const query = `${groupSearch} ${globalSearch}`.trim().toLowerCase()

    return groups.filter((group) => {
      if (!query) return true

      return `${group.name} ${group.description || ''} ${group.group_status}`
        .toLowerCase()
        .includes(query)
    })
  }, [groups, groupSearch, globalSearch])

  const visibleAssignments = useMemo(() => {
    const query = memberSearch.trim().toLowerCase()

    return assignments
      .map((assignment) => ({
        ...assignment,
        member: memberById.get(assignment.member_id) ?? null,
      }))
      .filter(({ member }) => {
        if (!member) return false
        if (!query) return true

        return [
          member.name,
          member.person_id,
          member.phone_number,
          member.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      })
      .sort((a, b) =>
        (a.member?.name || '').localeCompare(b.member?.name || ''),
      )
  }, [assignments, memberById, memberSearch])

  async function refreshAll() {
    setNotice('')
    await loadBase()
    if (selectedGroupId) {
      await loadAssignments(selectedGroupId)
    }
  }

  async function refreshSelectedGroup() {
    if (selectedGroupId) {
      await loadAssignments(selectedGroupId)
    }
    await loadBase()
  }

  async function handleEndAssignment(assignment) {
    const member = memberById.get(assignment.member_id)
    const confirmed = window.confirm(
      `Remove ${member?.name || 'this member'} from ${selectedGroup?.name}? Their member record will not be deleted.`,
    )

    if (!confirmed) return

    setEndingAssignmentId(assignment.id)
    setError('')
    setNotice('')

    try {
      await saveMemberGroupAssignments({
        endAssignmentId: assignment.id,
      })

      await loadAssignments(selectedGroupId)
      setNotice(`${member?.name || 'Member'} was removed from this group.`)
    } catch (err) {
      setError(err.message || 'Could not remove this assignment.')
    } finally {
      setEndingAssignmentId('')
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#92939b]">
            Church directory
          </p>
          <h1 className="text-[25px] font-extrabold tracking-[-0.8px] text-[#131418] sm:text-[30px]">
            Fellowships & Groups
          </h1>
          <p className="mt-2 max-w-[620px] text-[13px] leading-6 text-[#777984]">
            Organise existing members into fellowships and church groups.
            People can belong to more than one group.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refreshAll}
            disabled={loading}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[12px] border border-[#e5e5e7] bg-white px-4 text-[12px] font-semibold text-[#53555e] hover:bg-[#f8f8f9] disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setGroupModal({ mode: 'create' })}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[12px] bg-[#191a1f] px-4 text-[12px] font-semibold text-white hover:bg-black"
          >
            <Plus size={16} />
            Create group
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-800"
        >
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[22px] border border-[#e9e9eb] bg-white">
          <div className="border-b border-[#f0f0f1] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[13px] font-bold text-[#131418]">
                  All groups
                </h2>
                <p className="mt-1 text-[11px] text-[#92939b]">
                  {groups.length} total
                </p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eeeeef] text-[#53555e]">
                <FolderOpen size={17} />
              </span>
            </div>

            <div className="relative mt-4">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#92939b]"
              />
              <input
                value={groupSearch}
                onChange={(event) => setGroupSearch(event.target.value)}
                placeholder="Find a group..."
                className={`${inputClass} mt-0 pl-9`}
              />
            </div>
          </div>

          <div className="max-h-[620px] overflow-y-auto p-2">
            {loading ? (
              <p className="px-3 py-8 text-center text-[12px] text-[#888a93]">
                Loading groups…
              </p>
            ) : visibleGroups.length ? (
              visibleGroups.map((group) => {
                const selected = group.id === selectedGroupId

                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      setSelectedGroupId(group.id)
                      setMemberSearch('')
                      setError('')
                      setNotice('')
                    }}
                    className={`mb-1 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      selected
                        ? 'border-[#dce2ff] bg-[#f2f4ff]'
                        : 'border-transparent hover:bg-[#f8f8f9]'
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        selected
                          ? 'bg-[#e1e7ff] text-[#4058c9]'
                          : 'bg-[#eeeeef] text-[#777984]'
                      }`}
                    >
                      <Users size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-bold text-[#25262c]">
                        {group.name}
                      </span>
                      <span className="mt-1 block text-[10.5px] text-[#92939b]">
                        {group.group_status}
                      </span>
                    </span>
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        group.group_status === 'Active'
                          ? 'bg-emerald-500'
                          : 'bg-[#b9bbc2]'
                      }`}
                    />
                  </button>
                )
              })
            ) : (
              <div className="px-4 py-10 text-center">
                <FolderOpen size={25} className="mx-auto text-[#c2c3c9]" />
                <p className="mt-3 text-[12px] font-semibold text-[#53555e]">
                  No groups found
                </p>
                <p className="mt-1 text-[11px] text-[#92939b]">
                  Try another search or create a group.
                </p>
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-[22px] border border-[#e9e9eb] bg-white">
          {selectedGroup ? (
            <>
              <header className="flex flex-col gap-4 border-b border-[#f0f0f1] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                <div className="flex min-w-0 items-start gap-3.5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-[#eeeeef] text-[#53555e]">
                    <Users size={21} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-words text-[18px] font-extrabold tracking-[-0.4px] text-[#131418]">
                        {selectedGroup.name}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                          selectedGroup.group_status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-[#eeeeef] text-[#6b6d76]'
                        }`}
                      >
                        {selectedGroup.group_status}
                      </span>
                    </div>
                    <p className="mt-1 max-w-[600px] whitespace-pre-wrap text-[12px] leading-5 text-[#777984]">
                      {selectedGroup.description || 'No description added.'}
                    </p>
                    <p className="mt-2 text-[11px] text-[#92939b]">
                      {assignments.length}{' '}
                      {assignments.length === 1 ? 'member' : 'members'} assigned
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setGroupModal(selectedGroup)}
                  className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-2 self-start rounded-[10px] border border-[#e5e5e7] bg-white px-3.5 text-[11.5px] font-semibold text-[#53555e] hover:bg-[#f8f8f9]"
                >
                  <Pencil size={14} />
                  Edit group
                </button>
              </header>

              <div className="p-4 sm:p-6">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-[13px] font-bold text-[#131418]">
                      Assigned members
                    </h3>
                    <p className="mt-1 text-[11px] text-[#92939b]">
                      Removing someone here does not delete their member record.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={selectedGroup.group_status !== 'Active'}
                    onClick={() => setAssignmentModalOpen(true)}
                    className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[11px] bg-[#191a1f] px-4 text-[12px] font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <UserPlus size={15} />
                    Add members
                  </button>
                </div>

                {selectedGroup.group_status !== 'Active' && (
                  <p className="mb-4 rounded-lg bg-[#f4f4f5] px-3 py-2.5 text-[11px] text-[#6b6d76]">
                    This group is inactive. Reactivate it to add new members.
                  </p>
                )}

                <div className="relative mb-4">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#92939b]"
                  />
                  <input
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    placeholder="Search assigned members..."
                    className={`${inputClass} mt-0 pl-9`}
                  />
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#ececed]">
                  <table className="w-full min-w-[590px] border-collapse text-left">
                    <thead className="bg-[#f8f8f9]">
                      <tr className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#888a93]">
                        <th className="px-4 py-3">Member</th>
                        <th className="px-4 py-3">Person ID</th>
                        <th className="px-4 py-3">Joined group</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsLoading ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-10 text-center text-[12px] text-[#888a93]"
                          >
                            Loading assigned members…
                          </td>
                        </tr>
                      ) : visibleAssignments.length ? (
                        visibleAssignments.map((assignment) => {
                          const member = assignment.member

                          return (
                            <tr
                              key={assignment.id}
                              className="border-t border-[#f0f0f1] hover:bg-[#fcfcfd]"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eeeeef] text-[12px] font-bold text-[#53555e]">
                                    {(member.name || '?')
                                      .trim()
                                      .charAt(0)
                                      .toUpperCase()}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate text-[12px] font-semibold text-[#25262c]">
                                      {member.name}
                                    </span>
                                    <span className="mt-0.5 block text-[10.5px] text-[#92939b]">
                                      {member.status || 'Status unknown'}
                                    </span>
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono text-[11px] text-[#6b6d76]">
                                {member.person_id || '—'}
                              </td>
                              <td className="px-4 py-3 text-[11px] text-[#6b6d76]">
                                {formatDate(assignment.valid_from)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  title={`Remove ${member.name} from this group`}
                                  disabled={endingAssignmentId === assignment.id}
                                  onClick={() => handleEndAssignment(assignment)}
                                  className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-[#f0dada] px-2.5 text-[10.5px] font-semibold text-[#b64343] transition hover:bg-[#fff5f5] disabled:opacity-50"
                                >
                                  <UserMinus size={13} />
                                  {endingAssignmentId === assignment.id
                                    ? 'Removing…'
                                    : 'Remove'}
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-4 py-12 text-center">
                            <Users
                              size={26}
                              className="mx-auto text-[#c2c3c9]"
                            />
                            <p className="mt-3 text-[12px] font-semibold text-[#53555e]">
                              {assignments.length
                                ? 'No matching members'
                                : 'No members assigned yet'}
                            </p>
                            <p className="mt-1 text-[11px] text-[#92939b]">
                              {assignments.length
                                ? 'Try a different search.'
                                : 'Use Add members to assign existing people to this group.'}
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="px-6 py-16 text-center">
              <FolderOpen size={30} className="mx-auto text-[#c2c3c9]" />
              <h2 className="mt-3 text-[14px] font-bold text-[#25262c]">
                Select a group
              </h2>
              <p className="mt-1 text-[12px] text-[#888a93]">
                Choose a group from the list or create a new one.
              </p>
            </div>
          )}
        </section>
      </div>

      {groupModal && (
        <GroupModal
          group={groupModal.mode === 'create' ? null : groupModal}
          onClose={() => setGroupModal(null)}
          onSaved={async () => {
            const wasCreating = groupModal.mode === 'create'
            await loadBase()
            setNotice(wasCreating ? 'Group created successfully.' : 'Group updated successfully.')
          }}
        />
      )}

      {assignmentModalOpen && selectedGroup && (
        <AssignmentModal
          group={selectedGroup}
          members={members.filter((member) => member.status === 'Active')}
          assignedIds={assignedIds}
          onClose={() => setAssignmentModalOpen(false)}
          onAssigned={async () => {
            await loadAssignments(selectedGroup.id)
            setNotice('Member assigned successfully.')
          }}
        />
      )}
    </div>
  )
}
