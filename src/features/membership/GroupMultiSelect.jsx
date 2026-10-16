
import { useEffect, useState } from 'react'
import { Check, Users } from 'lucide-react'
import { getChurchGroups } from '../../services/membershipService'

export default function GroupMultiSelect({
  selectedIds = [],
  onChange,
  disabled = false,
}) {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadGroups() {
      setLoading(true)
      setError('')

      try {
        const result = await getChurchGroups({ activeOnly: false })

        if (!cancelled) {
          setGroups(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load fellowships and groups.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadGroups()

    return () => {
      cancelled = true
    }
  }, [])

  function toggleGroup(groupId) {
    if (disabled) return

    const selected = selectedIds.includes(groupId)

    if (!selected) {
      const group = groups.find((item) => item.id === groupId)
      if (group?.group_status !== 'Active') return
    }

    onChange(
      selected
        ? selectedIds.filter((id) => id !== groupId)
        : [...selectedIds, groupId],
    )
  }

  return (
    <section className="rounded-xl border border-[#ececed] bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e9edfd] text-[#3457d5]">
          <Users size={16} />
        </span>

        <div>
          <h3 className="text-[13px] font-bold text-[#131418]">
            Fellowships & Groups
          </h3>
          <p className="mt-1 text-[11.5px] text-[#777984]">
            Select every group this member currently belongs to.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-[12px] text-[#777984]">Loading groups...</p>
      ) : error ? (
        <p role="alert" className="text-[12px] text-red-600">
          {error}
        </p>
      ) : groups.length === 0 ? (
        <p className="text-[12px] text-[#777984]">
          No groups have been created yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {groups.map((group) => {
            const selected = selectedIds.includes(group.id)
            const inactive = group.group_status !== 'Active'
            const unavailable = inactive && !selected

            return (
              <button
                key={group.id}
                type="button"
                disabled={disabled || unavailable}
                aria-pressed={selected}
                onClick={() => toggleGroup(group.id)}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected
                    ? 'border-[#6681ff] bg-[#f1f3ff]'
                    : 'border-[#e9e9eb] bg-white hover:bg-[#f8f8f9]'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    selected
                      ? 'border-[#3457d5] bg-[#3457d5] text-white'
                      : 'border-[#d4d4d8] bg-white text-transparent'
                  }`}
                >
                  <Check size={13} />
                </span>

                <span className="min-w-0">
                  <span className="block text-[12px] font-semibold text-[#25262c]">
                    {group.name}
                  </span>

                  {group.description && (
                    <span className="mt-0.5 block text-[11px] text-[#777984]">
                      {group.description}
                    </span>
                  )}

                  {inactive && (
                    <span className="mt-1 block text-[10px] font-medium text-amber-700">
                      Inactive{selected ? ' · can be removed' : ''}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <p className="mt-3 text-[11px] text-[#777984]">
        {selectedIds.length} group{selectedIds.length === 1 ? '' : 's'} selected
      </p>
    </section>
  )
}
