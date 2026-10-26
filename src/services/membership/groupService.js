
import { supabase } from '../../lib/supabase'
import { unwrap } from './serviceUtils'


export async function getChurchGroups({ activeOnly = true } = {}) {
  let query = supabase
    .from('church_groups')
    .select(
      'id, name, description, group_status, group_type, created_at, updated_at',
    )
    .order('name')

  if (activeOnly) {
    query = query.eq('group_status', 'Active')
  }

  return unwrap(await query) ?? []
}

export async function createChurchGroup({
  name,
  description = '',
  groupType = 'group',
}) {
  const cleanName = String(name ?? '').trim()
  const cleanDescription = String(description ?? '').trim()

  if (!cleanName) {
    throw new Error('Enter an organisation name.')
  }

  if (!['fellowship', 'group'].includes(groupType)) {
    throw new Error('Choose Fellowship or Group.')
  }

  const existing =
    unwrap(
      await supabase
        .from('church_groups')
        .select('id, name')
        .ilike('name', cleanName)
        .limit(1),
    ) ?? []

  if (existing.length) {
    throw new Error('An organisation with this name already exists.')
  }

  return unwrap(
    await supabase
      .from('church_groups')
      .insert({
        name: cleanName,
        description: cleanDescription || null,
        group_type: groupType,
        group_status: 'Active',
      })
      .select(
        'id, name, description, group_status, group_type, created_at, updated_at',
      )
      .single(),
  )
}


export async function updateChurchGroup(
  groupId,
  {
    name,
    description = '',
    groupStatus = 'Active',
    groupType,
  },
) {
  if (!groupId) {
    throw new Error('Select an organisation to update.')
  }

  const cleanName = String(name ?? '').trim()
  const cleanDescription = String(description ?? '').trim()

  if (!cleanName) {
    throw new Error('Enter an organisation name.')
  }

  if (!['Active', 'Inactive'].includes(groupStatus)) {
    throw new Error('Select a valid status.')
  }

  if (
    groupType !== undefined &&
    !['fellowship', 'group'].includes(groupType)
  ) {
    throw new Error('Choose Fellowship or Group.')
  }

  const duplicateQuery = supabase
    .from('church_groups')
    .select('id')
    .ilike('name', cleanName)
    .neq('id', groupId)
    .limit(1)

  const existing = unwrap(await duplicateQuery) ?? []

  if (existing.length) {
    throw new Error('Another organisation already uses this name.')
  }

  const changes = {
    name: cleanName,
    description: cleanDescription || null,
    group_status: groupStatus,
    updated_at: new Date().toISOString(),
  }

  if (groupType !== undefined) {
    changes.group_type = groupType
  }

  // Do not use .single(): an update returning zero rows should be
  // reported explicitly instead of producing a JSON coercion error.
  const result = await supabase
    .from('church_groups')
    .update(changes)
    .eq('id', groupId)
    .select(
      'id, name, description, group_status, group_type, created_at, updated_at',
    )

  const updatedRows = unwrap(result) ?? []

  if (updatedRows.length === 0) {
    throw new Error(
      'The organisation was not updated. It may not exist, or your Supabase permissions may prevent this change. Check the church_groups UPDATE policy.',
    )
  }

  return updatedRows[0]
}



export async function getMemberGroups(memberId) {
  if (!memberId) {
    throw new Error('A member record ID is required.')
  }

  const result = await supabase
    .from('member_group_assignments')
    .select(
      'id, member_id, group_id, role, valid_from, valid_until, church_groups(id, name, group_status)',
    )
    .eq('member_id', memberId)
    .is('valid_until', null)
    .order('valid_from', { ascending: false })

  return unwrap(result) ?? []
}

export async function getGroupAssignments(groupId) {
  if (!groupId) {
    throw new Error('A group ID is required.')
  }

  const result = await supabase
    .from('member_group_assignments')
    .select('id, member_id, group_id, role, valid_from, valid_until')
    .eq('group_id', groupId)
    .is('valid_until', null)
    .order('valid_from', { ascending: false })

  return unwrap(result) ?? []
}

export async function saveMemberGroupAssignments({
  memberId = null,
  groupId = null,
  role = null,
  validFrom = null,
  endAssignmentId = null,
}) {
  if (endAssignmentId) {
    return unwrap(
      await supabase.rpc('set_member_group_assignment', {
        p_member_id: null,
        p_group_id: null,
        p_role: null,
        p_valid_from: null,
        p_end_assignment_id: endAssignmentId,
      }),
    )
  }

  if (!memberId || !groupId) {
    throw new Error('Select both a member and a group.')
  }

  const current = unwrap(
    await supabase
      .from('member_group_assignments')
      .select('id')
      .eq('member_id', memberId)
      .eq('group_id', groupId)
      .is('valid_until', null)
      .limit(1),
  ) ?? []

  if (current.length) {
    throw new Error('This member is already assigned to this group.')
  }

  return unwrap(
    await supabase.rpc('set_member_group_assignment', {
      p_member_id: memberId,
      p_group_id: groupId,
      p_role: role,
      p_valid_from: validFrom,
      p_end_assignment_id: null,
    }),
  )
}


export async function updateMemberGroups(memberId, groupIds = []) {
  if (!memberId) {
    throw new Error('A member record ID is required.')
  }

  if (!Array.isArray(groupIds)) {
    throw new Error('Selected groups must be a list.')
  }

  const uniqueGroupIds = [...new Set(groupIds.filter(Boolean))]

  return unwrap(
    await supabase.rpc('update_member_groups', {
      p_member_id: memberId,
      p_group_ids: uniqueGroupIds,
    }),
  )
}
