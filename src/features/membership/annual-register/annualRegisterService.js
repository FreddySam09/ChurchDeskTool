import { supabase } from "../../../lib/supabase";
import { compareMembershipNumbers } from "./annualRegisterUtils";

const TODAY = () => new Date().toISOString().slice(0, 10);

export async function listAnnualRegisters() {
  const { data, error } = await supabase
    .from("annual_registers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getAnnualRegister(registerId) {
  const { data, error } = await supabase
    .from("annual_registers")
    .select("*")
    .eq("id", registerId)
    .single();

  if (error) throw error;
  return data;
}

export async function listRegisterHistory(registerId) {
  const { data, error } = await supabase
    .from("annual_register_history")
    .select("*")
    .eq("annual_register_id", registerId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return data ?? [];
}

export async function recordRegisterHistory(
  registerId,
  eventType,
  details = {},
) {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) throw authError;

  const { error } = await supabase.from("annual_register_history").insert({
    annual_register_id: registerId,
    event_type: eventType,
    details,
    actor_user_id: authData?.user?.id ?? null,
  });

  if (error) throw error;
}


export async function listRegisterEntries(registerId) {
  const { data: entries, error } = await supabase
    .from("annual_membership_entries")
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
        membership_id,
        suffix,
        branch_status
      )
    `)
    .eq("annual_register_id", registerId)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  const rows = entries ?? [];
  if (!rows.length) return [];

  const entryIds = rows.map((entry) => entry.id);

  const { data: assignments, error: assignmentError } = await supabase
    .from("annual_member_assignments")
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
    .in("annual_membership_entry_id", entryIds);

  if (assignmentError) throw assignmentError;

  const assignmentsByEntry = new Map();

  for (const assignment of assignments ?? []) {
    const key = assignment.annual_membership_entry_id;
    const list = assignmentsByEntry.get(key) ?? [];
    list.push(assignment);
    assignmentsByEntry.set(key, list);
  }

  return rows.map((entry) => {
    const entryAssignments = assignmentsByEntry.get(entry.id) ?? [];

    // A branch has one person. That person is its head by definition.
    // When it is split, it becomes an independent entry with that same person.
    const automaticBranchHead =
      entry.branch_id || entry.entry_type === "Independent Split"
        ? entryAssignments.length === 1
          ? entryAssignments[0]
          : null
        : null;

    const designatedHead =
      entryAssignments.find((item) => item.is_head) ??
      automaticBranchHead;

    const normalizedAssignments = entryAssignments.map((assignment) => ({
      ...assignment,
      is_head: designatedHead
        ? assignment.id === designatedHead.id
        : assignment.is_head,
      relationship_to_head:
        designatedHead && assignment.id === designatedHead.id
          ? "Head"
          : assignment.relationship_to_head,
    }));

    return {
      ...entry,
      assignments: normalizedAssignments,
      head_name:
        designatedHead?.member?.name ??
        (!entry.branch_id ? entry.membership?.head?.name : null) ??
        "Head needs review",
      head_is_valid: Boolean(designatedHead),
      source_head_name: entry.membership?.head?.name ?? "Head not recorded",
      suffix: entry.branch?.suffix ?? "",
    };
  });
}


export async function createAnnualRegister({ name, year }) {
  const cleanedName = name.trim();

  if (!cleanedName) {
    throw new Error("Enter a name for this draft.");
  }

  if (!Number.isInteger(Number(year)) || Number(year) < 1900) {
    throw new Error("Enter a valid register year.");
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!authData?.user) throw new Error("Please sign in first.");

  const { data, error } = await supabase
    .from("annual_registers")
    .insert({
      name: cleanedName,
      register_year: Number(year),
      status: "Draft",
      created_by: authData.user.id,
    })
    .select("*")
    .single();

  if (error) throw error;

  try {
    await recordRegisterHistory(data.id, "DRAFT_CREATED", {
      name: cleanedName,
      register_year: Number(year),
    });

    return data;
  } catch (historyError) {
    // Do not leave an empty register if its initial history event failed.
    await supabase
      .from("annual_registers")
      .delete()
      .eq("id", data.id)
      .eq("status", "Draft");

    throw historyError;
  }
}

export async function createRegisterSnapshot(registerId) {
  const { data: register, error: registerError } = await supabase
    .from("annual_registers")
    .select("id, status")
    .eq("id", registerId)
    .single();

  if (registerError) throw registerError;
  if (register.status !== "Draft") {
    throw new Error("Only a draft register can be populated.");
  }

  const today = TODAY();

  const [membershipResult, branchResult, assignmentResult] = await Promise.all([
    supabase
    .from("memberships")
    .select("id, membership_id, membership_number, head_member_id, membership_status")
    .eq("membership_status", "Active")
    .order("created_at", { ascending: true }),

    supabase
      .from("membership_branches")
      .select("id, membership_id, suffix, branch_status")
      .eq("branch_status", "Active"),

    supabase
      .from("membership_structure_assignments")
      .select("membership_id, member_id, branch_id, relationship_to_head")
      .lte("valid_from", today)
      .or(`valid_until.is.null,valid_until.gte.${today}`),
  ]);

  if (membershipResult.error) throw membershipResult.error;
  if (branchResult.error) throw branchResult.error;
  if (assignmentResult.error) throw assignmentResult.error;

  const memberships = [...(membershipResult.data ?? [])].sort(
    compareMembershipNumbers,
  );

  const branches = branchResult.data ?? [];
  const assignments = assignmentResult.data ?? [];

  const entriesToInsert = [];

  for (const membership of memberships) {
    entriesToInsert.push({
      key: `membership:${membership.id}`,
      membership_id: membership.id,
      branch_id: null,
      entry_type: "Membership",
      membership_number: membership.membership_number ?? "",
      parent_key: null,
      head_member_id: membership.head_member_id,
    });

    const childBranches = branches
      .filter((branch) => branch.membership_id === membership.id)
      .sort((a, b) =>
        a.suffix.localeCompare(b.suffix, undefined, {
          numeric: true,
        }),
      );

    for (const branch of childBranches) {
      entriesToInsert.push({
        key: `branch:${branch.id}`,
        membership_id: membership.id,
        branch_id: branch.id,
        entry_type: "Branch",
        membership_number: `${membership.membership_number ?? ""}${branch.suffix}`,
        parent_key: `membership:${membership.id}`,
        head_member_id: null,
      });
    }
  }

  const insertedEntries = [];
  const entryIdByKey = new Map();

  try {
    for (let index = 0; index < entriesToInsert.length; index += 1) {
      const item = entriesToInsert[index];

      const { data: entry, error } = await supabase
        .from("annual_membership_entries")
        .insert({
          annual_register_id: registerId,
          membership_id: item.membership_id,
          branch_id: item.branch_id,
          entry_type: item.entry_type,
          parent_entry_id: item.parent_key
            ? (entryIdByKey.get(item.parent_key) ?? null)
            : null,
          membership_number: item.membership_number,
          sort_order: index + 1,
          is_included: true,
        })
        .select("*")
        .single();

      if (error) throw error;

      entryIdByKey.set(item.key, entry.id);
      insertedEntries.push({ ...item, entry_id: entry.id });
    }

    const assignmentRows = [];

    for (const item of insertedEntries) {
      const sourceAssignments = assignments.filter((assignment) => {
        if (assignment.membership_id !== item.membership_id) return false;

        return item.branch_id
          ? assignment.branch_id === item.branch_id
          : assignment.branch_id == null;
      });

      const assignedIds = new Set();

      if (!item.branch_id && item.head_member_id) {
        assignedIds.add(item.head_member_id);

        assignmentRows.push({
          annual_membership_entry_id: item.entry_id,
          member_id: item.head_member_id,
          is_head: true,
          relationship_to_head: "Head",
        });
      }

      for (const assignment of sourceAssignments) {
        if (assignedIds.has(assignment.member_id)) continue;
        assignedIds.add(assignment.member_id);

        assignmentRows.push({
          annual_membership_entry_id: item.entry_id,
          member_id: assignment.member_id,
          is_head: false,
          relationship_to_head: assignment.relationship_to_head,
        });
      }
    }

    if (assignmentRows.length) {
      const { error } = await supabase
        .from("annual_member_assignments")
        .insert(assignmentRows);

      if (error) throw error;
    }

    await recordRegisterHistory(registerId, "SNAPSHOT_CREATED", {
      entries: insertedEntries.length,
      note: "Snapshot copied from current live membership structure.",
    });

    return insertedEntries.length;
  } catch (error) {
    // Remove the incomplete snapshot. This only touches this draft's rows.
    await supabase
      .from("annual_membership_entries")
      .delete()
      .eq("annual_register_id", registerId);

    throw error;
  }
}



export async function setEntryIncluded(entry, included) {
  if (!entry?.id || !entry?.annual_register_id) {
    throw new Error("The register entry is missing its ID.");
  }

  const registerId = entry.annual_register_id;

  const { data: register, error: registerError } = await supabase
    .from("annual_registers")
    .select("id, status")
    .eq("id", registerId)
    .single();

  if (registerError) throw registerError;

  if (register.status === "Finalised") {
    throw new Error("Finalised registers are read-only.");
  }

  const { data: currentEntry, error: entryError } = await supabase
    .from("annual_membership_entries")
    .select("*")
    .eq("id", entry.id)
    .eq("annual_register_id", registerId)
    .single();

  if (entryError) throw entryError;

  if (currentEntry.is_included === included) return;

  const isParent =
    !currentEntry.branch_id &&
    currentEntry.entry_type !== "Branch" &&
    currentEntry.entry_type !== "Independent Split";

  if (!included) {
    // When removing a parent, convert its attached branches into
    // independent entries in this draft. Preserve their parent links
    // so the original structure can be restored later.
    if (isParent) {
      const { error: branchesError } = await supabase
        .from("annual_membership_entries")
        .update({
          entry_type: "Independent Split",
        })
        .eq("annual_register_id", registerId)
        .eq("parent_entry_id", currentEntry.id)
        .eq("entry_type", "Branch")
        .eq("is_included", true);

      if (branchesError) throw branchesError;
    }

    // Do not set membership_number to null.
    // The database requires this field even for excluded entries.
    const { error } = await supabase
      .from("annual_membership_entries")
      .update({
        is_included: false,
        removed_at: new Date().toISOString(),
        removed_by: null,
        removal_reason: "Removed from register draft",
      })
      .eq("id", currentEntry.id)
      .eq("annual_register_id", registerId);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("annual_membership_entries")
      .update({
        is_included: true,
        removed_at: null,
        removed_by: null,
        removal_reason: null,
      })
      .eq("id", currentEntry.id)
      .eq("annual_register_id", registerId);

    if (error) throw error;

    // Restore branches attached to this parent that were automatically
    // converted to independent entries. Intentionally split branches
    // have a null parent_entry_id and remain independent.
    if (isParent) {
      const { error: restoreBranchesError } = await supabase
        .from("annual_membership_entries")
        .update({
          entry_type: "Branch",
        })
        .eq("annual_register_id", registerId)
        .eq("parent_entry_id", currentEntry.id)
        .eq("entry_type", "Independent Split")
        .eq("is_included", true)
        .not("branch_id", "is", null);

      if (restoreBranchesError) throw restoreBranchesError;
    }
  }

  // Re-read the draft so renumbering uses the latest saved structure.
  const { data: entries, error: entriesError } = await supabase
    .from("annual_membership_entries")
    .select("*")
    .eq("annual_register_id", registerId)
    .order("sort_order", { ascending: true });

  if (entriesError) throw entriesError;

  await saveEntryOrder(registerId, entries ?? []);

  await recordRegisterHistory(
    registerId,
    included ? "ENTRY_RESTORED" : "ENTRY_REMOVED",
    {
      entry_id: currentEntry.id,
      membership_id: currentEntry.membership_id,
      included,
      parent_id: isParent
        ? currentEntry.id
        : currentEntry.parent_entry_id,
    },
  );
}



export async function setEntryHead(entry, memberId) {
  if (!memberId) throw new Error("Choose a person to designate as head.");

  const selectedAssignment = (entry.assignments ?? []).find(
    (assignment) => assignment.member_id === memberId,
  );

  if (!selectedAssignment) {
    throw new Error("The selected person is not assigned to this entry.");
  }

  for (const assignment of entry.assignments ?? []) {
    const { error } = await supabase
      .from("annual_member_assignments")
      .update({ is_head: assignment.member_id === memberId })
      .eq("id", assignment.id);

    if (error) throw error;
  }
}


export async function setEntryNumber(entry, value) {
  const proposed = String(value ?? "").trim();

  if (!proposed) {
    throw new Error("Enter a proposed membership number.");
  }

  if (!/^[A-Za-z0-9]+$/.test(proposed)) {
    throw new Error(
      "Membership numbers can contain only letters and numbers.",
    );
  }

  const { data: register, error: registerError } = await supabase
    .from("annual_registers")
    .select("id, status")
    .eq("id", entry.annual_register_id)
    .single();

  if (registerError) throw registerError;

  if (register.status === "Finalised") {
    throw new Error("Finalised registers are read-only.");
  }

  const { error } = await supabase
    .from("annual_membership_entries")
    .update({ membership_number: proposed })
    .eq("id", entry.id)
    .eq("annual_register_id", entry.annual_register_id);

  if (error) throw error;

  // When changing a main membership number, update its attached branches.
  if (!entry.branch_id && entry.entry_type !== "Branch") {
    const { data: children, error: childrenError } = await supabase
      .from("annual_membership_entries")
      .select(`
        id,
        membership_number,
        branch:membership_branches!annual_membership_entries_branch_id_fkey (
          suffix
        )
      `)
      .eq("annual_register_id", entry.annual_register_id)
      .eq("parent_entry_id", entry.id)
      .eq("entry_type", "Branch");

    if (childrenError) throw childrenError;

    for (const child of children ?? []) {
      const suffix =
        child.branch?.suffix ||
        String(child.membership_number ?? "").replace(
          String(entry.membership_number ?? ""),
          "",
        );

      const { error: childError } = await supabase
        .from("annual_membership_entries")
        .update({ membership_number: `${proposed}${suffix}` })
        .eq("id", child.id)
        .eq("annual_register_id", entry.annual_register_id);

      if (childError) throw childError;
    }
  }

  // Reload the latest entries after saving the proposed number.
  const { data: entries, error: entriesError } = await supabase
    .from("annual_membership_entries")
    .select("*")
    .eq("annual_register_id", entry.annual_register_id)
    .order("sort_order", { ascending: true });

  if (entriesError) throw entriesError;

  const allEntries = entries ?? [];

  // Sort included entries naturally by their proposed numbers.
  // A parent stays before its attached branches: 2, 2A, 2B, 3.
  const includedEntries = allEntries
    .filter((item) => item.is_included)
    .sort((a, b) => {
      const numberA = String(a.membership_number ?? "");
      const numberB = String(b.membership_number ?? "");

      const numberComparison = numberA.localeCompare(
        numberB,
        undefined,
        {
          numeric: true,
          sensitivity: "base",
        },
      );

      if (numberComparison !== 0) return numberComparison;

      // If numbers tie, put the main membership before its branch.
      if (!a.branch_id && b.branch_id) return -1;
      if (a.branch_id && !b.branch_id) return 1;

      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

  // Keep removed entries at the end, preserving their existing order.
  const removedEntries = allEntries
    .filter((item) => !item.is_included)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // Persist the new order and recalculate the proposed numbers.
  await saveEntryOrder(entry.annual_register_id, [
    ...includedEntries,
    ...removedEntries,
  ]);

  await recordRegisterHistory(
    entry.annual_register_id,
    "PROPOSED_NUMBER_CHANGED",
    {
      entry_id: entry.id,
      previous_number: entry.membership_number ?? null,
      proposed_number: proposed,
    },
  );
}


export async function undoBranchSplitInDraft(entry) {
  if (entry.entry_type !== "Independent Split" || !entry.branch_id) {
    throw new Error("This entry is not a branch split.");
  }

  const { data: parent, error: parentError } = await supabase
    .from("annual_membership_entries")
    .select("id, membership_number")
    .eq("annual_register_id", entry.annual_register_id)
    .eq("membership_id", entry.membership_id)
    .is("branch_id", null)
    .eq("entry_type", "Membership")
    .maybeSingle();

  if (parentError) throw parentError;

  if (!parent) {
    throw new Error(
      "The original parent membership could not be found in this draft.",
    );
  }

  const { error } = await supabase
    .from("annual_membership_entries")
    .update({
      entry_type: "Branch",
      parent_entry_id: parent.id,
      membership_number: `${parent.membership_number ?? ""}${entry.suffix ?? ""}`,
      removal_reason: null,
    })
    .eq("id", entry.id)
    .eq("annual_register_id", entry.annual_register_id);

  if (error) throw error;

  await recordRegisterHistory(entry.annual_register_id, "BRANCH_SPLIT_UNDONE", {
    entry_id: entry.id,
    restored_parent_entry_id: parent.id,
  });
}




export async function saveEntryOrder(registerId, entries) {
  const activeEntries = entries.filter((entry) => entry.is_included);
  const removedEntries = entries.filter((entry) => !entry.is_included);

  // Fetch the actual suffixes because raw annual-register entries
  // do not necessarily contain a `suffix` property.
  const branchIds = [
    ...new Set(
      entries
        .map((entry) => entry.branch_id)
        .filter(Boolean),
    ),
  ];

  const suffixByBranchId = new Map();

  if (branchIds.length > 0) {
    const { data: branches, error: branchError } = await supabase
      .from("membership_branches")
      .select("id, suffix")
      .in("id", branchIds);

    if (branchError) throw branchError;

    for (const branch of branches ?? []) {
      suffixByBranchId.set(branch.id, branch.suffix ?? "");
    }
  }

  // Assign numbers to included main memberships and independent splits.
  const mainNumbers = new Map();
  let number = 0;

  for (const entry of activeEntries) {
    const isIndependent = entry.entry_type === "Independent Split";
    const isMainMembership =
      !entry.branch_id && entry.entry_type !== "Branch";

    if (isIndependent || isMainMembership) {
      number += 1;
      mainNumbers.set(entry.id, String(number));
    }
  }

  const updates = entries.map((entry, index) => {
    // Never clear the number of a removed entry.
    if (!entry.is_included) {
      return {
        id: entry.id,
        sort_order: index + 1,
        membership_number: String(entry.membership_number ?? ""),
      };
    }

    let membershipNumber = "";

    if (mainNumbers.has(entry.id)) {
      membershipNumber = mainNumbers.get(entry.id);
    } else if (
      entry.entry_type === "Branch" &&
      entry.branch_id &&
      entry.parent_entry_id
    ) {
      const parentNumber = mainNumbers.get(entry.parent_entry_id);
      const suffix =
        suffixByBranchId.get(entry.branch_id) ??
        entry.suffix ??
        "";

      if (!parentNumber) {
        throw new Error(
          `Cannot number branch "${entry.membership_id ?? entry.id}": ` +
          "its parent has no active register number. Restore the parent " +
          "or split the branch into an independent membership.",
        );
      }

      membershipNumber = `${parentNumber}${suffix}`;
    } else {
      // Preserve an existing number if this entry isn't renumbered here.
      membershipNumber = String(entry.membership_number ?? "");
    }

    if (!membershipNumber.trim()) {
      throw new Error(
        `No proposed membership number could be assigned to entry ${entry.id}.`,
      );
    }

    return {
      id: entry.id,
      sort_order: index + 1,
      membership_number: membershipNumber,
    };
  });

  // Validate numbers among included entries only.
  // Removed entries may retain their historical numbers.
  const numberOwners = new Map();

  for (const entry of updates) {
    const source = entries.find((item) => item.id === entry.id);

    if (!source?.is_included) continue;

    const normalizedNumber = entry.membership_number
      .trim()
      .toUpperCase();

    if (numberOwners.has(normalizedNumber)) {
      throw new Error(
        `Duplicate proposed membership number "${entry.membership_number}". ` +
        "Each included membership must have a unique number.",
      );
    }

    numberOwners.set(normalizedNumber, entry.id);
  }

  // Persist only after all proposed numbers have passed validation.
  for (const update of updates) {
    const { error } = await supabase
      .from("annual_membership_entries")
      .update({
        sort_order: update.sort_order,
        membership_number: update.membership_number,
      })
      .eq("id", update.id)
      .eq("annual_register_id", registerId);

    if (error) throw error;
  }

  await recordRegisterHistory(registerId, "ENTRIES_REORDERED", {
    included_count: activeEntries.length,
    removed_count: removedEntries.length,
  });
}



export async function setRegisterStatus(registerId, status) {
  if (!["Draft", "Under Review"].includes(status)) {
    throw new Error("This operation cannot finalise a register.");
  }

  const { error } = await supabase
    .from("annual_registers")
    .update({ status })
    .eq("id", registerId);

  if (error) throw error;

  await recordRegisterHistory(registerId, "STATUS_CHANGED", { status });
}

export async function splitBranchInDraft(entry, label = "") {
  if (!entry.branch_id || entry.entry_type !== "Branch") {
    throw new Error("Only a branch entry can be split.");
  }

  const { error } = await supabase
    .from("annual_membership_entries")
    .update({
      entry_type: "Independent Split",
      parent_entry_id: null,
      removal_reason: null,
    })
    .eq("id", entry.id);

  if (error) throw error;

  await recordRegisterHistory(
    entry.annual_register_id,
    "BRANCH_SPLIT_IN_DRAFT",
    {
      entry_id: entry.id,
      previous_number: entry.membership_number,
      label: label.trim() || null,
    },
  );
}



export async function deleteAnnualRegisterDraft(registerId) {
  if (!registerId) {
    throw new Error("No register was selected.");
  }

  const { data: register, error: registerError } = await supabase
    .from("annual_registers")
    .select("id, name, status")
    .eq("id", registerId)
    .single();

  if (registerError) throw registerError;

  if (register.status !== "Draft") {
    throw new Error("Only draft registers can be deleted.");
  }

  const { error } = await supabase.rpc("delete_annual_register_draft", {
    p_register_id: registerId,
  });

  if (error) throw error;
}


export async function resyncAnnualRegisterDraft(registerId) {
  const { data: register, error: registerError } = await supabase
    .from("annual_registers")
    .select("id, name, register_year, status")
    .eq("id", registerId)
    .single();

  if (registerError) throw registerError;

  if (register.status !== "Draft") {
    throw new Error("Only draft registers can be resynced.");
  }

  const today = TODAY();

  const [
    entriesResult,
    membershipsResult,
    branchesResult,
    assignmentsResult,
  ] = await Promise.all([
    supabase
      .from("annual_membership_entries")
      .select("id, membership_id, branch_id, entry_type, membership_number, is_included")
      .eq("annual_register_id", registerId),

    supabase
    .from("memberships")
    .select("id, membership_number, head_member_id, membership_status")
    .eq("membership_status", "Active")
    .order("created_at", { ascending: true }),

    supabase
      .from("membership_branches")
      .select("id, membership_id, suffix, branch_status")
      .eq("branch_status", "Active"),

    supabase
      .from("membership_structure_assignments")
      .select("membership_id, member_id, branch_id, relationship_to_head")
      .lte("valid_from", today)
      .or(`valid_until.is.null,valid_until.gte.${today}`),
  ]);

  if (entriesResult.error) throw entriesResult.error;
  if (membershipsResult.error) throw membershipsResult.error;
  if (branchesResult.error) throw branchesResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;

  const existingEntries = entriesResult.data ?? [];
  const memberships = membershipsResult.data ?? [];
  const branches = branchesResult.data ?? [];
  const sourceAssignments = assignmentsResult.data ?? [];

  const entryByKey = new Map();
  const existingAssignmentKeys = new Set();

  for (const entry of existingEntries) {
    const key = entry.branch_id
      ? `branch:${entry.branch_id}`
      : `membership:${entry.membership_id}`;

    entryByKey.set(key, entry);
  }

  const existingEntryIds = existingEntries.map((entry) => entry.id);

  if (existingEntryIds.length) {
    const { data: currentAssignments, error: currentAssignmentsError } =
      await supabase
        .from("annual_member_assignments")
        .select("annual_membership_entry_id, member_id")
        .in("annual_membership_entry_id", existingEntryIds);

    if (currentAssignmentsError) throw currentAssignmentsError;

    for (const assignment of currentAssignments ?? []) {
      existingAssignmentKeys.add(
        `${assignment.annual_membership_entry_id}:${assignment.member_id}`,
      );
    }
  }

  let nextNumber =
    existingEntries.reduce((max, entry) => {
      if (entry.branch_id) return max;

      const match = String(entry.membership_number ?? "").match(/^(\d+)/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;

  let addedMemberships = 0;
  let addedBranches = 0;
  let addedAssignments = 0;

  async function insertEntry({
    membershipId,
    branchId = null,
    entryType,
    number,
    parentEntryId = null,
  }) {
    const { data, error } = await supabase
      .from("annual_membership_entries")
      .insert({
        annual_register_id: registerId,
        membership_id: membershipId,
        branch_id: branchId,
        entry_type: entryType,
        parent_entry_id: parentEntryId,
        membership_number: number,
        sort_order: existingEntries.length + 1,
        is_included: true,
      })
      .select("*")
      .single();

    if (error) throw error;

    existingEntries.push(data);

    const key = branchId
      ? `branch:${branchId}`
      : `membership:${membershipId}`;

    entryByKey.set(key, data);
    return data;
  }

  // Add memberships created after this draft was originally populated.
  for (const membership of memberships) {
    const membershipKey = `membership:${membership.id}`;
    let parentEntry = entryByKey.get(membershipKey);

    if (!parentEntry) {
      parentEntry = await insertEntry({
        membershipId: membership.id,
        entryType: "Membership",
        number: String(nextNumber),
      });

      nextNumber += 1;
      addedMemberships += 1;
    }

    // Add newly created active branches without duplicating existing ones.
    const childBranches = branches
      .filter((branch) => branch.membership_id === membership.id)
      .sort((a, b) => a.suffix.localeCompare(b.suffix));

    for (const branch of childBranches) {
      const branchKey = `branch:${branch.id}`;

      if (entryByKey.has(branchKey)) continue;

      await insertEntry({
        membershipId: membership.id,
        branchId: branch.id,
        entryType: "Branch",
        number: `${parentEntry.membership_number ?? ""}${branch.suffix}`,
        parentEntryId: parentEntry.id,
      });

      addedBranches += 1;
    }
  }

  // Add people assigned to entries after the original draft was created.
  // Existing assignments and head choices are left untouched.
  for (const entry of existingEntries) {
    const membership = memberships.find(
      (item) => item.id === entry.membership_id,
    );

    if (!membership) continue;

    const desiredAssignments = sourceAssignments.filter((assignment) => {
      if (assignment.membership_id !== entry.membership_id) return false;

      return entry.branch_id
        ? assignment.branch_id === entry.branch_id
        : assignment.branch_id == null;
    });

    // Preserve the existing membership head as a head assignment when needed.
    if (!entry.branch_id && membership.head_member_id) {
      desiredAssignments.unshift({
        membership_id: membership.id,
        member_id: membership.head_member_id,
        branch_id: null,
        relationship_to_head: "Head",
      });
    }

    for (const assignment of desiredAssignments) {
      const key = `${entry.id}:${assignment.member_id}`;

      if (existingAssignmentKeys.has(key)) continue;

      const isHead =
        !entry.branch_id &&
        assignment.member_id === membership.head_member_id;

      const { error } = await supabase
        .from("annual_member_assignments")
        .insert({
          annual_membership_entry_id: entry.id,
          member_id: assignment.member_id,
          is_head: isHead,
          relationship_to_head: isHead
            ? "Head"
            : assignment.relationship_to_head,
        });

      if (error) throw error;

      existingAssignmentKeys.add(key);
      addedAssignments += 1;
    }
  }

  const result = {
    addedMemberships,
    addedBranches,
    addedAssignments,
  };

  await recordRegisterHistory(registerId, "DRAFT_RESYNCED", result);

  return result;
}

export async function finaliseAnnualRegister(registerId) {
  if (!registerId) {
    throw new Error("Select the register you want to finalise.");
  }

  const { data, error } = await supabase.rpc(
    "finalise_annual_register",
    {
      p_annual_register_id: registerId,
    },
  );

  if (error) throw error;

  return data;
}