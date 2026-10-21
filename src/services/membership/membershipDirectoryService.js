
import { supabase } from '../../lib/supabase'
import {
  MEMBERSHIP_FIELDS,
  MEMBER_FIELDS,
  attachSpouseDetails,
  cleanObject,
  mapGroupsForMember,
  resolveRelationships,
  unwrap,
} from './serviceUtils'

export async function getMembershipDirectory() {
    const [
    membershipResult,
    memberResult,
    assignmentResult,
    branchResult,
    registerResult,
  ] = await Promise.all([
    supabase
      .from('memberships')
      .select(MEMBERSHIP_FIELDS)
      .order('created_at', { ascending: false }),

    supabase.from('members').select(MEMBER_FIELDS),

    supabase
      .from('membership_structure_assignments')
      .select(`
        id,
        membership_id,
        member_id,
        branch_id,
        relationship_to_head,
        valid_from,
        valid_until
      `)
      .is('valid_until', null),

    supabase
      .from('membership_branches')
      .select('id, membership_id, suffix, branch_status')
      .eq('branch_status', 'Active')
      .order('suffix'),

    supabase
      .from('annual_registers')
      .select('id, name, register_year, status, finalised_at')
      .eq('status', 'Finalised')
      .order('register_year', { ascending: false })
      .order('finalised_at', { ascending: false, nullsFirst: false })
      .limit(1),
  ])

  const memberships = unwrap(membershipResult) ?? []
  const members = unwrap(memberResult) ?? []
  const assignments = unwrap(assignmentResult) ?? []
  const branches = unwrap(branchResult) ?? []

  const memberById = new Map(
    members.map((member) => [member.id, member]),
  )

  const assignmentsByMembership = new Map()
  const assignmentsByBranch = new Map()
  const branchesByMembership = new Map()

  for (const assignment of assignments) {
    const membershipAssignments =
      assignmentsByMembership.get(assignment.membership_id) ?? []

    membershipAssignments.push(assignment)
    assignmentsByMembership.set(
      assignment.membership_id,
      membershipAssignments,
    )

    if (assignment.branch_id) {
      const branchAssignments =
        assignmentsByBranch.get(assignment.branch_id) ?? []

      branchAssignments.push(assignment)
      assignmentsByBranch.set(assignment.branch_id, branchAssignments)
    }
  }

  for (const branch of branches) {
    const membershipBranches =
      branchesByMembership.get(branch.membership_id) ?? []

    membershipBranches.push(branch)
    branchesByMembership.set(branch.membership_id, membershipBranches)
  }

  const directory = memberships.map((membership) => {
    const head = memberById.get(membership.head_member_id)

    const membershipAssignments =
      assignmentsByMembership.get(membership.id) ?? []

    const mainAssignments = membershipAssignments.filter(
      (assignment) => !assignment.branch_id,
    )

    const mainMemberCount = Math.max(
      mainAssignments.length,
      head ? 1 : 0,
    )

    const membershipBranches = (
      branchesByMembership.get(membership.id) ?? []
    ).map((branch) => {
      const branchAssignments = assignmentsByBranch.get(branch.id) ?? []

      const branchMembers = branchAssignments
        .map((assignment) => memberById.get(assignment.member_id))
        .filter(Boolean)

      const designatedHead = branchAssignments.find((assignment) =>
        ['Head', 'Branch Head', 'Head of Branch'].includes(
          assignment.relationship_to_head,
        ),
      )

      const headAssignment =
        designatedHead ?? branchAssignments[0] ?? null

      const branchHead = headAssignment
        ? memberById.get(headAssignment.member_id)
        : null

      return {
        ...branch,
        display_number: `${membership.membership_number ?? '—'}${branch.suffix}`,
        member_count: branchMembers.length,
        head_name: branchHead?.name ?? 'Branch head not recorded',
        head_person_id: branchHead?.person_id ?? null,
        head_status: branchHead?.status ?? null,
      }
    })

        return {
      ...membership,
      head,
      head_name: head?.name ?? 'Head not assigned',
      head_person_id: head?.person_id ?? null,
      head_status: head?.status ?? null,
      main_member_count: mainMemberCount,
      member_count: mainMemberCount,
      branch_count: membershipBranches.length,
      branches: membershipBranches,
    }
  })

  const activeRegister = unwrap(registerResult)?.[0] ?? null

  return {
    memberships: directory,
    activeRegister,
  }
}

