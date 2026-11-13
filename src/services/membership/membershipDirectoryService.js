import { supabase } from "../../lib/supabase";
import {
  MEMBERSHIP_FIELDS,
  MEMBER_FIELDS,
  attachSpouseDetails,
  cleanObject,
  mapGroupsForMember,
  resolveRelationships,
  deriveRelationshipToHead,
  unwrap,
} from "./serviceUtils";

/**
 * Membership directory
 *
 * A membership is the main household record.
 * A branch is a structural assignment containing one person.
 * A branch does not have a separate head.
 */
export async function getMembershipDirectory() {
  const [
    membershipResult,
    memberResult,
    assignmentResult,
    branchResult,
    registerResult,
  ] = await Promise.all([
    supabase
      .from("memberships")
      .select(MEMBERSHIP_FIELDS)
      .order("created_at", { ascending: false }),

    supabase.from("members").select(MEMBER_FIELDS),

    supabase
      .from("membership_structure_assignments")
      .select(
        `
        id,
        membership_id,
        member_id,
        branch_id,
        relationship_to_head,
        valid_from,
        valid_until
      `,
      )
      .is("valid_until", null),

    // Include inactive branches too.
    // Their suffixes must remain reserved and must not be reused.
    supabase
      .from("membership_branches")
      .select("id, membership_id, suffix, branch_status, branch_name")
      .order("suffix"),

    supabase
      .from("annual_registers")
      .select("id, name, register_year, status, finalised_at")
      .eq("status", "Finalised")
      .order("register_year", { ascending: false })
      .order("finalised_at", { ascending: false, nullsFirst: false })
      .limit(1),
  ]);

  const memberships = unwrap(membershipResult) ?? [];
  const members = unwrap(memberResult) ?? [];
  const assignments = unwrap(assignmentResult) ?? [];
  const branches = unwrap(branchResult) ?? [];

  const memberById = new Map(members.map((member) => [member.id, member]));

  const assignmentsByMembership = new Map();
  const assignmentsByBranch = new Map();
  const branchesByMembership = new Map();

  for (const assignment of assignments) {
    const membershipAssignments =
      assignmentsByMembership.get(assignment.membership_id) ?? [];

    membershipAssignments.push(assignment);
    assignmentsByMembership.set(
      assignment.membership_id,
      membershipAssignments,
    );

    if (assignment.branch_id) {
      const branchAssignments =
        assignmentsByBranch.get(assignment.branch_id) ?? [];

      branchAssignments.push(assignment);
      assignmentsByBranch.set(assignment.branch_id, branchAssignments);
    }
  }

  for (const branch of branches) {
    const membershipBranches =
      branchesByMembership.get(branch.membership_id) ?? [];

    membershipBranches.push(branch);
    branchesByMembership.set(branch.membership_id, membershipBranches);
  }

  const directory = memberships.map((membership) => {
    const head = memberById.get(membership.head_member_id) ?? null;

    const membershipAssignments =
      assignmentsByMembership.get(membership.id) ?? [];

    const mainAssignments = membershipAssignments.filter(
      (assignment) => !assignment.branch_id,
    );

    const mainMemberCount = Math.max(mainAssignments.length, head ? 1 : 0);

    const membershipBranches = (branchesByMembership.get(membership.id) ?? [])
      .filter((branch) => branch.branch_status === "Active")
      .map((branch) => {
        const branchAssignments = assignmentsByBranch.get(branch.id) ?? [];

        // A branch is expected to contain one person.
        // Do not identify that person as a branch head.
        const branchMember =
          branchAssignments.length > 0
            ? (memberById.get(branchAssignments[0].member_id) ?? null)
            : null;

        const branchMembers = branchAssignments
          .map((assignment) => memberById.get(assignment.member_id))
          .filter(Boolean);

        return {
          ...branch,
          display_number: `${
            membership.membership_number ?? "—"
          }${branch.suffix ?? ""}`,
          member_count: branchMembers.length,

          // New terminology.
          member: branchMember,
          person: branchMember,
          member_name: branchMember?.name ?? "Person not assigned",
          member_person_id: branchMember?.person_id ?? null,
          member_status: branchMember?.status ?? null,

          // Compatibility aliases for older UI components.
          // These should be removed after the UI is updated.
          head: branchMember,
          head_name: branchMember?.name ?? "Person not assigned",
          head_person_id: branchMember?.person_id ?? null,
          head_status: branchMember?.status ?? null,
        };
      });

    return {
      ...membership,
      head,
      head_name: head?.name ?? "Head not assigned",
      head_person_id: head?.person_id ?? null,
      head_status: head?.status ?? null,
      main_member_count: mainMemberCount,
      member_count: mainMemberCount,
      branch_count: membershipBranches.length,
      branches: membershipBranches,
    };
  });

  const activeRegister = unwrap(registerResult)?.[0] ?? null;

  return {
    memberships: directory,
    activeRegister,
  };
}

