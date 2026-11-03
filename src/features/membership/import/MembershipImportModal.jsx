
import { useEffect, useMemo, useRef, useState } from "react";
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
  parseGroupNames,
  formatGroupNames,
  prepareImportedRows,
  validateMembershipRows,
} from "./membershipImportConfig";

import {
  downloadWorkbook,
  readWorkbook,
} from "../../../services/imports/excelUtils";

import {
  getMembershipImportGroupCatalog,
  importMembershipRows,
} from "../../../services/membership/importMembershipsService";

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
  "Fellowship / Groups",
];

const SELECT_OPTIONS = {
  "Record Type": ["Membership", "Branch"],
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
  "Marital Status": [
    "Unmarried",
    "Married",
    "Widowed",
    "Divorced",
    "Separated",
    "Unknown",
  ],
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
    fields: ["Phone Number", "Email"],
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

function normalizeName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function issueKey(issue) {
  return `${issue.index}:${issue.field}:${issue.message}`;
}

function FieldEditor({ field, value, onChange, issues, disabled }) {
  const options = SELECT_OPTIONS[field];
  const fieldIssues = issues.filter((issue) => issue.field === field);
  const hasError = fieldIssues.length > 0;

  const inputClass = `mt-1.5 w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-[#202127] outline-none transition focus:border-[#9aa8ed] disabled:bg-[#f4f4f5] ${
    hasError ? "border-red-300" : "border-[#e5e6eb]"
  }`;

  return (
    <label className="block min-w-0 text-xs font-semibold text-[#555762]">
      {field}

      {options ? (
        <select
          value={value ?? ""}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        >
          <option value="">Select...</option>
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
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      )}

      {fieldIssues.map((issue) => (
        <span
          key={issueKey(issue)}
          className="mt-1 block font-normal leading-4 text-red-600"
        >
          {issue.message}
        </span>
      ))}
    </label>
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

  const [groupCatalog, setGroupCatalog] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadGroups() {
      setGroupsLoading(true);
      setGroupsError("");

      try {
        const groups = await getMembershipImportGroupCatalog();

        if (!cancelled) setGroupCatalog(groups ?? []);
      } catch (err) {
        if (!cancelled) {
          setGroupsError(
            err?.message ||
              "Unable to load registered Fellowships and Groups.",
          );
        }
      } finally {
        if (!cancelled) setGroupsLoading(false);
      }
    }

    loadGroups();

    return () => {
      cancelled = true;
    };
  }, []);

  // All Fellowship / Group validation is treated as a normal error.
  const validation = useMemo(() => {
    const base = validateMembershipRows(rows);
    const groupErrors = [];

    rows.forEach((row, index) => {
      const names = parseGroupNames(row["Fellowship / Groups"]);

      names.forEach((name) => {
        const matched = groupCatalog.find(
          (group) => normalizeName(group.name) === normalizeName(name),
        );

        if (!matched) {
          groupErrors.push({
            type: "error",
            index,
            sourceRow: row.__sourceRow ?? index + 2,
            field: "Fellowship / Groups",
            message: `"${name}" is not registered in Church Desk.`,
            groupName: name,
            issueType: "unknown-group",
          });
        } else if (!matched.active) {
          groupErrors.push({
            type: "error",
            index,
            sourceRow: row.__sourceRow ?? index + 2,
            field: "Fellowship / Groups",
            message: `"${name}" exists but is inactive.`,
            groupName: name,
            issueType: "inactive-group",
          });
        }
      });
    });

    return {
      errors: [...base.errors, ...groupErrors],
      warnings: base.warnings,
    };
  }, [rows, groupCatalog]);

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
        const hasErrors = rowIssues.some(
          (issue) => issue.type === "error",
        );
        const hasWarnings = rowIssues.some(
          (issue) => issue.type === "warning",
        );

        if (filter === "errors" && !hasErrors) return false;
        if (filter === "warnings" && !hasWarnings) return false;
        if (filter === "clean" && (hasErrors || hasWarnings)) return false;

        if (!query) return true;

        return MEMBERSHIP_HEADERS.some((header) =>
          String(row[header] ?? "").toLowerCase().includes(query),
        );
      });
  }, [rows, search, filter, issuesByRow]);

  const selectedRow = rows[selectedIndex] ?? null;
  const selectedIssues = issuesByRow.get(selectedIndex) ?? [];

  const errorCount = validation.errors.length;
  const warningCount = validation.warnings.length;

  const canImport =
    rows.length > 0 &&
    errorCount === 0 &&
    !groupsLoading &&
    !groupsError &&
    !busy;

  function updateCell(index, field, value) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );

    setError("");
    setMessage("");
  }

  function getGroupSuggestions(name) {
    const query = normalizeName(name);
    if (!query) return [];

    return groupCatalog
      .filter((group) => group.active)
      .map((group) => {
        const candidate = normalizeName(group.name);

        const score =
          candidate === query
            ? 3
            : candidate.includes(query) || query.includes(candidate)
              ? 2
              : candidate
                  .split(/\s+/)
                  .some((word) => query.includes(word))
                ? 1
                : 0;

        return { ...group, score };
      })
      .filter((group) => group.score > 0)
      .sort(
        (a, b) => b.score - a.score || a.name.localeCompare(b.name),
      )
      .slice(0, 5);
  }

  function replaceGroupName(index, oldName, newName, applyToAll = false) {
    const oldKey = normalizeName(oldName);

    setRows((current) =>
      current.map((row, rowIndex) => {
        if (!applyToAll && rowIndex !== index) return row;

        const updated = parseGroupNames(row["Fellowship / Groups"]).map(
          (name) => (normalizeName(name) === oldKey ? newName : name),
        );

        return {
          ...row,
          "Fellowship / Groups": formatGroupNames(updated),
        };
      }),
    );

    setError("");
    setMessage(
      applyToAll
        ? `"${oldName}" was replaced throughout the workbook.`
        : `"${oldName}" was replaced with "${newName}".`,
    );
  }

  function removeGroupName(index, name, applyToAll = false) {
    const oldKey = normalizeName(name);

    setRows((current) =>
      current.map((row, rowIndex) => {
        if (!applyToAll && rowIndex !== index) return row;

        const updated = parseGroupNames(
          row["Fellowship / Groups"],
        ).filter((item) => normalizeName(item) !== oldKey);

        return {
          ...row,
          "Fellowship / Groups": formatGroupNames(updated),
        };
      }),
    );

    setError("");
    setMessage(
      applyToAll
        ? `"${name}" was removed throughout the workbook.`
        : `"${name}" was removed from this member.`,
    );
  }

  function addRow() {
    const nextIndex = rows.length;

    setRows((current) => [
      ...current,
      {
        ...createEmptyRow(),
        __sourceRow: `New ${nextIndex + 1}`,
      },
    ]);

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

    setRows((current) =>
      current.filter((_, rowIndex) => rowIndex !== index),
    );

    setSelectedIndex((current) => {
      if (index < current) return current - 1;
      if (index === current) return Math.max(0, current - 1);
      return current;
    });

    setError("");
    setMessage(
      "Row removed from the preview. No database records were deleted.",
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
      if (fileInputRef.current) fileInputRef.current.value = "";
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
    if (!canImport) return;

    setBusy(true);
    setError("");
    setMessage("Importing memberships in one database transaction...");

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

  function chooseAnotherRegisteredName(name) {
    const replacement = window.prompt(
      `Replace "${name}" with which registered group name?`,
    );

    if (!replacement?.trim()) return;

    const exactMatch = groupCatalog.find(
      (group) =>
        group.active &&
        normalizeName(group.name) === normalizeName(replacement),
    );

    if (!exactMatch) {
      window.alert(
        "Enter the exact name of an active registered Fellowship or Group.",
      );
      return;
    }

    replaceGroupName(selectedIndex, name, exactMatch.name);
  }

  function GroupEditor() {
    if (!selectedRow) return null;

    const selectedGroups = parseGroupNames(
      selectedRow["Fellowship / Groups"],
    );

    const unmatchedGroups = selectedGroups.filter((name) => {
      const group = groupCatalog.find(
        (item) => normalizeName(item.name) === normalizeName(name),
      );

      return !group || !group.active;
    });

    const groupIssues = selectedIssues.filter(
      (issue) => issue.field === "Fellowship / Groups",
    );

    return (
      <section
        className={`rounded-xl border bg-white p-4 ${
          groupIssues.length ? "border-red-300" : "border-[#e5e6eb]"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-[#30313a]">
              Fellowship / Groups
            </h4>
            <p className="mt-1 text-[11px] text-[#858792]">
              Edit the memberships assigned to this person.
            </p>
          </div>

          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
              groupIssues.length
                ? "bg-red-100 text-red-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {groupIssues.length
              ? `${groupIssues.length} error(s)`
              : `${selectedGroups.length} selected`}
          </span>
        </div>

        {groupsLoading && (
          <p className="mt-3 text-xs text-[#858792]">
            Loading registered Fellowships and Groups...
          </p>
        )}

        {groupsError && (
          <p className="mt-3 text-xs text-red-600">{groupsError}</p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {selectedGroups.map((name) => {
            const group = groupCatalog.find(
              (item) => normalizeName(item.name) === normalizeName(name),
            );
            const valid = group?.active === true;

            return (
              <span
                key={name}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                  valid
                    ? "border-[#dce8df] bg-[#f3f8f4] text-[#356b45]"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {name}

                {!group && (
                  <strong className="text-[9px]">NOT FOUND</strong>
                )}

                {group && !group.active && (
                  <strong className="text-[9px]">INACTIVE</strong>
                )}

                <button
                  type="button"
                  disabled={busy}
                  title={`Remove ${name}`}
                  onClick={() => removeGroupName(selectedIndex, name)}
                  className="rounded p-0.5 hover:bg-black/5"
                >
                  <X size={13} />
                </button>
              </span>
            );
          })}

          {selectedGroups.length === 0 && (
            <p className="text-xs text-[#858792]">
              No Fellowships or Groups assigned.
            </p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#555762]">
              Add a registered Fellowship or Group
            </label>

            <select
              value=""
              disabled={busy || groupsLoading || !!groupsError}
              onChange={(event) => {
                const name = event.target.value;
                if (!name) return;

                updateCell(
                  selectedIndex,
                  "Fellowship / Groups",
                  formatGroupNames([...selectedGroups, name]),
                );
              }}
              className="w-full rounded-lg border border-[#e5e6eb] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#9aa8ed]"
            >
              <option value="">Choose a registered group...</option>

              {groupCatalog
                .filter(
                  (group) =>
                    group.active &&
                    !selectedGroups.some(
                      (name) =>
                        normalizeName(name) === normalizeName(group.name),
                    ),
                )
                .map((group) => (
                  <option key={group.id} value={group.name}>
                    {group.name}
                    {group.groupType ? ` (${group.groupType})` : ""}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#555762]">
              Edit the complete cell manually
            </label>

            <textarea
              rows={3}
              value={selectedRow["Fellowship / Groups"] ?? ""}
              disabled={busy}
              onChange={(event) =>
                updateCell(
                  selectedIndex,
                  "Fellowship / Groups",
                  event.target.value,
                )
              }
              onBlur={(event) =>
                updateCell(
                  selectedIndex,
                  "Fellowship / Groups",
                  formatGroupNames(event.target.value),
                )
              }
              placeholder="Men's Fellowship; Choir; Prayer Group"
              className={`w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-sm outline-none focus:border-[#9aa8ed] ${
                groupIssues.length ? "border-red-300" : "border-[#e5e6eb]"
              }`}
            />

            <p className="mt-1 text-[10px] text-[#858792]">
              Separate multiple names with semicolons, commas or new lines.
            </p>
          </div>
        </div>

        {groupIssues.map((issue) => (
          <p
            key={issueKey(issue)}
            className="mt-2 flex items-start gap-2 text-xs leading-5 text-red-600"
          >
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            {issue.message}
          </p>
        ))}

        {unmatchedGroups.length > 0 && (
          <div className="mt-4 space-y-3 border-t border-red-100 pt-4">
            <p className="text-xs font-bold text-red-700">
              Correct these unregistered or inactive entries
            </p>

            {unmatchedGroups.map((name) => {
              const suggestions = getGroupSuggestions(name);

              return (
                <div
                  key={name}
                  className="rounded-lg border border-red-200 bg-red-50/60 p-3"
                >
                  <p className="text-xs font-semibold text-red-800">
                    {name}
                  </p>

                  {suggestions.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-[10px] text-red-700">
                        Suggested registered matches:
                      </p>

                      {suggestions.map((suggestion) => (
                        <div
                          key={suggestion.id}
                          className="flex flex-wrap items-center justify-between gap-2"
                        >
                          <span className="text-xs text-[#41434d]">
                            {suggestion.name}
                          </span>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              replaceGroupName(
                                selectedIndex,
                                name,
                                suggestion.name,
                              )
                            }
                            className="rounded-md bg-white px-3 py-1.5 text-[10px] font-semibold text-[#435ed4] hover:bg-[#edf0ff]"
                          >
                            Replace
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] text-red-700">
                      No close match found. Edit the cell manually or remove
                      this entry.
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => chooseAnotherRegisteredName(name)}
                      className="text-[10px] font-semibold text-[#435ed4] hover:underline"
                    >
                      Choose another registered name
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove "${name}" from this member's import row?`,
                          )
                        ) {
                          removeGroupName(selectedIndex, name);
                        }
                      }}
                      className="text-[10px] font-semibold text-red-600 hover:underline"
                    >
                      Remove entry
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const replacement = window.prompt(
                          `Replace "${name}" throughout the workbook with which registered group name?`,
                        );

                        if (!replacement?.trim()) return;

                        const exactMatch = groupCatalog.find(
                          (group) =>
                            group.active &&
                            normalizeName(group.name) ===
                              normalizeName(replacement),
                        );

                        if (!exactMatch) {
                          window.alert(
                            "Enter the exact name of an active registered Fellowship or Group.",
                          );
                          return;
                        }

                        replaceGroupName(
                          selectedIndex,
                          name,
                          exactMatch.name,
                          true,
                        );
                      }}
                      className="text-[10px] font-semibold text-[#435ed4] hover:underline"
                    >
                      Replace throughout workbook
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove "${name}" wherever it appears in the workbook?`,
                          )
                        ) {
                          removeGroupName(selectedIndex, name, true);
                        }
                      }}
                      className="text-[10px] font-semibold text-red-600 hover:underline"
                    >
                      Remove throughout workbook
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111218]/60 p-2 backdrop-blur-sm sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="membership-import-title"
        className="flex max-h-[97vh] w-full max-w-[1700px] flex-col overflow-hidden rounded-2xl border border-[#e6e7eb] bg-[#f8f9fb] shadow-2xl"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8e9ee] bg-white px-5 py-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf0ff] text-[#435ed4]">
              <FileSpreadsheet size={22} />
            </div>

            <div>
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
            className="rounded-lg p-2 text-[#777984] hover:bg-[#f1f2f5] disabled:opacity-40"
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
            {busy ? "Reading workbook..." : "Upload Excel"}
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
          <SummaryCard
            label="Warnings"
            value={warningCount}
            tone="warning"
          />
          <SummaryCard
            label="Ready to import"
            value={rows.length > 0 && canImport ? "Yes" : "Not yet"}
            tone={rows.length > 0 && canImport ? "success" : "neutral"}
          />
        </div>

        {(error || message || groupsError) && (
          <div
            role={error || groupsError ? "alert" : "status"}
            className={`mx-4 mt-3 rounded-xl border px-3 py-2.5 text-xs leading-5 sm:mx-6 ${
              error || groupsError
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-[#dfe4fa] bg-[#f0f3ff] text-[#4658a6]"
            }`}
          >
            {error || groupsError || message}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-[#e8e9ee] bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#e8e9ee] px-4 py-3 sm:px-6">
              <div className="relative min-w-[200px] flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9698a2]"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search records..."
                  className="h-9 w-full rounded-lg border border-[#e5e6eb] bg-white pl-9 pr-3 text-xs outline-none focus:border-[#aab4e8]"
                />
              </div>

              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="h-9 rounded-lg border border-[#e5e6eb] bg-white px-3 text-xs outline-none"
                aria-label="Filter import rows"
              >
                <option value="all">All rows</option>
                <option value="errors">Errors only</option>
                <option value="warnings">Warnings only</option>
                <option value="clean">No issues</option>
              </select>

              <p className="text-[11px] text-[#858792]">
                Select a row to edit its complete details below.
              </p>
            </div>

            {rows.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
                <FileSpreadsheet size={36} className="text-[#a1a4b0]" />
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
              <div className="max-h-[42vh] overflow-auto">
                <table className="w-full min-w-[1650px] border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-[#f1f2f5] text-[10px] uppercase tracking-wide text-[#737681]">
                    <tr>
                      <th className="sticky left-0 z-20 w-20 border-b border-r border-[#e4e5ea] bg-[#f1f2f5] px-3 py-3">
                        Row
                      </th>

                      {QUICK_COLUMNS.map((field) => (
                        <th
                          key={field}
                          className={`border-b border-r border-[#e4e5ea] px-3 py-3 ${
                            field === "Fellowship / Groups"
                              ? "min-w-[240px]"
                              : "min-w-[125px]"
                          }`}
                        >
                          {field}
                        </th>
                      ))}

                      <th className="min-w-[130px] border-b border-r border-[#e4e5ea] px-3 py-3">
                        Issues
                      </th>
                      <th className="w-16 border-b border-[#e4e5ea] px-3 py-3">
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
                          className={`cursor-pointer ${
                            selected
                              ? "bg-[#edf1ff]"
                              : hasErrors
                                ? "bg-red-50/70"
                                : "bg-white"
                          } hover:bg-[#f5f6ff]`}
                          onClick={() => setSelectedIndex(index)}
                        >
                          <td
                            className={`sticky left-0 z-[1] border-b border-r border-[#ececf0] px-3 py-3 font-mono ${
                              selected
                                ? "bg-[#edf1ff]"
                                : hasErrors
                                  ? "bg-red-50"
                                  : "bg-white"
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              {hasErrors && (
                                <AlertTriangle
                                  size={13}
                                  className="shrink-0 text-red-600"
                                />
                              )}
                              <span className="text-[#858792]">
                                {row.__sourceRow ?? index + 2}
                              </span>
                            </div>
                          </td>

                          {QUICK_COLUMNS.map((field) => {
                            const fieldError = rowIssues.some(
                              (issue) =>
                                issue.type === "error" &&
                                issue.field === field,
                            );

                            return (
                              <td
                                key={field}
                                className="border-b border-r border-[#ececf0] p-1.5"
                              >
                                {field === "Fellowship / Groups" ? (
  <div className="min-w-[240px]">
    <textarea
      rows={2}
      value={row[field] ?? ""}
      disabled={busy}
      placeholder="Enter Fellowship / Group names"
      aria-label={`Fellowship / Groups, row ${index + 1}`}
      onClick={(event) => {
        event.stopPropagation();
        setSelectedIndex(index);
      }}
      onFocus={() => setSelectedIndex(index)}
      onChange={(event) =>
        updateCell(index, "Fellowship / Groups", event.target.value)
      }
      onBlur={(event) =>
        updateCell(
          index,
          "Fellowship / Groups",
          formatGroupNames(event.target.value),
        )
      }
      className={`w-full min-h-[48px] resize-y rounded-md border px-2 py-2 text-xs outline-none transition focus:ring-2 focus:ring-[#9aa8ed]/30 ${
        fieldError
          ? "border-red-300 bg-red-50 text-red-700"
          : "border-[#e5e6eb] bg-white text-[#41434d]"
      }`}
    />

    {fieldError && (
      <span className="mt-1 block text-[10px] font-semibold text-red-600">
        Correct this value
      </span>
    )}
  </div>
) : SELECT_OPTIONS[field] ? (
                                  <select
                                    value={row[field] ?? ""}
                                    aria-label={`${field}, row ${index + 1}`}
                                    onClick={(event) =>
                                      event.stopPropagation()
                                    }
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
                                    onClick={(event) =>
                                      event.stopPropagation()
                                    }
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

                          <td className="border-b border-r border-[#ececf0] px-3 py-2">
                            {hasErrors ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-[10px] font-semibold text-red-700">
                                  <AlertTriangle size={12} />
                                  {rowIssues.filter(
                                    (issue) => issue.type === "error",
                                  ).length}{" "}
                                  error(s)
                                </span>
                                {rowIssues
                                  .filter((issue) => issue.type === "error")
                                  .map((issue) => (
                                    <p
                                      key={issueKey(issue)}
                                      className="max-w-[230px] text-[10px] leading-4 text-red-700"
                                    >
                                      {issue.field}: {issue.message}
                                    </p>
                                  ))}
                              </div>
                            ) : hasWarnings ? (
                              <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-800">
                                {rowIssues.filter(
                                  (issue) => issue.type === "warning",
                                ).length}{" "}
                                warning(s)
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

                {visibleRows.length === 0 && (
                  <div className="p-8 text-center text-xs text-[#777984]">
                    No rows match this filter.
                  </div>
                )}
              </div>
            )}

            {rows.length > 0 && (
              <div className="border-t border-[#e8e9ee] bg-white px-4 py-2 text-[11px] text-[#777984]">
                Showing {visibleRows.length} of {rows.length} rows.
                Fellowship / Groups errors are shown in red against their
                corresponding row.
              </div>
            )}
          </div>

          {selectedRow && (
            <section className="space-y-5 px-4 py-5 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#697bd0]">
                    Full-width record editor
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-[#202127]">
                    {selectedRow.Name || "Unnamed member"}
                  </h3>
                  <p className="mt-1 text-xs text-[#858792]">
                    Editing spreadsheet row{" "}
                    {selectedRow.__sourceRow ?? selectedIndex + 2}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={selectedIndex === 0}
                    onClick={() =>
                      setSelectedIndex((current) => current - 1)
                    }
                    className="rounded-lg border border-[#e5e6eb] bg-white px-3 py-2 text-xs font-semibold text-[#555762] disabled:opacity-40"
                  >
                    Previous row
                  </button>
                  <button
                    type="button"
                    disabled={selectedIndex >= rows.length - 1}
                    onClick={() =>
                      setSelectedIndex((current) => current + 1)
                    }
                    className="rounded-lg border border-[#e5e6eb] bg-white px-3 py-2 text-xs font-semibold text-[#555762] disabled:opacity-40"
                  >
                    Next row
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRow(selectedIndex)}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                    Remove row
                  </button>
                </div>
              </div>

              {selectedIssues.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-red-700">
                    <AlertTriangle size={16} />
                    {selectedIssues.filter(
                      (issue) => issue.type === "error",
                    ).length}{" "}
                    error(s) in this row
                  </div>

                  <ul className="mt-2 space-y-1.5">
                    {selectedIssues.map((issue) => (
                      <li
                        key={issueKey(issue)}
                        className={`text-xs leading-5 ${
                          issue.type === "error"
                            ? "text-red-700"
                            : "text-amber-800"
                        }`}
                      >
                        <strong>{issue.field}:</strong> {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {FIELD_SECTIONS.map((section) => (
                <section
                  key={section.title}
                  className="rounded-xl border border-[#e5e6eb] bg-white p-4 sm:p-5"
                >
                  <h4 className="mb-4 border-b border-[#e6e7ec] pb-3 text-sm font-bold text-[#41434d]">
                    {section.title}
                  </h4>

                  <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {section.fields.map((field) => (
                      <FieldEditor
                        key={field}
                        field={field}
                        value={selectedRow[field]}
                        disabled={busy}
                        onChange={(value) =>
                          updateCell(selectedIndex, field, value)
                        }
                        issues={selectedIssues}
                      />
                    ))}
                  </div>
                </section>
              ))}

              <GroupEditor />
            </section>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8e9ee] bg-white px-4 py-3 sm:px-6">
          <p className="max-w-2xl text-[11px] leading-5 text-[#777984]">
            Edits remain in this preview until you export or import. No
            database records are changed by editing this screen.
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
              disabled={!canImport}
              title={
                groupsLoading
                  ? "Loading registered Fellowships and Groups."
                  : groupsError
                    ? "Unable to verify registered groups."
                    : errorCount > 0
                      ? "Resolve validation errors before importing."
                      : "Import all reviewed rows in one database transaction."
              }
              className="rounded-xl bg-[#191a20] px-5 py-2.5 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy
                ? "Importing..."
                : `Import ${rows.length ? `${rows.length} rows` : ""}`}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
