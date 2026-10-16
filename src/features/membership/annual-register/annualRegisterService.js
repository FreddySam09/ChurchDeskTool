
import { supabase } from '../../../lib/supabase'
import { compareMembershipNumbers } from './annualRegisterUtils'

const TODAY = () => new Date().toISOString().slice(0, 10)

export async function listAnnualRegisters() {
  const { data, error } = await supabase
    .from('annual_registers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getAnnualRegister(registerId) {
  const { data, error } = await supabase
    .from('annual_registers')
    .select('*')
    .eq('id', registerId)
    .single()

  if (error) throw error
  return data
}

export async function listRegisterHistory(registerId) {
  const { data, error } = await supabase
    .from('annual_register_history')
    .select('*')
    .eq('annual_register_id', registerId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error
  return data ?? []
}

export async function recordRegisterHistory(
  registerId,
  eventType,
  details = {},
) {
  const { data: authData, error: authError } =
    await supabase.auth.getUser()

  if (authError) throw authError

  const { error } = await supabase
    .from('annual_register_history')
    .insert({
      annual_register_id: registerId,
      event_type: eventType,
      details,
      actor_user_id: authData?.user?.id ?? null,
    })

  if (error) throw error
}

export async function listRegisterEntries(registerId) {
  const { data: entries, error } = await supabase
    .from('annual_membership_entries')
    .select(`
      *,
      membership:memberships!annual_membership_entries_membership_id_fkey (
        id,
        membership_id,
        membership_status,
        head_member_id,
        head:members!memberships_head_member_id_fkey (
          id,
          person_id,
          name
        )
      ),
      branch:membership_branches!annual_membership_entries_branch_id_fkey (
        id,
        suffix,
        branch_status
      )
    `)
    .eq('annual_register_id', registerId)
    .order('sort_order', { ascending: true })

  if (error) throw error

  const rows = entries ?? []
  if (!rows.length) return []

  const entryIds = rows.map((entry) => entry.id)

  const { data: assignments, error: assignmentError } = await supabase
    .from('annual_member_assignments')
    .select(`
      id,
      annual_membership_entry_id,
      member_id,
      is_head,
      relationship_to_head,
      member:members!annual_member_assignments_member_id_fkey (
        id,
        person_id,
        name,
        status
      )
    `)
    .in('annual_membership_entry_id', entryIds)

  if (assignmentError) throw assignmentError

  const assignmentsByEntry = new Map()

  for (const assignment of assignments ?? []) {
    const key = assignment.annual_membership_entry_id
    const list = assignmentsByEntry.get(key) ?? []

    list.push(assignment)
    assignmentsByEntry.set(key, list)
  }

  return rows.map((entry) => {
    const entryAssignments = assignmentsByEntry.get(entry.id) ?? []
    const designatedHead = entryAssignments.find((item) => item.is_head)

    return {
      ...entry,
      assignments: entryAssignments,
      head_name:
        designatedHead?.member?.name ??
        (!entry.branch_id ? entry.membership?.head?.name : null) ??
        'Head needs review',
      head_is_valid: Boolean(designatedHead),
      source_head_name: entry.membership?.head?.name ?? 'Head not recorded',
      suffix: entry.branch?.suffix ?? '',
    }
  })
}

export async function createAnnualRegister({ name, year }) {
  const cleanedName = name.trim()

  if (!cleanedName) {
    throw new Error('Enter a name for this draft.')
  }

  if (!Number.isInteger(Number(year)) || Number(year) < 1900) {
    throw new Error('Enter a valid register year.')
  }

  const { data: authData, error: authError } =
    await supabase.auth.getUser()

  if (authError) throw authError
  if (!authData?.user) throw new Error('Please sign in first.')

  const { data, error } = await supabase
    .from('annual_registers')
    .insert({
      name: cleanedName,
      register_year: Number(year),
      status: 'Draft',
      created_by: authData.user.id,
    })
    .select('*')
    .single()

  if (error) throw error

  try {
    await recordRegisterHistory(data.id, 'DRAFT_CREATED', {
      name: cleanedName,
      register_year: Number(year),
    })

    return data
  } catch (historyError) {
    // Do not leave an empty register if its initial history event failed.
    await supabase
      .from('annual_registers')
      .delete()
      .eq('id', data.id)
      .eq('status', 'Draft')

    throw historyError
  }
}

export async function createRegisterSnapshot(registerId) {
  const { data: register, error: registerError } = await supabase
    .from('annual_registers')
    .select('id, status')
    .eq('id', registerId)
    .single()

  if (registerError) throw registerError
  if (register.status !== 'Draft') {
    throw new Error('Only a draft register can be populated.')
  }

  const today = TODAY()

  const [
    membershipResult,
    branchResult,
    assignmentResult,
  ] = await Promise.all([
    supabase
      .from('memberships')
      .select('id, membership_id, membership_number, head_member_id')
      .order('created_at', { ascending: true }),

    supabase
      .from('membership_branches')
      .select('id, membership_id, suffix, branch_status')
      .eq('branch_status', 'Active'),

    supabase
      .from('membership_structure_assignments')
      .select('membership_id, member_id, branch_id, relationship_to_head')
      .lte('valid_from', today)
      .or(`valid_until.is.null,valid_until.gte.${today}`),
  ])

  if (membershipResult.error) throw membershipResult.error
  if (branchResult.error) throw branchResult.error
  if (assignmentResult.error) throw assignmentResult.error

  const memberships = [...(membershipResult.data ?? [])]
    .sort(compareMembershipNumbers)

  const branches = branchResult.data ?? []
  const assignments = assignmentResult.data ?? []

  const entriesToInsert = []

  for (const membership of memberships) {
    entriesToInsert.push({
      key: `membership:${membership.id}`,
      membership_id: membership.id,
      branch_id: null,
      entry_type: 'Membership',
      membership_number: membership.membership_number ?? '',
      parent_key: null,
      head_member_id: membership.head_member_id,
    })

    const childBranches = branches
      .filter((branch) => branch.membership_id === membership.id)
      .sort((a, b) => a.suffix.localeCompare(b.suffix, undefined, {
        numeric: true,
      }))

    for (const branch of childBranches) {
      entriesToInsert.push({
        key: `branch:${branch.id}`,
        membership_id: membership.id,
        branch_id: branch.id,
        entry_type: 'Branch',
        membership_number: `${membership.membership_number ?? ''}${branch.suffix}`,
        parent_key: `membership:${membership.id}`,
        head_member_id: null,
      })
    }
  }

  const insertedEntries = []
  const entryIdByKey = new Map()

  try {
    for (let index = 0; index < entriesToInsert.length; index += 1) {
      const item = entriesToInsert[index]

      const { data: entry, error } = await supabase
        .from('annual_membership_entries')
        .insert({
          annual_register_id: registerId,
          membership_id: item.membership_id,
          branch_id: item.branch_id,
          entry_type: item.entry_type,
          parent_entry_id: item.parent_key
            ? entryIdByKey.get(item.parent_key) ?? null
            : null,
          membership_number: item.membership_number,
          sort_order: index + 1,
          is_included: true,
        })
        .select('*')
        .single()

      if (error) throw error

      entryIdByKey.set(item.key, entry.id)
      insertedEntries.push({ ...item, entry_id: entry.id })
    }

    const assignmentRows = []

    for (const item of insertedEntries) {
      const sourceAssignments = assignments.filter((assignment) => {
        if (assignment.membership_id !== item.membership_id) return false

        return item.branch_id
          ? assignment.branch_id === item.branch_id
          : assignment.branch_id == null
      })

      const assignedIds = new Set()

      if (!item.branch_id && item.head_member_id) {
        assignedIds.add(item.head_member_id)

        assignmentRows.push({
          annual_membership_entry_id: item.entry_id,
          member_id: item.head_member_id,
          is_head: true,
          relationship_to_head: 'Head',
        })
      }

      for (const assignment of sourceAssignments) {
        if (assignedIds.has(assignment.member_id)) continue
        assignedIds.add(assignment.member_id)

        assignmentRows.push({
          annual_membership_entry_id: item.entry_id,
          member_id: assignment.member_id,
          is_head: false,
          relationship_to_head: assignment.relationship_to_head,
        })
      }
    }

    if (assignmentRows.length) {
      const { error } = await supabase
        .from('annual_member_assignments')
        .insert(assignmentRows)

      if (error) throw error
    }

    await recordRegisterHistory(registerId, 'SNAPSHOT_CREATED', {
      entries: insertedEntries.length,
      note: 'Snapshot copied from current live membership structure.',
    })

    return insertedEntries.length
  } catch (error) {
    // Remove the incomplete snapshot. This only touches this draft's rows.
    await supabase
      .from('annual_membership_entries')
      .delete()
      .eq('annual_register_id', registerId)

    throw error
  }
}

export async function setEntryIncluded(entry, included) {
  const { error } = await supabase
    .from('annual_membership_entries')
    .update({
      is_included: included,
      removed_at: included ? null : new Date().toISOString(),
      removed_by: null,
      removal_reason: included ? null : 'Removed from register draft',
    })
    .eq('id', entry.id)

  if (error) throw error
}

export async function setEntryHead(entry, memberId) {
  if (!memberId) throw new Error('Choose a person to designate as head.')

  const selectedAssignment = (entry.assignments ?? []).find(
    (assignment) => assignment.member_id === memberId,
  )

  if (!selectedAssignment) {
    throw new Error('The selected person is not assigned to this entry.')
  }

  for (const assignment of entry.assignments ?? []) {
    const { error } = await supabase
      .from('annual_member_assignments')
      .update({ is_head: assignment.member_id === memberId })
      .eq('id', assignment.id)

    if (error) throw error
  }
}

export async function saveEntryOrder(registerId, entries) {
  const activeEntries = entries.filter((entry) => entry.is_included)
  const removedEntries = entries.filter((entry) => !entry.is_included)

  const mainNumbers = new Map()
  let number = 0

  for (const entry of activeEntries) {
    if (!entry.branch_id && entry.entry_type !== 'Branch') {
      number += 1
      mainNumbers.set(entry.id, String(number))
    }
  }

  const updates = entries.map((entry, index) => {
    let membershipNumber = entry.membership_number

    if (mainNumbers.has(entry.id)) {
      membershipNumber = mainNumbers.get(entry.id)
    } else if (entry.branch_id && entry.parent_entry_id) {
      const parentNumber = mainNumbers.get(entry.parent_entry_id)

      if (parentNumber) {
        membershipNumber = `${parentNumber}${entry.suffix ?? ''}`
      }
    }

    return {
      id: entry.id,
      sort_order: index + 1,
      membership_number: membershipNumber,
    }
  })

  // Writes affect draft entries only, never public.memberships.
  for (const update of updates) {
    const { error } = await supabase
      .from('annual_membership_entries')
      .update({
        sort_order: update.sort_order,
        membership_number: update.membership_number,
      })
      .eq('id', update.id)
      .eq('annual_register_id', registerId)

    if (error) throw error
  }

  await recordRegisterHistory(registerId, 'ENTRIES_REORDERED', {
    included_count: activeEntries.length,
    removed_count: removedEntries.length,
  })
}

export async function setRegisterStatus(registerId, status) {
  if (!['Draft', 'Under Review'].includes(status)) {
    throw new Error('This operation cannot finalise a register.')
  }

  const { error } = await supabase
    .from('annual_registers')
    .update({ status })
    .eq('id', registerId)

  if (error) throw error

  await recordRegisterHistory(registerId, 'STATUS_CHANGED', { status })
}

export async function splitBranchInDraft(entry, label = '') {
  if (!entry.branch_id || entry.entry_type !== 'Branch') {
    throw new Error('Only a branch entry can be split.')
  }

  const { error } = await supabase
    .from('annual_membership_entries')
    .update({
      entry_type: 'Independent Split',
      parent_entry_id: null,
      removal_reason: null,
    })
    .eq('id', entry.id)

  if (error) throw error

  await recordRegisterHistory(entry.annual_register_id, 'BRANCH_SPLIT_IN_DRAFT', {
    entry_id: entry.id,
    previous_number: entry.membership_number,
    label: label.trim() || null,
  })
}