/**
 * Load one membership and its current structural assignments.
 *
 * Family relationships are resolved separately from membership
 * assignments. A related person may belong to another membership.
 */

export async function getMembershipDetails(membershipRowId, branchId = null) {
  if (!membershipRowId) {
    throw new Error("A membership record ID is required.");
  }

  const membership = unwrap(
    await supabase
      .from("memberships")
      .select(MEMBERSHIP_FIELDS)
      .eq("id", membershipRowId)
      .single(),
  );

  const [
    memberResult,
    assignmentResult,
    branchResult,
    relationshipResult,
    groupAssignmentResult,
  ] = await Promise.all([
    supabase.from("members").select(MEMBER_FIELDS),

    supabase
      .from("membership_structure_assignments")
      .select("*")
      .eq("membership_id", membershipRowId)
      .is("valid_until", null),

    supabase
      .from("membership_branches")
      .select("*")
      .eq("membership_id", membershipRowId)
      .order("suffix"),

    supabase.from("membership_relationships").select("*"),

    supabase
      .from("member_group_assignments")
      .select("*, church_groups(id, name, group_status)")
      .is("valid_until", null),
  ]);

  const allMembers = unwrap(memberResult) ?? [];
  const assignments = unwrap(assignmentResult) ?? [];
  const allBranches = unwrap(branchResult) ?? [];
  const allRelationships = unwrap(relationshipResult) ?? [];
  const groupAssignments = unwrap(groupAssignmentResult) ?? [];

  const branches = allBranches.filter(
    (branch) => branch.branch_status === "Active",
  );

  const membersById = new Map(
    allMembers.map((member) => [member.id, member]),
  );

  const branchById = new Map(
    branches.map((branch) => [branch.id, branch]),
  );

  // Build the currently assigned membership members.
  const assignedMembers = assignments
    .map((assignment) => {
      const member = membersById.get(assignment.member_id);

      if (!member) return null;

      return {
        ...member,
        assignment_id: assignment.id,

        // Preserve the old value for compatibility and auditing.
        legacy_relationship_to_head: assignment.relationship_to_head,

        relationship_to_head: assignment.relationship_to_head,

        branch_id: assignment.branch_id,
        branch_suffix:
          branchById.get(assignment.branch_id)?.suffix ?? null,

        is_head: member.id === membership.head_member_id,

        groups: mapGroupsForMember(
          groupAssignments,
          member.id,
        ),
      };
    })
    .filter(Boolean);

  // Compatibility for older records where the head has no assignment row.
  if (
    !assignedMembers.some(
      (member) => member.id === membership.head_member_id,
    )
  ) {
    const headMember = membersById.get(membership.head_member_id);

    if (headMember) {
      assignedMembers.unshift({
        ...headMember,
        assignment_id: null,
        legacy_relationship_to_head: null,
        relationship_to_head: null,
        branch_id: null,
        branch_suffix: null,
        is_head: true,
        groups: mapGroupsForMember(
          groupAssignments,
          headMember.id,
        ),
      });
    }
  }

  const assignedMemberIds = new Set(
    assignedMembers.map((member) => member.id),
  );

  // Resolve the actual family relationship graph.
  const relationships = resolveRelationships(
    allRelationships,
    membersById,
    assignedMemberIds,
  );

  const membersWithSpouseDetails = attachSpouseDetails(
    assignedMembers,
    relationships,
    membersById,
  );

  const membershipHead =
    membersWithSpouseDetails.find(
      (member) => member.id === membership.head_member_id,
    ) ??
    membersById.get(membership.head_member_id) ??
    null;

  /*
   * Calculate the relationship to the CURRENT head.
   *
   * This intentionally replaces the displayed relationship_to_head
   * while preserving the original assignment label separately.
   */
  const membersWithCurrentRelationships = membersWithSpouseDetails.map(
    (member) => {
      const displayRelationship = deriveRelationshipToHead({
        member,
        headId: membership.head_member_id,
        relationships: allRelationships,
        membersById,
      });

      return {
        ...member,

        // The current, calculated display relationship.
        relationship_to_head: displayRelationship,

        // Preserve the old assignment label.
        legacy_relationship_to_head:
          member.legacy_relationship_to_head ?? null,

        is_head: member.id === membership.head_member_id,
      };
    },
  );

  // Branches remain structural placements, not separate households.
  const branchesWithMembers = branches.map((branch) => {
    const branchMembers = membersWithCurrentRelationships.filter(
      (member) => member.branch_id === branch.id,
    );

    const branchMember = branchMembers[0] ?? null;

    return {
      ...branch,
      members: branchMembers,
      member: branchMember,
      person: branchMember,

      // Compatibility alias only.
      head: branchMember,
    };
  });

  const selectedBranch = branchId
    ? branchesWithMembers.find(
        (branch) => branch.id === branchId,
      ) ?? null
    : null;

  if (branchId && !selectedBranch) {
    throw new Error(
      "This branch could not be found or is no longer active.",
    );
  }

  const displayedMembers = selectedBranch
    ? selectedBranch.members
    : membersWithCurrentRelationships;

  const displayedMemberIds = new Set(
    displayedMembers.map((member) => member.id),
  );

  const displayedRelationships = relationships.filter(
    (relationship) =>
      displayedMemberIds.has(relationship.member_id) ||
      displayedMemberIds.has(relationship.related_member_id),
  );

  const displayedHead = selectedBranch
    ? selectedBranch.member
    : membershipHead;

  return {
    membership,

    head: displayedHead,
    membershipHead,

    members: displayedMembers,

    mainMembers: membersWithCurrentRelationships.filter(
      (member) => !member.branch_id,
    ),

    people: allMembers,

    branches: branchesWithMembers,
    allBranches,

    relationships,
    displayedRelationships,

    selectedBranch,
    isBranchView: Boolean(selectedBranch),
  };
}




