
import { supabase } from '../../lib/supabase'

const GROUP_FIELDS =
  'id, name, description, group_status, group_type, created_at, updated_at'

const POSITION_FIELDS = `
  id,
  organization_type,
  group_id,
  role_name,
  capacity,
  display_order,
  is_active,
  created_at,
  updated_at
`

const APPOINTMENT_FIELDS = `
  id,
  position_id,
  member_id,
  valid_from,
  valid_until,
  notes,
  created_at,
  updated_at
`

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

function cleanText(value) {
  return String(value ?? '').trim()
}


export async function getLeadershipOrganizations() {
  const [groupResult, positionResult] = await Promise.all([
    supabase
      .from('church_groups')
      .select(GROUP_FIELDS)
      .order('name'),

    supabase
      .from('leadership_positions')
      .select(POSITION_FIELDS)
      .order('display_order')
      .order('role_name'),
  ])

  const groups = unwrap(groupResult) ?? []
  const positions = unwrap(positionResult) ?? []

  // Attach each leadership position to its organization.
  const organizationsWithPositions = groups.map((group) => ({
    ...group,
    positions: positions.filter(
      (position) =>
        position.organization_type !== 'church_office' &&
        position.group_id === group.id,
    ),
  }))

  return {
    officePositions: positions.filter(
      (position) => position.organization_type === 'church_office',
    ),

    fellowships: organizationsWithPositions.filter(
      (group) =>
        group.group_type === 'fellowship' &&
        group.group_status === 'Active',
    ),

    groups: organizationsWithPositions.filter(
      (group) =>
        group.group_type === 'group' &&
        group.group_status === 'Active',
    ),

    allGroups: groups,
    positions,
  }
}


export async function getLeadershipMembers() {
  const result = await supabase
    .from('members')
    .select('id, person_id, name, gender, status')
    .eq('status', 'Active')
    .order('name')

  return unwrap(result) ?? []
}

export async function getLeadershipAppointments() {
  const { data, error } = await supabase
    .from("leadership_appointments")
    .select(`
      *,
      member:members!leadership_appointments_member_id_fkey (
        id,
        person_id,
        name
      ),
      position:leadership_positions (
        id,
        role_name,
        capacity,
        group_id,
        organization_type
      )
    `)
    .order("valid_from", { ascending: false });

  if (error) throw error;

  return data || [];
}

export async function createLeadershipGroup({
  name,
  description = '',
  groupType = 'group',
}) {
  const cleanName = cleanText(name)

  if (!cleanName) {
    throw new Error('Enter a name for the organization.')
  }

  if (!['group', 'fellowship'].includes(groupType)) {
    throw new Error('Choose a valid organization type.')
  }

  const duplicateResult = await supabase
    .from('church_groups')
    .select('id')
    .ilike('name', cleanName)
    .limit(1)

  if ((unwrap(duplicateResult) ?? []).length) {
    throw new Error('An organization with this name already exists.')
  }

  const result = await supabase
    .from('church_groups')
    .insert({
      name: cleanName,
      description: cleanText(description) || null,
      group_status: 'Active',
      group_type: groupType,
    })
    .select(GROUP_FIELDS)
    .single()

  return unwrap(result)
}

