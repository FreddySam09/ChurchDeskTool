import * as XLSX from 'xlsx'

export function downloadWorkbook(filename, headers, rows) {
  const worksheet = XLSX.utils.aoa_to_sheet([
    headers,
    ...rows.map((row) =>
      headers.map((header) => row[header] ?? ''),
    ),
  ])

  worksheet['!cols'] = headers.map((header) => ({
    wch: Math.min(
      Math.max(String(header).length + 3, 16),
      30,
    ),
  }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Membership Import')
  XLSX.writeFile(workbook, filename)
}

export async function readWorkbook(file) {
  if (!file) {
    throw new Error('Choose an Excel workbook first.')
  }

  const extension = file.name.split('.').pop()?.toLowerCase()

  if (!['xlsx', 'xls'].includes(extension)) {
    throw new Error('Please upload an .xlsx or .xls file.')
  }

  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: 'array',
    cellDates: true,
  })

  const firstSheet = workbook.SheetNames[0]

  if (!firstSheet) {
    throw new Error('The workbook contains no worksheets.')
  }

  const worksheet = workbook.Sheets[firstSheet]
  const sourceRows = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
  })

  if (!sourceRows.length) {
    throw new Error('The first worksheet contains no data rows.')
  }

  return sourceRows.map((source, index) => ({
    ...source,
    __sourceRow: index + 2,
  }))
}

export function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function normalizeRows(rows, headers) {
  const headerLookup = new Map(
    headers.map((header) => [normalizeHeader(header), header]),
  )

  return rows.map((source, index) => {
    const row = {}

    for (const [sourceHeader, value] of Object.entries(source)) {
      const canonicalHeader = headerLookup.get(
        normalizeHeader(sourceHeader),
      )

      if (canonicalHeader) {
        row[canonicalHeader] = value
      }
    }

    return {
      ...Object.fromEntries(
        headers.map((header) => [header, row[header] ?? '']),
      ),
      __sourceRow: source.__sourceRow ?? index + 2,
    }
  })
}

export function cleanCell(value) {
  return String(value ?? '').trim()
}


export function parseExcelDate(value) {
  if (value === '' || value === null || value === undefined) {
    return ''
  }

  // Excel may return a real Date object.
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null

    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0'),
    ].join('-')
  }

  const text = cleanCell(value)
  if (!text) return ''

  // Already in YYYY-MM-DD format.
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)

  if (isoMatch) {
    const [, year, month, day] = isoMatch
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
    )

    if (
      date.getFullYear() === Number(year) &&
      date.getMonth() === Number(month) - 1 &&
      date.getDate() === Number(day)
    ) {
      return [
        year,
        month.padStart(2, '0'),
        day.padStart(2, '0'),
      ].join('-')
    }

    return null
  }

  // Common Excel date formats: DD/MM/YYYY, MM/DD/YYYY,
  // DD-MM-YYYY and MM-DD-YYYY.
  const numericMatch = text.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/,
  )

  if (numericMatch) {
    const first = Number(numericMatch[1])
    const second = Number(numericMatch[2])
    const year = Number(numericMatch[3])

    let day
    let month

    if (first > 12) {
      day = first
      month = second
    } else if (second > 12) {
      month = first
      day = second
    } else {
      // Ambiguous dates use DD/MM/YYYY.
      day = first
      month = second
    }

    const date = new Date(year, month - 1, day)

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null
    }

    return [
      year,
      String(month).padStart(2, '0'),
      String(day).padStart(2, '0'),
    ].join('-')
  }

  return null
}
