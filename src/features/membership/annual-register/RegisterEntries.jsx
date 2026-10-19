import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  RotateCcw,
  Search,
  Split,
  X,
} from "lucide-react";
import {
  getIncludedEntries,
  getRemovedEntries,
  getEntryLabel,
} from "./annualRegisterUtils";
import { RefreshCw } from "lucide-react";
import { getEntryReviewIssues } from "./annualRegisterUtils";

function isBranchEntry(entry) {
  return Boolean(entry.branch_id) && entry.entry_type === "Branch";
}

function isSplitEntry(entry) {
  return entry.entry_type === "Independent Split";
}

function makeGroups(entries) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const groups = [];
  const groupByRoot = new Map();
  const assigned = new Set();

  for (const entry of entries) {
    if (assigned.has(entry.id)) continue;

    if (
      entry.parent_entry_id &&
      byId.has(entry.parent_entry_id) &&
      isBranchEntry(entry)
    ) {
      const parent = byId.get(entry.parent_entry_id);
      let group = groupByRoot.get(parent.id);

      if (!group) {
        group = { key: parent.id, entries: [parent] };
        groupByRoot.set(parent.id, group);
        groups.push(group);
        assigned.add(parent.id);
      }

      if (!group.entries.some((item) => item.id === entry.id)) {
        group.entries.push(entry);
      }

      assigned.add(entry.id);
      continue;
    }

    if (
      isBranchEntry(entry) &&
      entry.parent_entry_id &&
      assigned.has(entry.parent_entry_id)
    ) {
      const group = groupByRoot.get(entry.parent_entry_id);

      if (group && !group.entries.some((item) => item.id === entry.id)) {
        group.entries.push(entry);
      }

      assigned.add(entry.id);
      continue;
    }

    const group = { key: entry.id, entries: [entry] };
    groupByRoot.set(entry.id, group);
    groups.push(group);
    assigned.add(entry.id);
  }

  for (const group of groups) {
    group.entries.sort((a, b) => {
      if (a.id === group.key) return -1;
      if (b.id === group.key) return 1;

      return String(a.suffix || "").localeCompare(
        String(b.suffix || ""),
        undefined,
        { numeric: true },
      );
    });
  }

  return groups;
}

function flattenGroups(groups) {
  return groups.flatMap((group) => group.entries);
}

