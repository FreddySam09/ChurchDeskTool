import { useMemo } from "react";
import { Check, Search, Users, X } from "lucide-react";

function getMembershipNumber(membership) {
  return membership?.membership_number == null
    ? "No number"
    : String(membership.membership_number);
}

export default function CarolMembershipPickerModal({
  open,
  onClose,
  memberships,
  visits,
  campaignAssignments,
  dayId,
  search,
  setSearch,
  areaFilter,
  setAreaFilter,
  streetFilter,
  setStreetFilter,
  statusFilter,
  setStatusFilter,
  selectedIds,
  setSelectedIds,
  assigning,
  onAssign,
  onClearFilters,
}) {
  const visitByMembershipId = useMemo(
    () => new Map(visits.map((visit) => [visit.membership_id, visit])),
    [visits],
  );

  const campaignAssignmentByMembershipId = useMemo(() => {
    const map = new Map();

    for (const assignment of campaignAssignments) {
      if (!map.has(assignment.membership_id)) {
        map.set(assignment.membership_id, assignment);
      }
    }

    return map;
  }, [campaignAssignments]);

  const areas = useMemo(
    () =>
      [
        ...new Set(
          memberships.map((item) => item.area?.trim()).filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [memberships],
  );

  const streets = useMemo(() => {
    const source = areaFilter
      ? memberships.filter((item) => item.area === areaFilter)
      : memberships;

    return [
      ...new Set(
        source.map((item) => item.street_name?.trim()).filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [memberships, areaFilter]);

  const filteredMemberships = useMemo(() => {
    const query = search.trim().toLowerCase();

    return memberships.filter((membership) => {
      if (areaFilter && membership.area !== areaFilter) return false;

      if (streetFilter && membership.street_name !== streetFilter) {
        return false;
      }

      const currentVisit = visitByMembershipId.get(membership.id);
      const assignment = campaignAssignmentByMembershipId.get(membership.id);
      const assignedHere = Boolean(currentVisit);
      const assignedElsewhere =
        Boolean(assignment) && assignment.carol_day_id !== dayId;

      if (statusFilter === "Available" && (assignedHere || assignedElsewhere)) {
        return false;
      }

      if (statusFilter === "Assigned here" && !assignedHere) return false;
      if (statusFilter === "Assigned elsewhere" && !assignedElsewhere) {
        return false;
      }

      if (!query) return true;

      return [
        membership.head_name,
        membership.membership_number,
        membership.membership_id,
        membership.door_number,
        membership.street_name,
        membership.area,
        membership.city,
        membership.pincode,
        membership.landmark,
        membership.primary_phone_number,
        membership.alternate_phone_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [
    memberships,
    search,
    areaFilter,
    streetFilter,
    statusFilter,
    visitByMembershipId,
    campaignAssignmentByMembershipId,
    dayId,
  ]);

  if (!open) return null;

  const eligibleIds = filteredMemberships
    .filter((membership) => {
      const assignedHere = visitByMembershipId.has(membership.id);
      const assignment = campaignAssignmentByMembershipId.get(membership.id);
      const assignedElsewhere = assignment && assignment.carol_day_id !== dayId;

      return !assignedHere && !assignedElsewhere;
    })
    .map((membership) => membership.id);

  const selectedEligibleCount = eligibleIds.filter((id) =>
    selectedIds.includes(id),
  ).length;

  const allEligibleSelected =
    eligibleIds.length > 0 && selectedEligibleCount === eligibleIds.length;

  function toggleMembership(id) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function toggleVisible() {
    if (allEligibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !eligibleIds.includes(id)),
      );
    } else {
      setSelectedIds((current) => [...new Set([...current, ...eligibleIds])]);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="carol-membership-picker-title"
        className="flex max-h-[92vh] w-full max-w-[1150px] flex-col overflow-hidden rounded-2xl border border-[#e8e8ec] bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#ededf0] px-5 py-4 sm:px-6">
          <div>
            <h2
              id="carol-membership-picker-title"
              className="text-lg font-bold text-[#1e1e1e]"
            >
              Find memberships
            </h2>
            <p className="mt-1 text-sm text-[#777985]">
              Search, filter, and select households to add to this Carol Day.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close membership picker"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#e8e8ec] text-[#777985] transition hover:bg-[#f5f5f6] hover:text-[#1e1e1e]"
          >
            <X size={17} />
          </button>
        </header>

        <div className="grid grid-cols-1 gap-3 border-b border-[#ededf0] bg-[#fcfcfd] p-4 sm:grid-cols-2 xl:grid-cols-4 sm:px-6">
          <label className="relative block sm:col-span-2 xl:col-span-1">
            <span className="sr-only">Search memberships</span>
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8b8d97]"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, number, street, pincode..."
              className="w-full rounded-lg border border-[#e1e1e6] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#777985]"
            />
          </label>

          <label>
            <span className="sr-only">Filter by area</span>
            <select
              value={areaFilter}
              onChange={(event) => {
                setAreaFilter(event.target.value);
                setStreetFilter("");
              }}
              className="w-full rounded-lg border border-[#e1e1e6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#777985]"
            >
              <option value="">All areas</option>
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="sr-only">Filter by street</span>
            <select
              value={streetFilter}
              onChange={(event) => setStreetFilter(event.target.value)}
              className="w-full rounded-lg border border-[#e1e1e6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#777985]"
            >
              <option value="">All streets</option>
              {streets.map((street) => (
                <option key={street} value={street}>
                  {street}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="sr-only">Filter assignment status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-lg border border-[#e1e1e6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#777985]"
            >
              <option value="Available">Available to assign</option>
              <option value="Assigned here">Already assigned here</option>
              <option value="Assigned elsewhere">
                Assigned to another day
              </option>
              <option value="All">All memberships</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ededf0] px-4 py-3 sm:px-6">
          <p className="text-xs text-[#777985]">
            {filteredMemberships.length} result
            {filteredMemberships.length === 1 ? "" : "s"} · {selectedIds.length}{" "}
            selected
          </p>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={toggleVisible}
              disabled={eligibleIds.length === 0}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#34353d] hover:text-black disabled:opacity-40"
            >
              <Check size={14} />
              {allEligibleSelected ? "Deselect available" : "Select available"}
            </button>

            <button
              type="button"
              onClick={onClearFilters}
              className="text-xs font-medium text-[#777985] underline underline-offset-4 hover:text-[#1e1e1e]"
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[650px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-[#f7f7f9]">
              <tr className="border-b border-[#e9e9ed] text-[11px] font-semibold uppercase tracking-wide text-[#777985]">
                <th className="w-16 px-4 py-3 text-center">S.No.</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Street Name</th>
                <th className="px-4 py-3">Area</th>
                <th className="w-24 px-4 py-3 text-center">Select</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#f0f0f2]">
              {filteredMemberships.map((membership, index) => {
                const visit = visitByMembershipId.get(membership.id);
                const assignment = campaignAssignmentByMembershipId.get(
                  membership.id,
                );
                const assignedElsewhere =
                  assignment && assignment.carol_day_id !== dayId;
                const disabled = Boolean(visit || assignedElsewhere);
                const checked = selectedIds.includes(membership.id);

                return (
                  <tr
                    key={membership.id}
                    className={`transition ${
                      checked ? "bg-[#f6f6f7]" : "hover:bg-[#fbfbfc]"
                    }`}
                  >
                    <td className="px-4 py-3 text-center text-xs text-[#898b95]">
                      {index + 1}
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm text-[#1e1e1e]">
                        {membership.head_name || "Name not recorded"}
                      </div>
                      <div className="mt-0.5 text-xs text-[#898b95]">
                        #{getMembershipNumber(membership)}
                      </div>
                      {visit && (
                        <span className="mt-1 inline-flex rounded-full bg-[#f0f0f2] px-2 py-0.5 text-[10px] font-medium text-[#626575]">
                          Already assigned here
                        </span>
                      )}
                      {assignedElsewhere && (
                        <span className="mt-1 inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700">
                          Assigned to another day
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm text-[#626575]">
                      {membership.street_name || "—"}
                    </td>

                    <td className="px-4 py-3 text-sm text-[#626575]">
                      {membership.area || "—"}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Select ${membership.head_name || "membership"}`}
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleMembership(membership.id)}
                        className="size-4 accent-[#1e1e1e] disabled:cursor-not-allowed disabled:opacity-30"
                      />
                    </td>
                  </tr>
                );
              })}

              {filteredMemberships.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center">
                    <Users size={26} className="mx-auto text-[#b6b7be]" />
                    <p className="mt-3 text-sm font-semibold text-[#454650]">
                      No memberships found
                    </p>
                    <p className="mt-1 text-xs text-[#898b95]">
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-col gap-3 border-t border-[#ededf0] bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-[#777985]">
            {selectedIds.length} membership
            {selectedIds.length === 1 ? "" : "s"} selected
          </p>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#e1e1e6] px-4 py-2.5 text-sm font-semibold text-[#454650] hover:bg-[#f7f7f8]"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onAssign}
              disabled={assigning || selectedIds.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1e1e1e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Users size={15} />
              {assigning ? "Assigning..." : "Assign selected"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
