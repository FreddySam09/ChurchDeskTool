import {
  cleanCell,
  normalizeRows,
  parseExcelDate,
} from "../../../services/imports/excelUtils";

export const MEMBERSHIP_HEADERS = [
  "Membership Number",
  "Record Type",
  "Branch Suffix",
  "Is Head",
  "Name",
  "Relationship to Head",
  "Gender",
  "Date of Birth",
  "Marital Status",
  "Married To",
  "Date of Marriage",
  "Occupation",
  "Role",
  "Phone Number",
  "Email",
  "Fellowship / Groups",
  "Door Number",
  "Floor Number",
  "Apartment / House Name",
  "Block Number",
  "Street Name",
  "Area",
  "City",
  "Pincode",
  "Google Maps Link",
  "Landmark",
  "Primary Phone Number",
  "Alternate Phone Number",
  "Membership Email",
  "Year Joined",
  "Membership Status",
];

export const DATE_HEADERS = ["Date of Birth", "Date of Marriage"];

const RELATIONSHIPS = [
  "Spouse",
  "Son",
  "Daughter",
  "Father",
  "Mother",
  "Grand Son",
  "Grand daughter",
  "Guardian",
  "Brother",
  "Sister",
  "Son-in-Law",
  "Daughter-in-Law",
];
const GENDERS = ["Male", "Female", "Other"];

export const MARITAL_STATUSES = [
  "Unmarried",
  "Married",
  "Widowed",
  "Divorced",
  "Separated",
  "Unknown",
];

export function normalizeMaritalStatus(value) {
  const clean = String(value ?? "").trim();
  if (!clean) return "";

  const aliases = {
    single: "Unmarried",
    unmarried: "Unmarried",
    married: "Married",
    widowed: "Widowed",
    divorced: "Divorced",
    separated: "Separated",
    unknown: "Unknown",
  };

  return aliases[clean.toLocaleLowerCase()] ?? clean;
}

const MEMBERSHIP_STATUSES = ["Active", "Inactive", "Closed"];
const RECORD_TYPES = ["Membership", "Branch"];

