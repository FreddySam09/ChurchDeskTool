import { supabase } from "../../lib/supabase";
import { getChurchGroups } from "./groupService";
import {
  parseGroupNames,
  formatTitleCase,
  normalizeMaritalStatus,
} from "../../features/membership/import/membershipImportConfig";

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeGroupName(value) {
  return clean(value).replace(/\s+/g, " ").toLocaleLowerCase();
}

// These fields are standardised both on Excel upload and immediately
// before database insertion, including values edited in the preview.
const TITLE_CASE_FIELDS = [
  "Name",
  "Married To",
  "Occupation",
  "Street Name",
  "Area",
  "City",
  "Landmark",
];

function normalizeMembershipRow(row) {
  const normalized = { ...row };

  for (const field of TITLE_CASE_FIELDS) {
    normalized[field] = formatTitleCase(normalized[field]);
  }

  normalized["Marital Status"] = normalizeMaritalStatus(
    normalized["Marital Status"],
  );

  return normalized;
}

/**
 * Fetch all groups, including inactive ones, for import validation.
 */
export async function getMembershipImportGroupCatalog() {
  const groups = await getChurchGroups({ activeOnly: false });

  return (groups ?? []).map((group) => ({
    id: group.id,
    name: clean(group.name),
    groupType: group.group_type ?? "",
    status: group.group_status ?? "",
    active: group.group_status === "Active",
  }));
}

/**
 * Import reviewed membership rows in one PostgreSQL transaction.
 *
 * Only active registered Fellowships and Groups are accepted.
 * Name-like fields are standardised immediately before import.
 */
export async function importMembershipRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("There are no rows to import.");
  }

  const groups = await getChurchGroups({ activeOnly: true });
  const groupsByName = new Map();

  for (const group of groups ?? []) {
    const key = normalizeGroupName(group.name);

    if (groupsByName.has(key)) {
      throw new Error(
        `More than one active church group is named "${group.name}". Resolve duplicate group names before importing.`,
      );
    }

    groupsByName.set(key, group);
  }

  const payloadRows = rows.map((row, index) => {
    // Apply title case even if the user manually edited the preview.
    const normalizedRow = normalizeMembershipRow(row);

    const groupNames = parseGroupNames(
      normalizedRow["Fellowship / Groups"],
    );

    const groupIds = [];
    const unknownNames = [];

    for (const name of groupNames) {
      const group = groupsByName.get(normalizeGroupName(name));

      if (!group) {
        unknownNames.push(name);
      } else if (!groupIds.includes(group.id)) {
        groupIds.push(group.id);
      }
    }

    if (unknownNames.length > 0) {
      const rowNumber = row.__sourceRow ?? index + 2;
      const memberName = clean(normalizedRow.Name) || "unnamed member";

      throw new Error(
        `Row ${rowNumber} (${memberName}): unregistered or inactive Fellowship / Group name(s): ${unknownNames.join(", ")}. Correct them in the preview and try again.`,
      );
    }

    const payload = {
      ...normalizedRow,
      "Marital Status": normalizedRow["Marital Status"] || null,
      "Year Joined": clean(normalizedRow["Year Joined"])
        ? Number(clean(normalizedRow["Year Joined"]))
        : null,
      group_ids: groupIds,
    };

    delete payload.__sourceRow;

    return payload;
  });

  const { data, error } = await supabase.rpc(
    "import_memberships_transactional",
    {
      p_rows: payloadRows,
    },
  );

  if (error) {
    throw new Error(
      error.message ||
        "The membership import failed. The database transaction was rolled back.",
    );
  }

  if (!data || data.success !== true) {
    throw new Error(
      "The import did not return a successful result. Check Supabase before retrying.",
    );
  }

  return data;
}