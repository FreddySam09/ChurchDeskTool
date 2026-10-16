
import { supabase } from '../../lib/supabase'
import { cleanObject, unwrap } from './serviceUtils'

export async function addMemberToMembership({
  membershipRowId,
  member,
  branchSuffix = null,
  relationshipToHead = null,
  dateOfMarriage = null,
}) {
  if (!membershipRowId) {
    throw new Error('Select a membership before adding a member.')
  }

  if (!member?.name?.trim()) {
    throw new Error('Member name is required.')
  }

  if (relationshipToHead === 'Spouse' && !dateOfMarriage) {
    throw new Error('A wedding date is required when adding a spouse.')
  }

  return unwrap(
    await supabase.rpc('add_member_to_membership', {
      p_membership_id: membershipRowId,
      p_member: cleanObject(member),
      p_branch_suffix: branchSuffix,
      p_relationship_to_head: relationshipToHead,
      p_date_of_marriage: dateOfMarriage || null,
    }),
  )
}


export async function addMemberToMembershipWithGroups({
  membershipRowId,
  member,
  branchSuffix = null,
  relationshipToHead = null,
  dateOfMarriage = null,
  groupIds = [],
}) {
  if (!membershipRowId) {
    throw new Error('Select a membership before adding a member.')
  }

  if (!member?.name?.trim()) {
    throw new Error('Member name is required.')
  }

  if (relationshipToHead === 'Spouse' && !dateOfMarriage) {
    throw new Error('A wedding date is required when adding a spouse.')
  }

  const uniqueGroupIds = [...new Set(groupIds.filter(Boolean))]

  return unwrap(
    await supabase.rpc('add_member_to_membership_with_groups', {
      p_membership_id: membershipRowId,
      p_member: cleanObject(member),
      p_branch_suffix: branchSuffix,
      p_relationship_to_head: relationshipToHead,
      p_date_of_marriage: dateOfMarriage || null,
      p_group_ids: uniqueGroupIds,
    }),
  )
}


export async function recordMemberRelationship({
  memberId,
  relatedMemberId,
  relationshipType,
  dateOfMarriage = null,
  notes = null,
}) {
  if (!memberId || !relatedMemberId || !relationshipType) {
    throw new Error('Both people and a relationship type are required.')
  }

  if (memberId === relatedMemberId) {
    throw new Error('A member cannot have a relationship with themselves.')
  }

  if (relationshipType === 'Spouse' && !dateOfMarriage) {
    throw new Error('A wedding date is required for a spouse relationship.')
  }

  return unwrap(
    await supabase.rpc('record_membership_relationship', {
      p_member_id: memberId,
      p_related_member_id: relatedMemberId,
      p_relationship_type: relationshipType,
      p_date_of_marriage: dateOfMarriage || null,
      p_notes: notes || null,
    }),
  )
}

export async function updateMember(memberRowId, patch) {
  if (!memberRowId) {
    throw new Error('A member record ID is required.')
  }

  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('A valid member update is required.')
  }

  return unwrap(
    await supabase.rpc('update_member', {
      p_member_row_id: memberRowId,
      p_patch: patch,
    }),
  )
}

export async function getMembers() {
  const result = await supabase
    .from('members')
    .select('*')
    .order('created_at', { ascending: false })

  return unwrap(result) ?? []
}

/**
 * Returns each person once, linked to their current membership.
 */
export async function getMemberDirectory() {
  const [
    membersResult,
    membershipsResult,
    assignmentsResult,
    branchesResult,
    groupsResult,
  ] = await Promise.all([
    supabase
      .from('members')
      .select(`
        id,
        person_id,
        name,
        gender,
        date_of_birth,
        marital_status,
        baptism_status,
        date_of_baptism,
        occupation_or_studying,
        phone_number,
        email,
        status,
        created_at
      `)
      .order('name', { ascending: true }),

    supabase
      .from('memberships')
      .select(`
        id,
        membership_id,
        membership_number,
        head_member_id,
        membership_status,
        area,
        city
      `),

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
      .select('id, membership_id, suffix, branch_status'),

    supabase
      .from('member_group_assignments')
      .select(`
        id,
        member_id,
        role,
        valid_until,
        church_groups (
          id,
          name,
          group_status
        )
      `)
      .is('valid_until', null),
  ])

  const members = unwrap(membersResult) ?? []
  const memberships = unwrap(membershipsResult) ?? []
  const assignments = unwrap(assignmentsResult) ?? []
  const branches = unwrap(branchesResult) ?? []
  const groupAssignments = unwrap(groupsResult) ?? []

  const membershipById = new Map(
    memberships.map((membership) => [membership.id, membership]),
  )

  const branchById = new Map(
    branches.map((branch) => [branch.id, branch]),
  )

  const assignmentsByMember = new Map()

  for (const assignment of assignments) {
    const current = assignmentsByMember.get(assignment.member_id) ?? []
    current.push(assignment)
    assignmentsByMember.set(assignment.member_id, current)
  }

  const groupsByMember = new Map()

  for (const assignment of groupAssignments) {
    if (!assignment.church_groups) continue

    const current = groupsByMember.get(assignment.member_id) ?? []

    current.push({
      id: assignment.church_groups.id,
      name: assignment.church_groups.name,
      role: assignment.role,
    })

    groupsByMember.set(assignment.member_id, current)
  }

  return members.map((member) => {
    const currentAssignments =
      assignmentsByMember.get(member.id) ?? []

    const assignment = currentAssignments[0] ?? null

    const membership = assignment
      ? membershipById.get(assignment.membership_id)
      : null

    const branch = assignment?.branch_id
      ? branchById.get(assignment.branch_id)
      : null

    const membershipNumber = membership?.membership_number

    const branchSuffix =
      branch?.branch_status === 'Active' ? branch.suffix ?? '' : ''

    return {
      ...member,
      assignment_id: assignment?.id ?? null,
      membership_row_id: membership?.id ?? null,
      membership_id: membership?.membership_id ?? null,
      membership_number: membershipNumber ?? null,
      display_membership_number:
        membershipNumber == null
          ? '—'
          : `${membershipNumber}${branchSuffix}`,
      membership_status: membership?.membership_status ?? 'Unassigned',
      membership_area: membership?.area ?? '',
      membership_city: membership?.city ?? '',
      relationship_to_head:
        assignment?.relationship_to_head ??
        (membership?.head_member_id === member.id
          ? 'Head of Membership'
          : 'Not recorded'),
      is_head: membership?.head_member_id === member.id,
      groups: groupsByMember.get(member.id) ?? [],
    }
  })
}
