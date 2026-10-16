
import {
  cleanCell,
  normalizeRows,
  parseExcelDate,
} from '../../../services/imports/excelUtils'

export const MEMBERSHIP_HEADERS = [
  'Membership Number',
  'Record Type',
  'Branch Suffix',
  'Is Head',
  'Name',
  'Relationship to Head',
  'Gender',
  'Date of Birth',
  'Marital Status',
  'Married To',
  'Date of Marriage',
  'Baptism Status',
  'Date of Baptism',
  'Occupation',
  'Role',
  'Phone Number',
  'Email',
  'Fellowship / Groups',
  'Door Number',
  'Street Name',
  'Area',
  'City',
  'Pincode',
  'Landmark',
  'Primary Phone Number',
  'Alternate Phone Number',
  'Membership Email',
  'Year Joined',
  'Membership Status',
]

export const DATE_HEADERS = [
  'Date of Birth',
  'Date of Marriage',
  'Date of Baptism',
]

const RELATIONSHIPS = [
  'Spouse',
  'Parent',
  'Child',
  'Sibling',
  'Guardian',
  'Other',
]

const GENDERS = ['Male', 'Female', 'Other']
const MARITAL_STATUSES = ['Single', 'Married', 'Widowed', 'Divorced']
const BAPTISM_STATUSES = ['Unknown', 'Baptised', 'Not Baptised']
const MEMBERSHIP_STATUSES = ['Active', 'Inactive', 'Closed']
const RECORD_TYPES = ['Membership', 'Branch']

export const MEMBERSHIP_EXAMPLE_ROWS = [
  {
    'Membership Number': '101',
    'Record Type': 'Membership',
    'Branch Suffix': '',
    'Is Head': 'Yes',
    Name: 'Example Head',
    'Relationship to Head': '',
    Gender: 'Male',
    'Date of Birth': '1980-04-12',
    'Marital Status': 'Married',
    'Married To': 'Example Spouse',
    'Date of Marriage': '2005-08-20',
    'Baptism Status': 'Baptised',
    'Date of Baptism': '1995-06-10',
    Occupation: 'Teacher',
    Role: 'Head',
    'Phone Number': '9876543210',
    Email: 'head@example.com',
    'Fellowship / Groups': 'Youth Fellowship; Sunday School',
    'Door Number': '12A',
    'Street Name': 'Church Street',
    Area: 'Anna Nagar',
    City: 'Chennai',
    Pincode: '600040',
    Landmark: 'Near park',
    'Primary Phone Number': '9876543210',
    'Alternate Phone Number': '',
    'Membership Email': 'head@example.com',
    'Year Joined': '2005',
    'Membership Status': 'Active',
  },
  {
    'Membership Number': '101',
    'Record Type': 'Membership',
    'Branch Suffix': '',
    'Is Head': 'No',
    Name: 'Example Spouse',
    'Relationship to Head': 'Spouse',
    Gender: 'Female',
    'Date of Birth': '1983-09-18',
    'Marital Status': 'Married',
    'Married To': 'Example Head',
    'Date of Marriage': '2005-08-20',
    'Baptism Status': 'Baptised',
    'Date of Baptism': '1998-02-01',
    Occupation: 'Teacher',
    Role: 'Member',
    'Phone Number': '9876543211',
    Email: 'spouse@example.com',
    'Fellowship / Groups': 'Youth Fellowship',
    'Door Number': '12A',
    'Street Name': 'Church Street',
    Area: 'Anna Nagar',
    City: 'Chennai',
    Pincode: '600040',
    Landmark: 'Near park',
    'Primary Phone Number': '9876543210',
    'Alternate Phone Number': '',
    'Membership Email': 'head@example.com',
    'Year Joined': '2005',
    'Membership Status': 'Active',
  },
]

/**
 * Converts Excel group values into a normalized, de-duplicated list.
 *
 * Supported separators: semicolon, comma, and newline.
 * Use semicolons in the workbook to separate multiple group names.
 */
export function parseGroupNames(value) {
  const values = Array.isArray(value) ? value : [value]

  const names = values.flatMap((item) =>
    String(item ?? '').split(/[;,\n\r]+/),
  )

  const seen = new Set()

  return names
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => {
      const key = name.toLocaleLowerCase()

      if (seen.has(key)) return false

      seen.add(key)
      return true
    })
}

