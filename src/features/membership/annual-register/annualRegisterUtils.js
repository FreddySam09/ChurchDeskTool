
export function normalizeMembershipNumber(value) {
  return String(value ?? "").trim().toUpperCase();
}

/**
 * Sort membership numbers naturally:
 * 1, 2, 2A, 2B, 3, 10
 *
 * Numbers without a suffix appear before their lettered branches.
 */
export function compareMembershipNumbers(a, b) {
  const numberA = String(a?.membership_number ?? "").trim();
  const numberB = String(b?.membership_number ?? "").trim();

  // Entries without a membership number go last.
  if (!numberA && numberB) return 1;
  if (numberA && !numberB) return -1;
  if (!numberA && !numberB) return 0;

  return numberA.localeCompare(numberB, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function getIncludedEntries(entries = []) {
  return entries.filter((entry) => entry.is_included);
}

export function getRemovedEntries(entries = []) {
  return entries.filter((entry) => !entry.is_included);
}

export function getEntryLabel(entry) {
  if (entry?.entry_type === "Branch") {
    return "Branch Membership";
  }

  if (entry?.entry_type === "Independent Split") {
    return "Independent Split";
  }

  return "Membership";
}

export function getDuplicateMembershipNumbers(entries = []) {
  const entriesByNumber = new Map();

  for (const entry of entries) {
    if (!entry.is_included) continue;

    const number = normalizeMembershipNumber(entry.membership_number);
    if (!number) continue;

    const matchingEntries = entriesByNumber.get(number) ?? [];
    matchingEntries.push(entry);
    entriesByNumber.set(number, matchingEntries);
  }

  return new Set(
    [...entriesByNumber.entries()]
      .filter(([, matchingEntries]) => matchingEntries.length > 1)
      .map(([number]) => number),
  );
}

export function getEntryReviewIssues(entries = []) {
  const included = getIncludedEntries(entries);
  const duplicates = getDuplicateMembershipNumbers(included);
  const issuesByEntryId = new Map();

  for (const entry of included) {
    const issues = [];
    const number = normalizeMembershipNumber(entry.membership_number);

    if (!number) {
      issues.push("Missing membership number");
    } else if (!/^[A-Z0-9]+$/.test(number)) {
      issues.push("Invalid membership number");
    }

    if (number && duplicates.has(number)) {
      issues.push(`Duplicate membership number: ${number}`);
    }

    if (!entry.assignments?.some((assignment) => assignment.is_head)) {
      issues.push("Head designation needs review");
    }

    issuesByEntryId.set(entry.id, issues);
  }

  return issuesByEntryId;
}

export function entryNeedsHeadReview(entry) {
  if (!entry?.is_included) return false;

  return !entry.assignments?.some((assignment) => assignment.is_head);
}

export function getRegisterSummary(entries = []) {
  const included = getIncludedEntries(entries);
  const removed = getRemovedEntries(entries);
  const issuesByEntryId = getEntryReviewIssues(entries);

  const entriesNeedingReview = included.filter(
    (entry) => (issuesByEntryId.get(entry.id) ?? []).length > 0,
  );

  return {
    total: included.length,
    removed: removed.length,
    people: included.reduce(
      (count, entry) => count + (entry.assignments?.length ?? 0),
      0,
    ),
    needsHeadReview: included.filter(entryNeedsHeadReview).length,
    entriesNeedingReview: entriesNeedingReview.length,
    issuesByEntryId,
  };
}
