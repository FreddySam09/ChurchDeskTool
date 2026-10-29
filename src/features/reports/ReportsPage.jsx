
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bookmark,
  CalendarDays,
  Check,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Users,
  UsersRound,
  Wallet,
  X,
  Crown,
  House,
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { REPORT_SOURCES, PRESET_REPORTS } from "./config/reportSources";
import {
  applyReportDefinition,
  loadReportRows,
} from "./services/reportQueryService";
import {
  deleteSavedReport,
  getMyExportHistory,
  getSavedReports,
  recordReportExport,
  saveReportDefinition,
} from "./services/reportPersistenceService";
import {
  exportCsv,
  exportExcel,
  exportPdf,
} from "./services/reportExportService";

const ICONS = { Users, House, CalendarDays, UsersRound, Crown, Wallet };

const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "starts_with", label: "Starts with" },
  { value: "greater_than", label: "Greater than" },
  { value: "greater_or_equal", label: "Greater than or equal to" },
  { value: "less_than", label: "Less than" },
  { value: "less_or_equal", label: "Less than or equal to" },
  { value: "on_or_after", label: "On or after" },
  { value: "on_or_before", label: "On or before" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
  { value: "in_month", label: "Date falls in month" },
  { value: "in_all_groups", label: "Belongs to ALL these groups" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const EMPTY_FILTER = { field: "", operator: "contains", value: "" };
const EMPTY_SORT = { field: "", direction: "asc" };

const DEFAULT_FIELDS = {
  members: ["person_id", "name", "phone_number", "membership_number", "membership_area"],
  memberships: ["membership_number", "head_name", "member_count", "area", "city", "membership_status"],
  events: ["title", "event_type", "event_date", "start_time", "location"],
  groups: ["name", "group_type", "group_status", "member_count"],
  leadership: ["member_name", "role_name", "group_name", "valid_from", "valid_until"],
  finance: [],
};

const INPUT_CLASS =
  "min-w-0 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-[#27282d] outline-none transition focus:border-[#6077df] focus:ring-2 focus:ring-[#6077df]/10";

function newDefinition(source) {
  return {
    name: "Custom Report",
    source,
    fields: DEFAULT_FIELDS[source] ?? [],
    filters: [],
    sorts: [],
  };
}

function formatValue(value) {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function Panel({ title, description, actions, children }) {
  return (
    <section className="rounded-2xl border border-black/[0.07] bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#202126]">{title}</h2>
          {description && (
            <p className="mt-1 text-xs leading-5 text-[#777982]">{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function FieldSelect({ fields, value, onChange, placeholder = "Choose a field" }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={INPUT_CLASS}
    >
      <option value="">{placeholder}</option>
      {fields.map((field) => (
        <option key={field.key} value={field.key}>
          {field.label}
        </option>
      ))}
    </select>
  );
}

function ReportTable({ rows, fields }) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-black/10 px-4 py-12 text-center">
        <Search className="mx-auto mb-3 text-[#a1a3ab]" size={22} />
        <p className="text-sm font-medium text-[#4b4d55]">No matching records</p>
        <p className="mt-1 text-xs text-[#888a92]">
          Try changing your search or filters.
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-[540px] overflow-auto rounded-xl border border-black/[0.07]">
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-[#f6f7f9]">
          <tr>
            {fields.map((field) => (
              <th
                key={field.key}
                className="whitespace-nowrap border-b border-black/[0.07] px-4 py-3 text-xs font-semibold text-[#555862]"
              >
                {field.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${index}-${row.id ?? row.person_id ?? row.membership_id ?? ""}`}
              className="border-b border-black/[0.05] last:border-0 hover:bg-[#fafbfc]"
            >
              {fields.map((field) => (
                <td
                  key={field.key}
                  className="max-w-[300px] whitespace-pre-wrap break-words px-4 py-3 text-[13px] text-[#42444c]"
                >
                  {formatValue(row[field.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();

  const [definition, setDefinition] = useState(() => newDefinition("members"));
  const [rawRows, setRawRows] = useState([]);
  const [savedReports, setSavedReports] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState("builder");
  const [editingSavedId, setEditingSavedId] = useState(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [columnSearch, setColumnSearch] = useState("");
  const [previewSearch, setPreviewSearch] = useState("");

  const sourceConfig = REPORT_SOURCES[definition.source];
  const fields = sourceConfig?.fields ?? [];

  const selectedFields = useMemo(
    () => fields.filter((field) => definition.fields.includes(field.key)),
    [fields, definition.fields],
  );

  const previewRows = useMemo(
    () => applyReportDefinition(rawRows, definition),
    [rawRows, definition],
  );

  const visiblePreviewRows = useMemo(() => {
    const query = previewSearch.trim().toLocaleLowerCase();
    if (!query) return previewRows;

    return previewRows.filter((row) =>
      selectedFields.some((field) =>
        String(row[field.key] ?? "").toLocaleLowerCase().includes(query),
      ),
    );
  }, [previewRows, previewSearch, selectedFields]);

  const visibleFields = useMemo(() => {
    const query = columnSearch.trim().toLocaleLowerCase();
    if (!query) return fields;

    return fields.filter((field) =>
      field.label.toLocaleLowerCase().includes(query),
    );
  }, [fields, columnSearch]);

  const refreshSavedReports = useCallback(async () => {
    try {
      setSavedReports(await getSavedReports());
    } catch (loadError) {
      console.warn("Saved reports could not be loaded:", loadError.message);
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await getMyExportHistory());
    } catch (loadError) {
      console.warn("Export history could not be loaded:", loadError.message);
    }
  }, []);

  const runReport = useCallback(async (source = definition.source) => {
    if (REPORT_SOURCES[source]?.disabled) {
      setError("Financial reports will be enabled after the Finance workspace is implemented.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      setRawRows(await loadReportRows(source));
    } catch (loadError) {
      setRawRows([]);
      setError(loadError.message || "Could not load report data.");
    } finally {
      setLoading(false);
    }
  }, [definition.source]);

  useEffect(() => {
    runReport(definition.source);
  }, [definition.source, runReport]);

  useEffect(() => {
    refreshSavedReports();
    refreshHistory();
  }, [refreshSavedReports, refreshHistory]);

  function changeSource(source) {
    setDefinition(newDefinition(source));
    setEditingSavedId(null);
    setColumnSearch("");
    setPreviewSearch("");
    setError("");
    setNotice("");
  }

  function updateDefinition(patch) {
    setDefinition((current) => ({ ...current, ...patch }));
  }

  function toggleField(fieldKey) {
    setDefinition((current) => {
      const exists = current.fields.includes(fieldKey);

      return {
        ...current,
        fields: exists
          ? current.fields.filter((field) => field !== fieldKey)
          : [...current.fields, fieldKey],
      };
    });
  }

  function addFilter() {
    setDefinition((current) => ({
      ...current,
      filters: [
        ...current.filters,
        { ...EMPTY_FILTER, field: fields[0]?.key ?? "" },
      ],
    }));
  }

  function addEventDateRange() {
    const dateField = fields.find((field) => field.key === "event_date");
    if (!dateField) return;

    setDefinition((current) => ({
      ...current,
      filters: [
        ...current.filters,
        { field: "event_date", operator: "on_or_after", value: "" },
        { field: "event_date", operator: "on_or_before", value: "" },
      ],
    }));
  }

  function updateFilter(index, patch) {
    setDefinition((current) => ({
      ...current,
      filters: current.filters.map((filter, filterIndex) =>
        filterIndex === index ? { ...filter, ...patch } : filter,
      ),
    }));
  }

  function removeFilter(index) {
    setDefinition((current) => ({
      ...current,
      filters: current.filters.filter((_, filterIndex) => filterIndex !== index),
    }));
  }

  function addSort() {
    setDefinition((current) => ({
      ...current,
      sorts: [...current.sorts, { ...EMPTY_SORT, field: fields[0]?.key ?? "" }],
    }));
  }

  function updateSort(index, patch) {
    setDefinition((current) => ({
      ...current,
      sorts: current.sorts.map((sort, sortIndex) =>
        sortIndex === index ? { ...sort, ...patch } : sort,
      ),
    }));
  }

  function removeSort(index) {
    setDefinition((current) => ({
      ...current,
      sorts: current.sorts.filter((_, sortIndex) => sortIndex !== index),
    }));
  }

  function selectAllFields() {
    updateDefinition({ fields: fields.map((field) => field.key) });
  }

  function clearAllFields() {
    updateDefinition({ fields: [] });
  }

  function loadPreset(preset) {
    const config = REPORT_SOURCES[preset.source];
    if (!config || config.disabled) return;

    setDefinition({
      name: preset.name,
      source: preset.source,
      fields: preset.fields.filter((key) =>
        config.fields.some((field) => field.key === key),
      ),
      filters: preset.filters.map((filter) => ({ ...filter })),
      sorts: preset.sorts.map((sort) => ({ ...sort })),
    });

    setEditingSavedId(null);
    setColumnSearch("");
    setPreviewSearch("");
    setActiveTab("builder");
  }

  function loadSavedReport(saved) {
    const savedDefinition = saved.definition;

    if (!savedDefinition || !REPORT_SOURCES[savedDefinition.source]) {
      setError("This saved report has an invalid configuration.");
      return;
    }

    const config = REPORT_SOURCES[savedDefinition.source];

    setDefinition({
      name: saved.name,
      source: savedDefinition.source,
      fields: (savedDefinition.fields ?? []).filter((key) =>
        config.fields.some((field) => field.key === key),
      ),
      filters: savedDefinition.filters ?? [],
      sorts: savedDefinition.sorts ?? [],
    });

    setEditingSavedId(saved.id);
    setColumnSearch("");
    setPreviewSearch("");
    setActiveTab("builder");
  }

  async function saveCurrentReport() {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const saved = await saveReportDefinition({
        id: editingSavedId,
        name: saveName,
        source: definition.source,
        fields: definition.fields,
        filters: definition.filters,
        sorts: definition.sorts,
      });

      setEditingSavedId(saved.id);
      setDefinition((current) => ({ ...current, name: saveName.trim() }));
      setShowSaveDialog(false);
      setNotice("Report configuration saved.");
      await refreshSavedReports();
    } catch (saveError) {
      setError(
        saveError.message ||
          "Could not save the report. Confirm the Reports SQL migration has been applied.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeSavedReport(saved) {
    if (!window.confirm(`Delete the saved report "${saved.name}"?`)) return;

    setError("");
    setNotice("");

    try {
      await deleteSavedReport(saved.id);
      if (editingSavedId === saved.id) setEditingSavedId(null);
      await refreshSavedReports();
      setNotice("Saved report deleted.");
    } catch (deleteError) {
      setError(deleteError.message || "Could not delete the saved report.");
    }
  }

  async function handleExport(format) {
    if (!selectedFields.length) {
      setError("Select at least one output column before exporting.");
      return;
    }

    setExporting(true);
    setError("");
    setNotice("");

    try {
      const freshRows = await loadReportRows(definition.source);
      const filteredRows = applyReportDefinition(freshRows, definition);
      const exportedAt = new Date().toISOString();
      const exportedBy = user?.email || user?.id || "Signed-in user";
      const reportName = definition.name || sourceConfig.label;

      const payload = {
        rows: filteredRows,
        fields: selectedFields,
        reportName,
        exportedBy,
        exportedAt: formatDateTime(exportedAt),
        source: definition.source,
      };

      if (format === "csv") exportCsv(payload);
      if (format === "xlsx") exportExcel(payload);
      if (format === "pdf") exportPdf(payload);

      try {
        await recordReportExport({
          source: definition.source,
          reportName,
          format,
          filters: definition.filters,
          fields: definition.fields,
          sorts: definition.sorts,
          rowCount: filteredRows.length,
        });

        await refreshHistory();
        setNotice(
          `${format.toUpperCase()} export created and recorded in export history.`,
        );
      } catch (auditError) {
        setNotice(
          `${format.toUpperCase()} export created, but export history could not be recorded: ${auditError.message}`,
        );
      }
    } catch (exportError) {
      setError(exportError.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  function resetDefinition() {
    setDefinition(newDefinition(definition.source));
    setEditingSavedId(null);
    setColumnSearch("");
    setPreviewSearch("");
    setError("");
    setNotice("");
  }

  return (
    <main className="min-h-full bg-[#f5f6f8] px-4 py-6 text-[#202126] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.04em] text-[#18191d] sm:text-3xl">
              Reports
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#737680]">
              Build, filter, save, and export reports from your church records.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => runReport()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium transition hover:bg-[#f8f8fa] disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh data
            </button>
            <button
              type="button"
              onClick={() => {
                setSaveName(definition.name || "Custom Report");
                setShowSaveDialog(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#202126] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#383a43]"
            >
              <Save size={15} />
              Save report
            </button>
          </div>
        </header>

        {(error || notice) && (
          <div
            className={`mb-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {error ? (
              <X size={17} className="mt-0.5 shrink-0" />
            ) : (
              <Check size={17} className="mt-0.5 shrink-0" />
            )}
            <span>{error || notice}</span>
            <button
              type="button"
              className="ml-auto opacity-60 hover:opacity-100"
              onClick={() => {
                setError("");
                setNotice("");
              }}
              aria-label="Dismiss message"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Matching records", loading ? "—" : previewRows.length, "After applying filters"],
            ["Output columns", selectedFields.length, "Selected for export"],
            ["Saved reports", savedReports.length, "Your configurations"],
            ["Recent exports", history.length, "Latest 50 in your history"],
          ].map(([label, value, description]) => (
            <div key={label} className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
              <p className="text-xs text-[#777a84]">{label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
              <p className="mt-1 text-[11px] text-[#999ba3]">{description}</p>
            </div>
          ))}
        </div>

        <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-black/[0.06] bg-white p-1">
          {[
            { id: "builder", label: "Report Builder", icon: Filter },
            { id: "saved", label: "Saved Reports", icon: Bookmark },
            { id: "history", label: "Export History", icon: Clock3 },
          ].map((tab) => {
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "bg-[#202126] text-white"
                    : "text-[#70737d] hover:bg-[#f5f6f8] hover:text-[#25262b]"
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "builder" && (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <div className="space-y-5">
              <Panel title="1. Choose a data source" description="Select which church records this report should use.">
                <div className="space-y-2">
                  {Object.entries(REPORT_SOURCES).map(([key, source]) => {
                    const Icon = ICONS[source.icon] || FileSpreadsheet;
                    const active = definition.source === key;

                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={source.disabled}
                        onClick={() => changeSource(key)}
                        className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                          active
                            ? "border-[#6579dc] bg-[#f1f3ff]"
                            : "border-black/[0.07] bg-white hover:border-black/20 hover:bg-[#fafbfc]"
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        <span className={`mt-0.5 rounded-lg p-2 ${active ? "bg-white text-[#5267c7]" : "bg-[#f3f4f6] text-[#696c75]"}`}>
                          <Icon size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm font-medium text-[#292a30]">
                            {source.label}
                            {source.disabled && (
                              <span className="rounded-md bg-[#ececf0] px-1.5 py-0.5 text-[10px] text-[#757781]">
                                Coming soon
                              </span>
                            )}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-[#7d8089]">
                            {source.description}
                          </span>
                        </span>
                        {active && <Check size={16} className="mt-1 shrink-0 text-[#5267c7]" />}
                      </button>
                    );
                  })}
                </div>
              </Panel>

              <Panel title="2. Output columns" description="Choose which information appears in the report and exports.">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-[#777a84]">
                    {definition.fields.length} of {fields.length} selected
                  </span>
                  <div className="flex gap-3">
                    <button type="button" onClick={selectAllFields} className="text-xs font-medium text-[#5267c7] hover:underline">
                      Select all
                    </button>
                    <button type="button" onClick={clearAllFields} className="text-xs font-medium text-[#777a84] hover:underline">
                      Clear
                    </button>
                  </div>
                </div>

                <div className="relative mb-3">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#92949d]" />
                  <input
                    type="search"
                    value={columnSearch}
                    onChange={(event) => setColumnSearch(event.target.value)}
                    placeholder="Find a column..."
                    aria-label="Search output columns"
                    className={`${INPUT_CLASS} pl-9`}
                  />
                </div>

                <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
                  {visibleFields.map((field) => (
                    <label
                      key={field.key}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-[#44464e] hover:bg-[#f7f8fa]"
                    >
                      <input
                        type="checkbox"
                        checked={definition.fields.includes(field.key)}
                        onChange={() => toggleField(field.key)}
                        className="h-4 w-4 rounded border-gray-300 accent-[#5267c7]"
                      />
                      <span>{field.label}</span>
                    </label>
                  ))}
                  {visibleFields.length === 0 && (
                    <p className="px-2 py-4 text-xs text-[#888a92]">No columns match your search.</p>
                  )}
                </div>
              </Panel>
            </div>

            <div className="min-w-0 space-y-5">
              <Panel
                title="3. Filters"
                description="Every filter is combined using AND logic. All active conditions must match."
                actions={
                  <div className="flex flex-wrap gap-2">
                    {definition.source === "events" && (
                      <button
                        type="button"
                        onClick={addEventDateRange}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#6077df]/30 bg-[#f1f3ff] px-3 py-2 text-xs font-medium text-[#4359bc] hover:bg-[#e9edff]"
                      >
                        <CalendarDays size={14} />
                        Add date range
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={addFilter}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-xs font-medium hover:bg-[#f7f8fa]"
                    >
                      <Plus size={14} />
                      Add filter
                    </button>
                  </div>
                }
              >
                {definition.filters.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-black/10 px-4 py-8 text-center">
                    <Filter className="mx-auto mb-2 text-[#a1a3ab]" size={20} />
                    <p className="text-sm text-[#555862]">No filters applied</p>
                    <p className="mt-1 text-xs text-[#888a92]">All records from this data source are included.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {definition.filters.map((filter, index) => {
                      const selectedField = fields.find((field) => field.key === filter.field);
                      const isDate = selectedField?.type === "date";
                      const isMonth = filter.operator === "in_month";
                      const needsNoValue = ["is_empty", "is_not_empty"].includes(filter.operator);

                      return (
                        <div
                          key={`filter-${index}`}
                          className="grid gap-2 rounded-xl border border-black/[0.07] bg-[#fafbfc] p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                        >
                          <FieldSelect
                            fields={fields}
                            value={filter.field}
                            onChange={(value) => updateFilter(index, { field: value, value: "" })}
                          />

                          <select
                            value={filter.operator}
                            onChange={(event) => updateFilter(index, { operator: event.target.value, value: "" })}
                            className={INPUT_CLASS}
                          >
                            {OPERATORS.map((operator) => (
                              <option key={operator.value} value={operator.value}>
                                {operator.label}
                              </option>
                            ))}
                          </select>

                          {isMonth ? (
                            <div>
                              <input
                                type="text"
                                list="report-month-options"
                                value={filter.value ?? ""}
                                onChange={(event) => updateFilter(index, { value: event.target.value })}
                                placeholder="Type a month, e.g. April"
                                aria-label="Month to filter by"
                                className={INPUT_CLASS}
                              />
                              <datalist id="report-month-options">
                                {MONTHS.map((month, monthIndex) => (
                                  <option key={month} value={month} label={`Month ${monthIndex + 1}`} />
                                ))}
                              </datalist>
                              <p className="mt-1 text-[11px] text-[#858791]">Full name, abbreviation, or number 1–12.</p>
                            </div>
                          ) : needsNoValue ? (
                            <div className="flex items-center px-3 text-xs text-[#858791]">No value required</div>
                          ) : (
                            <input
                              type={
                                isDate || ["on_or_after", "on_or_before"].includes(filter.operator)
                                  ? "date"
                                  : selectedField?.type === "number"
                                    ? "number"
                                    : "text"
                              }
                              value={Array.isArray(filter.value) ? filter.value.join(", ") : filter.value ?? ""}
                              onChange={(event) => updateFilter(index, { value: event.target.value })}
                              placeholder={
                                filter.operator === "in_all_groups"
                                  ? "e.g. Youth Fellowship, Choir"
                                  : filter.operator === "greater_than"
                                    ? "Enter a value greater than..."
                                    : filter.operator === "less_than"
                                      ? "Enter a value less than..."
                                      : "Enter a value..."
                              }
                              className={INPUT_CLASS}
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => removeFilter(index)}
                            aria-label="Remove filter"
                            title="Remove filter"
                            className="flex items-center justify-center rounded-lg px-2 text-[#999ba3] hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="mt-3 text-[11px] leading-5 text-[#898b94]">
                  For a date range, use “Add date range” and fill in both dates. For “Belongs to ALL these groups”, enter exact group names separated by commas.
                </p>
              </Panel>

              <Panel
                title="4. Sorting"
                description="Add sort levels in priority order."
                actions={
                  <button
                    type="button"
                    onClick={addSort}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-xs font-medium hover:bg-[#f7f8fa]"
                  >
                    <Plus size={14} />
                    Add sort
                  </button>
                }
              >
                {definition.sorts.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-black/10 px-4 py-5 text-center text-xs text-[#858791]">
                    Default database order will be used.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {definition.sorts.map((sort, index) => (
                      <div key={`sort-${index}`} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                        <FieldSelect
                          fields={fields}
                          value={sort.field}
                          onChange={(value) => updateSort(index, { field: value })}
                        />
                        <select
                          value={sort.direction}
                          onChange={(event) => updateSort(index, { direction: event.target.value })}
                          className={INPUT_CLASS}
                        >
                          <option value="asc">Ascending (A → Z)</option>
                          <option value="desc">Descending (Z → A)</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeSort(index)}
                          aria-label="Remove sort"
                          className="rounded-lg px-3 text-[#999ba3] hover:bg-red-50 hover:text-red-600"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                title="5. Preview & export"
                description="Search the matching records, then export the full filtered report."
                actions={
                  <span className="rounded-lg bg-[#f1f2f5] px-3 py-1.5 text-xs font-medium tabular-nums text-[#555862]">
                    {loading ? "Loading…" : `${previewRows.length.toLocaleString("en-IN")} rows`}
                  </span>
                }
              >
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={loading || exporting || selectedFields.length === 0}
                    onClick={() => handleExport("pdf")}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#202126] px-3.5 py-2.5 text-xs font-medium text-white hover:bg-[#383a43] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {exporting ? <LoaderCircle size={14} className="animate-spin" /> : <FileText size={14} />}
                    Export PDF
                  </button>
                  <button
                    type="button"
                    disabled={loading || exporting || selectedFields.length === 0}
                    onClick={() => handleExport("xlsx")}
                    className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-xs font-medium text-[#3e4048] hover:bg-[#f7f8fa] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FileSpreadsheet size={14} />
                    Export Excel
                  </button>
                  <button
                    type="button"
                    disabled={loading || exporting || selectedFields.length === 0}
                    onClick={() => handleExport("csv")}
                    className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-xs font-medium text-[#3e4048] hover:bg-[#f7f8fa] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download size={14} />
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={resetDefinition}
                    className="ml-auto inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium text-[#777a84] hover:bg-[#f7f8fa] hover:text-[#292a30]"
                  >
                    <RefreshCw size={14} />
                    Reset builder
                  </button>
                </div>

                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#292a30]">Report preview</p>
                    <p className="mt-1 text-xs text-[#777a84]">
                      {previewSearch.trim()
                        ? `Showing ${visiblePreviewRows.length} of ${previewRows.length} records`
                        : `${previewRows.length} matching records`}
                    </p>
                  </div>
                  <div className="relative w-full sm:max-w-xs">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#92949d]" />
                    <input
                      type="search"
                      value={previewSearch}
                      onChange={(event) => setPreviewSearch(event.target.value)}
                      placeholder="Search visible columns..."
                      aria-label="Search report preview"
                      className={`${INPUT_CLASS} pl-9`}
                    />
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center gap-3 rounded-xl border border-black/[0.07] bg-[#fafbfc] py-16 text-sm text-[#777a84]">
                    <LoaderCircle className="animate-spin" size={18} />
                    Loading report data…
                  </div>
                ) : selectedFields.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-black/10 px-4 py-10 text-center text-sm text-[#777a84]">
                    Select at least one output column to preview the report.
                  </div>
                ) : (
                  <ReportTable rows={visiblePreviewRows.slice(0, 250)} fields={selectedFields} />
                )}

                {!loading && visiblePreviewRows.length > 250 && (
                  <p className="mt-3 text-xs text-[#888a92]">
                    Preview shows the first 250 matching rows. Exports include every record matching your report filters.
                  </p>
                )}
              </Panel>
            </div>
          </div>
        )}

        {activeTab === "saved" && (
          <Panel
            title="Saved reports"
            description="Load, modify, and export your saved report configurations."
          >
            {savedReports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-black/10 px-4 py-12 text-center">
                <Bookmark className="mx-auto mb-3 text-[#a1a3ab]" size={22} />
                <p className="text-sm font-medium text-[#4b4d55]">No saved reports yet</p>
                <p className="mt-1 text-xs text-[#888a92]">Build a report and select Save report.</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {savedReports.map((saved) => (
                  <div key={saved.id} className="rounded-xl border border-black/[0.07] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{saved.name}</h3>
                        <p className="mt-1 text-xs text-[#777a84]">
                          {REPORT_SOURCES[saved.source]?.label ?? saved.source}
                        </p>
                      </div>
                      <Bookmark size={16} className="shrink-0 text-[#727784]" />
                    </div>
                    <p className="mt-3 text-xs text-[#898b94]">
                      {(saved.definition?.fields ?? []).length} columns · {(saved.definition?.filters ?? []).length} filters
                    </p>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => loadSavedReport(saved)}
                        className="flex-1 rounded-lg bg-[#202126] px-3 py-2 text-xs font-medium text-white hover:bg-[#383a43]"
                      >
                        Open report
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSavedReport(saved)}
                        aria-label={`Delete ${saved.name}`}
                        className="rounded-lg border border-black/10 px-3 py-2 text-[#858791] hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 border-t border-black/[0.07] pt-5">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#777a84]">Start from a preset</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {PRESET_REPORTS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => loadPreset(preset)}
                    className="rounded-xl border border-black/[0.07] px-3 py-3 text-left text-sm hover:border-black/20 hover:bg-[#fafbfc]"
                  >
                    <span className="font-medium">{preset.name}</span>
                    <span className="mt-1 block text-xs text-[#858791]">
                      {REPORT_SOURCES[preset.source].label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </Panel>
        )}

        {activeTab === "history" && (
          <Panel
            title="Export history"
            description="Your most recent exports, including format, row count, and timestamp."
            actions={
              <button
                type="button"
                onClick={refreshHistory}
                className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-xs hover:bg-[#f7f8fa]"
              >
                <RefreshCw size={13} />
                Refresh
              </button>
            }
          >
            {history.length === 0 ? (
              <div className="rounded-xl border border-dashed border-black/10 px-4 py-12 text-center">
                <Clock3 className="mx-auto mb-3 text-[#a1a3ab]" size={22} />
                <p className="text-sm font-medium text-[#4b4d55]">No export history</p>
                <p className="mt-1 text-xs text-[#888a92]">Successful audit entries will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-black/[0.07]">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-[#f6f7f9] text-xs text-[#666973]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Report</th>
                      <th className="px-4 py-3 font-semibold">Source</th>
                      <th className="px-4 py-3 font-semibold">Format</th>
                      <th className="px-4 py-3 font-semibold">Rows</th>
                      <th className="px-4 py-3 font-semibold">Exported at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry) => (
                      <tr key={entry.id} className="border-t border-black/[0.06]">
                        <td className="px-4 py-3 font-medium">{entry.report_name}</td>
                        <td className="px-4 py-3 text-[#666973]">{REPORT_SOURCES[entry.source]?.label ?? entry.source}</td>
                        <td className="px-4 py-3 uppercase text-[#666973]">{entry.export_format}</td>
                        <td className="px-4 py-3 tabular-nums text-[#666973]">{entry.row_count}</td>
                        <td className="px-4 py-3 text-[#666973]">{formatDateTime(entry.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        {showSaveDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Save report</h2>
                  <p className="mt-1 text-xs text-[#777a84]">Save the current columns, filters, and sorting.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSaveDialog(false)}
                  className="rounded-lg p-1.5 text-[#777a84] hover:bg-[#f2f3f5]"
                  aria-label="Close dialog"
                >
                  <X size={17} />
                </button>
              </div>
              <label className="mb-2 block text-xs font-medium text-[#555862]">Report name</label>
              <input
                autoFocus
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && saveName.trim() && !saving) saveCurrentReport();
                }}
                placeholder="e.g. Events in October"
                className={`${INPUT_CLASS} py-3`}
              />
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSaveDialog(false)}
                  className="rounded-xl border border-black/10 px-4 py-2.5 text-sm hover:bg-[#f7f8fa]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || !saveName.trim()}
                  onClick={saveCurrentReport}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#202126] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#383a43] disabled:opacity-50"
                >
                  {saving && <LoaderCircle size={14} className="animate-spin" />}
                  Save configuration
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