export default function RegisterEntries({
  entries = [],
  loading = false,
  working = false,
  readOnly = false,
  onResync,
  onToggleIncluded,
  onDesignateHead,
  onSplitBranch,
  onUndoSplit,
  onReorder,
  onNumberChange,
}) {
  const [search, setSearch] = useState("");
  const [showRemoved, setShowRemoved] = useState(true);
  const [draggedKey, setDraggedKey] = useState(null);
  const [numberEdits, setNumberEdits] = useState({});

  const includedCount = getIncludedEntries(entries).length;
  const removedCount = getRemovedEntries(entries).length;

  useEffect(() => {
    setNumberEdits(
      Object.fromEntries(
        entries.map((entry) => [entry.id, entry.membership_number ?? ""]),
      ),
    );
  }, [entries]);

  const groups = useMemo(() => makeGroups(entries), [entries]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();

    return groups
      .map((group) => ({
        ...group,
        entries: group.entries.filter((entry) => {
          if (!showRemoved && !entry.is_included) return false;
          if (!query) return true;

          const haystack = [
            entry.membership_number,
            entry.membership?.membership_id,
            entry.head_name,
            entry.source_head_name,
            entry.membership?.head?.person_id,
            entry.suffix,
            ...(entry.assignments ?? []).map(
              (assignment) => assignment.member?.name,
            ),
            ...(entry.assignments ?? []).map(
              (assignment) => assignment.member?.person_id,
            ),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(query);
        }),
      }))
      .filter((group) => group.entries.length > 0);
  }, [groups, search, showRemoved]);

  function moveGroup(groupKey, direction) {
    const currentIndex = groups.findIndex((group) => group.key === groupKey);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= groups.length) {
      return;
    }

    const next = [...groups];
    const [moved] = next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, moved);

    onReorder?.(flattenGroups(next));
  }

  function dropOnGroup(targetKey) {
    if (!draggedKey || draggedKey === targetKey) return;

    const next = [...groups];
    const from = next.findIndex((group) => group.key === draggedKey);
    const to = next.findIndex((group) => group.key === targetKey);

    if (from < 0 || to < 0) return;

    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    setDraggedKey(null);
    onReorder?.(flattenGroups(next));
  }

  async function saveNumber(entry) {
    const value = String(numberEdits[entry.id] ?? "").trim();

    if (!value || value === String(entry.membership_number ?? "")) {
      return;
    }

    await onNumberChange?.(entry, value);
  }

  const entriesWithCurrentNumbers = useMemo(
    () =>
      entries.map((entry) => ({
        ...entry,
        membership_number:
          numberEdits[entry.id] ?? entry.membership_number ?? "",
      })),
    [entries, numberEdits],
  );

  const reviewIssuesByEntryId = useMemo(
    () => getEntryReviewIssues(entriesWithCurrentNumbers),
    [entriesWithCurrentNumbers],
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_1px_2px_rgba(15,15,20,0.04)]">
      <div className="border-b border-[#e5e7eb] px-4 py-4 sm:px-5">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-base font-semibold text-[#17181d]">
              Register editor
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#777984]">
              Edit proposed numbers and arrange membership groups. Branches move
              with their parent.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {!readOnly && (
              <button
                type="button"
                onClick={onResync}
                disabled={working}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e5e7] bg-white px-3 py-1.5 text-xs font-medium text-[#53555e] transition hover:bg-[#f7f7f8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={13} />
                {working ? "Resyncing…" : "Resync"}
              </button>
            )}
            <span className="rounded-full border border-[#dcece2] bg-[#eff8f2] px-3 py-1.5 font-medium text-[#28734b]">
              Included {includedCount}
            </span>
            <span className="rounded-full border border-[#f2dede] bg-[#fff4f3] px-3 py-1.5 font-medium text-[#b0443e]">
              Removed {removedCount}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#92939b]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search number, membership ID, head, or person…"
              className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#6b7fe8] focus:ring-2 focus:ring-[#6b7fe8]/10"
            />
          </label>

          <label className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-[#e5e7eb] px-3 text-xs font-medium text-[#555761]">
            <input
              type="checkbox"
              checked={showRemoved}
              onChange={(event) => setShowRemoved(event.target.checked)}
              className="accent-[#25262c]"
            />
            Show removed entries
          </label>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-[#777984]">
          Loading register entries…
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-sm font-medium text-[#383a42]">
            {entries.length
              ? "No entries match your search."
              : "This draft has no entries yet."}
          </p>
          <p className="mt-1 text-xs text-[#92939b]">
            Create a draft with a current-membership snapshot to populate the
            register.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#e9e9eb] bg-[#f8f8f9] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#858792]">
                <th className="w-24 px-3 py-3">Order</th>
                <th className="w-32 px-3 py-3">Proposed no.</th>
                <th className="px-3 py-3">Membership / household</th>
                <th className="w-40 px-3 py-3">Register action</th>
                <th className="w-56 px-3 py-3 text-right">Edit</th>
              </tr>
            </thead>

            <tbody>
              {filteredGroups.map((group) => {
                const root =
                  group.entries.find((entry) => !isBranchEntry(entry)) ??
                  group.entries[0];

                const groupIndex = groups.findIndex(
                  (item) => item.key === group.key,
                );

                return group.entries.map((entry, entryIndex) => {
                  const isBranch = isBranchEntry(entry);
                  const split = isSplitEntry(entry);
                  const isRemoved = !entry.is_included;
                  const head = entry.head_name || "Head needs review";

                  return (
                    <tr
                      key={entry.id}
                      draggable={!readOnly && !working && entryIndex === 0}
                      onDragStart={() => setDraggedKey(group.key)}
                      onDragEnd={() => setDraggedKey(null)}
                      onDragOver={(event) => {
                        if (draggedKey && draggedKey !== group.key) {
                          event.preventDefault();
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        dropOnGroup(group.key);
                      }}
                      className={`border-b border-[#f0f0f2] last:border-b-0 transition ${
                        isRemoved
                          ? "bg-[#fafafa] text-[#92939b]"
                          : draggedKey === group.key
                            ? "bg-[#f4f6ff]"
                            : "bg-white hover:bg-[#fcfcfd]"
                      } ${isBranch ? "bg-[#fbfaff]" : ""}`}
                    >
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="cursor-grab text-[#a1a2aa]"
                            title="Drag to reorder"
                          >
                            <GripVertical size={16} />
                          </span>

                          {!readOnly && (
                            <div className="flex flex-col">
                              <button
                                type="button"
                                aria-label="Move group up"
                                disabled={working || groupIndex <= 0}
                                onClick={() => moveGroup(group.key, -1)}
                                className="rounded p-0.5 text-[#777984] hover:bg-[#ededf0] disabled:opacity-25"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                type="button"
                                aria-label="Move group down"
                                disabled={
                                  working ||
                                  groupIndex < 0 ||
                                  groupIndex >= groups.length - 1
                                }
                                onClick={() => moveGroup(group.key, 1)}
                                className="rounded p-0.5 text-[#777984] hover:bg-[#ededf0] disabled:opacity-25"
                              >
                                <ChevronDown size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3 align-top">
                        {readOnly ? (
                          <span
                            className={`inline-flex min-w-[54px] justify-center rounded-md border px-2 py-1.5 text-xs font-bold tabular-nums ${
                              isBranch
                                ? "border-violet-200 bg-violet-50 text-violet-700"
                                : "border-[#e5e7eb] bg-[#f8f8f9] text-[#25262c]"
                            }`}
                          >
                            {entry.membership_number || "—"}
                          </span>
                        ) : (
                          <input
                            aria-label={`Proposed number for ${head}`}
                            value={numberEdits[entry.id] ?? ""}
                            onChange={(event) =>
                              setNumberEdits((current) => ({
                                ...current,
                                [entry.id]: event.target.value,
                              }))
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.currentTarget.blur();
                              }
                            }}
                            onBlur={() => saveNumber(entry)}
                            disabled={working || isRemoved}
                            className={`w-[82px] rounded-md border px-2 py-1.5 text-xs font-semibold tabular-nums outline-none focus:border-[#6b7fe8] focus:ring-2 focus:ring-[#6b7fe8]/10 disabled:bg-[#f5f5f6] ${
                              isBranch
                                ? "border-violet-200 bg-violet-50 text-violet-700"
                                : "border-[#e5e7eb] bg-white text-[#25262c]"
                            }`}
                          />
                        )}

                        {!isRemoved &&
                          (reviewIssuesByEntryId.get(entry.id) ?? []).length >
                            0 && (
                            <div className="mt-1 space-y-1" role="alert">
                              {reviewIssuesByEntryId
                                .get(entry.id)
                                .map((issue) => (
                                  <p
                                    key={issue}
                                    className="max-w-[150px] text-xs font-medium text-red-600"
                                  >
                                    {issue}
                                  </p>
                                ))}
                            </div>
                          )}
                      </td>

                      <td className="px-3 py-3 align-top">
                        <div
                          className={`flex items-start gap-2 ${isBranch ? "pl-5" : ""}`}
                        >
                          {isBranch && (
                            <span className="mt-0.5 text-violet-500">↳</span>
                          )}

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-sm font-semibold ${
                                  isRemoved
                                    ? "text-[#777984] line-through"
                                    : "text-[#25262c]"
                                }`}
                              >
                                {head}
                              </span>

                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                  isBranch
                                    ? "border-violet-200 bg-violet-50 text-violet-700"
                                    : split
                                      ? "border-sky-200 bg-sky-50 text-sky-700"
                                      : "border-[#e5e7eb] bg-[#f8f8f9] text-[#777984]"
                                }`}
                              >
                                {getEntryLabel(entry)}
                              </span>

                              {isRemoved && (
                                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                  Removed
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-[11px] text-[#858792]">
                              {entry.membership?.membership_id ||
                                "Membership ID unavailable"}
                              {entry.suffix ? ` · Branch ${entry.suffix}` : ""}
                            </p>

                            {isBranch && (
                              <p className="mt-1 text-[11px] text-violet-700">
                                Branch of{" "}
                                {root?.membership_number ||
                                  entry.membership_number?.replace(
                                    entry.suffix,
                                    "",
                                  ) ||
                                  "parent membership"}
                              </p>
                            )}

                            {split && (
                              <p className="mt-1 text-[11px] text-sky-700">
                                Proposed as an independent membership after
                                approval
                              </p>
                            )}

                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(entry.assignments ?? []).map((assignment) => (
                                <span
                                  key={assignment.id}
                                  title={assignment.relationship_to_head || ""}
                                  className={`rounded-md border px-2 py-1 text-[10px] ${
                                    assignment.is_head
                                      ? "border-[#dcece2] bg-[#eff8f2] font-semibold text-[#28734b]"
                                      : "border-[#ececef] bg-white text-[#777984]"
                                  }`}
                                >
                                  {assignment.member?.name || "Unknown person"}
                                  {assignment.is_head ? " · Head" : ""}
                                </span>
                              ))}
                            </div>

                            {!entry.head_is_valid && entry.is_included && (
                              <p className="mt-2 text-[11px] text-amber-700">
                                Head designation needs review.
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3 align-top">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                            isRemoved
                              ? "bg-rose-50 text-rose-700"
                              : split
                                ? "bg-sky-50 text-sky-700"
                                : "bg-[#f1f1f3] text-[#555761]"
                          }`}
                        >
                          {isRemoved ? "Removed" : split ? "Split" : "Continue"}
                        </span>

                        {entry.removal_reason && isRemoved && (
                          <p className="mt-1 max-w-[130px] text-[10px] leading-4 text-[#92939b]">
                            {entry.removal_reason}
                          </p>
                        )}
                      </td>

                      <td className="px-3 py-3 align-top">
                        {!readOnly ? (
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={working}
                              onClick={() =>
                                onToggleIncluded?.(entry, !entry.is_included)
                              }
                              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] font-medium disabled:opacity-40 ${
                                isRemoved
                                  ? "border-[#dcece2] text-[#28734b] hover:bg-[#eff8f2]"
                                  : "border-[#f0d5d2] text-[#b0443e] hover:bg-[#fff4f3]"
                              }`}
                            >
                              {isRemoved ? (
                                <>
                                  <RotateCcw size={12} /> Restore
                                </>
                              ) : (
                                <>
                                  <X size={12} /> Remove
                                </>
                              )}
                            </button>

                            {isBranch && !isRemoved && (
                              <button
                                type="button"
                                disabled={working}
                                onClick={() => onSplitBranch?.(entry)}
                                className="inline-flex items-center gap-1 rounded-md border border-sky-200 px-2.5 py-1.5 text-[11px] font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-40"
                              >
                                <Split size={12} /> Split
                              </button>
                            )}

                            {split && (
                              <button
                                type="button"
                                disabled={working}
                                onClick={() => onUndoSplit?.(entry)}
                                className="inline-flex items-center gap-1 rounded-md border border-[#e5e7eb] px-2.5 py-1.5 text-[11px] font-medium text-[#555761] hover:bg-[#f8f8f9] disabled:opacity-40"
                              >
                                <RotateCcw size={12} /> Undo split
                              </button>
                            )}

                            {entry.assignments?.length > 0 && (
                              <HeadSelector
                                entry={entry}
                                working={working}
                                onDesignateHead={onDesignateHead}
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-[#92939b]">
                            Read-only
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-[#e9e9eb] bg-[#fafafa] px-4 py-3 text-[11px] text-[#858792] sm:flex-row sm:items-center sm:justify-between">
        <span>
          Drag a group's handle or use the arrows to reorder. Branches stay with
          their parent.
        </span>
        {working && (
          <span className="font-medium text-[#555761]">Saving changes…</span>
        )}
      </div>
    </section>
  );
}

function HeadSelector({ entry, working, onDesignateHead }) {
  const [open, setOpen] = useState(false);
  const currentHead = entry.assignments?.find(
    (assignment) => assignment.is_head,
  );

  return (
    <div className="relative">
      <button
        type="button"
        disabled={working}
        onClick={() => setOpen((value) => !value)}
        className="rounded-md border border-[#e5e7eb] px-2.5 py-1.5 text-[11px] font-medium text-[#555761] hover:bg-[#f8f8f9] disabled:opacity-40"
      >
        Head: {currentHead?.member?.name?.split(" ")[0] || "Set"}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 max-h-56 w-56 overflow-y-auto rounded-lg border border-[#e5e7eb] bg-white p-1 shadow-xl">
          {entry.assignments.map((assignment) => (
            <button
              key={assignment.id}
              type="button"
              onClick={async () => {
                await onDesignateHead?.(entry, assignment.member_id);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs hover:bg-[#f5f6f8]"
            >
              <span className="truncate">
                {assignment.member?.name || "Unknown person"}
              </span>
              {assignment.is_head ? (
                <Check size={13} className="shrink-0 text-[#28734b]" />
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
