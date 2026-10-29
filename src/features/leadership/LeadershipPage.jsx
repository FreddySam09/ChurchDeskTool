import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Crown,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  UserRound,
  Users,
  X,
} from "lucide-react";

import {
  getLeadershipOrganizations,
  getLeadershipMembers,
  getLeadershipAppointments,
  createLeadershipPosition,
  updateLeadershipPosition,
  appointLeader,
  endLeadershipAppointment,
} from "../../services/leadership/leadershipService";

const TABS = [
  { id: "church_office", label: "Church Office", icon: Crown },
  { id: "fellowship", label: "Fellowships", icon: Users },
  { id: "group", label: "Groups", icon: UserRound },
];

const today = () => new Date().toISOString().slice(0, 10);

const formatDate = (value) => {
  if (!value) return "—";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#777982] focus:ring-2 focus:ring-[#777982]/10";

const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#24252b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#383940] disabled:cursor-not-allowed disabled:opacity-50";

const buttonSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50";

function Modal({ title, description, onClose, children, wide = false }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`my-auto w-full ${
          wide ? "max-w-2xl" : "max-w-lg"
        } overflow-hidden rounded-2xl bg-white shadow-2xl`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>

            {description && (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </header>

        <div className="px-5 py-5 sm:px-6">{children}</div>
      </section>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-slate-700">{label}</span>

      {children}

      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function PersonLabel({ member }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-slate-800">
        {member?.name || "Unknown member"}
      </p>

      {member?.person_id && (
        <p className="mt-0.5 text-xs text-slate-500">{member.person_id}</p>
      )}
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
      <div className="mb-3 rounded-2xl bg-slate-50 p-3 text-slate-400">
        <Users size={23} />
      </div>

      <p className="text-sm font-semibold text-slate-800">{title}</p>

      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
    </div>
  );
}

function InlineError({ message }) {
  if (!message) return null;

  return (
    <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
      <AlertCircle size={17} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function AppointmentModal({ position, members, onClose, onSave, saving }) {
  const [memberId, setMemberId] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return members.filter((member) => {
      if (!query) return true;

      return `${member.name || ""} ${member.person_id || ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [members, search]);

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (!memberId) {
      setError("Choose a member to appoint.");
      return;
    }

    if (!startDate) {
      setError("Choose the appointment start date.");
      return;
    }

    try {
      await onSave({
        positionId: position.id,
        memberId,
        validFrom: startDate,
        notes: notes.trim() || null,
      });
    } catch (err) {
      setError(err.message || "Could not save the appointment.");
    }
  }

  return (
    <Modal
      title={`Appoint ${position.role_name}`}
      description={`Position in ${
        position.organizationName || "the selected organization"
      }`}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Find a member">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              className={`${inputClass} pl-9`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or person ID"
            />
          </div>
        </Field>

        <Field label="Member">
          <select
            className={inputClass}
            value={memberId}
            onChange={(event) => setMemberId(event.target.value)}
            required
          >
            <option value="">Select a member</option>

            {filteredMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
                {member.person_id ? ` · ${member.person_id}` : ""}
              </option>
            ))}
          </select>

          <span className="block text-xs text-slate-500">
            Only active members are available for appointment.
          </span>
        </Field>

        <Field label="Appointment starts on">
          <input
            className={inputClass}
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
          />
        </Field>

        <Field label="Notes (optional)">
          <textarea
            className={inputClass}
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Term details or appointment notes"
          />
        </Field>

        <InlineError message={error} />

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            className={buttonSecondary}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button className={buttonPrimary} type="submit" disabled={saving}>
            {saving ? "Saving…" : "Confirm appointment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EndAppointmentModal({ appointment, onClose, onSave, saving }) {
  const [endDate, setEndDate] = useState(today());
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (!endDate) {
      setError("Choose the final date of the appointment.");
      return;
    }

    if (endDate < appointment.valid_from) {
      setError("The end date cannot be earlier than the start date.");
      return;
    }

    try {
      await onSave({
        appointmentId: appointment.id,
        validUntil: endDate,
      });
    } catch (err) {
      setError(err.message || "Could not end the appointment.");
    }
  }

  return (
    <Modal
      title="End appointment"
      description="This records the end of the term. It does not delete the appointment or change the member's group membership."
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={submit}>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-800">
            {appointment.member?.name || "Member"}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {appointment.position?.role_name} · Started{" "}
            {formatDate(appointment.valid_from)}
          </p>
        </div>

        <Field label="Appointment end date">
          <input
            className={inputClass}
            type="date"
            min={appointment.valid_from}
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            required
          />
        </Field>

        <InlineError message={error} />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={buttonSecondary}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "Saving…" : "End appointment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PositionModal({ organization, position, onClose, onSave, saving }) {
  const [roleName, setRoleName] = useState(position?.role_name || "");
  const [capacity, setCapacity] = useState(String(position?.capacity || 1));
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");

    const parsedCapacity = Number(capacity);

    if (!roleName.trim()) {
      setError("Enter a position name.");
      return;
    }

    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
      setError("Capacity must be a whole number of at least 1.");
      return;
    }

    try {
      await onSave({
        organization,
        position,
        roleName: roleName.trim(),
        capacity: parsedCapacity,
      });
    } catch (err) {
      setError(err.message || "Could not save the position.");
    }
  }

  return (
    <Modal
      title={position ? "Edit leadership position" : "Add leadership position"}
      description={`Configure roles for ${
        organization?.name || "this organization"
      }.`}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Position name">
          <input
            className={inputClass}
            value={roleName}
            onChange={(event) => setRoleName(event.target.value)}
            placeholder="e.g. Secretary"
            required
          />
        </Field>

        <Field
          label="Number of people allowed"
          hint="Couple-leader roles count each person individually."
        >
          <input
            className={inputClass}
            type="number"
            min="1"
            step="1"
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
            required
          />
        </Field>

        <InlineError message={error} />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={buttonSecondary}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button type="submit" className={buttonPrimary} disabled={saving}>
            {saving ? "Saving…" : "Save position"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AppointmentRow({ appointment, onEnd }) {
  const member = appointment.member || {};
  const position = appointment.position || {};
  const active = !appointment.valid_until;

  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            active
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {active ? <UserRound size={17} /> : <Clock3 size={17} />}
        </div>

        <div className="min-w-0">
          <PersonLabel member={member} />

          <p className="mt-1 text-xs text-slate-500">
            {position.role_name || "Leadership position"} · Started{" "}
            {formatDate(appointment.valid_from)}
          </p>

          {appointment.notes && (
            <p className="mt-1 text-xs text-slate-500">{appointment.notes}</p>
          )}

          {!active && (
            <p className="mt-1 text-xs text-slate-500">
              Ended {formatDate(appointment.valid_until)}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-center">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            active
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {active ? "Current" : "Past term"}
        </span>

        {active && (
          <button
            type="button"
            onClick={() => onEnd(appointment)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            End term
          </button>
        )}
      </div>
    </div>
  );
}

function PositionCard({
  position,
  appointments,
  onAppoint,
  onEdit,
  onRemove,
  onEnd,
  onShowHistory,
  historyExpanded,
}) {
  const current = appointments.filter(
    (appointment) =>
      appointment.position_id === position.id && !appointment.valid_until,
  );

  const history = appointments
    .filter(
      (appointment) =>
        appointment.position_id === position.id && appointment.valid_until,
    )
    .sort((a, b) => (b.valid_from || "").localeCompare(a.valid_from || ""));

  const full = current.length >= position.capacity;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
      <header className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h3 className="font-semibold text-slate-900">{position.role_name}</h3>

          <p className="mt-1 text-xs text-slate-500">
            {current.length} of {position.capacity} positions filled
          </p>

          <div className="mt-2 flex gap-1">
            {Array.from({ length: Math.min(position.capacity, 12) }).map(
              (_, index) => (
                <span
                  key={index}
                  className={`h-1.5 w-6 rounded-full ${
                    index < current.length ? "bg-[#24252b]" : "bg-slate-100"
                  }`}
                />
              ),
            )}

            {position.capacity > 12 && (
              <span className="text-[10px] text-slate-400">
                +{position.capacity - 12}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={buttonSecondary}
            onClick={() => onEdit(position)}
          >
            <Settings2 size={15} />
            Edit role
          </button>

          <button
            type="button"
            className={buttonPrimary}
            disabled={full}
            title={
              full ? "All available positions are filled" : "Appoint a leader"
            }
            onClick={() => onAppoint(position)}
          >
            <Plus size={16} />
            {full ? "Full" : "Appoint"}
          </button>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
            onClick={() => onRemove(position)}
            title="Remove this leadership role"
          >
            <X size={15} />
            Remove role
          </button>
        </div>
      </header>

      <div className="divide-y divide-slate-100">
        {current.length ? (
          current.map((appointment) => (
            <AppointmentRow
              key={appointment.id}
              appointment={appointment}
              onEnd={onEnd}
            />
          ))
        ) : (
          <div className="px-5 py-5 text-sm text-slate-400">
            No current appointments for this position.
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/70">
          <button
            type="button"
            onClick={() => onShowHistory(position.id)}
            className="flex w-full items-center justify-between px-5 py-3 text-left text-xs font-semibold text-slate-600 hover:bg-slate-100/70"
          >
            <span>Previous terms ({history.length})</span>

            <ChevronDown
              size={16}
              className={`transition-transform ${
                historyExpanded ? "rotate-180" : ""
              }`}
            />
          </button>

          {historyExpanded && (
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {history.map((appointment) => (
                <AppointmentRow
                  key={appointment.id}
                  appointment={appointment}
                  onEnd={onEnd}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function LeadershipPage() {
  const [tab, setTab] = useState("church_office");

  const [organizations, setOrganizations] = useState({
    officePositions: [],
    committeePositions: [],
    fellowships: [],
    groups: [],
  });

  const [members, setMembers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [historyExpanded, setHistoryExpanded] = useState({});
  const [modal, setModal] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [organizationData, memberData, appointmentData] = await Promise.all(
        [
          getLeadershipOrganizations(),
          getLeadershipMembers(),
          getLeadershipAppointments(),
        ],
      );

      setOrganizations({
        officePositions: organizationData?.officePositions || [],
        committeePositions: organizationData?.committeePositions || [],
        fellowships: organizationData?.fellowships || [],
        groups: organizationData?.groups || [],
      });

      setMembers(memberData || []);
      setAppointments(appointmentData || []);
    } catch (err) {
      setError(err.message || "Could not load leadership data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const visibleOrganizations = useMemo(() => {
    if (tab === "church_office") {
      return [
        {
          id: "church-office",
          name: "Church Office",
          type: "church_office",
          positions: organizations.officePositions,
        },
        {
          id: "church-committee",
          name: "Church Committee",
          type: "church_committee",
          positions: organizations.committeePositions,
        },
      ];
    }

    const source =
      tab === "fellowship" ? organizations.fellowships : organizations.groups;

    return source.map((organization) => ({
      ...organization,
      type: tab,
    }));
  }, [tab, organizations]);

  useEffect(() => {
    const exists = visibleOrganizations.some(
      (organization) => organization.id === selectedOrganizationId,
    );

    if (!exists) {
      setSelectedOrganizationId(visibleOrganizations[0]?.id || "");
    }
  }, [visibleOrganizations, selectedOrganizationId]);

  const selectedOrganization = visibleOrganizations.find(
    (organization) => organization.id === selectedOrganizationId,
  );

  const selectedPositions = useMemo(() => {
    const positions = selectedOrganization?.positions || [];
    const query = search.trim().toLowerCase();

    if (!query) return positions;

    return positions.filter((position) => {
      const positionAppointments = appointments.filter(
        (appointment) => appointment.position_id === position.id,
      );

      return (
        position.role_name.toLowerCase().includes(query) ||
        positionAppointments.some((appointment) =>
          `${appointment.member?.name || ""} ${
            appointment.member?.person_id || ""
          }`
            .toLowerCase()
            .includes(query),
        )
      );
    });
  }, [selectedOrganization, appointments, search]);

  function openAppointment(position) {
    setModal({
      type: "appointment",
      position: {
        ...position,
        organizationName: selectedOrganization?.name,
      },
    });
  }

  async function saveAppointment(values) {
    setSaving(true);
    setError("");

    try {
      await appointLeader(values);
      setModal(null);
      setNotice("Appointment saved.");
      await loadData();
    } catch (err) {
      setError(err.message || "Could not save the appointment.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function saveEndAppointment({ appointmentId, validUntil }) {
    setSaving(true);
    setError("");

    try {
      await endLeadershipAppointment({ appointmentId, validUntil });
      setModal(null);
      setNotice("Appointment ended. Its history has been retained.");
      await loadData();
    } catch (err) {
      setError(err.message || "Could not end the appointment.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function savePosition({ organization, position, roleName, capacity }) {
    setSaving(true);
    setError("");

    try {
      if (position) {
        await updateLeadershipPosition(position.id, {
          roleName,
          capacity,
        });
      } else {
        await createLeadershipPosition({
          organizationType: organization.type,
          groupId: ["church_office", "church_committee"].includes(
            organization.type,
          )
            ? null
            : organization.id,
          roleName,
          capacity,
        });
      }

      setModal(null);
      setNotice("Leadership position saved.");
      await loadData();
    } catch (err) {
      setError(err.message || "Could not save the leadership position.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function removePosition(position) {
    const confirmed = window.confirm(
      `Remove the "${position.role_name}" role?\n\n` +
        "The role will no longer appear in active leadership positions. " +
        "Existing appointment records and history will be preserved.",
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await updateLeadershipPosition(position.id, {
        isActive: false,
      });

      setNotice(`"${position.role_name}" has been removed from active roles.`);
      await loadData();
    } catch (err) {
      setError(err.message || "Could not remove the leadership role.");
    } finally {
      setSaving(false);
    }
  }

  const pageTitle =
    tab === "church_office"
      ? "Church Office"
      : tab === "fellowship"
        ? "Fellowship Leadership"
        : "Group Leadership";

  return (
    <main className="min-h-full bg-[#f7f7f8] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px] space-y-5">
        {/* Page heading */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Leadership
            </h1>

            <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
              Manage appointments, leadership capacities, and past terms without
              changing membership or fellowship/group assignments. Create and
              manage organisations from the Fellowships & Groups page.
            </p>
          </div>
        </div>

        {/* Main tabs */}
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setSearch("");
                setNotice("");
                setError("");
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                tab === id
                  ? "bg-[#24252b] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* Success message */}
        {notice && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span className="flex items-center gap-2">
              <Check size={17} />
              {notice}
            </span>

            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
              className="rounded-md p-1 hover:bg-emerald-100"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span className="flex items-start gap-2">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              {error}
            </span>

            <button
              type="button"
              className="font-semibold underline"
              onClick={loadData}
            >
              Retry
            </button>
          </div>
        )}

        {/* Organization list and leadership positions */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-900/[0.02]">
            <div className="px-2 pb-3 pt-1">
              <h2 className="text-sm font-semibold text-slate-800">
                {tab === "church_office"
                  ? "Office positions"
                  : tab === "fellowship"
                    ? "Fellowships"
                    : "Groups"}
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                {visibleOrganizations.length}{" "}
                {visibleOrganizations.length === 1
                  ? "organization"
                  : "organizations"}
              </p>
            </div>

            <div className="space-y-1">
              {visibleOrganizations.map((organization) => {
                const selected = organization.id === selectedOrganizationId;
                const count = (organization.positions || []).length;

                return (
                  <button
                    key={organization.id}
                    type="button"
                    onClick={() => setSelectedOrganizationId(organization.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition ${
                      selected
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {organization.name}
                      </span>

                      <span className="mt-1 block text-xs opacity-70">
                        {count} {count === 1 ? "position" : "positions"}
                      </span>
                    </span>

                    <span
                      className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                        selected
                          ? "bg-white text-slate-900"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {tab !== "church_office" && visibleOrganizations.length === 0 && (
              <div className="px-2 py-5 text-sm text-slate-500">
                No {tab === "fellowship" ? "fellowships" : "groups"} found.
                <p className="mt-1 text-xs text-slate-400">
                  Create one from the Fellowships & Groups page before
                  configuring its leadership.
                </p>
              </div>
            )}
          </aside>

          <div className="min-w-0 space-y-4">
            {/* Organization heading and controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {selectedOrganization?.name || pageTitle}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Assign leaders and view previous terms.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[190px] flex-1 sm:flex-none">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    className={`${inputClass} pl-9`}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search roles or leaders"
                  />
                </div>

                <button
                  type="button"
                  className={buttonSecondary}
                  onClick={loadData}
                  disabled={loading}
                  title="Refresh leadership data"
                >
                  <RefreshCw
                    size={15}
                    className={loading ? "animate-spin" : ""}
                  />
                  Refresh
                </button>

                <button
                  type="button"
                  className={buttonSecondary}
                  onClick={() => {
                    setError("");
                    setModal({
                      type: "position",
                      position: null,
                      organization: selectedOrganization,
                    });
                  }}
                  disabled={!selectedOrganization || saving}
                >
                  <Plus size={15} />
                  Add position
                </button>
              </div>
            </div>

            {/* Position list */}
            {loading ? (
              <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
                <RefreshCw size={17} className="mr-2 animate-spin" />
                Loading leadership data…
              </div>
            ) : !selectedOrganization ? (
              <EmptyState
                title={`No ${
                  tab === "fellowship"
                    ? "fellowships"
                    : tab === "group"
                      ? "groups"
                      : "office positions"
                } selected`}
                description={
                  tab === "church_office"
                    ? "Select Church Office to manage its leadership positions."
                    : "Create an organisation from the Fellowships & Groups page, then return here to configure its leadership."
                }
              />
            ) : selectedPositions.length === 0 ? (
              <EmptyState
                title={
                  search
                    ? "No matching positions"
                    : "No leadership positions yet"
                }
                description={
                  search
                    ? "Try another role name, member name, or person ID."
                    : "Add a position to begin appointing leaders."
                }
              />
            ) : (
              <div className="space-y-4">
                {selectedPositions.map((position) => (
                  <PositionCard
                    key={position.id}
                    position={position}
                    appointments={appointments}
                    onAppoint={openAppointment}
                    onEdit={(item) => {
                      setError("");
                      setModal({
                        type: "position",
                        position: item,
                        organization: selectedOrganization,
                      });
                    }}
                    onRemove={removePosition}
                    onEnd={(appointment) => {
                      setError("");
                      setModal({ type: "endAppointment", appointment });
                    }}
                    historyExpanded={Boolean(historyExpanded[position.id])}
                    onShowHistory={(id) =>
                      setHistoryExpanded((previous) => ({
                        ...previous,
                        [id]: !previous[id],
                      }))
                    }
                  />
                ))}
              </div>
            )}

            {/* Neutral information banner */}
            <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-relaxed text-slate-600">
              <CalendarDays
                size={16}
                className="mt-0.5 shrink-0 text-slate-500"
              />

              <p>
                Ending an appointment preserves its record as a past term.
                Leadership appointments are separate from membership and
                fellowship/group participation. Organisation creation and
                management are handled on the Fellowships & Groups page.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Modals */}
      {modal?.type === "appointment" && (
        <AppointmentModal
          position={modal.position}
          members={members}
          saving={saving}
          onClose={() => setModal(null)}
          onSave={saveAppointment}
        />
      )}

      {modal?.type === "endAppointment" && (
        <EndAppointmentModal
          appointment={modal.appointment}
          saving={saving}
          onClose={() => setModal(null)}
          onSave={saveEndAppointment}
        />
      )}

      {modal?.type === "position" && (
        <PositionModal
          organization={modal.organization}
          position={modal.position}
          saving={saving}
          onClose={() => setModal(null)}
          onSave={savePosition}
        />
      )}
    </main>
  );
}