export const MEMBERSHIP_EXAMPLE_ROWS = [
  {
    "Membership Number": "101",
    "Record Type": "Membership",
    "Branch Suffix": "",
    "Is Head": "Yes",
    Name: "Rajesh Kumar",
    "Relationship to Head": "",
    Gender: "Male",
    "Date of Birth": "1980-04-12",
    "Marital Status": "Married",
    "Married To": "Priya Rajesh",
    "Date of Marriage": "2005-08-20",
    Occupation: "Teacher",
    Role: "Head",
    "Phone Number": "9876543210",
    Email: "rajesh@example.com",
    "Fellowship / Groups": "Men's Fellowship; Choir",
    "Door Number": "12A",
    "Floor Number": "",
    "Apartment / House Name": "",
    "Block Number": "",
    "Street Name": "Church Street",
    Area: "Anna Nagar",
    City: "Chennai",
    Pincode: "600040",
    "Google Maps Link":
      "https://maps.google.com/?q=12A+Church+Street,+Anna+Nagar,+Chennai",
    Landmark: "Near park",
    "Primary Phone Number": "9876543210",
    "Alternate Phone Number": "",
    "Membership Email": "rajesh@example.com",
    "Year Joined": "2005",
    "Membership Status": "Active",
  },
  {
    "Membership Number": "101",
    "Record Type": "Membership",
    "Branch Suffix": "",
    "Is Head": "No",
    Name: "Priya Rajesh",
    "Relationship to Head": "Spouse",
    Gender: "Female",
    "Date of Birth": "1983-09-18",
    "Marital Status": "Married",
    "Married To": "Rajesh Kumar",
    "Date of Marriage": "2005-08-20",
    Occupation: "Teacher",
    Role: "Member",
    "Phone Number": "9876543211",
    Email: "priya@example.com",
    "Fellowship / Groups": "Women's Fellowship; Young Couples",
    "Door Number": "12A",
    "Floor Number": "",
    "Apartment / House Name": "",
    "Block Number": "",
    "Street Name": "Church Street",
    Area: "Anna Nagar",
    City: "Chennai",
    Pincode: "600040",
    "Google Maps Link":
      "https://maps.google.com/?q=12A+Church+Street,+Anna+Nagar,+Chennai",
    Landmark: "Near park",
    "Primary Phone Number": "9876543210",
    "Alternate Phone Number": "",
    "Membership Email": "rajesh@example.com",
    "Year Joined": "2005",
    "Membership Status": "Active",
  },
  {
    "Membership Number": "101",
    "Record Type": "Membership",
    "Branch Suffix": "",
    "Is Head": "No",
    Name: "Arun Rajesh",
    "Relationship to Head": "Child",
    Gender: "Male",
    "Date of Birth": "2005-03-15",
    "Marital Status": "Unmarried",
    "Married To": "",
    "Date of Marriage": "",
    Occupation: "College Student",
    Role: "Member",
    "Phone Number": "9876543212",
    Email: "arun@example.com",
    "Fellowship / Groups": "Youth Fellowship; Media Team",
    "Door Number": "12A",
    "Floor Number": "",
    "Apartment / House Name": "",
    "Block Number": "",
    "Street Name": "Church Street",
    Area: "Anna Nagar",
    City: "Chennai",
    Pincode: "600040",
    "Google Maps Link":
      "https://maps.google.com/?q=12A+Church+Street,+Anna+Nagar,+Chennai",
    Landmark: "Near park",
    "Primary Phone Number": "9876543210",
    "Alternate Phone Number": "",
    "Membership Email": "rajesh@example.com",
    "Year Joined": "2005",
    "Membership Status": "Active",
  },
  {
    "Membership Number": "101",
    "Record Type": "Membership",
    "Branch Suffix": "",
    "Is Head": "No",
    Name: "Ananya Rajesh",
    "Relationship to Head": "Child",
    Gender: "Female",
    "Date of Birth": "2010-07-22",
    "Marital Status": "Unmarried",
    "Married To": "",
    "Date of Marriage": "",
    Occupation: "Student",
    Role: "Member",
    "Phone Number": "9876543213",
    Email: "ananya@example.com",
    "Fellowship / Groups": "Sunday School",
    "Door Number": "12A",
    "Floor Number": "",
    "Apartment / House Name": "",
    "Block Number": "",
    "Street Name": "Church Street",
    Area: "Anna Nagar",
    City: "Chennai",
    Pincode: "600040",
    "Google Maps Link":
      "https://maps.google.com/?q=12A+Church+Street,+Anna+Nagar,+Chennai",
    Landmark: "Near park",
    "Primary Phone Number": "9876543210",
    "Alternate Phone Number": "",
    "Membership Email": "rajesh@example.com",
    "Year Joined": "2005",
    "Membership Status": "Active",
  },
  {
    "Membership Number": "101",
    "Record Type": "Membership",
    "Branch Suffix": "",
    "Is Head": "No",
    Name: "Lakshmi Rajesh",
    "Relationship to Head": "Parent",
    Gender: "Female",
    "Date of Birth": "1955-01-10",
    "Marital Status": "Widowed",
    "Married To": "",
    "Date of Marriage": "",
    Occupation: "Retired",
    Role: "Member",
    "Phone Number": "9876543214",
    Email: "",
    "Fellowship / Groups": "Women's Fellowship; Prayer Group",
    "Door Number": "12A",
    "Floor Number": "",
    "Apartment / House Name": "",
    "Block Number": "",
    "Street Name": "Church Street",
    Area: "Anna Nagar",
    City: "Chennai",
    Pincode: "600040",
    "Google Maps Link":
      "https://maps.google.com/?q=12A+Church+Street,+Anna+Nagar,+Chennai",
    Landmark: "Near park",
    "Primary Phone Number": "9876543210",
    "Alternate Phone Number": "",
    "Membership Email": "rajesh@example.com",
    "Year Joined": "2005",
    "Membership Status": "Active",
  },
  {
    "Membership Number": "101",
    "Record Type": "Branch",
    "Branch Suffix": "A",
    "Is Head": "Yes",
    Name: "Joseph Kumar",
    "Relationship to Head": "",
    Gender: "Male",
    "Date of Birth": "1978-11-05",
    "Marital Status": "Married",
    "Married To": "",
    "Date of Marriage": "",
    Occupation: "Business",
    Role: "Head",
    "Phone Number": "9876543215",
    Email: "joseph@example.com",
    "Fellowship / Groups": "Men's Fellowship; Choir",
    "Door Number": "24B",
    "Floor Number": "",
    "Apartment / House Name": "",
    "Block Number": "",
    "Street Name": "Church Street",
    Area: "Anna Nagar",
    City: "Chennai",
    Pincode: "600040",
    "Google Maps Link":
      "https://maps.google.com/?q=12A+Church+Street,+Anna+Nagar,+Chennai",
    Landmark: "Near park",
    "Primary Phone Number": "9876543215",
    "Alternate Phone Number": "",
    "Membership Email": "joseph@example.com",
    "Year Joined": "2005",
    "Membership Status": "Active",
  },
];