/**
 * Canonical spreadsheet representation for groups.
 */
export function formatGroupNames(value) {
  return parseGroupNames(value).join('; ')
}

export function createEmptyRow() {
  return Object.fromEntries(
    MEMBERSHIP_HEADERS.map((header) => [header, '']),
  )
}

export function prepareImportedRows(rows) {
  const normalized = normalizeRows(rows, MEMBERSHIP_HEADERS)

  return normalized.map((row, index) => {
    const prepared = { ...row }

    for (const header of DATE_HEADERS) {
      const value = cleanCell(prepared[header])

      if (!value) {
        prepared[header] = ''
        continue
      }

      const parsed = parseExcelDate(value)
      prepared[header] = parsed ?? value
    }

    for (const header of MEMBERSHIP_HEADERS) {
      if (DATE_HEADERS.includes(header)) continue
      prepared[header] = cleanCell(prepared[header])
    }

    prepared['Membership Number'] =
      prepared['Membership Number'].replace(/\s+/g, '')

    prepared['Record Type'] =
      prepared['Record Type'].trim()

    prepared['Branch Suffix'] =
      prepared['Branch Suffix'].toUpperCase()

    prepared['Is Head'] =
      prepared['Is Head'].toLowerCase() === 'yes' ? 'Yes' : 'No'

        // The database supports "Child", not "Son" or "Daughter".
    // Normalize common Excel values before validation and import.
    const relationship = prepared['Relationship to Head']
      .trim()
      .toLocaleLowerCase()

    const relationshipAliases = {
      son: 'Child',
      daughter: 'Child',
      child: 'Child',
      spouse: 'Spouse',
      parent: 'Parent',
      sibling: 'Sibling',
      guardian: 'Guardian',
      other: 'Other',
    }

    if (relationship) {
      prepared['Relationship to Head'] =
        relationshipAliases[relationship] ?? prepared['Relationship to Head']
    }

    prepared['Fellowship / Groups'] = formatGroupNames(
      prepared['Fellowship / Groups'],
    )

    // Preserve the original Excel row number when available.
    prepared.__sourceRow = row.__sourceRow ?? index + 2

    return prepared
  })
}

export function getHouseholdKey(row) {
  const number = cleanCell(row['Membership Number']).toLowerCase()
  const suffix = cleanCell(row['Branch Suffix']).toUpperCase()

  return `${number}::${suffix || 'MAIN'}`
}

function addIssue(collection, type, rows, index, field, message) {
  collection.push({
    type,
    index,
    sourceRow: rows[index]?.__sourceRow ?? index + 2,
    field,
    message,
  })
}