export async function getMembershipDetails(
  membershipRowId,
  branchId = null,
) {
  if (!membershipRowId) {
    throw new Error('A membership record ID is required.')
  }

  const membership = unwrap(
    await supabase
      .from('memberships')
      .select(MEMBERSHIP_FIELDS)
      .eq('id', membershipRowId)
      .single(),
  )

  const [
    memberResult,
    assignmentResult,
    branchResult,
    relationshipResult,
    groupAssignmentResult,
  ] = await Promise.all([
    supabase.from('members').select(MEMBER_FIELDS),

    supabase
      .from('membership_structure_assignments')
      .select('*')
      .eq('membership_id', membershipRowId)
      .is('valid_until', null),

    supabase
      .from('membership_branches')
      .select('*')
      .eq('membership_id', membershipRowId)
      .eq('branch_status', 'Active')
      .order('suffix'),

    supabase.from('membership_relationships').select('*'),

    supabase
      .from('member_group_assignments')
      .select('*, church_groups(id, name, group_status)')
      .is('valid_until', null),
  ])

  const allMembers = unwrap(memberResult) ?? []
  const assignments = unwrap(assignmentResult) ?? []
  const branches = unwrap(branchResult) ?? []
  const allRelationships = unwrap(relationshipResult) ?? []
  const groupAssignments = unwrap(groupAssignmentResult) ?? []

  const membersById = new Map(
    allMembers.map((member) => [member.id, member]),
  )

  const branchById = new Map(
    branches.map((branch) => [branch.id, branch]),
  )

  const members = assignments
    .map((assignment) => {
      const member = membersById.get(assignment.member_id)

      if (!member) return null

      return {
        ...member,
        assignment_id: assignment.id,
        relationship_to_head: assignment.relationship_to_head,
        branch_id: assignment.branch_id,
        branch_suffix:
          branchById.get(assignment.branch_id)?.suffix ?? null,
        is_head: member.id === membership.head_member_id,
        groups: mapGroupsForMember(groupAssignments, member.id),
      }
    })
    .filter(Boolean)

  // Include the head if an older record has no assignment row.
  if (!members.some((member) => member.id === membership.head_member_id)) {
    const headMember = membersById.get(membership.head_member_id)

    if (headMember) {
      members.unshift({
        ...headMember,
        assignment_id: null,
        relationship_to_head: 'Head',
        branch_id: null,
        branch_suffix: null,
        is_head: true,
        groups: mapGroupsForMember(groupAssignments, headMember.id),
      })
    }
  }

  const includedMemberIds = new Set(members.map((member) => member.id))

  const relationships = resolveRelationships(
    allRelationships,
    membersById,
    includedMemberIds,
  )

  const membersWithSpouseDetails = attachSpouseDetails(
    members,
    relationships,
    membersById,
  )

  const membersByIdWithSpouseDetails = new Map(
    membersWithSpouseDetails.map((member) => [member.id, member]),
  )

  const head =
    membersByIdWithSpouseDetails.get(membership.head_member_id) ?? null

  const branchesWithMembers = branches.map((branch) => {
    const branchMembers = membersWithSpouseDetails.filter(
      (member) => member.branch_id === branch.id,
    )

    const designatedHead = branchMembers.find((member) =>
      ['Head', 'Branch Head', 'Head of Branch'].includes(
        member.relationship_to_head,
      ),
    )

    return {
      ...branch,
      members: branchMembers,
      head: designatedHead ?? branchMembers[0] ?? null,
    }
  })

  const selectedBranch = branchId
    ? branchesWithMembers.find((branch) => branch.id === branchId) ?? null
    : null

  if (branchId && !selectedBranch) {
    throw new Error('This branch could not be found or is no longer active.')
  }

  const displayedMembers = selectedBranch
    ? selectedBranch.members
    : membersWithSpouseDetails

  const displayedMemberIds = new Set(
    displayedMembers.map((member) => member.id),
  )

  const displayedRelationships = relationships.filter(
    (relationship) =>
      displayedMemberIds.has(relationship.member_id) &&
      displayedMemberIds.has(relationship.related_member_id),
  )

  return {
    membership,
    head: selectedBranch ? selectedBranch.head : head,
    members: displayedMembers,
    mainMembers: membersWithSpouseDetails.filter(
      (member) => !member.branch_id,
    ),
    branches: branchesWithMembers,
    relationships: displayedRelationships,
    selectedBranch,
    isBranchView: Boolean(selectedBranch),
  }
}

export async function createMembershipWithHead({ head, membership }) {
  if (!head?.name?.trim()) {
    throw new Error('Head of membership name is required.')
  }

  return unwrap(
    await supabase.rpc('create_membership_with_head', {
      p_head: cleanObject(head),
      p_membership: cleanObject(membership),
    }),
  )
}

export async function updateMembership(membershipRowId, patch) {
  if (!membershipRowId) {
    throw new Error('A membership record ID is required.')
  }

  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('A valid membership update is required.')
  }

  return unwrap(
    await supabase.rpc('update_membership', {
      p_membership_row_id: membershipRowId,
      p_patch: patch,
    }),
  )
}

