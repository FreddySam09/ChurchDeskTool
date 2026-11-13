
export function unwrap(result) {
  if (result.error) {
    throw new Error(result.error.message || "Database request failed.");
  }

  return result.data;
}

export function clean(value) {
  return value === undefined || value === "" ? null : value;
}

export function cleanObject(object) {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => [key, clean(value)]),
  );
}

export const MEMBERSHIP_FIELDS = `
  id,
  membership_id,
  membership_number,
  head_member_id,
  membership_status,
  head_photo_path,
  door_number,
  floor_number,
  apartment_name,
  block_number,
  street_name,
  area,
  city,
  pincode,
  landmark,
  google_maps_link,
  primary_phone_number,
  alternate_phone_number,
  email,
  year_joined,
  created_at,
  updated_at
`;

export const MEMBER_FIELDS = `
  id,
  person_id,
  name,
  gender,
  date_of_birth,
  marital_status,
  date_of_marriage,
  baptism_status,
  date_of_baptism,
  occupation_or_studying,
  phone_number,
  email,
  status,
  created_at,
  updated_at
`;

export function mapGroupsForMember(groupAssignments, memberId) {
  return groupAssignments
    .filter((assignment) => assignment.member_id === memberId)
    .map((assignment) => ({
      ...(assignment.church_groups ?? {}),
      role: assignment.role,
      assignment_id: assignment.id,
    }));
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
      const first = membersById.get(relationship.member_id);
      const second = membersById.get(relationship.related_member_id);

      return {
        ...relationship,
        member_name: first?.name ?? "Unknown member",
        member_person_id: first?.person_id ?? null,
        related_member_name: second?.name ?? "Unknown member",
        related_member_person_id: second?.person_id ?? null,
      };
    });
}

export function attachSpouseDetails(members, relationships, membersById) {
  return members.map((member) => {
    const relationship = relationships.find(
      (item) =>
        item.relationship_type === "Spouse" &&
        (item.member_id === member.id ||
          item.related_member_id === member.id),
    );

    if (!relationship) {
      return {
        ...member,
        spouse_name: null,
        spouse_person_id: null,
        spouse_id: null,
        date_of_marriage: null,
      };
    }

    const spouseId =
      relationship.member_id === member.id
        ? relationship.related_member_id
        : relationship.member_id;

    const spouse = membersById.get(spouseId);

    return {
      ...member,
      spouse_id: spouseId,
      spouse_name: spouse?.name ?? null,
      spouse_person_id: spouse?.person_id ?? null,
      date_of_marriage: relationship.date_of_marriage ?? null,
    };
  });
}

/*
 * Relationship display helpers.
 *
 * The relationship graph is authoritative.
 * membership_structure_assignments.relationship_to_head is NOT
 * used to determine the current family relationship.
 */

function normalizeRelationship(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function genderLabel(member, male, female, neutral = male) {
  if (member?.gender === "Female") return female;
  if (member?.gender === "Male") return male;
  return neutral;
}

function buildFamilyGraph(relationships) {
  const graph = {
    parents: new Map(),
    children: new Map(),
    spouses: new Map(),
    siblings: new Map(),
  };

  function addToMap(map, key, value) {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(value);
  }

  for (const relationship of relationships) {
    const first = relationship.member_id;
    const second = relationship.related_member_id;

    if (!first || !second || first === second) continue;

    const type = normalizeRelationship(relationship.relationship_type);

    if (type === "spouse") {
      addToMap(graph.spouses, first, second);
      addToMap(graph.spouses, second, first);
      continue;
    }

    if (
      type === "parent" ||
      type === "father" ||
      type === "mother"
    ) {
      addToMap(graph.children, first, second);
      addToMap(graph.parents, second, first);
      continue;
    }

    if (
      type === "child" ||
      type === "son" ||
      type === "daughter"
    ) {
      addToMap(graph.children, second, first);
      addToMap(graph.parents, first, second);
      continue;
    }

    if (type === "sibling" || type === "brother" || type === "sister") {
      addToMap(graph.siblings, first, second);
      addToMap(graph.siblings, second, first);
    }
  }

  return graph;
}

function getSet(map, key) {
  return map.get(key) ?? new Set();
}

function getDirectRelationship(memberId, headId, graph, membersById) {
  // Spouse
  if (getSet(graph.spouses, headId).has(memberId)) {
    return "Spouse";
  }

  // Member is a child of the current head.
  if (getSet(graph.children, headId).has(memberId)) {
    return genderLabel(membersById.get(memberId), "Son", "Daughter", "Child");
  }

  // Member is a parent of the current head.
  if (getSet(graph.parents, headId).has(memberId)) {
    return genderLabel(
      membersById.get(memberId),
      "Father",
      "Mother",
      "Parent",
    );
  }

  // Sibling
  if (getSet(graph.siblings, headId).has(memberId)) {
    return genderLabel(
      membersById.get(memberId),
      "Brother",
      "Sister",
      "Sibling",
    );
  }

  return null;
}

function getExtendedRelationship(memberId, headId, graph, membersById) {
  const headParents = getSet(graph.parents, headId);
  const memberParents = getSet(graph.parents, memberId);

  // Grandparent of the current head.
  for (const parentId of headParents) {
    if (getSet(graph.parents, parentId).has(memberId)) {
      return genderLabel(
        membersById.get(memberId),
        "Grandfather",
        "Grandmother",
        "Grandparent",
      );
    }
  }

  // Grandchild of the current head.
  for (const parentId of memberParents) {
    if (getSet(graph.children, headId).has(parentId)) {
      return genderLabel(
        membersById.get(memberId),
        "Grandson",
        "Granddaughter",
        "Grandchild",
      );
    }
  }

  /*
   * Spouse of a parent:
   *
   * Example:
   * John is the father of NAme.
   * Jane is John's spouse.
   * Therefore Jane is displayed as NAme's mother.
   *
   * Only infer this when the parent has exactly one recorded spouse.
   * This avoids guessing in cases involving multiple marriages.
   */
  for (const parentId of headParents) {
    const parentSpouses = getSet(graph.spouses, parentId);

    if (parentSpouses.size !== 1) continue;

    const spouseId = [...parentSpouses][0];

    if (spouseId !== memberId) continue;

    return genderLabel(
      membersById.get(memberId),
      "Father",
      "Mother",
      "Parent",
    );
  }

  // Sibling of a parent = aunt/uncle.
  for (const parentId of headParents) {
    if (getSet(graph.siblings, parentId).has(memberId)) {
      return genderLabel(
        membersById.get(memberId),
        "Uncle",
        "Aunt",
        "Aunt / Uncle",
      );
    }
  }

  return null;
}

/**
 * Calculates a member's relationship to the current membership head.
 *
 * The relationship graph is not modified.
 * The returned values are for display only.
 */
export function deriveRelationshipToHead({
  member,
  headId,
  relationships,
  membersById,
}) {
  if (!member?.id || !headId) {
    return "Not recorded";
  }

  if (member.id === headId) {
    return "Head";
  }

  const graph = buildFamilyGraph(relationships);

  const direct = getDirectRelationship(
    member.id,
    headId,
    graph,
    membersById,
  );

  if (direct) return direct;

  const extended = getExtendedRelationship(
    member.id,
    headId,
    graph,
    membersById,
  );

  if (extended) return extended;

  return "Not recorded";
}
