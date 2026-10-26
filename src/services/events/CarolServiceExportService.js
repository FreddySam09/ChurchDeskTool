
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function safeFilename(value) {
  return String(value || "carol-day")
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function formatVisitDate(value) {
  if (!value) return "Date not set";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getMembershipNumber(membership) {
  return membership?.membership_number == null
    ? "No number"
    : String(membership.membership_number);
}

/**
 * Keep the exact order of the visits supplied by the page.
 * Offering records are indexed by visit_id.
 */
function buildExportRows(visits, offerings) {
  const offeringByVisitId = new Map(
    offerings.map((offering) => [
      offering.visit_id,
      offering.amount,
    ]),
  );

  return visits.map((visit, index) => {
    const membership = visit.membership;

    return {
      "S.No.": index + 1,
      "Membership No.": getMembershipNumber(membership),
      "Household Name": membership?.head_name || "Membership not found",
      "Street Name": membership?.street_name || "",
      Area: membership?.area || "",
      "Visited Status": visit.status || "Pending",
      "Offering (₹)": offeringByVisitId.has(visit.id)
        ? Number(offeringByVisitId.get(visit.id))
        : "",
    };
  });
}

export function exportCarolVisitsToExcel({ day, visits, offerings }) {
  const rows = buildExportRows(visits, offerings);
  const headers = [
    "S.No.",
    "Membership No.",
    "Household Name",
    "Street Name",
    "Area",
    "Visited Status",
    "Offering (₹)",
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([
    [`${day?.name || "Carol Day"} — Assigned Visit List`],
    [`Visit Date: ${formatVisitDate(day?.visit_date)}`],
    [`Total Assigned: ${visits.length}`],
    [],
    headers,
    ...rows.map((row) => headers.map((header) => row[header] ?? "")),
  ]);

  worksheet["!cols"] = [
    { wch: 9 },
    { wch: 17 },
    { wch: 30 },
    { wch: 24 },
    { wch: 22 },
    { wch: 18 },
    { wch: 17 },
  ];

  worksheet["!autofilter"] = {
    ref: `A5:G${Math.max(5, rows.length + 5)}`,
  };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Assigned Visits");

  const filename = `${safeFilename(day?.name)}-${day?.visit_date || "visits"}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

export function exportCarolVisitsToPdf({ day, visits, offerings }) {
  const rows = buildExportRows(visits, offerings);

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(day?.name || "Carol Day — Assigned Visit List", 14, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Visit Date: ${formatVisitDate(day?.visit_date)}`, 14, 23);
  doc.text(`Total Assigned: ${visits.length}`, 14, 29);

  autoTable(doc, {
    startY: 35,
    head: [[
      "S.No.",
      "Membership No.",
      "Household Name",
      "Street Name",
      "Area",
      "Visited Status",
      "Offering (INR)",
    ]],
    body: rows.map((row) => [
      row["S.No."],
      row["Membership No."],
      row["Household Name"],
      row["Street Name"],
      row.Area,
      row["Visited Status"],
      row["Offering (₹)"] === ""
        ? ""
        : Number(row["Offering (₹)"]).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
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
      0: { cellWidth: 14 },
      1: { cellWidth: 25 },
      2: { cellWidth: 48 },
      3: { cellWidth: 42 },
      4: { cellWidth: 38 },
      5: { cellWidth: 30 },
      6: { cellWidth: 25, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.internal.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(
      `Page ${page} of ${pageCount}`,
      doc.internal.pageSize.getWidth() - 14,
      doc.internal.pageSize.getHeight() - 7,
      { align: "right" },
    );
  }

  const filename = `${safeFilename(day?.name)}-${day?.visit_date || "visits"}.pdf`;
  doc.save(filename);
}