export function parseGroupNames(value) {
  const values = Array.isArray(value) ? value : [value];
  const names = values.flatMap((item) =>
    String(item ?? "").split(/[;,\n\r]+/),
  );
  const seen = new Set();

  return names
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => {
      const key = name.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function formatGroupNames(value) {
  return parseGroupNames(value).join("; ");
}

export function createEmptyRow() {
  return Object.fromEntries(
    MEMBERSHIP_HEADERS.map((header) => [header, ""]),
  );
}

export function formatTitleCase(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/(^|[\s'-])(\p{L})/gu, (_, separator, letter) => {
      return separator + letter.toLocaleUpperCase("en");
    });
}

export function normalizeAddressCell(value) {
  const text = cleanCell(value).replace(/\s+/g, " ");
  if (!text) return "";

  if (
    /^(?:\.|-+|—|–|n\/?a|na|null|none|not applicable)$/i.test(text)
  ) {
    return "";
  }

  return text;
}

function looksLikeWholeAddress(value) {
  const text = normalizeAddressCell(value);
  if (!text) return false;

  const commaParts = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    commaParts.length >= 3 ||
    (/\b(?:street|st\.?|road|rd\.?|nagar|colony|layout|cross|main road|avenue)\b/i.test(
      text,
    ) &&
      text.length > 45)
  );
}

export function prepareImportedRows(rows) {
  const normalized = normalizeRows(rows, MEMBERSHIP_HEADERS);

  const titleCaseFields = [
    "Name",
    "Married To",
    "Occupation",
    "Street Name",
    "Area",
    "City",
    "Landmark",
    "Apartment / House Name",
  ];

  return normalized.map((row, index) => {
    const prepared = { ...row };

    for (const header of DATE_HEADERS) {
      const value = cleanCell(prepared[header]);

      if (!value) {
        prepared[header] = "";
        continue;
      }

      const parsed = parseExcelDate(value);
      prepared[header] = parsed ?? value;
    }

    for (const header of MEMBERSHIP_HEADERS) {
      if (DATE_HEADERS.includes(header)) continue;
      prepared[header] = cleanCell(prepared[header]);
    }

    for (const field of [
      "Door Number",
      "Floor Number",
      "Apartment / House Name",
      "Block Number",
      "Pincode",
      "Google Maps Link",
    ]) {
      prepared[field] = normalizeAddressCell(prepared[field]);
    }

    for (const field of titleCaseFields) {
      prepared[field] = formatTitleCase(prepared[field]);
    }

    prepared["Marital Status"] = normalizeMaritalStatus(
      prepared["Marital Status"],
    );

    prepared["Membership Number"] = prepared[
      "Membership Number"
    ].replace(/\s+/g, "");

    prepared["Record Type"] = prepared["Record Type"].trim();
    prepared["Branch Suffix"] = prepared["Branch Suffix"].toUpperCase();
    prepared["Is Head"] =
      prepared["Is Head"].toLowerCase() === "yes" ? "Yes" : "No";

    // Normalize relationship with the membership head.
    const relationship = prepared["Relationship to Head"]
      .trim()
      .toLocaleLowerCase();

    const relationshipAliases = {
      spouse: "Spouse",
      son: "Son",
      daughter: "Daughter",
      father: "Father",
      mother: "Mother",
      "grand son": "Grand Son",
      grandson: "Grand Son",
      "grand daughter": "Grand daughter",
      granddaughter: "Grand daughter",
      guardian: "Guardian",
      brother: "Brother",
      sister: "Sister",
      "son-in-law": "Son-in-Law",
      "son in law": "Son-in-Law",
      "daughter-in-law": "Daughter-in-Law",
      "daughter in law": "Daughter-in-Law",
    };

    if (relationship) {
      prepared["Relationship to Head"] =
        relationshipAliases[relationship] ??
        formatTitleCase(prepared["Relationship to Head"]);
    }
    prepared["Fellowship / Groups"] = formatGroupNames(
      prepared["Fellowship / Groups"],
    );

    prepared["Marital Status"] = normalizeMaritalStatus(
      prepared["Marital Status"],
    );

    if (!prepared["Marital Status"]) {
      const hasMarriageDate = Boolean(
        cleanCell(prepared["Date of Marriage"]),
      );

      const isSpouse =
        prepared["Relationship to Head"] === "Spouse";

      prepared["Marital Status"] =
        hasMarriageDate || isSpouse ? "Married" : "Unmarried";
    }

    prepared.__sourceRow = row.__sourceRow ?? index + 2;

    return prepared;
  });
}

export function getHouseholdKey(row) {
  const number = cleanCell(row["Membership Number"]).toLowerCase();
  const suffix = cleanCell(row["Branch Suffix"]).toUpperCase();

  return `${number}::${suffix || "MAIN"}`;
}

function addIssue(collection, type, rows, index, field, message) {
  collection.push({
    type,
    index,
    sourceRow: rows[index]?.__sourceRow ?? index + 2,
    field,
    message,
  });
}

export function validateMembershipRows(rows) {
  const errors = [];
  const warnings = [];

  rows.forEach((row, index) => {
    if (looksLikeWholeAddress(row["Door Number"])) {
      addIssue(
        warnings,
        "warning",
        rows,
        index,
        "Door Number",
        "This looks like a full address rather than a door/house number. Move each component into its own column before importing.",
      );
    }
  });

  const addError = (index, field, message) =>
    addIssue(errors, "error", rows, index, field, message);

  const addWarning = (index, field, message) =>
    addIssue(warnings, "warning", rows, index, field, message);

  const householdRows = new Map();
  const membershipNumberRows = new Map();
  const nameRows = new Map();

  rows.forEach((row, index) => {
    const number = cleanCell(row["Membership Number"]);
    const name = cleanCell(row.Name);
    const type = cleanCell(row["Record Type"]);
    const suffix = cleanCell(row["Branch Suffix"]).toUpperCase();
    const head = cleanCell(row["Is Head"]);
    const relationship = cleanCell(row["Relationship to Head"]);
    const status = cleanCell(row["Membership Status"]);
    const gender = cleanCell(row.Gender);

    const maritalStatus = normalizeMaritalStatus(
      cleanCell(row["Marital Status"]),
    );

    const marriageDate = cleanCell(row["Date of Marriage"]);
    const yearJoined = cleanCell(row["Year Joined"]);

    if (!number) {
      addError(index, "Membership Number", "Membership number is required.");
    } else {
      if (!/^[A-Za-z0-9]+$/.test(number)) {
        addError(
          index,
          "Membership Number",
          "Use letters and numbers only, without spaces or punctuation.",
        );
      }

      const normalizedNumber = number.toLowerCase();
      const numberIndexes =
        membershipNumberRows.get(normalizedNumber) ?? [];

      numberIndexes.push(index);
      membershipNumberRows.set(normalizedNumber, numberIndexes);
    }

    if (!name) {
      addError(index, "Name", "Member name is required.");
    } else {
      const normalizedName = name.toLocaleLowerCase();
      const nameIndexes = nameRows.get(normalizedName) ?? [];

      nameIndexes.push(index);
      nameRows.set(normalizedName, nameIndexes);
    }

    if (!RECORD_TYPES.includes(type)) {
      addError(index, "Record Type", "Choose Membership or Branch.");
    }

    if (!["Yes", "No"].includes(head)) {
      addError(index, "Is Head", "Choose Yes or No.");
    }

    if (type === "Branch" && !/^[A-Z]$/.test(suffix)) {
      addError(
        index,
        "Branch Suffix",
        "A branch needs one uppercase letter from A to Z.",
      );
    }

    if (type === "Membership" && suffix) {
      addError(
        index,
        "Branch Suffix",
        "Normal memberships should not have a branch suffix.",
      );
    }

    if (type === "Branch" && head === "Yes" && !suffix) {
      addError(index, "Branch Suffix", "A branch head needs a branch suffix.");
    }

    if (relationship && !RELATIONSHIPS.includes(relationship)) {
      addError(
        index,
        "Relationship to Head",
        `Use ${RELATIONSHIPS.join(", ")}.`,
      );
    }

    if (type === "Membership" && head === "Yes" && relationship) {
      addWarning(
        index,
        "Relationship to Head",
        "The main membership head normally has no relationship to themselves.",
      );
    }

    if (type === "Branch" && head === "Yes" && !relationship) {
      addError(
        index,
        "Relationship to Head",
        "A branch member must specify their relationship to the original membership head.",
      );
    }

    if (type === "Membership" && head === "No" && !relationship) {
      addError(
        index,
        "Relationship to Head",
        "Select the member's relationship to the household head.",
      );
    }

    if (gender && !GENDERS.includes(gender)) {
      addError(index, "Gender", `Use ${GENDERS.join(", ")}.`);
    }

            if (maritalStatus && !MARITAL_STATUSES.includes(maritalStatus)) {
      addError(
        index,
        "Marital Status",
        `Use ${MARITAL_STATUSES.join(", ")}.`,
      );
    }

    if (status && !MEMBERSHIP_STATUSES.includes(status)) {
      addError(
        index,
        "Membership Status",
        `Use ${MEMBERSHIP_STATUSES.join(", ")}.`,
      );
    }

    // Dates.
    for (const field of DATE_HEADERS) {
      const value = cleanCell(row[field]);

      if (!value) continue;

      const parsed = parseExcelDate(value);

      if (!parsed) {
        addError(index, field, "Enter a valid date in YYYY-MM-DD format.");
      } else if (parsed > new Date().toISOString().slice(0, 10)) {
        addWarning(index, field, "This date is in the future.");
      }
    }

    if (relationship === "Spouse" && !marriageDate) {
      addError(
        index,
        "Date of Marriage",
        "A spouse relationship requires a wedding date.",
      );
    }

    // Explicit Unmarried conflicts with a marriage date or Spouse relationship.
    if (
      maritalStatus === "Unmarried" &&
      (Boolean(marriageDate) || relationship === "Spouse")
    ) {
      addError(
        index,
        "Marital Status",
        "This member has a marriage date or Spouse relationship. Change the marital status from Unmarried.",
      );
    }

    if (yearJoined && !/^\d{4}$/.test(yearJoined)) {
      addError(index, "Year Joined", "Enter a four-digit year.");
    }

    if (
      number &&
      type &&
      (type === "Membership" || /^[A-Z]$/.test(suffix))
    ) {
      const key = getHouseholdKey(row);
      const indexes = householdRows.get(key) ?? [];

      indexes.push(index);
      householdRows.set(key, indexes);
    }
  });

  for (const [key, indexes] of householdRows) {
    if (!key || key.startsWith("::")) continue;

    const types = new Set(
      indexes.map((index) => cleanCell(rows[index]["Record Type"])),
    );

    const isBranch = types.has("Branch");

    if (isBranch) {
      if (indexes.length !== 1) {
        indexes.forEach((index) => {
          addError(
            index,
            "Record Type",
            "A branch must contain exactly one person. Create a separate branch for each person.",
          );
        });
      }

      indexes.forEach((index) => {
  // Is Head = Yes explicitly designates the branch member as its head.
  // Is Head = No is also valid. Branches do not require a separate head.

  if (!cleanCell(rows[index]["Relationship to Head"])) {
    addError(
      index,
      "Relationship to Head",
      "A branch member must specify their relationship to the original membership head.",
    );
  }
});

      continue;
    }

    const heads = indexes.filter(
      (index) => cleanCell(rows[index]["Is Head"]) === "Yes",
    );

    if (heads.length !== 1) {
      indexes.forEach((index) => {
        addError(
          index,
          "Is Head",
          `This membership needs exactly one head; found ${heads.length}.`,
        );
      });
    }
  }

  for (const [number, indexes] of membershipNumberRows) {
    if (indexes.length < 2) continue;

    const distinctHouseholds = new Map();

    for (const index of indexes) {
      const row = rows[index];
      const key = getHouseholdKey(row);

      if (!distinctHouseholds.has(key)) {
        distinctHouseholds.set(key, []);
      }

      distinctHouseholds.get(key).push(index);
    }

    if (distinctHouseholds.size > 1) {
      indexes.forEach((index) => {
        addWarning(
          index,
          "Membership Number",
          `Membership number ${number} is used by more than one household or branch. Confirm that the numbering is intentional.`,
        );
      });
    }
  }

  for (const indexes of nameRows.values()) {
    if (indexes.length < 2) continue;

    indexes.forEach((index) => {
      addWarning(
        index,
        "Name",
        "This name appears more than once. Confirm that these are different people.",
      );
    });
  }

  for (const indexes of householdRows.values()) {
    const headIndex = indexes.find(
      (index) => cleanCell(rows[index]["Is Head"]) === "Yes",
    );

    if (headIndex === undefined) continue;

    const headRow = rows[headIndex];

    const spouseRows = indexes.filter(
      (index) =>
        cleanCell(rows[index]["Relationship to Head"]) === "Spouse",
    );

    for (const spouseIndex of spouseRows) {
      const spouseRow = rows[spouseIndex];
      const headDate = cleanCell(headRow["Date of Marriage"]);
      const spouseDate = cleanCell(spouseRow["Date of Marriage"]);

      if (headDate && spouseDate && headDate !== spouseDate) {
        addWarning(
          spouseIndex,
          "Date of Marriage",
          "The head and spouse have different wedding dates. Check that both rows use the same date.",
        );
      }

      const headMarriedTo = cleanCell(headRow["Married To"]);
      const spouseName = cleanCell(spouseRow.Name);
      const spouseMarriedTo = cleanCell(spouseRow["Married To"]);
      const headName = cleanCell(headRow.Name);

      if (
        headMarriedTo &&
        spouseName &&
        headMarriedTo.toLocaleLowerCase() !==
          spouseName.toLocaleLowerCase()
      ) {
        addWarning(
          headIndex,
          "Married To",
          "The head's Married To value does not match the spouse row's name.",
        );
      }

      if (
        spouseMarriedTo &&
        headName &&
        spouseMarriedTo.toLocaleLowerCase() !==
          headName.toLocaleLowerCase()
      ) {
        addWarning(
          spouseIndex,
          "Married To",
          "The spouse's Married To value does not match the head's name.",
        );
      }

      if (headDate && !spouseDate) {
        addWarning(
          spouseIndex,
          "Date of Marriage",
          "The head has a wedding date. Copy it to the spouse row so both records agree.",
        );
      }

      if (!headDate && spouseDate) {
        addWarning(
          headIndex,
          "Date of Marriage",
          "The spouse has a wedding date. Copy it to the head row so both records agree.",
        );
      }
    }
  }

  return { errors, warnings };
}