export async function createMembershipWithHead({ head, membership }) {
  if (!head?.name?.trim()) {
    throw new Error("Head of membership name is required.");
  }

  const headMarriageDate = head.date_of_marriage || null;

  // The RPC creates the membership and head as before.
  const result = unwrap(
    await supabase.rpc("create_membership_with_head_v2", {
      p_head: cleanObject(head),
      p_membership: cleanObject(membership),
    }),
  );

  // Save the date separately because the head may not have a spouse
  // relationship recorded yet.
  if (headMarriageDate) {
    if (!result?.membership_id) {
      throw new Error(
        "Membership was created, but its permanent ID was not returned. The marriage date could not be saved.",
      );
    }

    const membershipRow = unwrap(
      await supabase
        .from("memberships")
        .select("id, head_member_id")
        .eq("membership_id", result.membership_id)
        .single(),
    );

    if (!membershipRow?.head_member_id) {
      throw new Error(
        "Membership was created, but its head record could not be located.",
      );
    }

    unwrap(
      await supabase
        .from("members")
        .update({ date_of_marriage: headMarriageDate })
        .eq("id", membershipRow.head_member_id),
    );
  }

  return result;
}


export async function updateMembership(membershipRowId, patch) {
  if (!membershipRowId) {
    throw new Error("A membership record ID is required.");
  }

  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error("A valid membership update is required.");
  }

  return unwrap(
    await supabase.rpc("update_membership_v2", {
      p_membership_row_id: membershipRowId,
      p_patch: patch,
    }),
  );
}

/**
 * Changes only the head of the main membership.
 * It must not rewrite person-to-person family relationships.
 */
export async function changeMembershipHead({
  membershipRowId,
  newHeadMemberId,
  reason = null,
}) {
  if (!membershipRowId || !newHeadMemberId) {
    throw new Error("Membership and new head are required.");
  }

  return unwrap(
    await supabase.rpc("change_membership_head", {
      p_membership_row_id: membershipRowId,
      p_new_head_member_id: newHeadMemberId,
      p_reason: reason,
    }),
  );
}