export async function updateLeadershipGroup(
  groupId,
  { name, description = '', groupStatus = 'Active' },
) {
  if (!groupId) throw new Error('Select an organization.')

  const cleanName = cleanText(name)

  if (!cleanName) throw new Error('Enter an organization name.')

  if (!['Active', 'Inactive'].includes(groupStatus)) {
    throw new Error('Choose a valid status.')
  }

  const duplicateResult = await supabase
    .from('church_groups')
    .select('id')
    .ilike('name', cleanName)
    .neq('id', groupId)
    .limit(1)

  if ((unwrap(duplicateResult) ?? []).length) {
    throw new Error('Another organization already uses this name.')
  }

  const result = await supabase
    .from('church_groups')
    .update({
      name: cleanName,
      description: cleanText(description) || null,
      group_status: groupStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', groupId)
    .select(GROUP_FIELDS)
    .single()

  return unwrap(result)
}

export async function createLeadershipPosition({
  organizationType,
  groupId = null,
  roleName,
  capacity = 1,
  displayOrder = 0,
}) {
  const cleanRole = cleanText(roleName)
  const numericCapacity = Number(capacity)

  if (!cleanRole) throw new Error('Enter a position name.')

  if (!['church_office', 'fellowship', 'group'].includes(organizationType)) {
    throw new Error('Choose a valid organization type.')
  }

  if (
    organizationType === 'church_office'
      ? groupId !== null
      : !groupId
  ) {
    throw new Error('The selected organization is invalid.')
  }

  if (!Number.isInteger(numericCapacity) || numericCapacity < 1) {
    throw new Error('Position capacity must be at least one.')
  }

  const duplicateQuery = supabase
    .from('leadership_positions')
    .select('id')
    .ilike('role_name', cleanRole)
    .eq('organization_type', organizationType)

  if (groupId) duplicateQuery.eq('group_id', groupId)
  else duplicateQuery.is('group_id', null)

  const duplicateResult = await duplicateQuery.limit(1)

  if ((unwrap(duplicateResult) ?? []).length) {
    throw new Error('This position already exists for the organization.')
  }

  const result = await supabase
    .from('leadership_positions')
    .insert({
      organization_type: organizationType,
      group_id: groupId,
      role_name: cleanRole,
      capacity: numericCapacity,
      display_order: Number(displayOrder) || 0,
      is_active: true,
    })
    .select(POSITION_FIELDS)
    .single()

  return unwrap(result)
}

export async function updateLeadershipPosition(
  positionId,
  { roleName, capacity, displayOrder, isActive },
) {
  if (!positionId) throw new Error('Select a position.')

  const patch = {}

  if (roleName !== undefined) {
    patch.role_name = cleanText(roleName)
    if (!patch.role_name) throw new Error('Enter a position name.')
  }

  if (capacity !== undefined) {
    const parsed = Number(capacity)
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error('Capacity must be at least one.')
    }
    patch.capacity = parsed
  }

  if (displayOrder !== undefined) {
    patch.display_order = Number(displayOrder) || 0
  }

  if (isActive !== undefined) {
    patch.is_active = Boolean(isActive)
  }

  const result = await supabase
    .from('leadership_positions')
    .update(patch)
    .eq('id', positionId)
    .select(POSITION_FIELDS)
    .single()

  return unwrap(result)
}

export async function appointLeader({
  positionId,
  memberId,
  validFrom,
  notes = '',
}) {
  if (!positionId || !memberId) {
    throw new Error('Choose a position and a member.')
  }

  if (!validFrom) throw new Error('Choose the appointment date.')

  const [positionResult, activeAppointmentsResult, memberResult] =
    await Promise.all([
      supabase
        .from('leadership_positions')
        .select(POSITION_FIELDS)
        .eq('id', positionId)
        .single(),

      supabase
        .from('leadership_appointments')
        .select('id, member_id')
        .eq('position_id', positionId)
        .is('valid_until', null),

      supabase
        .from('members')
        .select('id, name, status')
        .eq('id', memberId)
        .single(),
    ])

  const position = unwrap(positionResult)
  const activeAppointments = unwrap(activeAppointmentsResult) ?? []
  const member = unwrap(memberResult)

  if (!position.is_active) {
    throw new Error('This position is inactive.')
  }

  if (member.status !== 'Active') {
    throw new Error('Only active members can be appointed.')
  }

  if (activeAppointments.some((item) => item.member_id === memberId)) {
    throw new Error('This person already holds this position.')
  }

  if (activeAppointments.length >= position.capacity) {
    throw new Error(
      `This position is full. Capacity: ${position.capacity}.`,
    )
  }

  const result = await supabase
    .from('leadership_appointments')
    .insert({
      position_id: positionId,
      member_id: memberId,
      valid_from: validFrom,
      notes: cleanText(notes) || null,
    })
    .select(APPOINTMENT_FIELDS)
    .single()

  return unwrap(result)
}

export async function endLeadershipAppointment({
  appointmentId,
  validUntil,
}) {
  if (!appointmentId) throw new Error('Select an appointment.')

  if (!validUntil) throw new Error('Choose the end date.')

  const existingResult = await supabase
    .from('leadership_appointments')
    .select('id, valid_from, valid_until')
    .eq('id', appointmentId)
    .single()

  const existing = unwrap(existingResult)

  if (existing.valid_until) {
    throw new Error('This appointment has already ended.')
  }

  if (validUntil < existing.valid_from) {
    throw new Error('The end date cannot precede the start date.')
  }

  const result = await supabase
    .from('leadership_appointments')
    .update({
      valid_until: validUntil,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .is('valid_until', null)
    .select(APPOINTMENT_FIELDS)
    .single()

  return unwrap(result)
}
