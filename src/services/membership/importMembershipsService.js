
import { supabase } from '../../lib/supabase'
import { getChurchGroups } from './groupService'
import { parseGroupNames } from '../../features/membership/import/membershipImportConfig'

function clean(value) {
  return String(value ?? '').trim()
}

function groupKey(value) {
  return clean(value).toLocaleLowerCase()
}

/**
 * Import the edited workbook preview in one PostgreSQL RPC call.
 *
 * Fellowship / Groups accepts multiple registered group names separated
 * by semicolons. Group IDs are resolved here and validated again by SQL.
 */
export async function importMembershipRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('There are no rows to import.')
  }

  const groups = await getChurchGroups({ activeOnly: true })
  const groupsByName = new Map()

  for (const group of groups) {
    const key = groupKey(group.name)

    if (groupsByName.has(key)) {
      throw new Error(
        `More than one active church group is named "${group.name}". Resolve the duplicate group names before importing.`,
      )
    }

    groupsByName.set(key, group)
  }

  const payloadRows = rows.map((row, index) => {
    const groupNames = parseGroupNames(row['Fellowship / Groups'])
    const groupIds = []
    const unknownNames = []

    for (const name of groupNames) {
      const group = groupsByName.get(groupKey(name))

      if (!group) {
        unknownNames.push(name)
      } else if (!groupIds.includes(group.id)) {
        groupIds.push(group.id)
      }
    }

    if (unknownNames.length > 0) {
      const rowNumber = row.__sourceRow ?? index + 2
      const memberName = clean(row.Name) || 'unnamed member'

      throw new Error(
        `Row ${rowNumber} (${memberName}): unregistered or inactive group name(s): ${unknownNames.join(', ')}. Use the exact names registered in Church Desk.`,
      )
    }

    const payload = {
      ...row,
      group_ids: groupIds,
    }

    delete payload.__sourceRow

    return payload
  })

  const { data, error } = await supabase.rpc(
    'import_memberships_transactional',
    {
      p_rows: payloadRows,
    },
  )

  if (error) {
    throw new Error(
      error.message ||
        'The membership import failed. The database transaction was rolled back.',
    )
  }

  if (!data || data.success !== true) {
    throw new Error(
      'The import did not return a successful result. Check Supabase before retrying.',
    )
  }

  return data
}