export async function createBranchFromExistingMember({
  membershipRowId,
  memberId,
}) {
  if (!membershipRowId || !memberId) {
    throw new Error("Membership and member are both required.");
  }

  const today = new Date().toISOString().slice(0, 10);

  const membership = unwrap(
    await supabase
      .from("memberships")
      .select("id, membership_number, head_member_id, membership_status")
      .eq("id", membershipRowId)
      .single(),
  );

  if (membership.membership_status !== "Active") {
    throw new Error("A branch can only be created from an active membership.");
  }

  if (membership.head_member_id === memberId) {
    throw new Error("The main membership head cannot be moved into a branch.");
  }

  const assignment = unwrap(
    await supabase
      .from("membership_structure_assignments")
      .select("id, membership_id, member_id, branch_id, valid_from")
      .eq("membership_id", membershipRowId)
      .eq("member_id", memberId)
      .is("valid_until", null)
      .maybeSingle(),
  );

  if (!assignment) {
    throw new Error(
      "This person does not have an active assignment in this membership.",
    );
  }

  if (assignment.branch_id) {
    throw new Error("This person is already assigned to a branch.");
  }

  // Include inactive branches so a suffix is never reused.
  const existingBranches =
    unwrap(
      await supabase
        .from("membership_branches")
        .select("suffix")
        .eq("membership_id", membershipRowId)
        .order("suffix"),
    ) ?? [];

  const usedSuffixes = new Set(
    existingBranches.map((branch) => String(branch.suffix || "").toUpperCase()),
  );

  let suffix = "";

  for (let code = 65; code <= 90; code += 1) {
    const candidate = String.fromCharCode(code);

    if (!usedSuffixes.has(candidate)) {
      suffix = candidate;
      break;
    }
  }

  if (!suffix) {
    throw new Error(
      "All branch suffixes A–Z are already in use for this membership.",
    );
  }

  // This legacy helper performs direct table writes.
  // Prefer the atomic createBranchFromMember RPC workflow used by
  // the current Create Branch modal.
  const branch = unwrap(
    await supabase
      .from("membership_branches")
      .insert({
        membership_id: membershipRowId,
        suffix,
        branch_status: "Active",
      })
      .select("*")
      .single(),
  );

  let previousAssignmentClosed = false;

  try {
    const closedAssignment = unwrap(
      await supabase
        .from("membership_structure_assignments")
        .update({
          valid_until: today,
        })
        .eq("id", assignment.id)
        .is("valid_until", null)
        .select("id")
        .single(),
    );

    previousAssignmentClosed = Boolean(closedAssignment?.id);

    unwrap(
      await supabase
        .from("membership_structure_assignments")
        .insert({
          membership_id: membershipRowId,
          member_id: memberId,
          branch_id: branch.id,

          // Legacy structural field only.
          // This is not a family relationship.
          relationship_to_head: "Head of Branch",

          valid_from: today,
          valid_until: null,
        })
        .select("*")
        .single(),
    );

    return {
      branch,
      membershipNumber: `${membership.membership_number || ""}${suffix}`,
      memberId,
    };
  } catch (error) {
    if (previousAssignmentClosed) {
      await supabase
        .from("membership_structure_assignments")
        .update({ valid_until: null })
        .eq("id", assignment.id);
    }

    await supabase.from("membership_branches").delete().eq("id", branch.id);

    throw error;
  }
}

export async function getNextMembershipNumber() {
  const { data: registers, error: registerError } = await supabase
    .from("annual_registers")
    .select("id, register_year, finalised_at")
    .eq("status", "Finalised")
    .order("register_year", { ascending: false })
    .order("finalised_at", {
      ascending: false,
      nullsFirst: false,
    })
    .limit(1);

  if (registerError) throw registerError;

  const currentRegister = registers?.[0];

  if (currentRegister) {
    const { data: entries, error: entriesError } = await supabase
      .from("annual_membership_entries")
      .select("membership_number")
      .eq("annual_register_id", currentRegister.id)
      .eq("is_included", true)
      .is("branch_id", null)
      .eq("entry_type", "Membership");

    if (entriesError) throw entriesError;

    const numbers = (entries ?? [])
      .map((entry) => Number(entry.membership_number))
      .filter((number) => Number.isSafeInteger(number) && number > 0);

    return String(Math.max(0, ...numbers) + 1);
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("memberships")
    .select("membership_number");

  if (membershipError) throw membershipError;

  const numbers = (memberships ?? [])
    .map((membership) => Number(membership.membership_number))
    .filter((number) => Number.isSafeInteger(number) && number > 0);

  return String(Math.max(0, ...numbers) + 1);
}
