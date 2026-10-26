
import { supabase } from "../../lib/supabase";

function unwrap({ data, error }) {
  if (error) {
    throw new Error(error.message || "Database request failed.");
  }

  return data;
}

function normalisePhone(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function dateInRange(dateValue, startDate, endDate) {
  if (!dateValue || String(dateValue).length < 10) return false;

  const monthDay = String(dateValue).slice(5, 10);
  const start = String(startDate).slice(5, 10);
  const end = String(endDate).slice(5, 10);

  // Handles a selected period that crosses December into January.
  return start <= end
    ? monthDay >= start && monthDay <= end
    : monthDay >= start || monthDay <= end;
}

function membershipSort(a, b) {
  return String(a.membership_number ?? "").localeCompare(
    String(b.membership_number ?? ""),
    undefined,
    { numeric: true },
  );
}

export async function getCommunicationGroups() {
  return (
    unwrap(
      await supabase
        .from("church_groups")
        .select("id, name, description, group_status")
        .eq("group_status", "Active")
        .order("name"),
    ) ?? []
  );
}

export async function getAnnouncementHistory() {
  return (
    unwrap(
      await supabase
        .from("church_announcements")
        .select("*")
        .order("created_at", { ascending: false }),
    ) ?? []
  );
}

/**
 * Returns active members with their current household membership.
 * Group assignments are retained here for the Announcements tab only.
 */
export async function getCommunicationRecipients() {
  const [
    membersResult,
    membershipsResult,
    assignmentsResult,
    groupAssignmentsResult,
  ] = await Promise.all([
    supabase
      .from("members")
      .select("id, person_id, name, date_of_birth, phone_number, status")
      .eq("status", "Active")
      .order("name"),

    supabase
      .from("memberships")
      .select(
        "id, membership_id, membership_number, head_member_id, membership_status, primary_phone_number, alternate_phone_number",
      )
      .eq("membership_status", "Active"),

    supabase
      .from("membership_structure_assignments")
      .select("membership_id, member_id, valid_until")
      .is("valid_until", null),

    supabase
      .from("member_group_assignments")
      .select("member_id, group_id, church_groups(id, name, group_status)"),
  ]);

  const members = unwrap(membersResult) ?? [];
  const memberships = unwrap(membershipsResult) ?? [];
  const assignments = unwrap(assignmentsResult) ?? [];
  const groupAssignments = unwrap(groupAssignmentsResult) ?? [];

  const memberById = new Map(members.map((member) => [member.id, member]));
  const membershipById = new Map(
    memberships.map((membership) => [membership.id, membership]),
  );

  const membershipByMemberId = new Map();

  for (const assignment of assignments) {
    const membership = membershipById.get(assignment.membership_id);
    if (!membership) continue;

    const current = membershipByMemberId.get(assignment.member_id);

    // Prefer a membership where this person is the head.
    if (
      !current ||
      membership.head_member_id === assignment.member_id
    ) {
      membershipByMemberId.set(assignment.member_id, membership);
    }
  }

  const groupsByMemberId = new Map();

  for (const assignment of groupAssignments) {
    const group = assignment.church_groups;
    if (!group || group.group_status !== "Active") continue;

    const existing = groupsByMemberId.get(assignment.member_id) ?? [];
    existing.push({ id: group.id, name: group.name });
    groupsByMemberId.set(assignment.member_id, existing);
  }

  return members
    .map((member) => {
      const membership = membershipByMemberId.get(member.id);
      const head = membership
        ? memberById.get(membership.head_member_id)
        : null;

      const isHead = membership?.head_member_id === member.id;
      const phone = isHead
        ? membership?.primary_phone_number ||
          membership?.alternate_phone_number ||
          member.phone_number
        : member.phone_number ||
          membership?.primary_phone_number ||
          membership?.alternate_phone_number;

      return {
        ...member,
        membership_row_id: membership?.id ?? null,
        membership_number: membership?.membership_number ?? "",
        membership_name: head?.name
          ? `${membership?.membership_number ?? "—"} — ${head.name}`
          : membership
            ? `Membership ${membership.membership_number ?? "—"}`
            : "",
        phone_number: phone || "",
        whatsapp_phone: normalisePhone(phone),
        groups: groupsByMemberId.get(member.id) ?? [],
      };
    })
    .sort(membershipSort);
}

export async function createAnnouncement({
  title,
  message,
  audienceType,
  groupIds,
}) {
  const cleanTitle = String(title || "").trim();
  const cleanMessage = String(message || "").trim();

  if (!cleanTitle) throw new Error("Enter an announcement title.");
  if (!cleanMessage) throw new Error("Enter the announcement message.");

  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError) throw authError;
  if (!authData.user) throw new Error("Please sign in again.");

  if (audienceType === "groups" && (!groupIds || groupIds.length === 0)) {
    throw new Error("Select at least one audience group.");
  }

  return unwrap(
    await supabase
      .from("church_announcements")
      .insert({
        title: cleanTitle,
        message: cleanMessage,
        audience_type: audienceType,
        audience_group_ids: audienceType === "all" ? [] : groupIds,
        created_by: authData.user.id,
      })
      .select("*")
      .single(),
  );
}