export function validateMembershipRows(rows) {
  const errors = []
  const warnings = []

  const addError = (index, field, message) =>
    addIssue(errors, 'error', rows, index, field, message)

  const addWarning = (index, field, message) =>
    addIssue(warnings, 'warning', rows, index, field, message)

  const householdRows = new Map()
  const membershipNumberRows = new Map()
  const nameRows = new Map()

  rows.forEach((row, index) => {
    const number = cleanCell(row['Membership Number'])
    const name = cleanCell(row.Name)
    const type = cleanCell(row['Record Type'])
    const suffix = cleanCell(row['Branch Suffix']).toUpperCase()
    const head = cleanCell(row['Is Head'])
    const relationship = cleanCell(row['Relationship to Head'])
    const status = cleanCell(row['Membership Status'])
    const gender = cleanCell(row.Gender)
    const maritalStatus = cleanCell(row['Marital Status'])
    const baptismStatus = cleanCell(row['Baptism Status'])
    const marriageDate = cleanCell(row['Date of Marriage'])
    const yearJoined = cleanCell(row['Year Joined'])

    // Membership number format.
    if (!number) {
      addError(
        index,
        'Membership Number',
        'Membership number is required.',
      )
    } else {
      if (!/^[A-Za-z0-9]+$/.test(number)) {
        addError(
          index,
          'Membership Number',
          'Use letters and numbers only, without spaces or punctuation.',
        )
      }

      const normalizedNumber = number.toLowerCase()
      const numberIndexes =
        membershipNumberRows.get(normalizedNumber) ?? []

      numberIndexes.push(index)
      membershipNumberRows.set(normalizedNumber, numberIndexes)
    }

    // Person name.
    if (!name) {
      addError(index, 'Name', 'Member name is required.')
    } else {
      const normalizedName = name.toLocaleLowerCase()
      const nameIndexes = nameRows.get(normalizedName) ?? []

      nameIndexes.push(index)
      nameRows.set(normalizedName, nameIndexes)
    }

    // Membership type and branch suffix.
    if (!RECORD_TYPES.includes(type)) {
      addError(index, 'Record Type', 'Choose Membership or Branch.')
    }

    if (!['Yes', 'No'].includes(head)) {
      addError(index, 'Is Head', 'Choose Yes or No.')
    }

    if (type === 'Branch' && !/^[A-Z]$/.test(suffix)) {
      addError(
        index,
        'Branch Suffix',
        'A branch needs one uppercase letter from A to Z.',
      )
    }

    if (type === 'Membership' && suffix) {
      addError(
        index,
        'Branch Suffix',
        'Normal memberships should not have a branch suffix.',
      )
    }

    if (type === 'Branch' && head === 'Yes' && !suffix) {
      addError(
        index,
        'Branch Suffix',
        'A branch head needs a branch suffix.',
      )
    }

    // Relationship validation.
    if (relationship && !RELATIONSHIPS.includes(relationship)) {
      addError(
        index,
        'Relationship to Head',
        `Use ${RELATIONSHIPS.join(', ')}.`,
      )
    }

    if (head === 'Yes' && relationship) {
      addWarning(
        index,
        'Relationship to Head',
        'The household head normally has no relationship to themselves.',
      )
    }

    if (head === 'No' && !relationship) {
      addError(
        index,
        'Relationship to Head',
        'Select the member’s relationship to the household head.',
      )
    }

    // Personal information.
    if (gender && !GENDERS.includes(gender)) {
      addError(index, 'Gender', `Use ${GENDERS.join(', ')}.`)
    }

    if (maritalStatus && !MARITAL_STATUSES.includes(maritalStatus)) {
      addError(
        index,
        'Marital Status',
        `Use ${MARITAL_STATUSES.join(', ')}.`,
      )
    }

    if (baptismStatus && !BAPTISM_STATUSES.includes(baptismStatus)) {
      addError(
        index,
        'Baptism Status',
        `Use ${BAPTISM_STATUSES.join(', ')}.`,
      )
    }

    if (status && !MEMBERSHIP_STATUSES.includes(status)) {
      addError(
        index,
        'Membership Status',
        `Use ${MEMBERSHIP_STATUSES.join(', ')}.`,
      )
    }

    // Dates.
    for (const field of DATE_HEADERS) {
      const value = cleanCell(row[field])

      if (!value) continue

      const parsed = parseExcelDate(value)

      if (!parsed) {
        addError(
          index,
          field,
          'Enter a valid date in YYYY-MM-DD format.',
        )
      } else if (parsed > new Date().toISOString().slice(0, 10)) {
        addWarning(index, field, 'This date is in the future.')
      }
    }

    if (relationship === 'Spouse' && !marriageDate) {
      addError(
        index,
        'Date of Marriage',
        'A spouse relationship requires a wedding date.',
      )
    }

    if (marriageDate && maritalStatus && maritalStatus !== 'Married') {
      addWarning(
        index,
        'Marital Status',
        'A marriage date is present but marital status is not Married.',
      )
    }

    if (relationship === 'Spouse' && maritalStatus === 'Single') {
      addError(
        index,
        'Marital Status',
        'A spouse relationship cannot have marital status Single.',
      )
    }

    // Year joined.
    if (!yearJoined) {
      addError(index, 'Year Joined', 'Year joined is required.')
    } else if (!/^\d{4}$/.test(yearJoined)) {
      addError(index, 'Year Joined', 'Enter a four-digit year.')
    }

    // Validate household composition using membership number AND suffix.
    // Repeated membership numbers within the same household are expected.
    if (number && type && (type === 'Membership' || /^[A-Z]$/.test(suffix))) {
      const key = getHouseholdKey(row)
      const indexes = householdRows.get(key) ?? []

      indexes.push(index)
      householdRows.set(key, indexes)
    }
  })

  // Each household/branch must contain exactly one head.
  for (const [key, indexes] of householdRows) {
    if (!key || key.startsWith('::')) continue

    const heads = indexes.filter(
      (index) => cleanCell(rows[index]['Is Head']) === 'Yes',
    )

    if (heads.length !== 1) {
      indexes.forEach((index) => {
        addError(
          index,
          'Is Head',
          `This household needs exactly one head; found ${heads.length}.`,
        )
      })
    }

    const types = new Set(
      indexes.map((index) => cleanCell(rows[index]['Record Type'])),
    )

    if (types.size > 1) {
      indexes.forEach((index) => {
        addWarning(
          index,
          'Record Type',
          'This household has mixed Membership/Branch record types.',
        )
      })
    }
  }

  // Duplicate membership number checking:
  // Multiple rows with the same number and suffix are members of one household,
  // not duplicate memberships. Warn only when the same number is used for
  // different household/branch keys.
  for (const [number, indexes] of membershipNumberRows) {
    if (indexes.length < 2) continue

    const distinctHouseholds = new Map()

    for (const index of indexes) {
      const row = rows[index]
      const key = getHouseholdKey(row)

      if (!distinctHouseholds.has(key)) {
        distinctHouseholds.set(key, [])
      }

      distinctHouseholds.get(key).push(index)
    }

    if (distinctHouseholds.size > 1) {
      indexes.forEach((index) => {
        addWarning(
          index,
          'Membership Number',
          `Membership number ${number} is used by more than one household or branch. Confirm that the numbering is intentional.`,
        )
      })
    }
  }

  // Repeated names are a warning, not an automatic failure.
  for (const indexes of nameRows.values()) {
    if (indexes.length < 2) continue

    indexes.forEach((index) => {
      addWarning(
        index,
        'Name',
        'This name appears more than once. Confirm that these are different people.',
      )
    })
  }

  // Marriage consistency checks between the household head and spouse.
  for (const indexes of householdRows.values()) {
    const headIndex = indexes.find(
      (index) => cleanCell(rows[index]['Is Head']) === 'Yes',
    )

    if (headIndex === undefined) continue

    const headRow = rows[headIndex]
    const spouseRows = indexes.filter(
      (index) =>
        cleanCell(rows[index]['Relationship to Head']) === 'Spouse',
    )

    for (const spouseIndex of spouseRows) {
      const spouseRow = rows[spouseIndex]
      const headDate = cleanCell(headRow['Date of Marriage'])
      const spouseDate = cleanCell(spouseRow['Date of Marriage'])

      if (headDate && spouseDate && headDate !== spouseDate) {
        addWarning(
          spouseIndex,
          'Date of Marriage',
          'The head and spouse have different wedding dates. Check that both rows use the same date.',
        )
      }

      const headMarriedTo = cleanCell(headRow['Married To'])
      const spouseName = cleanCell(spouseRow.Name)
      const spouseMarriedTo = cleanCell(spouseRow['Married To'])
      const headName = cleanCell(headRow.Name)

      if (
        headMarriedTo &&
        spouseName &&
        headMarriedTo.toLocaleLowerCase() !== spouseName.toLocaleLowerCase()
      ) {
        addWarning(
          headIndex,
          'Married To',
          'The head’s Married To value does not match the spouse row’s name.',
        )
      }

      if (
        spouseMarriedTo &&
        headName &&
        spouseMarriedTo.toLocaleLowerCase() !== headName.toLocaleLowerCase()
      ) {
        addWarning(
          spouseIndex,
          'Married To',
          'The spouse’s Married To value does not match the head’s name.',
        )
      }

      if (headDate && !spouseDate) {
        addWarning(
          spouseIndex,
          'Date of Marriage',
          'The head has a wedding date. Copy it to the spouse row so both records agree.',
        )
      }

      if (!headDate && spouseDate) {
        addWarning(
          headIndex,
          'Date of Marriage',
          'The spouse has a wedding date. Copy it to the head row so both records agree.',
        )
      }
    }
  }

  return { errors, warnings }
}
