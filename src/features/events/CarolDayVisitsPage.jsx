
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
  Plus,
  CircleDollarSign,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import CarolOfferingPanel from "./CarolOfferingPanel";
import { exportCarolVisitsToExcel, exportCarolVisitsToPdf } from "../../services/events/CarolServiceExportService";
import CarolMembershipPickerModal from "./CarolMembershipPickerModal";
import CarolOfferingAmountInput from "./CarolOfferingAmountInput";
import { clearCarolOffering, getCarolOfferingsForVisits } from "../../services/events/carolOfferingService";
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
    <div className="rounded-xl border border-[#e9e9ed] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-[#777985]">{label}</p>
        <Icon size={16} className="shrink-0 text-[#92939b]" />
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight text-[#1e1e1e]">
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

  const [membershipPickerOpen, setMembershipPickerOpen] = useState(false);
  const [exporting, setExporting] = useState("");

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

  const eligibleVisibleIds = useMemo(
    () =>
      filteredMemberships
        .filter((membership) => {
          const assignedHere = visitByMembershipId.has(membership.id);
          const assignment = campaignAssignmentByMembershipId.get(
            membership.id,
          );
          const assignedElsewhere =
            assignment && assignment.carol_day_id !== dayId;

          return !assignedHere && !assignedElsewhere;
        })
        .map((membership) => membership.id),
    [
      filteredMemberships,
      visitByMembershipId,
      campaignAssignmentByMembershipId,
      dayId,
    ],
  );

  const selectedVisibleCount = eligibleVisibleIds.filter((id) =>
    selectedIds.includes(id),
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
    if (!eligibleVisibleIds.length) return;

    const allSelected = eligibleVisibleIds.every((id) =>
      selectedIds.includes(id),
    );

    if (allSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !eligibleVisibleIds.includes(id)),
      );
    } else {
      setSelectedIds((current) => [
        ...new Set([...current, ...eligibleVisibleIds]),
      ]);
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
      setMembershipPickerOpen(false);
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

        if (nextStatus !== "Visited") {
          await clearCarolOffering(visit.id);
        }

        setNotice(
          nextStatus === "Visited"
            ? "Visit marked as visited. You can now enter the offering amount."
            : "Visit status updated and offering cleared.",
        );

        await loadPage();
      } catch (err) {
        setError(
          err.message ||
            "Unable to update the visit status or clear its offering.",
        );

        await loadPage();
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

  async function handleExport(format) {
    if (!day || exporting || visits.length === 0) return;
    
    setExporting(format);
    setError("");
    setNotice("");

    try {
      // Fetch saved amounts for every visit, including amounts not
      // currently visible or focused in the input fields.
      const offerings = await getCarolOfferingsForVisits(
        visits.map((visit) => visit.id),
      );

      const exportData = {
        day,
        visits, // Preserve the exact current displayed order.
        offerings,
      };

      if (format === "pdf") {
        exportCarolVisitsToPdf(exportData);
        setNotice("Day-wise visit list exported as PDF.");
      } else {
        exportCarolVisitsToExcel(exportData);
        setNotice("Day-wise visit list exported as Excel.");
      }
    } catch (err) {
      setError(err.message || "Unable to export the visit list.");
    } finally {
      setExporting("");
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
      <div className="mx-auto w-full max-w-375 p-6">
        <div className="animate-pulse rounded-2xl border border-[#e9e9ed] bg-white p-8">
          <div className="h-5 w-48 rounded bg-gray-200" />
          <div className="mt-4 h-4 w-72 max-w-full rounded bg-gray-100" />
          <div className="mt-8 h-32 rounded-lg bg-gray-100" />
        </div>
      </div>
    );
  }

  if (!day && error) {
    return (
      <div className="mx-auto w-full max-w-375 p-6">
        <button
          type="button"
          onClick={() => navigate("/events/christmas-carols")}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#626575] transition hover:text-[#1e1e1e]"
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
    <div className="mx-auto w-full max-w-375 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate("/events/christmas-carols")}
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[#626575] transition hover:text-[#1e1e1e]"
          >
            <ArrowLeft size={16} />
            Back to Christmas Carols
          </button>

          <h1 className="text-2xl font-semibold tracking-tight text-[#1e1e1e]">
            Manage Carol Visits
          </h1>

          <p className="mt-1.5 text-sm text-[#777985]">
            {day?.name} · {formatDate(day?.visit_date)}
            {day?.start_time ? ` · ${String(day.start_time).slice(0, 5)}` : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={loadPage}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-[#e4e4e8] bg-white px-3.5 py-2 text-sm font-medium text-[#34353d] transition hover:bg-[#f8f8f9] disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
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
          className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
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
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-lg font-bold text-[#1e1e1e]">
              Find memberships
            </h2>
            <p className="mt-1 text-sm text-[#777985]">
              Search and filter households in a popup, then select the ones to
              assign.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMembershipPickerOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#1e1e1e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
          >
            <Plus size={16} />
            Find memberships
          </button>
        </div>
      </section>

      <CarolMembershipPickerModal
        open={membershipPickerOpen}
        onClose={() => setMembershipPickerOpen(false)}
        memberships={memberships}
        visits={visits}
        campaignAssignments={campaignAssignments}
        dayId={dayId}
        search={search}
        setSearch={setSearch}
        areaFilter={areaFilter}
        setAreaFilter={setAreaFilter}
        streetFilter={streetFilter}
        setStreetFilter={setStreetFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        assigning={assigning}
        onAssign={handleAssign}
        onClearFilters={clearFilters}
      />

      {/* Assigned visits */}
      <section className="overflow-hidden rounded-xl border border-[#e8e8ec] bg-white">
        <div className="flex flex-col gap-2 border-b border-[#ededf0] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
          <div>
            <h2 className="text-base font-semibold text-[#1e1e1e]">
              Assigned visit list
            </h2>
            <p className="mt-1 text-sm text-[#777985]">
              Update each household's visit status or remove its assignment.
            </p>
          </div>

          <span className="self-start rounded-lg bg-[#f2f2f4] px-3 py-1.5 text-sm font-medium text-[#454650] sm:self-auto">
            {visits.length} assigned
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
            type="button"
            onClick={() => handleExport("pdf")}
            disabled={visits.length === 0 || Boolean(exporting)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#e1e1e6] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#34353d] transition hover:bg-[#f7f7f9] disabled:cursor-not-allowed disabled:opacity-50"
            >
            <FileText size={16} />
            {exporting === "pdf" ? "Exporting PDF..." : "Download PDF"}
            </button>

            <button
            type="button"
            onClick={() => handleExport("excel")}
            disabled={visits.length === 0 || Boolean(exporting)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1e1e1e] px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            >
            <FileSpreadsheet size={16} />
            {exporting === "excel" ? "Exporting Excel..." : "Download Excel"}
            </button>
        </div>
        </div>
        {visits.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Users size={28} className="mx-auto text-[#b6b7be]" />
            <p className="mt-3 text-sm font-semibold text-[#454650]">
              No families assigned yet
            </p>
            <p className="mt-1 text-sm text-[#898b95]">
              Use Find memberships to assign households to this Carol Day.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-225 border-collapse text-left">
              <thead className="bg-[#f7f7f9]">
                <tr className="border-b border-[#e9e9ed] text-[11px] font-semibold uppercase tracking-wide text-[#777985]">
                  <th className="w-16 px-4 py-3 text-center">S.No.</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Membeship No</th>
                  <th className="px-4 py-3">Street Name</th>
                  <th className="px-4 py-3">Area</th>
                  <th className="px-4 py-3">Visited Status</th>
                  <th className="px-4 py-3">Offering</th>
                  <th className="w-16 px-4 py-3 text-center">Remove</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#f0f0f2]">
                {visits.map((visit, index) => {
                  const membership = visit.membership;

                  return (
                    <tr
                      key={visit.id}
                      className="align-middle transition hover:bg-[#fbfbfc]"
                    >
                      <td className="px-4 py-3 text-center text-xs text-[#898b95]">
                        {index + 1}
                      </td>

                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-[#1e1e1e]">
                          {membership?.head_name || "Membership not found"}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <p className="mt-0.5 text-xs text-[#898b95]">
                          #{getMembershipNumber(membership)}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-sm text-[#626575]">
                        {membership?.street_name || "—"}
                      </td>

                      <td className="px-4 py-3 text-sm text-[#626575]">
                        {membership?.area || "—"}
                      </td>

                      <td className="px-4 py-3">
                        <select
                          aria-label={`Visit status for ${membership?.head_name || "membership"}`}
                          value={visit.status}
                          disabled={busyVisitId === visit.id}
                          onChange={(event) =>
                            handleStatusChange(visit, event.target.value)
                          }
                          className={`rounded-lg border px-2.5 py-2 text-xs font-semibold outline-none disabled:opacity-50 ${statusClasses(visit.status)}`}
                        >
                          {VISIT_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-3">
                        <div className="min-w-52.5 max-w-67.5">
                          <CarolOfferingAmountInput
                            key={`${visit.id}-${visit.status}`}
                            visit={visit}
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          title="Remove from this Carol Day"
                          aria-label={`Remove ${membership?.head_name || "membership"} from this Carol Day`}
                          disabled={busyVisitId === visit.id}
                          onClick={() => handleRemoveVisit(visit)}
                          className="inline-flex size-9 items-center justify-center rounded-lg border border-transparent text-[#898b95] transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
