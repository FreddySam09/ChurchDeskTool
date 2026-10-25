import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Users,
  Wallet,
} from "lucide-react";

import {
  createCarolDay,
  deleteCarolDay,
  getCarolDays,
  updateCarolDay,
} from "../../services/events/carolService";

const EMPTY_FORM = {
  name: "",
  visit_date: "",
  start_time: "18:00",
  end_time: "21:00",
  notes: "",
  status: "Scheduled",
};

const TABS = [
  { label: "Church Calendar", path: "/events/church-calendar" },
  { label: "Christmas Carols", path: "/events/christmas-carols" },
  { label: "Special Events", path: "/events/special-events" },
];

const activeTab = TABS.find((tab) => tab.path === location.pathname) || TABS[0];

function formatDate(value) {
  if (!value) return "Date not set";

  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatTime(value) {
  if (!value) return "";

  const [hours, minutes] = value.split(":").map(Number);

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hours, minutes));
}

function statusClass(status) {
  if (status === "Completed") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "Cancelled") {
    return "bg-red-50 text-red-700";
  }

  return "bg-blue-50 text-blue-700";
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-100";

function CarolDayModal({ initialValue, onClose, onSave, saving }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    ...(initialValue ?? {}),
    start_time: initialValue?.start_time?.slice(0, 5) || EMPTY_FORM.start_time,
    end_time: initialValue?.end_time?.slice(0, 5) || EMPTY_FORM.end_time,
  }));

  const [error, setError] = useState("");

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");

    try {
      await onSave(form);
    } catch (saveError) {
      setError(saveError.message || "Unable to save this Carol Day.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="carol-day-modal-title"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2
              id="carol-day-modal-title"
              className="text-lg font-semibold text-gray-900"
            >
              {initialValue ? "Edit Carol Day" : "Create Carol Day"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Set the date and timing for a family visit round.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </header>

        <form onSubmit={submit} className="space-y-5 p-6">
          <Field label="Carol Day name">
            <input
              className={inputClass}
              value={form.name}
              onChange={(event) => change("name", event.target.value)}
              placeholder="e.g. West Street — Day 1"
              maxLength={120}
              required
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Visit date">
              <input
                type="date"
                className={inputClass}
                value={form.visit_date}
                onChange={(event) => change("visit_date", event.target.value)}
                required
              />
            </Field>

            <Field label="Status">
              <select
                className={inputClass}
                value={form.status}
                onChange={(event) => change("status", event.target.value)}
              >
                <option value="Scheduled">Scheduled</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </Field>

            <Field label="Start time">
              <input
                type="time"
                className={inputClass}
                value={form.start_time}
                onChange={(event) => change("start_time", event.target.value)}
                required
              />
            </Field>

            <Field label="End time (optional)">
              <input
                type="time"
                className={inputClass}
                value={form.end_time}
                onChange={(event) => change("end_time", event.target.value)}
              />
            </Field>
          </div>

          <Field label="Notes (optional)">
            <textarea
              className={`${inputClass} min-h-24 resize-y`}
              value={form.notes || ""}
              onChange={(event) => change("notes", event.target.value)}
              placeholder="Meeting point, route details or instructions"
              maxLength={2000}
              rows={3}
            />
          </Field>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <footer className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#1e1e1e] px-5 py-2.5 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving…"
                : initialValue
                  ? "Save changes"
                  : "Create Carol Day"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default function ChristmasCarolsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDay, setEditingDay] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedYear, setSelectedYear] = useState(
    String(new Date().getFullYear()),
  );

  const loadDays = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const result = await getCarolDays();
      setDays(result || []);
    } catch (error) {
      setPageError(error.message || "Unable to load Carol Days.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDays();
  }, [loadDays]);

  const availableYears = useMemo(() => {
    return [
      ...new Set(
        days
          .map((day) => Number(String(day.visit_date || "").slice(0, 4)))
          .filter((year) => Number.isInteger(year) && year >= 1900),
      ),
    ].sort((a, b) => b - a);
  }, [days]);

  useEffect(() => {
    if (!availableYears.length) return;

    setSelectedYear((current) => {
      const year = Number(current);

      return availableYears.includes(year)
        ? current
        : String(availableYears[0]);
    });
  }, [availableYears]);

  const filteredDays = useMemo(() => {
    const query = search.trim().toLowerCase();

    return days
      .filter((day) => {
        const dayYear = String(day.visit_date || "").slice(0, 4);

        const matchesYear = !selectedYear || dayYear === selectedYear;

        const matchesSearch =
          !query ||
          day.name?.toLowerCase().includes(query) ||
          day.notes?.toLowerCase().includes(query);

        const matchesStatus =
          statusFilter === "All" || day.status === statusFilter;

        return matchesYear && matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const dateOrder = (b.visit_date || "").localeCompare(
          a.visit_date || "",
        );

        if (dateOrder !== 0) return dateOrder;

        return (a.start_time || "").localeCompare(b.start_time || "");
      });
  }, [days, search, statusFilter, selectedYear]);

  const stats = useMemo(
    () => ({
      total: days.length,
      scheduled: days.filter((day) => day.status === "Scheduled").length,
      completed: days.filter((day) => day.status === "Completed").length,
      cancelled: days.filter((day) => day.status === "Cancelled").length,
    }),
    [days],
  );

  function openCreate() {
    setEditingDay(null);
    setModalOpen(true);
  }

  function openEdit(day) {
    setEditingDay(day);
    setModalOpen(true);
  }

  async function saveDay(values) {
    setSaving(true);
    setPageError("");

    try {
      if (editingDay) {
        await updateCarolDay(editingDay.id, values);
      } else {
        await createCarolDay(values);
      }

      setModalOpen(false);
      setEditingDay(null);
      await loadDays();
    } finally {
      setSaving(false);
    }
  }

  async function removeDay(day) {
    const confirmed = window.confirm(
      `Delete "${day.name}"? This cannot be undone.`,
    );

    if (!confirmed) return;

    setPageError("");

    try {
      await deleteCarolDay(day.id);
      await loadDays();
    } catch (error) {
      setPageError(error.message || "Unable to delete this Carol Day.");
    }
  }

  return (
    <main className="min-h-full space-y-6 bg-[#f7f7f8]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl">
            Christmas Carols
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            Organise visit rounds, manage family assignments and keep offering
            records in one place.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-[41px] items-center gap-2 rounded-[11px] bg-[#202126] px-3.5 text-sm font-medium text-white hover:bg-[#35363d] sm:px-4"
        >
          <Plus size={16} />
          Create Carol Day
        </button>
      </div>

      <div className="mb-7 border-b border-[#e8e8ea]">
        <nav
          aria-label="Event workspaces"
          className="flex gap-1 overflow-x-auto overflow-y-hidden sm:gap-2"
        >
          {TABS.map((tab) => {
            const selected = tab.path === activeTab.path;

            return (
              <button
                key={tab.path}
                type="button"
                onClick={() => navigate(tab.path)}
                aria-current={selected ? "page" : undefined}
                className={`-mb-px shrink-0 border-b-2 px-4 py-[13px] text-[13px] transition sm:px-[19px] sm:text-sm ${
                  selected
                    ? "border-[#202126] font-medium text-[#15161a]"
                    : "border-transparent text-[#858894] hover:text-[#292a30]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* <nav className="flex gap-7 overflow-x-auto border-b border-[#e5e5e7] px-1">
        {TABS.map((tab) => {
          const active = location.pathname === tab.path;

          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => navigate(tab.path)}
              className={`-mb-px shrink-0 border-b-2 px-1 py-3 text-sm transition ${
                active
                  ? "border-[#1e1e1e] font-medium text-[#1e1e1e]"
                  : "border-transparent text-[#85858c] hover:text-[#1e1e1e]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav> */}

      {pageError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{pageError}</span>
          <button
            type="button"
            onClick={() => setPageError("")}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white">
        <div className="flex flex-col gap-4 border-b border-[#eeeeef] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-base font-semibold text-[#1e1e1e]">
              Carol Day register
            </h2>
            <p className="mt-1 text-xs text-[#85858c]">
              {filteredDays.length} Carol Days
              {selectedYear ? ` in ${selectedYear}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              aria-label="Filter Carol Days by year"
              className="rounded-lg border border-[#e3e3e6] bg-white px-3 py-2 text-sm text-[#34353d] outline-none focus:border-[#777985]"
            >
              {availableYears.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={loadDays}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-[#e3e3e6] px-3 py-2 text-sm text-[#454650] transition hover:bg-[#f7f7f8] disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 border-b border-[#eeeeef] p-3 sm:grid-cols-[minmax(0,1fr)_160px] sm:p-4">
          <input
            className={inputClass}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search Carol Days..."
            aria-label="Search Carol Days"
          />

          <select
            className={inputClass}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by status"
          >
            <option value="All">All statuses</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm text-gray-500">
            <RefreshCw size={17} className="animate-spin" />
            Loading Carol Days…
          </div>
        ) : filteredDays.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
              <CalendarDays size={22} />
            </div>
            <h3 className="mt-4 font-semibold text-gray-900">
              {days.length === 0
                ? "No Carol Days yet"
                : "No matching Carol Days"}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-gray-500">
              {days.length === 0
                ? "Create your first Carol Day to start organising family visits."
                : "Try changing the search text or status filter."}
            </p>
            {days.length === 0 && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#1e1e1e] px-4 py-2.5 text-sm font-medium text-white hover:bg-black"
              >
                <Plus size={16} />
                Create Carol Day
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-3 bg-[#fafafa] p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
            {filteredDays.map((day, index) => (
              <article
                key={day.id}
                className="flex min-w-0 flex-col rounded-xl border border-[#e8e8eb] bg-white p-4 transition hover:border-[#d4d4d9] sm:p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700 transition group-hover:bg-gray-950 group-hover:text-white">
                    <CalendarDays size={20} />
                  </div>

                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusClass(day.status)}`}
                  >
                    {day.status}
                  </span>
                </div>

                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
                    Carol Day {index + 1}
                  </p>

                  <h3 className="mt-2 break-words text-xl font-semibold tracking-tight text-gray-950">
                    {day.name || "Untitled Carol Day"}
                  </h3>

                  <div className="mt-4 space-y-2.5 text-sm text-gray-500">
                    <p className="flex items-center gap-2.5">
                      <CalendarDays
                        size={16}
                        className="shrink-0 text-gray-400"
                      />
                      <span>{formatDate(day.visit_date)}</span>
                    </p>

                    <p className="flex items-center gap-2.5">
                      <Clock3 size={16} className="shrink-0 text-gray-400" />
                      <span>
                        {formatTime(day.start_time)}
                        {day.end_time ? ` – ${formatTime(day.end_time)}` : ""}
                      </span>
                    </p>
                  </div>

                  {day.notes && (
                    <p className="mt-4 line-clamp-2 text-sm leading-5 text-gray-500">
                      {day.notes}
                    </p>
                  )}
                </div>

                <div className="mt-auto pt-6">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/events/christmas-carols/${day.id}/visits`)
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black"
                  >
                    <Users size={16} />
                    Manage Visits
                  </button>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(day)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => removeDay(day)}
                      aria-label={`Delete ${day.name}`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="flex items-start gap-2 text-xs leading-5 text-gray-500">
        <MapPin size={14} className="mt-0.5 shrink-0" />
        Family assignments, visit tracking and offerings will be connected in
        the next step. Deleting a day with assigned families is blocked to
        protect their records.
      </p>

      {modalOpen && (
        <CarolDayModal
          initialValue={editingDay}
          saving={saving}
          onClose={() => {
            if (!saving) {
              setModalOpen(false);
              setEditingDay(null);
            }
          }}
          onSave={saveDay}
        />
      )}
    </main>
  );
}
