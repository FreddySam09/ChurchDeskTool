
import { supabase } from "../../../lib/supabase";
import { getMemberDirectory } from "../../../services/membership/memberService";
import { REPORT_SOURCES } from "../config/reportSources";

function unwrap({ data, error }) {
  if (error) throw error;
  return data ?? [];
}

function getAge(dateOfBirth) {
  if (!dateOfBirth) return null;

  const birthDate = new Date(`${String(dateOfBirth).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();

  if (
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function monthFromDate(value) {
  if (!value) return null;

  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getMonth() + 1;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function normaliseMonth(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return null;

  const numericMonth = Number(text);
  if (Number.isInteger(numericMonth) && numericMonth >= 1 && numericMonth <= 12) {
    return numericMonth;
  }

  const index = MONTH_NAMES.findIndex((month) =>
    month.toLowerCase().startsWith(text),
  );

  return index === -1 ? null : index + 1;
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map(String))];
}

async function loadMembers() {
  const members = await getMemberDirectory();

  return members.map((member) => {
    const groups = Array.isArray(member.groups) ? member.groups : [];

    return {
      ...member,
      birth_month: monthFromDate(member.date_of_birth),
      age: getAge(member.date_of_birth),
      group_names: uniqueStrings(groups.map((group) => group.name)).join(", "),
      group_roles: uniqueStrings(groups.map((group) => group.role)).join(", "),
      group_ids: uniqueStrings(groups.map((group) => group.id)),
    };
  });
}

async function loadMemberships() {
  const [membershipResult, memberResult, assignmentResult] = await Promise.all([
    supabase
      .from("memberships")
      .select("*")
      .order("membership_number", { ascending: true }),
    supabase.from("members").select("id, person_id, name, phone_number, email"),
    supabase
      .from("membership_structure_assignments")
      .select("id, membership_id, member_id, branch_id, valid_until")
      .is("valid_until", null),
  ]);

  const memberships = unwrap(membershipResult);
  const members = unwrap(memberResult);
  const assignments = unwrap(assignmentResult);

  const memberById = new Map(members.map((member) => [member.id, member]));
  const countByMembership = new Map();

  for (const assignment of assignments) {
    if (assignment.branch_id) continue;

    countByMembership.set(
      assignment.membership_id,
      (countByMembership.get(assignment.membership_id) ?? 0) + 1,
    );
  }

  return memberships.map((membership) => {
    const head = memberById.get(membership.head_member_id);

    return {
      ...membership,
      head_name: head?.name ?? "",
      head_person_id: head?.person_id ?? "",
      member_count: countByMembership.get(membership.id) ?? (head ? 1 : 0),
      phone_number: head?.phone_number ?? "",
      email: head?.email ?? "",
      area: membership.area ?? "",
      city: membership.city ?? "",
      membership_status: membership.membership_status ?? "",
    };
  });
}

async function loadEvents() {
  return unwrap(
    await supabase
      .from("church_events")
      .select("*")
      .order("event_date", { ascending: true }),
  );
}

async function loadGroups() {
  const [groupResult, assignmentResult] = await Promise.all([
    supabase.from("church_groups").select("*").order("name", { ascending: true }),
    supabase
      .from("member_group_assignments")
      .select("group_id, member_id, valid_until")
      .is("valid_until", null),
  ]);

  const groups = unwrap(groupResult);
  const assignments = unwrap(assignmentResult);
  const countByGroup = new Map();

  for (const assignment of assignments) {
    countByGroup.set(
      assignment.group_id,
      (countByGroup.get(assignment.group_id) ?? 0) + 1,
    );
  }

  return groups.map((group) => ({
    ...group,
    member_count: countByGroup.get(group.id) ?? 0,
  }));
}

async function loadLeadership() {
  const result = await supabase
    .from("leadership_appointments")
    .select(`
      *,
      members (
        id,
        person_id,
        name
      ),
      leadership_positions (
        id,
        role_name,
        organization_type,
        group_id,
        church_groups (
          id,
          name
        )
      )
    `)
    .order("valid_from", { ascending: false });

  return unwrap(result).map((appointment) => ({
    ...appointment,
    member_name: appointment.members?.name ?? "",
    person_id: appointment.members?.person_id ?? "",
    role_name: appointment.leadership_positions?.role_name ?? "",
    organization_type: appointment.leadership_positions?.organization_type ?? "",
    group_name: appointment.leadership_positions?.church_groups?.name ?? "",
    appointment_status: appointment.valid_until ? "Ended" : "Current",
  }));
}

export async function loadReportRows(source) {
  if (!REPORT_SOURCES[source]) {
    throw new Error("Choose a valid report source.");
  }

  if (REPORT_SOURCES[source].disabled) {
    throw new Error(
      "Financial reporting will be available when the Finance workspace is implemented.",
    );
  }

  switch (source) {
    case "members":
      return loadMembers();
    case "memberships":
      return loadMemberships();
    case "events":
      return loadEvents();
    case "groups":
      return loadGroups();
    case "leadership":
      return loadLeadership();
    default:
      throw new Error("This report source is not supported.");
  }
}

function normalise(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function compareValues(left, right) {
  if (left == null || left === "") return right == null || right === "" ? 0 : 1;
  if (right == null || right === "") return -1;

  const leftNumber = Number(left);
  const rightNumber = Number(right);

  if (
    String(left).trim() !== "" &&
    String(right).trim() !== "" &&
    Number.isFinite(leftNumber) &&
    Number.isFinite(rightNumber)
  ) {
    return leftNumber - rightNumber;
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function dateOnly(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function passesFilter(row, filter) {
  const value = row[filter.field];
  const expected = filter.value;
  const actualText = normalise(value);
  const expectedText = normalise(expected);

  switch (filter.operator) {
    case "equals":
      return actualText === expectedText;

    case "not_equals":
      return actualText !== expectedText;

    case "contains":
      return actualText.includes(expectedText);

    case "not_contains":
      return !actualText.includes(expectedText);

    case "starts_with":
      return actualText.startsWith(expectedText);

    case "greater_than":
      return compareValues(value, expected) > 0;

    case "greater_or_equal":
      return compareValues(value, expected) >= 0;

    case "less_than":
      return compareValues(value, expected) < 0;

    case "less_or_equal":
      return compareValues(value, expected) <= 0;

    case "on_or_after":
      return Boolean(dateOnly(value)) && dateOnly(value) >= dateOnly(expected);

    case "on_or_before":
      return Boolean(dateOnly(value)) && dateOnly(value) <= dateOnly(expected);

    case "is_empty":
      return value == null || String(value).trim() === "";

    case "is_not_empty":
      return value != null && String(value).trim() !== "";

    case "in_month": {
      const selectedMonth = normaliseMonth(expected);
      return selectedMonth !== null && monthFromDate(value) === selectedMonth;
    }

    case "in_any_group": {
      const ids = Array.isArray(row.group_ids) ? row.group_ids.map(String) : [];
      const names = normalise(row.group_names);
      return ids.includes(String(expected)) || names.includes(expectedText);
    }

    case "in_all_groups": {
      const selected = Array.isArray(expected)
        ? expected
        : String(expected ?? "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);

      const ids = Array.isArray(row.group_ids)
        ? row.group_ids.map(String)
        : [];

      const names = Array.isArray(row.groups)
        ? row.groups.map((group) => normalise(group.name))
        : normalise(row.group_names)
            .split(",")
            .map((name) => name.trim());

      return (
        selected.length > 0 &&
        selected.every((item) => {
          const group = String(item).trim();
          return ids.includes(group) || names.includes(normalise(group));
        })
      );
    }

    default:
      return true;
  }
}

export function applyReportDefinition(rows, definition) {
  const filters = definition.filters ?? [];
  const sorts = definition.sorts ?? [];

  let output = rows.filter((row) =>
    filters.every((filter) => {
      if (!filter.field || !filter.operator) return true;

      if (
        !["is_empty", "is_not_empty"].includes(filter.operator) &&
        (filter.value === "" || filter.value == null)
      ) {
        return true;
      }

      return passesFilter(row, filter);
    }),
  );

  if (sorts.length) {
    output = [...output].sort((left, right) => {
      for (const sort of sorts) {
        const result = compareValues(left[sort.field], right[sort.field]);
        if (result !== 0) return sort.direction === "desc" ? -result : result;
      }

      return 0;
    });
  }

  const selectedFields = definition.fields ?? [];

  return output.map((row) =>
    Object.fromEntries(
      selectedFields.map((field) => [field, row[field] ?? ""]),
    ),
  );
}