export async function markAnnouncementOpened(id) {
  if (!id) return;

  unwrap(
    await supabase
      .from("church_announcements")
      .update({ last_opened_for_whatsapp_at: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .single(),
  );
}

/**
 * Return birthdays and wedding anniversaries within a selected
 * month/day range. The year is deliberately ignored.
 */
export async function getSpecialDays({ startDate, endDate }) {
  if (!startDate || !endDate) {
    throw new Error("Select a start date and end date.");
  }

  const [recipients, relationshipsResult] = await Promise.all([
    getCommunicationRecipients(),
    supabase
      .from("membership_relationships")
      .select(
        "member_id, related_member_id, relationship_type, date_of_marriage",
      )
      .eq("relationship_type", "Spouse"),
  ]);

  const relationships = unwrap(relationshipsResult) ?? [];
  const memberById = new Map(
    recipients.map((member) => [member.id, member]),
  );

  const birthdays = recipients
    .filter((member) =>
      dateInRange(member.date_of_birth, startDate, endDate),
    )
    .map((member) => ({
      id: member.id,
      person_id: member.person_id,
      name: member.name,
      date_of_birth: member.date_of_birth,
      special_date: member.date_of_birth,
      membership_row_id: member.membership_row_id,
      membership_number: member.membership_number,
      membership_name: member.membership_name,
      phone_number: member.phone_number,
      special_type: "Birthday",
    }))
    .sort((a, b) => {
      const dateComparison = String(a.date_of_birth)
        .slice(5, 10)
        .localeCompare(String(b.date_of_birth).slice(5, 10));

      return dateComparison || membershipSort(a, b);
    });

  const anniversaries = [];
  const seenCouples = new Set();

  for (const relationship of relationships) {
    const weddingDate = relationship.date_of_marriage;

    if (!dateInRange(weddingDate, startDate, endDate)) continue;

    const pair = [
      relationship.member_id,
      relationship.related_member_id,
    ]
      .filter(Boolean)
      .sort()
      .join(":");

    if (!pair || seenCouples.has(pair)) continue;
    seenCouples.add(pair);

    const first = memberById.get(relationship.member_id);
    const second = memberById.get(relationship.related_member_id);

    if (!first || !second) continue;

    const household = first.membership_row_id ? first : second;

    anniversaries.push({
      id: pair,
      couple_name: `${first.name} & ${second.name}`,
      date_of_marriage: weddingDate,
      special_date: weddingDate,
      membership_row_id: household.membership_row_id,
      membership_number: household.membership_number,
      membership_name: household.membership_name,
      phone_number:
        household.phone_number ||
        first.phone_number ||
        second.phone_number ||
        "",
      special_type: "Wedding Anniversary",
    });
  }

  anniversaries.sort((a, b) => {
    const dateComparison = String(a.date_of_marriage)
      .slice(5, 10)
      .localeCompare(String(b.date_of_marriage).slice(5, 10));

    return dateComparison || membershipSort(a, b);
  });

  return { birthdays, anniversaries };
}
