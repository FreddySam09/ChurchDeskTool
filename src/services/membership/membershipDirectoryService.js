
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

  return memberships.map((membership) => {
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
