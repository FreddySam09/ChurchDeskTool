import { supabase } from '../../lib/supabase'

const VISIT_STATUSES = ['Pending', 'Visited', 'Missed']

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

function getCampaignYear(visitDate) {
  const year = Number(String(visitDate || '').slice(0, 4))

  if (!Number.isInteger(year) || year < 1900) {
    throw new Error('The Carol Day has an invalid visit date.')
  }

  return year
}

async function getMembershipsByIds(ids) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))]

  if (!uniqueIds.length) return []

  const memberships = unwrap(
    await supabase
      .from('memberships')
      .select(`
        id,
        membership_id,
        membership_number,
        head_member_id,
        membership_status,
        door_number,
        street_name,
        area,
        city,
        pincode,
        landmark,
        primary_phone_number,
        alternate_phone_number
      `)
      .in('id', uniqueIds),
  ) ?? []

  const headIds = [
    ...new Set(memberships.map((item) => item.head_member_id).filter(Boolean)),
  ]

  let heads = []

  if (headIds.length) {
    heads = unwrap(
      await supabase
        .from('members')
        .select('id, name, status')
        .in('id', headIds),
    ) ?? []
  }

  const headById = new Map(heads.map((head) => [head.id, head]))

  return memberships.map((membership) => ({
    ...membership,
    head_name:
      headById.get(membership.head_member_id)?.name || 'Name not recorded',
  }))
}

/**
 * Load active memberships for the assignment picker.
 * Address fields remain sourced from the memberships table.
 */
export async function getAssignableCarolMemberships() {
  const memberships = unwrap(
    await supabase
      .from('memberships')
      .select(`
        id,
        membership_id,
        membership_number,
        head_member_id,
        membership_status,
        door_number,
        street_name,
        area,
        city,
        pincode,
        landmark,
        primary_phone_number,
        alternate_phone_number
      `)
      .eq('membership_status', 'Active')
      .order('membership_number', { ascending: true }),
  ) ?? []

  const headIds = [
    ...new Set(memberships.map((item) => item.head_member_id).filter(Boolean)),
  ]

  let heads = []

  if (headIds.length) {
    heads = unwrap(
      await supabase
        .from('members')
        .select('id, name, status')
        .in('id', headIds),
    ) ?? []
  }

  const headById = new Map(heads.map((head) => [head.id, head]))

  return memberships.map((membership) => ({
    ...membership,
    head_name:
      headById.get(membership.head_member_id)?.name || 'Name not recorded',
  }))
}

/**
 * Load one Carol Day.
 */
export async function getCarolDay(dayId) {
  if (!dayId) throw new Error('Carol Day ID is missing.')

  return unwrap(
    await supabase
      .from('carol_days')
      .select('*')
      .eq('id', dayId)
      .single(),
  )
}

/**
 * Load visits for a Carol Day and attach the household's membership details.
 */
export async function getCarolDayVisits(dayId) {
  if (!dayId) throw new Error('Carol Day ID is missing.')

  const visits = unwrap(
    await supabase
      .from('carol_day_visits')
      .select(`
        id,
        membership_id,
        carol_day_id,
        campaign_year,
        status,
        sort_order,
        visit_notes,
        visited_at,
        created_at,
        updated_at
      `)
      .eq('carol_day_id', dayId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ) ?? []

  const memberships = await getMembershipsByIds(
    visits.map((visit) => visit.membership_id),
  )

  const membershipById = new Map(
    memberships.map((membership) => [membership.id, membership]),
  )

  return visits.map((visit) => ({
    ...visit,
    membership: membershipById.get(visit.membership_id) ?? null,
  }))
}

/**
 * Load all visit assignments for a campaign year.
 * Used to avoid silently assigning one membership to two Carol Days.
 */
export async function getCarolCampaignAssignments(campaignYear) {
  if (!campaignYear) throw new Error('Campaign year is required.')

  return unwrap(
    await supabase
      .from('carol_day_visits')
      .select(`
        id,
        membership_id,
        carol_day_id,
        campaign_year,
        status,
        sort_order
      `)
      .eq('campaign_year', campaignYear)
      .not('carol_day_id', 'is', null),
  ) ?? []
}

/**
 * Assign multiple memberships to a Carol Day.
 * Memberships already assigned in this campaign are not duplicated.
 */
export async function assignMembershipsToCarolDay({
  day,
  membershipIds,
}) {
  if (!day?.id) throw new Error('Select a Carol Day first.')

  const ids = [...new Set((membershipIds || []).filter(Boolean))]

  if (!ids.length) {
    throw new Error('Select at least one membership to assign.')
  }

  const campaignYear = getCampaignYear(day.visit_date)

  const allCampaignAssignments =
    await getCarolCampaignAssignments(campaignYear)

  const assignmentByMembership = new Map()

  for (const assignment of allCampaignAssignments) {
    if (!assignmentByMembership.has(assignment.membership_id)) {
      assignmentByMembership.set(
        assignment.membership_id,
        assignment,
      )
    }
  }

  const alreadyAssignedHere = new Set(
    allCampaignAssignments
      .filter((item) => item.carol_day_id === day.id)
      .map((item) => item.membership_id),
  )

  const assignedElsewhere = ids.filter((id) => {
    const existing = assignmentByMembership.get(id)

    return existing && existing.carol_day_id !== day.id
  })

  if (assignedElsewhere.length) {
    throw new Error(
      `${assignedElsewhere.length} selected membership(s) are already assigned to another Carol Day this year. Remove or reassign them first.`,
    )
  }

  const newIds = ids.filter(
    (id) =>
      !alreadyAssignedHere.has(id) &&
      !assignmentByMembership.has(id),
  )

  if (!newIds.length) {
    throw new Error(
      'All selected memberships are already assigned to this Carol Day.',
    )
  }

  const currentDayVisits = allCampaignAssignments.filter(
    (item) => item.carol_day_id === day.id,
  )

  const nextSortOrder =
    Math.max(0, ...currentDayVisits.map((item) => Number(item.sort_order) || 0)) + 1

  const rows = newIds.map((membershipId, index) => ({
    membership_id: membershipId,
    carol_day_id: day.id,
    campaign_year: campaignYear,
    status: 'Pending',
    sort_order: nextSortOrder + index,
  }))

  return unwrap(
    await supabase
      .from('carol_day_visits')
      .insert(rows)
      .select('*'),
  )
}

/**
 * Change a visit's status.
 */
export async function updateCarolVisitStatus(visitId, status) {
  if (!visitId) throw new Error('Visit ID is missing.')

  if (!VISIT_STATUSES.includes(status)) {
    throw new Error('Select a valid visit status.')
  }

  return unwrap(
    await supabase
      .from('carol_day_visits')
      .update({
        status,
        visited_at: status === 'Visited' ? new Date().toISOString() : null,
      })
      .eq('id', visitId)
      .select('*')
      .single(),
  )
}

/**
 * Remove a visit assignment without deleting the membership itself.
 */
export async function removeCarolVisit(visitId) {
  if (!visitId) throw new Error('Visit ID is missing.')

  return unwrap(
    await supabase
      .from('carol_day_visits')
      .delete()
      .eq('id', visitId)
      .select('id')
      .single(),
  )
}