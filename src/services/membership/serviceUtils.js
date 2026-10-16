
export function unwrap(result) {
  if (result.error) {
    throw new Error(result.error.message || 'Database request failed.')
  }

  return result.data
}

export function clean(value) {
  return value === undefined || value === '' ? null : value
}

export function cleanObject(object) {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => [key, clean(value)]),
  )
}

export const MEMBERSHIP_FIELDS = `
  id,
  membership_id,
  membership_number,
  head_member_id,
  membership_status,
  head_photo_path,
  door_number,
  street_name,
  area,
  city,
  pincode,
  landmark,
  primary_phone_number,
  alternate_phone_number,
  email,
  year_joined,
  created_at,
  updated_at
`

export const MEMBER_FIELDS = `
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
  created_at,
  updated_at
`

export function mapGroupsForMember(groupAssignments, memberId) {
  return groupAssignments
    .filter((assignment) => assignment.member_id === memberId)
    .map((assignment) => ({
      ...(assignment.church_groups ?? {}),
      role: assignment.role,
      assignment_id: assignment.id,
    }))
}

export function resolveRelationships(
  relationships,
  membersById,
  includedMemberIds,
) {
  return relationships
    .filter(
      (relationship) =>
        includedMemberIds.has(relationship.member_id) ||
        includedMemberIds.has(relationship.related_member_id),
    )
    .map((relationship) => {
      const first = membersById.get(relationship.member_id)
      const second = membersById.get(relationship.related_member_id)

      return {
        ...relationship,
        member_name: first?.name ?? 'Unknown member',
        member_person_id: first?.person_id ?? null,
        related_member_name: second?.name ?? 'Unknown member',
        related_member_person_id: second?.person_id ?? null,
      }
    })
}

export function attachSpouseDetails(members, relationships, membersById) {
  return members.map((member) => {
    const relationship = relationships.find(
      (item) =>
        item.relationship_type === 'Spouse' &&
        (item.member_id === member.id ||
          item.related_member_id === member.id),
    )

    if (!relationship) {
      return {
        ...member,
        spouse_name: null,
        spouse_person_id: null,
        spouse_id: null,
        date_of_marriage: null,
      }
    }

    const spouseId =
      relationship.member_id === member.id
        ? relationship.related_member_id
        : relationship.member_id

    const spouse = membersById.get(spouseId)

    return {
      ...member,
      spouse_id: spouseId,
      spouse_name: spouse?.name ?? null,
      spouse_person_id: spouse?.person_id ?? null,
      date_of_marriage: relationship.date_of_marriage ?? null,
    }
  })
}
