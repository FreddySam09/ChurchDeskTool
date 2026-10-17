import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  FileSpreadsheet,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  createEmptyRow,
  DATE_HEADERS,
  MEMBERSHIP_EXAMPLE_ROWS,
  MEMBERSHIP_HEADERS,
  prepareImportedRows,
  validateMembershipRows,
} from "./membershipImportConfig";
import {
  downloadWorkbook,
  readWorkbook,
} from "../../../services/imports/excelUtils";
import { importMembershipRows } from "../../../services/membership/importMembershipsService";

const QUICK_COLUMNS = [
  "Membership Number",
  "Record Type",
  "Branch Suffix",
  "Is Head",
  "Name",
  "Relationship to Head",
  "Gender",
  "Date of Birth",
  "Marital Status",
  "Date of Marriage",
  "Membership Status",
];

const SELECT_OPTIONS = {
  "Record Type": ["Membership", "Branch"],
  "Branch Suffix": [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
  "Is Head": ["Yes", "No"],
  "Relationship to Head": [
    "Spouse",
    "Parent",
    "Child",
    "Sibling",
    "Guardian",
    "Other",
  ],
  Gender: ["Male", "Female", "Other"],
  "Marital Status": ["Single", "Married", "Widowed", "Divorced"],
  "Baptism Status": ["Unknown", "Baptised", "Not Baptised"],
  Role: ["Head", "Member"],
  "Membership Status": ["Active", "Inactive", "Closed"],
};

const FIELD_SECTIONS = [
  {
    title: "Membership identity",
    fields: [
      "Membership Number",
      "Record Type",
      "Branch Suffix",
      "Is Head",
      "Membership Status",
      "Year Joined",
    ],
  },
  {
    title: "Personal details",
    fields: [
      "Name",
      "Relationship to Head",
      "Gender",
      "Date of Birth",
      "Marital Status",
      "Married To",
      "Date of Marriage",
      "Baptism Status",
      "Date of Baptism",
      "Occupation",
      "Role",
    ],
  },
  {
    title: "Personal contact",
    fields: ["Phone Number", "Email", "Fellowship / Groups"],
  },
  {
    title: "Household address",
    fields: [
      "Door Number",
      "Street Name",
      "Area",
      "City",
      "Pincode",
      "Landmark",
      "Primary Phone Number",
      "Alternate Phone Number",
      "Membership Email",
    ],
  },
];

function issueKey(issue) {
  return `${issue.index}:${issue.field}:${issue.message}`;
}

function FieldEditor({ field, value, onChange, issues }) {
  const options = SELECT_OPTIONS[field];
  const hasError = issues.some(
    (issue) => issue.type === "error" && issue.field === field,
  );
  const hasWarning = issues.some(
    (issue) => issue.type === "warning" && issue.field === field,
  );

  const inputClass = `mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-[#202127] outline-none transition focus:border-[#9aa8ed] ${
    hasError
      ? "border-red-300"
      : hasWarning
        ? "border-amber-300"
        : "border-[#e5e6eb]"
  }`;

  return (
    <label className="block min-w-0 text-xs font-semibold text-[#555762]">
      {field}

      {options ? (
        <select
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        >
          <option value="">Select…</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={
            DATE_HEADERS.includes(field)
              ? "date"
              : field === "Email" || field === "Membership Email"
                ? "email"
                : field.includes("Phone")
                  ? "tel"
                  : "text"
          }
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      )}

      {hasError && (
        <span className="mt-1 block font-normal text-red-600">
          {
            issues.find(
              (issue) => issue.type === "error" && issue.field === field,
            )?.message
          }
        </span>
      )}

      {!hasError && hasWarning && (
        <span className="mt-1 block font-normal text-amber-700">
          {
            issues.find(
              (issue) => issue.type === "warning" && issue.field === field,
            )?.message
          }
        </span>
      )}
    </label>
  );
}

export default function MembershipImportModal({ onClose }) {
  const fileInputRef = useRef(null);

  const [rows, setRows] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const validation = useMemo(() => validateMembershipRows(rows), [rows]);

  const issuesByRow = useMemo(() => {
    const map = new Map();

    for (const issue of [...validation.errors, ...validation.warnings]) {
      const list = map.get(issue.index) ?? [];
      list.push(issue);
      map.set(issue.index, list);
    }

    return map;
  }, [validation]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row, index }) => {
        const rowIssues = issuesByRow.get(index) ?? [];
        const hasErrors = rowIssues.some((issue) => issue.type === "error");
        const hasWarnings = rowIssues.some((issue) => issue.type === "warning");

        if (filter === "errors" && !hasErrors) return false;
        if (filter === "warnings" && !hasWarnings) return false;
        if (filter === "clean" && (hasErrors || hasWarnings)) {
          return false;
        }

        if (!query) return true;

        return MEMBERSHIP_HEADERS.some((header) =>
          String(row[header] ?? "")
            .toLowerCase()
            .includes(query),
        );
      });
  }, [rows, search, filter, issuesByRow]);

  const selectedRow = rows[selectedIndex] ?? null;
  const selectedIssues = issuesByRow.get(selectedIndex) ?? [];

  function updateCell(index, field, value) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );

    setError("");
    setMessage("");
  }

  function addRow() {
    const nextIndex = rows.length;

    setRows((current) => [...current, createEmptyRow()]);
    setSelectedIndex(nextIndex);
    setFilter("all");
    setMessage("Blank row added. Complete the required fields.");
    setError("");
  }

  function deleteRow(index) {
    const confirmed = window.confirm(
      `Remove spreadsheet row ${
        rows[index]?.__sourceRow ?? index + 2
      } from this import preview?`,
    );

    if (!confirmed) return;

    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));

    setSelectedIndex((current) => {
      if (index < current) return current - 1;
      if (index === current) return Math.max(0, current - 1);
      return current;
    });

    setError("");
    setMessage(
      "Row removed from the preview. Nothing has been deleted from Supabase.",
    );
  }

  async function handleFile(file) {
    if (!file) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const sourceRows = await readWorkbook(file);
      const preparedRows = prepareImportedRows(sourceRows);

      setRows(preparedRows);
      setSelectedIndex(0);
      setFilter("all");
      setSearch("");
      setFileName(file.name);
      setMessage(
        `${preparedRows.length} rows loaded. Review and correct them before importing.`,
      );
    } catch (err) {
      setError(err.message || "Unable to read this workbook.");
    } finally {
      setBusy(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function downloadCorrectedWorkbook() {
    if (!rows.length) return;

    downloadWorkbook(
      "church-desk-memberships-reviewed.xlsx",
      MEMBERSHIP_HEADERS,
      rows,
    );

    setMessage("Corrected workbook exported.");
  }

  function downloadTemplate() {
    downloadWorkbook(
      "church-desk-membership-template.xlsx",
      MEMBERSHIP_HEADERS,
      MEMBERSHIP_EXAMPLE_ROWS,
    );
  }

  function resetPreview() {
    if (
      rows.length &&
      !window.confirm(
        "Clear the current preview? Your edits will be discarded.",
      )
    ) {
      return;
    }

    setRows([]);
    setSelectedIndex(0);
    setFileName("");
    setFilter("all");
    setSearch("");
    setError("");
    setMessage("");
  }

  async function handleImportClick() {
    if (!rows.length || validation.errors.length || busy) return;

    setBusy(true);
    setError("");
    setMessage("Importing memberships in one database transaction…");

    try {
      const result = await importMembershipRows(rows);
      const imported = Number(result?.imported_rows ?? rows.length);
      const memberships = Number(result?.created_memberships ?? 0);

      setMessage(
        `Import completed successfully: ${imported} rows processed and ${memberships} new memberships created. All changes were committed together.`,
      );

      setRows([]);
      setSelectedIndex(0);
      setFileName("");
      setFilter("all");
      setSearch("");
    } catch (err) {
      setError(
        `${err?.message || "The import failed."} The transaction should roll back all import changes. Correct the issue and try again.`,
      );
      setMessage("");
    } finally {
      setBusy(false);
    }
  }

  const errorCount = validation.errors.length;
  const warningCount = validation.warnings.length;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111218]/60 p-2 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="membership-import-title"
        className="flex max-h-[96vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-[#e6e7eb] bg-[#f8f9fb] shadow-2xl"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8e9ee] bg-white px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf0ff] text-[#435ed4]">
              <FileSpreadsheet size={22} />
            </div>

            <div className="min-w-0">
              <h2
                id="membership-import-title"
                className="text-lg font-bold tracking-tight text-[#191a20]"
              >
                Import memberships
              </h2>
              <p className="mt-0.5 text-xs text-[#777984]">
                Upload, edit, validate and review before importing
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close membership import"
            className="rounded-lg p-2 text-[#777984] transition hover:bg-[#f1f2f5] disabled:opacity-40"
          >
            <X size={19} />
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-[#e8e9ee] bg-white px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-[#191a20] px-4 py-2.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            <Upload size={15} />
            {busy ? "Reading workbook…" : "Upload Excel"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />

          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e5e6eb] bg-white px-3 py-2.5 text-xs font-semibold text-[#444651] hover:bg-[#f6f7f9]"
          >
            <Download size={15} />
            Download template
          </button>

          <button
            type="button"
            onClick={addRow}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e5e6eb] bg-white px-3 py-2.5 text-xs font-semibold text-[#444651] hover:bg-[#f6f7f9] disabled:opacity-40"
          >
            <Plus size={15} />
            Add row
          </button>

          <button
            type="button"
            onClick={downloadCorrectedWorkbook}
            disabled={!rows.length || busy}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e5e6eb] bg-white px-3 py-2.5 text-xs font-semibold text-[#444651] hover:bg-[#f6f7f9] disabled:opacity-40"
          >
            <Save size={15} />
            Export reviewed Excel
          </button>

          <button
            type="button"
            onClick={resetPreview}
            disabled={!rows.length || busy}
            className="ml-auto rounded-xl px-3 py-2.5 text-xs font-semibold text-[#777984] hover:bg-[#f1f2f5] disabled:opacity-40"
          >
            Clear preview
          </button>
        </div>

        {fileName && (
          <div className="border-b border-[#e8e9ee] bg-[#f4f6ff] px-4 py-2 text-xs text-[#4a5eaf] sm:px-6">
            Loaded: <span className="font-semibold">{fileName}</span>
            <span className="mx-2">·</span>
            {rows.length} data rows
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 border-b border-[#e8e9ee] px-4 py-3 sm:grid-cols-4 sm:px-6">
          <SummaryCard label="Total rows" value={rows.length} />
          <SummaryCard label="Errors" value={errorCount} tone="error" />
          <SummaryCard label="Warnings" value={warningCount} tone="warning" />
          <SummaryCard
            label="Ready to review"
            value={rows.length > 0 && errorCount === 0 ? "Yes" : "Not yet"}
            tone={rows.length > 0 && errorCount === 0 ? "success" : "neutral"}
          />
        </div>

        {(error || message) && (
          <div
            role={error ? "alert" : "status"}
            className={`mx-4 mt-3 rounded-xl border px-3 py-2.5 text-xs leading-5 sm:mx-6 ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-[#dfe4fa] bg-[#f0f3ff] text-[#4658a6]"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="flex min-h-[300px] min-w-0 flex-col overflow-hidden border-b border-[#e8e9ee] xl:border-b-0 xl:border-r">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#e8e9ee] bg-white px-3 py-3 sm:px-4">
              <label className="relative min-w-[170px] flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9698a2]"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search records…"
                  className="h-9 w-full rounded-lg border border-[#e5e6eb] bg-white pl-9 pr-3 text-xs outline-none focus:border-[#aab4e8]"
                />
              </label>

              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="h-9 rounded-lg border border-[#e5e6eb] bg-white px-2 text-xs outline-none"
                aria-label="Filter import rows"
              >
                <option value="all">All rows</option>
                <option value="errors">Errors only</option>
                <option value="warnings">Warnings only</option>
                <option value="clean">No issues</option>
              </select>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {rows.length === 0 ? (
                <div className="flex h-full min-h-[300px] flex-col items-center justify-center px-6 text-center">
                  <FileSpreadsheet size={34} className="text-[#a1a4b0]" />
                  <p className="mt-3 text-sm font-semibold text-[#444651]">
                    No workbook loaded
                  </p>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-[#858792]">
                    Upload the membership Excel workbook to begin. You can edit
                    every field before anything is sent to the database.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                    className="mt-4 rounded-xl bg-[#191a20] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    Choose workbook
                  </button>
                </div>
              ) : (
                <table className="w-full min-w-[1250px] border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-[#f1f2f5] text-[10px] uppercase tracking-wide text-[#737681]">
                    <tr>
                      <th className="w-12 border-b border-r border-[#e4e5ea] px-3 py-3">
                        Row
                      </th>

                      {QUICK_COLUMNS.map((field) => (
                        <th
                          key={field}
                          className="border-b border-r border-[#e4e5ea] px-2 py-3"
                        >
                          {field}
                        </th>
                      ))}

                      <th className="border-b border-[#e4e5ea] px-2 py-3">
                        Issues
                      </th>
                      <th className="border-b border-[#e4e5ea] px-2 py-3">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleRows.map(({ row, index }) => {
                      const rowIssues = issuesByRow.get(index) ?? [];
                      const hasErrors = rowIssues.some(
                        (issue) => issue.type === "error",
                      );
                      const hasWarnings = rowIssues.some(
                        (issue) => issue.type === "warning",
                      );
                      const selected = selectedIndex === index;

                      return (
                        <tr
                          key={`${row.__sourceRow ?? "new"}-${index}`}
                          className={`${
                            selected
                              ? "bg-[#edf1ff]"
                              : hasErrors
                                ? "bg-red-50/60"
                                : "bg-white"
                          } hover:bg-[#f5f6ff]`}
                          onClick={() => setSelectedIndex(index)}
                        >
                          <td className="border-b border-r border-[#ececf0] px-3 py-2 font-mono text-[#858792]">
                            {row.__sourceRow ?? "New"}
                          </td>

                          {QUICK_COLUMNS.map((field) => {
                            const fieldError = rowIssues.some(
                              (issue) =>
                                issue.type === "error" && issue.field === field,
                            );

                            return (
                              <td
                                key={field}
                                className="border-b border-r border-[#ececf0] p-1"
                              >
                                {SELECT_OPTIONS[field] ? (
                                  <select
                                    value={row[field] ?? ""}
                                    aria-label={`${field}, row ${index + 1}`}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) =>
                                      updateCell(
                                        index,
                                        field,
                                        event.target.value,
                                      )
                                    }
                                    className={`w-full min-w-[95px] rounded-md border bg-white px-2 py-2 outline-none focus:border-[#8d9ce8] ${
                                      fieldError
                                        ? "border-red-300"
                                        : "border-transparent"
                                    }`}
                                  >
                                    <option value="">—</option>
                                    {SELECT_OPTIONS[field].map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    value={row[field] ?? ""}
                                    type={
                                      DATE_HEADERS.includes(field)
                                        ? "date"
                                        : "text"
                                    }
                                    aria-label={`${field}, row ${index + 1}`}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) =>
                                      updateCell(
                                        index,
                                        field,
                                        event.target.value,
                                      )
                                    }
                                    className={`w-full min-w-[110px] rounded-md border bg-white px-2 py-2 outline-none focus:border-[#8d9ce8] ${
                                      fieldError
                                        ? "border-red-300"
                                        : "border-transparent"
                                    }`}
                                  />
                                )}
                              </td>
                            );
                          })}

                          <td className="border-b border-r border-[#ececf0] px-2 py-2">
                            {hasErrors ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-[10px] font-semibold text-red-700">
                                <AlertTriangle size={12} />
                                {
                                  rowIssues.filter(
                                    (issue) => issue.type === "error",
                                  ).length
                                }
                              </span>
                            ) : hasWarnings ? (
                              <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-800">
                                {
                                  rowIssues.filter(
                                    (issue) => issue.type === "warning",
                                  ).length
                                }{" "}
                                warning
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                                <Check size={12} />
                                Clear
                              </span>
                            )}
                          </td>

                          <td className="border-b border-[#ececf0] px-2 py-2">
                            <button
                              type="button"
                              aria-label={`Delete row ${index + 1}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteRow(index);
                              }}
                              disabled={busy}
                              className="rounded-md p-2 text-[#888a94] hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {rows.length > 0 && visibleRows.length === 0 && (
                <div className="p-8 text-center text-xs text-[#777984]">
                  No rows match this filter.
                </div>
              )}
            </div>

            {rows.length > 0 && (
              <div className="border-t border-[#e8e9ee] bg-white px-4 py-2 text-[11px] text-[#777984]">
                Showing {visibleRows.length} of {rows.length} rows. Select any
                row and edit cells directly.
              </div>
            )}
          </div>

          <aside className="min-h-0 overflow-auto bg-[#f8f9fb]">
            <div className="sticky top-0 z-[1] border-b border-[#e8e9ee] bg-[#f8f9fb] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#697bd0]">
                    Record editor
                  </p>
                  <h3 className="mt-1 text-sm font-bold text-[#202127]">
                    {selectedRow?.Name || "Select a record"}
                  </h3>
                </div>

                {selectedRow && (
                  <span className="rounded-full border border-[#e2e4ec] bg-white px-2.5 py-1 font-mono text-[10px] text-[#777984]">
                    Row {selectedRow.__sourceRow ?? selectedIndex + 2}
                  </span>
                )}
              </div>
            </div>

            {!selectedRow ? (
              <p className="p-5 text-xs leading-5 text-[#777984]">
                Upload a workbook or add a row, then select it to edit every
                field.
              </p>
            ) : (
              <div className="space-y-5 p-4">
                {FIELD_SECTIONS.map((section) => (
                  <section key={section.title}>
                    <h4 className="mb-3 border-b border-[#e6e7ec] pb-2 text-xs font-bold text-[#41434d]">
                      {section.title}
                    </h4>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      {section.fields.map((field) => (
                        <FieldEditor
                          key={field}
                          field={field}
                          value={selectedRow[field]}
                          onChange={(value) =>
                            updateCell(selectedIndex, field, value)
                          }
                          issues={selectedIssues}
                        />
                      ))}
                    </div>
                  </section>
                ))}

                <section className="rounded-xl border border-[#e5e6eb] bg-white p-3">
                  <h4 className="text-xs font-bold text-[#41434d]">
                    Validation for this row
                  </h4>

                  {selectedIssues.length === 0 ? (
                    <p className="mt-2 flex items-center gap-2 text-xs text-emerald-700">
                      <Check size={14} />
                      No detected issues.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {selectedIssues.map((issue) => (
                        <li
                          key={issueKey(issue)}
                          className={`flex gap-2 text-xs leading-5 ${
                            issue.type === "error"
                              ? "text-red-700"
                              : "text-amber-800"
                          }`}
                        >
                          <AlertTriangle
                            size={13}
                            className="mt-0.5 shrink-0"
                          />
                          <span>
                            <strong>{issue.field}:</strong> {issue.message}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <button
                  type="button"
                  onClick={() => deleteRow(selectedIndex)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  <Trash2 size={14} />
                  Remove this row
                </button>
              </div>
            )}
          </aside>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8e9ee] bg-white px-4 py-3 sm:px-6">
          <p className="max-w-2xl text-[11px] leading-5 text-[#777984]">
            Edits remain in this preview until you export or import. No database
            records are changed by editing this screen.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-[#e5e6eb] bg-white px-4 py-2.5 text-xs font-semibold text-[#555762] hover:bg-[#f6f7f9] disabled:opacity-40"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleImportClick}
              disabled={!rows.length || errorCount > 0 || busy}
              title={
                errorCount > 0
                  ? "Resolve validation errors before importing."
                  : "Import all reviewed rows in one database transaction."
              }
              className="rounded-xl bg-[#191a20] px-5 py-2.5 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy
                ? "Importing…"
                : `Import ${rows.length ? `${rows.length} rows` : ""}`}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, tone = "neutral" }) {
  const toneClass = {
    neutral: "text-[#202127]",
    error: "text-red-600",
    warning: "text-amber-700",
    success: "text-emerald-700",
  }[tone];

  return (
    <div className="rounded-xl border border-[#e8e9ee] bg-white px-3 py-2.5">
      <p className="text-[10px] font-medium text-[#858792]">{label}</p>
      <p className={`mt-1 text-lg font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
