
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function formatDate(value) {
  if (!value || String(value).length < 10) return "";

  const month = Number(String(value).slice(5, 7));
  const day = Number(String(value).slice(8, 10));

  const date = new Date(2000, month - 1, day, 12);

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function filenameDate(value) {
  return String(value || "")
    .replace(/[^0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
}

function makeRows(items, type) {
  const isBirthday = type === "birthday";

  return items.map((item, index) => ({
    "S.No.": index + 1,
    "Membership No.": item.membership_number || "",
    [isBirthday ? "Name" : "Couple"]:
      isBirthday ? item.name || "" : item.couple_name || "",
    [isBirthday ? "Birthday" : "Wedding Date"]: formatDate(
      isBirthday ? item.date_of_birth : item.date_of_marriage,
    ),
    Phone: item.phone_number || "",
    Membership: item.membership_name || "",
  }));
}

function addWorksheet(workbook, name, title, startDate, endDate, rows) {
  const headers = [
    "S.No.",
    "Membership No.",
    name === "Birthdays" ? "Name" : "Couple",
    name === "Birthdays" ? "Birthday" : "Wedding Date",
    "Phone",
    "Membership",
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([
    [title],
    [`Date range: ${formatDate(startDate)} – ${formatDate(endDate)}`],
    [`Total records: ${rows.length}`],
    [],
    headers,
    ...rows.map((row) => headers.map((header) => row[header] ?? "")),
  ]);

  worksheet["!cols"] = [
    { wch: 8 },
    { wch: 17 },
    { wch: 34 },
    { wch: 18 },
    { wch: 18 },
    { wch: 38 },
  ];

  if (rows.length) {
    worksheet["!autofilter"] = {
      ref: `A5:F${rows.length + 5}`,
    };
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, name);
}

export function exportSpecialDaysToExcel({
  startDate,
  endDate,
  birthdays = [],
  anniversaries = [],
}) {
  const workbook = XLSX.utils.book_new();

  const birthdayData = makeRows(birthdays, "birthday");
  const anniversaryData = makeRows(anniversaries, "anniversary");

  addWorksheet(
    workbook,
    "Birthdays",
    "Church Desk — Birthday List",
    startDate,
    endDate,
    birthdayData,
  );

  addWorksheet(
    workbook,
    "Wedding Anniversaries",
    "Church Desk — Wedding Anniversary List",
    startDate,
    endDate,
    anniversaryData,
  );

  const filename = `church-special-days-${filenameDate(startDate)}-to-${filenameDate(endDate)}.xlsx`;

  XLSX.writeFile(workbook, filename);
}

export function exportSpecialDaysToPdf({
  startDate,
  endDate,
  birthdays = [],
  anniversaries = [],
}) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Church Desk — Special Days", margin, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Date range: ${formatDate(startDate)} – ${formatDate(endDate)}`,
    margin,
    23,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Birthdays (${birthdays.length})`, margin, 33);

  const birthdayRows = makeRows(birthdays, "birthday");

  autoTable(doc, {
    startY: 37,
    head: [[
      "S.No.",
      "Membership No.",
      "Name",
      "Birthday",
      "Phone",
      "Membership",
    ]],
    body: birthdayRows.map((row) => [
      row["S.No."],
      row["Membership No."],
      row.Name,
      row.Birthday,
      row.Phone,
      row.Membership,
    ]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.5,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [30, 30, 30],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [247, 247, 249],
    },
    columnStyles: {
      0: { cellWidth: 13 },
      1: { cellWidth: 25 },
      2: { cellWidth: 42 },
      3: { cellWidth: 23 },
      4: { cellWidth: 28 },
      5: { cellWidth: "auto" },
    },
    margin: { left: margin, right: margin },
  });

  let nextY = (doc.lastAutoTable?.finalY ?? 37) + 12;

  if (nextY > pageHeight - 30) {
    doc.addPage();
    nextY = 18;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(
    `Wedding Anniversaries (${anniversaries.length})`,
    margin,
    nextY,
  );

  const anniversaryRows = makeRows(anniversaries, "anniversary");

  autoTable(doc, {
    startY: nextY + 4,
    head: [[
      "S.No.",
      "Membership No.",
      "Couple",
      "Wedding Date",
      "Phone",
      "Membership",
    ]],
    body: anniversaryRows.map((row) => [
      row["S.No."],
      row["Membership No."],
      row.Couple,
      row["Wedding Date"],
      row.Phone,
      row.Membership,
    ]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.5,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [30, 30, 30],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [247, 247, 249],
    },
    columnStyles: {
      0: { cellWidth: 13 },
      1: { cellWidth: 25 },
      2: { cellWidth: 48 },
      3: { cellWidth: 25 },
      4: { cellWidth: 28 },
      5: { cellWidth: "auto" },
    },
    margin: { left: margin, right: margin },
  });

  const pageCount = doc.internal.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);

    doc.text(
      `Page ${page} of ${pageCount}`,
      pageWidth - margin,
      pageHeight - 7,
      { align: "right" },
    );
  }

  doc.save(
    `church-special-days-${filenameDate(startDate)}-to-${filenameDate(endDate)}.pdf`,
  );
}
