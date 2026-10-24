import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Clock3,
  MapPin,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import CarolOfferingPanel from "./CarolOfferingPanel";

import {
  assignMembershipsToCarolDay,
  getAssignableCarolMemberships,
  getCarolCampaignAssignments,
  getCarolDay,
  getCarolDayVisits,
  removeCarolVisit,
  updateCarolVisitStatus,
} from "../../services/events/carolVisitService";

const VISIT_STATUS_OPTIONS = [
  { value: "Pending", label: "Pending" },
  { value: "Visited", label: "Visited" },
  { value: "Missed", label: "Missed" },
];

function formatDate(value) {
  if (!value) return "Date not set";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatAddress(membership) {
  if (!membership) return "Address not recorded";

  return (
    [
      membership.door_number,
      membership.street_name,
      membership.area,
      membership.landmark ? `Near ${membership.landmark}` : null,
      membership.city,
      membership.pincode,
    ]
      .filter((part) => String(part ?? "").trim())
      .join(", ") || "Address not recorded"
  );
}

function getMembershipNumber(membership) {
  return membership?.membership_number == null
    ? "No number"
    : String(membership.membership_number);
}

function statusClasses(status) {
  if (status === "Visited") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Missed") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-[#e9e9ed] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#777985]">{label}</p>
        <Icon size={18} className="text-[#777985]" />
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-[#1e1e1e]">
        {value}
      </p>
    </div>
  );
}

export default function CarolDayVisitsPage() {
  const { dayId } = useParams();
  const navigate = useNavigate();

  const [day, setDay] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [visits, setVisits] = useState([]);
  const [campaignAssignments, setCampaignAssignments] = useState([]);

  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [streetFilter, setStreetFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("Available");

  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [busyVisitId, setBusyVisitId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const loadedDay = await getCarolDay(dayId);
      const year = Number(String(loadedDay.visit_date).slice(0, 4));

      const [loadedMemberships, loadedVisits, loadedAssignments] =
        await Promise.all([
          getAssignableCarolMemberships(),
          getCarolDayVisits(dayId),
          getCarolCampaignAssignments(year),
        ]);

      setDay(loadedDay);
      setMemberships(loadedMemberships);
      setVisits(loadedVisits);
      setCampaignAssignments(loadedAssignments);
      setSelectedIds([]);
    } catch (err) {
      setError(err.message || "Unable to load Carol Day visits.");
    } finally {
      setLoading(false);
    }
  }, [dayId]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

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

      const currentDayVisit = visitByMembershipId.get(membership.id);
      const campaignAssignment = campaignAssignmentByMembershipId.get(
        membership.id,
      );

      const isAssignedHere = Boolean(currentDayVisit);
      const isAssignedElsewhere =
        Boolean(campaignAssignment) &&
        campaignAssignment.carol_day_id !== dayId;

      if (
        statusFilter === "Available" &&
        (isAssignedHere || isAssignedElsewhere)
      ) {
        return false;
      }

      if (statusFilter === "Assigned here" && !isAssignedHere) {
        return false;
      }

      if (statusFilter === "Assigned elsewhere" && !isAssignedElsewhere) {
        return false;
      }

      if (!query) return true;

      const searchable = [
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
        .toLowerCase();

      return searchable.includes(query);
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

  const selectedVisibleCount = filteredMemberships.filter((item) =>
    selectedIds.includes(item.id),
  ).length;

  const assignedCount = visits.length;
  const visitedCount = visits.filter(
    (visit) => visit.status === "Visited",
  ).length;
  const missedCount = visits.filter(
    (visit) => visit.status === "Missed",
  ).length;
  const pendingCount = visits.filter(
    (visit) => visit.status === "Pending",
  ).length;

  function toggleMembership(membershipId) {
    setSelectedIds((current) =>
      current.includes(membershipId)
        ? current.filter((id) => id !== membershipId)
        : [...current, membershipId],
    );
  }

  function toggleVisibleMemberships() {
    const eligibleIds = filteredMemberships
      .filter((membership) => {
        const assignedHere = visitByMembershipId.has(membership.id);
        const assignment = campaignAssignmentByMembershipId.get(membership.id);
        const assignedElsewhere =
          assignment && assignment.carol_day_id !== dayId;

        return !assignedHere && !assignedElsewhere;
      })
      .map((membership) => membership.id);

    if (!eligibleIds.length) return;

    const allSelected = eligibleIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !eligibleIds.includes(id)),
      );
    } else {
      setSelectedIds((current) => [...new Set([...current, ...eligibleIds])]);
    }
  }

  async function handleAssign() {
    if (!day || selectedIds.length === 0) return;

    setAssigning(true);
    setError("");
    setNotice("");

    try {
      const inserted = await assignMembershipsToCarolDay({
        day,
        membershipIds: selectedIds,
      });

      setNotice(
        `${inserted.length} membership${inserted.length === 1 ? "" : "s"} assigned to this Carol Day.`,
      );
      setSelectedIds([]);
      await loadPage();
    } catch (err) {
      setError(err.message || "Unable to assign memberships.");
    } finally {
      setAssigning(false);
    }
  }

  async function handleStatusChange(visit, nextStatus) {
    if (visit.status === nextStatus) return;

    setBusyVisitId(visit.id);
    setError("");
    setNotice("");

    try {
      await updateCarolVisitStatus(visit.id, nextStatus);
      setNotice(`Visit status updated to ${nextStatus}.`);
      await loadPage();
    } catch (err) {
      setError(err.message || "Unable to update visit status.");
    } finally {
      setBusyVisitId("");
    }
  }

  async function handleRemoveVisit(visit) {
    const name = visit.membership?.head_name || "this membership";

    if (
      !window.confirm(
        `Remove ${name} from this Carol Day's visit list? The membership record itself will not be deleted.`,
      )
    ) {
      return;
    }

    setBusyVisitId(visit.id);
    setError("");
    setNotice("");

    try {
      await removeCarolVisit(visit.id);
      setNotice("Membership removed from this Carol Day.");
      await loadPage();
    } catch (err) {
      setError(err.message || "Unable to remove this visit.");
    } finally {
      setBusyVisitId("");
    }
  }

  function clearFilters() {
    setSearch("");
    setAreaFilter("");
    setStreetFilter("");
    setStatusFilter("Available");
    setSelectedIds([]);
  }

  if (loading && !day) {
    return (
      <div className="mx-auto w-full max-w-[1500px] p-6">
        <div className="animate-pulse rounded-2xl border border-[#e9e9ed] bg-white p-8">
          <div className="h-5 w-48 rounded bg-gray-200" />
          <div className="mt-4 h-4 w-72 rounded bg-gray-100" />
          <div className="mt-8 h-32 rounded-xl bg-gray-100" />
        </div>
      </div>
    );
  }

  if (!day && error) {
    return (
      <div className="mx-auto w-full max-w-[1500px] p-6">
        <button
          type="button"
          onClick={() => navigate("/events/christmas-carols")}
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#454650] hover:text-black"
        >
          <ArrowLeft size={16} />
          Back to Christmas Carols
        </button>

        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
          <button
            type="button"
            onClick={loadPage}
            className="ml-2 font-semibold underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate("/events/christmas-carols")}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#626575] transition hover:text-[#1e1e1e]"
          >
            <ArrowLeft size={16} />
            Back to Christmas Carols
          </button>

          <h1 className="text-[28px] font-extrabold tracking-[-0.8px] text-[#131418] sm:text-[34px]">
            Manage Carol Visits
          </h1>

          <p className="mt-2 text-sm text-[#777985]">
            {day?.name} · {formatDate(day?.visit_date)}
            {day?.start_time ? ` · ${String(day.start_time).slice(0, 5)}` : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={loadPage}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[#e4e4e8] bg-white px-4 py-2.5 text-sm font-semibold text-[#34353d] transition hover:bg-[#f8f8f9] disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Assigned families"
          value={assignedCount}
          icon={Users}
        />
        <StatCard label="Pending visits" value={pendingCount} icon={Clock3} />
        <StatCard label="Visited" value={visitedCount} icon={CheckCheck} />
        <StatCard label="Missed" value={missedCount} icon={MapPin} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#e8e8ec] bg-white">
        <div className="border-b border-[#ededf0] p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#1e1e1e]">
                Find memberships
              </h2>
              <p className="mt-1 text-sm text-[#777985]">
                Search by household, membership number, or address. Select
                multiple families to assign them together.
              </p>
            </div>
            <span className="text-sm text-[#777985]">
              {filteredMemberships.length} result
              {filteredMemberships.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="relative block">
              <span className="sr-only">Search memberships</span>
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8b8d97]"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, number, street, pincode..."
                className="w-full rounded-xl border border-[#e1e1e6] bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-[#777985] focus:ring-2 focus:ring-[#eeeeF1]"
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
                className="w-full rounded-xl border border-[#e1e1e6] bg-white px-3 py-3 text-sm outline-none focus:border-[#777985]"
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
                className="w-full rounded-xl border border-[#e1e1e6] bg-white px-3 py-3 text-sm outline-none focus:border-[#777985]"
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
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setSelectedIds([]);
                }}
                className="w-full rounded-xl border border-[#e1e1e6] bg-white px-3 py-3 text-sm outline-none focus:border-[#777985]"
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={toggleVisibleMemberships}
              disabled={filteredMemberships.length === 0}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#34353d] hover:text-black disabled:opacity-40"
            >
              <Check size={16} />
              {selectedVisibleCount === filteredMemberships.length &&
              filteredMemberships.length > 0
                ? "Deselect visible results"
                : "Select all visible results"}
            </button>

            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-[#777985] underline underline-offset-4 hover:text-[#1e1e1e]"
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="max-h-[620px] overflow-y-auto">
          {filteredMemberships.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Users size={28} className="mx-auto text-[#b6b7be]" />
              <p className="mt-3 text-sm font-semibold text-[#454650]">
                No memberships match these filters
              </p>
              <p className="mt-1 text-sm text-[#898b95]">
                Try another area, street, or search term.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#f0f0f2]">
              {filteredMemberships.map((membership) => {
                const isSelected = selectedIds.includes(membership.id);
                const visit = visitByMembershipId.get(membership.id);
                const campaignAssignment = campaignAssignmentByMembershipId.get(
                  membership.id,
                );
                const assignedElsewhere =
                  campaignAssignment &&
                  campaignAssignment.carol_day_id !== dayId;

                return (
                  <label
                    key={membership.id}
                    className={`flex cursor-pointer items-start gap-3 px-4 py-4 transition sm:px-6 ${
                      isSelected ? "bg-[#f7f7f8]" : "hover:bg-[#fbfbfc]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={Boolean(visit || assignedElsewhere)}
                      onChange={() => toggleMembership(membership.id)}
                      className="mt-1 h-4 w-4 shrink-0 accent-[#1e1e1e] disabled:cursor-not-allowed"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#1e1e1e]">
                          {membership.head_name}
                        </p>
                        <span className="rounded-md bg-[#f0f0f2] px-2 py-0.5 text-xs font-semibold text-[#555762]">
                          #{getMembershipNumber(membership)}
                        </span>

                        {visit && (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClasses(
                              visit.status,
                            )}`}
                          >
                            {visit.status} · This day
                          </span>
                        )}

                        {assignedElsewhere && (
                          <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                            Assigned to another day
                          </span>
                        )}
                      </div>

                      <p className="mt-1 flex items-start gap-1.5 text-sm leading-5 text-[#777985]">
                        <MapPin size={14} className="mt-0.5 shrink-0" />
                        <span>{formatAddress(membership)}</span>
                      </p>

                      {membership.primary_phone_number && (
                        <p className="mt-1 text-xs text-[#8b8d97]">
                          Phone: {membership.primary_phone_number}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-[#ededf0] bg-[#fcfcfd] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-[#777985]">
            {selectedIds.length} membership{selectedIds.length === 1 ? "" : "s"}{" "}
            selected
          </p>

          <button
            type="button"
            onClick={handleAssign}
            disabled={assigning || selectedIds.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e1e1e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Users size={16} />
            {assigning ? "Assigning..." : "Assign selected memberships"}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#e8e8ec] bg-white">
        <div className="flex flex-col gap-2 border-b border-[#ededf0] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-lg font-bold text-[#1e1e1e]">
              Assigned visit list
            </h2>
            <p className="mt-1 text-sm text-[#777985]">
              Update the outcome of each household visit or remove an
              assignment.
            </p>
          </div>
          <span className="rounded-lg bg-[#f2f2f4] px-3 py-1.5 text-sm font-semibold text-[#454650]">
            {visits.length} assigned
          </span>
        </div>

        {visits.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Users size={28} className="mx-auto text-[#b6b7be]" />
            <p className="mt-3 text-sm font-semibold text-[#454650]">
              No families assigned yet
            </p>
            <p className="mt-1 text-sm text-[#898b95]">
              Search above and select the memberships you want to visit.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#f0f0f2]">
            {visits.map((visit, index) => {
              const membership = visit.membership;

              return (
                <div
                  key={visit.id}
                  className="flex flex-col gap-4 px-4 py-4 sm:px-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f1f1f3] text-xs font-bold text-[#454650]">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#1e1e1e]">
                          {membership?.head_name || "Membership not found"}
                        </p>
                        <span className="rounded-md bg-[#f0f0f2] px-2 py-0.5 text-xs font-semibold text-[#555762]">
                          #{getMembershipNumber(membership)}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClasses(
                            visit.status,
                          )}`}
                        >
                          {visit.status}
                        </span>
                      </div>

                      <p className="mt-1 flex items-start gap-1.5 text-sm leading-5 text-[#777985]">
                        <MapPin size={14} className="mt-0.5 shrink-0" />
                        <span>{formatAddress(membership)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <select
                      aria-label={`Visit status for ${membership?.head_name || "membership"}`}
                      value={visit.status}
                      disabled={busyVisitId === visit.id}
                      onChange={(event) =>
                        handleStatusChange(visit, event.target.value)
                      }
                      className="min-w-32 rounded-lg border border-[#e1e1e6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#777985] disabled:opacity-50"
                    >
                      {VISIT_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      title="Remove from this Carol Day"
                      aria-label={`Remove ${membership?.head_name || "membership"} from this Carol Day`}
                      disabled={busyVisitId === visit.id}
                      onClick={() => handleRemoveVisit(visit)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#e6e6ea] text-[#777985] transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <CarolOfferingPanel visit={visit} />
                </div>

              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
