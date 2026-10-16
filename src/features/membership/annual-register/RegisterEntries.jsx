
import { useMemo, useState } from 'react'
import {
  filterEntries,
  getIncludedEntries,
  getRemovedEntries,
  getEntryLabel,
} from './annualRegisterUtils'

export default function RegisterEntries({
  entries = [],
  loading = false,
  working = false,
  readOnly = false,
  onToggleIncluded,
  onDesignateHead,
  onSplitBranch,
}) {
  const [search, setSearch] = useState('')
  const [showRemoved, setShowRemoved] = useState(false)

  const filteredEntries = useMemo(
    () => filterEntries(entries, search, showRemoved),
    [entries, search, showRemoved],
  )

  const includedCount = getIncludedEntries(entries).length
  const removedCount = getRemovedEntries(entries).length

  return (
    <section className="rounded-2xl border border-[#e9e9eb] bg-white">
      <div className="border-b border-[#e9e9eb] p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-base font-semibold text-[#131418]">
              Register entries
            </h2>
            <p className="mt-1 text-sm text-[#777984]">
              Review memberships, branches, and assigned people.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Count label="Included" value={includedCount} />
            <Count label="Removed" value={removedCount} />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search membership number, name, or ID…"
            className="min-w-0 flex-1 rounded-xl border border-[#e5e5e7] bg-white px-4 py-3 text-sm text-[#131418] outline-none placeholder:text-[#a0a1a8] focus:border-[#7b88c9] focus:ring-2 focus:ring-[#7b88c9]/10"
          />

          <label className="flex shrink-0 items-center gap-2 rounded-xl border border-[#e9e9eb] px-3 py-2 text-sm text-[#53555e]">
            <input
              type="checkbox"
              checked={showRemoved}
              onChange={(event) => setShowRemoved(event.target.checked)}
              className="accent-[#25262c]"
            />
            Show removed
          </label>
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        {loading ? (
          <EmptyState>Loading register entries…</EmptyState>
        ) : filteredEntries.length === 0 ? (
          <EmptyState>
            {entries.length === 0
              ? 'This register has no entries yet. Create a membership snapshot to populate it.'
              : 'No entries match your search and filters.'}
          </EmptyState>
        ) : (
          filteredEntries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              entries={entries}
              readOnly={readOnly}
              working={working}
              onToggleIncluded={onToggleIncluded}
              onDesignateHead={onDesignateHead}
              onSplitBranch={onSplitBranch}
            />
          ))
        )}
      </div>
    </section>
  )
}

function EntryCard({
  entry,
  entries,
  readOnly,
  working,
  onToggleIncluded,
  onDesignateHead,
  onSplitBranch,
}) {
  const assignments = entry.assignments ?? []
  const headAssignment = assignments.find((assignment) => assignment.is_head)
  const included = entry.is_included
  const isBranch = Boolean(entry.branch_id) && entry.entry_type === 'Branch'

  const parentEntry = entries.find(
    (candidate) => candidate.id === entry.parent_entry_id,
  )

  return (
    <article
      className={`rounded-xl border p-4 ${
        !included
          ? 'border-[#eeeeef] bg-[#fafafa] opacity-70'
          : entry.head_is_valid
            ? 'border-[#e9e9eb] bg-white'
            : 'border-amber-200 bg-amber-50/50'
      }`}
    >
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 gap-3">
          <div
            className={`flex h-12 min-w-12 items-center justify-center rounded-xl border px-2 text-sm font-bold tabular-nums ${
              isBranch
                ? 'border-violet-200 bg-violet-50 text-violet-700'
                : 'border-[#e9e9eb] bg-[#f7f7f8] text-[#131418]'
            }`}
          >
            {entry.membership_number || '—'}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-sm font-semibold text-[#131418]">
                {entry.head_name || 'Head needs review'}
              </h3>

              <span className="rounded-full border border-[#e9e9eb] bg-[#f7f7f8] px-2 py-0.5 text-[11px] text-[#53555e]">
                {getEntryLabel(entry)}
              </span>

              {!included && (
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">
                  Removed
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-[#777984]">
              {entry.membership?.membership_id || 'Membership ID unavailable'}
              {entry.suffix ? ` · Branch ${entry.suffix}` : ''}
            </p>

            {isBranch && (
              <p className="mt-1 text-xs text-violet-700">
                Branch of membership{' '}
                {parentEntry?.membership_number ||
                  entry.membership_number?.replace(entry.suffix, '') ||
                  '—'}
              </p>
            )}

            {entry.entry_type === 'Independent Split' && (
              <p className="mt-1 text-xs text-sky-700">
                Marked as an independent split in this draft
              </p>
            )}

            {!entry.head_is_valid && included && (
              <p className="mt-2 text-xs text-amber-700">
                A register head has not been designated.
              </p>
            )}
          </div>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={working}
              onClick={() => onToggleIncluded(entry, !included)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${
                included
                  ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                  : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              {included ? 'Remove from register' : 'Restore entry'}
            </button>

            {isBranch && included && (
              <button
                type="button"
                disabled={working}
                onClick={() => onSplitBranch(entry)}
                className="rounded-lg border border-sky-200 px-3 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-50 disabled:opacity-50"
              >
                Split in draft
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-[#eeeeef] pt-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#92939b]">
              People in this entry ({assignments.length})
            </p>

            {assignments.length === 0 ? (
              <p className="text-sm text-[#92939b]">
                No people are assigned to this entry.
              </p>
            ) : (
              <ul className="space-y-2">
                {assignments.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="text-[#25262c]">
                        {assignment.member?.name || 'Unknown person'}
                      </span>

                      {assignment.member?.person_id && (
                        <span className="ml-2 text-xs text-[#92939b]">
                          {assignment.member.person_id}
                        </span>
                      )}

                      {assignment.relationship_to_head && (
                        <span className="ml-2 text-xs text-[#92939b]">
                          · {assignment.relationship_to_head}
                        </span>
                      )}
                    </div>

                    {assignment.is_head && (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                        Register head
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!readOnly && included && assignments.length > 0 && (
            <div className="w-full sm:max-w-xs">
              <label
                htmlFor={`head-${entry.id}`}
                className="mb-2 block text-xs font-medium text-[#777984]"
              >
                Designate register head
              </label>

              <select
                id={`head-${entry.id}`}
                value={headAssignment?.member_id ?? ''}
                disabled={working}
                onChange={(event) =>
                  onDesignateHead(entry, event.target.value)
                }
                className="w-full rounded-lg border border-[#e5e5e7] bg-white px-3 py-2 text-sm text-[#25262c] outline-none focus:border-[#7b88c9] focus:ring-2 focus:ring-[#7b88c9]/10 disabled:opacity-50"
              >
                <option value="">Select a head…</option>
                {assignments.map((assignment) => (
                  <option
                    key={assignment.member_id}
                    value={assignment.member_id}
                  >
                    {assignment.member?.name || 'Unknown person'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function Count({ label, value }) {
  return (
    <span className="rounded-lg border border-[#e9e9eb] bg-[#f7f7f8] px-3 py-2 text-xs text-[#53555e]">
      {label}: {value}
    </span>
  )
}

function EmptyState({ children }) {
  return (
    <div className="rounded-xl border border-dashed border-[#e9e9eb] p-8 text-center text-sm leading-6 text-[#777984]">
      {children}
    </div>
  )
}