export async function changeMembershipHead({
  membershipRowId,
  newHeadMemberId,
  reason = null,
}) {
  if (!membershipRowId || !newHeadMemberId) {
    throw new Error('Membership and new head are required.')
  }

  return unwrap(
    await supabase.rpc('change_membership_head', {
      p_membership_row_id: membershipRowId,
      p_new_head_member_id: newHeadMemberId,
      p_reason: reason,
    }),
  )
}

/**
 * Create a branch from an existing non-head member.
 *
 * The member's permanent person record is not duplicated.
 * Their previous active main-membership assignment is closed,
 * and a new active branch assignment is created.
 */
export async function createBranchFromExistingMember({
  membershipRowId,
  memberId,
}) {
  if (!membershipRowId || !memberId) {
    throw new Error('Membership and member are both required.')
  }

  const today = new Date().toISOString().slice(0, 10)

  const membership = unwrap(
    await supabase
      .from('memberships')
      .select('id, membership_number, head_member_id, membership_status')
      .eq('id', membershipRowId)
      .single(),
  )

  if (membership.membership_status !== 'Active') {
    throw new Error('A branch can only be created from an active membership.')
  }

  if (membership.head_member_id === memberId) {
    throw new Error(
      'The main membership head cannot be moved into a branch.',
    )
  }

  const assignment = unwrap(
    await supabase
      .from('membership_structure_assignments')
      .select('id, membership_id, member_id, branch_id, valid_from')
      .eq('membership_id', membershipRowId)
      .eq('member_id', memberId)
      .is('valid_until', null)
      .maybeSingle(),
  )

  if (!assignment) {
    throw new Error(
      'This person does not have an active assignment in this membership.',
    )
  }

  if (assignment.branch_id) {
    throw new Error(
      'This person is already assigned to a branch. Open the branch to manage them.',
    )
  }

  const existingBranches = unwrap(
    await supabase
      .from('membership_branches')
      .select('suffix')
      .eq('membership_id', membershipRowId)
      .order('suffix'),
  ) ?? []

  const usedSuffixes = new Set(
    existingBranches.map((branch) =>
      String(branch.suffix || '').toUpperCase(),
    ),
  )

  let suffix = ''
  for (let code = 65; code <= 90; code += 1) {
    const candidate = String.fromCharCode(code)
    if (!usedSuffixes.has(candidate)) {
      suffix = candidate
      break
    }
  }

  if (!suffix) {
    throw new Error(
      'All branch suffixes A–Z are in use for this membership.',
    )
  }

  // Create the branch first so its ID can be referenced by the assignment.
  const branch = unwrap(
    await supabase
      .from('membership_branches')
      .insert({
        membership_id: membershipRowId,
        suffix,
        branch_status: 'Active',
      })
      .select('*')
      .single(),
  )

  let previousAssignmentClosed = false

  try {
    // Close the existing assignment without deleting its history.
    const closedAssignment = unwrap(
      await supabase
        .from('membership_structure_assignments')
        .update({ valid_until: today })
        .eq('id', assignment.id)
        .is('valid_until', null)
        .select('id')
        .single(),
    )

    previousAssignmentClosed = Boolean(closedAssignment?.id)

    // Reassign the same person record to the newly created branch.
    unwrap(
      await supabase
        .from('membership_structure_assignments')
        .insert({
          membership_id: membershipRowId,
          member_id: memberId,
          branch_id: branch.id,
          relationship_to_head: 'Head of Branch',
          valid_from: today,
          valid_until: null,
        })
        .select('*')
        .single(),
    )

    return {
      branch,
      membershipNumber: `${membership.membership_number || ''}${suffix}`,
      memberId,
    }
  } catch (error) {
    // Best-effort rollback if creating the new assignment fails.
    if (previousAssignmentClosed) {
      await supabase
        .from('membership_structure_assignments')
        .update({ valid_until: null })
        .eq('id', assignment.id)
    }

    await supabase
      .from('membership_branches')
      .delete()
      .eq('id', branch.id)

    throw error
  }
}

export async function getNextMembershipNumber() {
  // The latest finalised register takes priority.
  const { data: registers, error: registerError } = await supabase
    .from("annual_registers")
    .select("id, register_year, finalised_at")
    .eq("status", "Finalised")
    .order("register_year", { ascending: false })
    .order("finalised_at", { ascending: false, nullsFirst: false })
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

  // Before the first register is finalised, inspect actual membership
  // numbers instead of counting records.
  const { data: memberships, error: membershipError } = await supabase
    .from("memberships")
    .select("membership_number");

  if (membershipError) throw membershipError;

  const numbers = (memberships ?? [])
    .map((membership) => Number(membership.membership_number))
    .filter((number) => Number.isSafeInteger(number) && number > 0);

  return String(Math.max(0, ...numbers) + 1);
}