
export function errorMessage(error) {
  return error?.message || 'Something went wrong.'
}

export function compareMembershipNumbers(a, b) {
  const left = String(a?.membership_number ?? '')
  const right = String(b?.membership_number ?? '')

  if (!left && right) return 1
  if (left && !right) return -1

  const numberOrder = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base',
  }).compare(left, right)

  if (numberOrder !== 0) return numberOrder

  if (a?.branch_id && !b?.branch_id) return 1
  if (!a?.branch_id && b?.branch_id) return -1

  return 0
}

export function getEntryHead(entry) {
  return entry?.assignments?.find((assignment) => assignment.is_head) ?? null
}

export function entryNeedsHeadReview(entry) {
  if (!entry?.is_included) return false
  return !getEntryHead(entry)
}

export function getEntryLabel(entry) {
  if (entry?.entry_type === 'Independent Split') {
    return 'Independent split'
  }

  if (entry?.branch_id) {
    return 'Branch'
  }

  return 'Membership'
}

export function getIncludedEntries(entries = []) {
  return entries.filter((entry) => entry.is_included)
}

export function getRemovedEntries(entries = []) {
  return entries.filter((entry) => !entry.is_included)
}

export function getRegisterSummary(entries = []) {
  const included = getIncludedEntries(entries)

  return {
    total: included.length,
    removed: getRemovedEntries(entries).length,
    needsHeadReview: included.filter(entryNeedsHeadReview).length,
    people: included.reduce(
      (count, entry) => count + (entry.assignments?.length ?? 0),
      0,
    ),
  }
}

export function getEntrySearchText(entry) {
  return [
    entry?.membership_number,
    entry?.membership?.membership_id,
    entry?.head_name,
    entry?.source_head_name,
    entry?.entry_type,
    entry?.suffix,
    ...(entry?.assignments ?? []).flatMap((assignment) => [
      assignment?.member?.name,
      assignment?.member?.person_id,
    ]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function filterEntries(entries = [], search = '', showRemoved = false) {
  const query = search.trim().toLowerCase()

  return entries.filter((entry) => {
    if (!showRemoved && !entry.is_included) return false

    return !query || getEntrySearchText(entry).includes(query)
  })
}
