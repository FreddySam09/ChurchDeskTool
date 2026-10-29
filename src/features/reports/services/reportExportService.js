import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function safeFileName(value) {
  return String(value || "church-desk-report")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "church-desk-report";
}

function formatCell(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(value) {
  const text = formatCell(value);

  // Protect against spreadsheet formula injection in exported CSV.
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;

  return `"${safe.replace(/"/g, '""')}"`;
}

export function exportCsv({ rows, fields, reportName }) {
  const header = fields.map((field) => csvEscape(field.label));
  const body = rows.map((row) =>
    fields.map((field) => csvEscape(row[field.key])),
  );

  const csv = [header, ...body]
    .map((row) => row.join(","))
    .join("\r\n");

  // UTF-8 BOM improves compatibility with Excel.
  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;",
  });

  downloadBlob(blob, `${safeFileName(reportName)}.csv`);
}

export function exportExcel({
  rows,
  fields,
  reportName,
  exportedBy,
  exportedAt,
  source,
}) {
  const data = rows.map((row) =>
    Object.fromEntries(
      fields.map((field) => [field.label, formatCell(row[field.key])]),
    ),
  );

  const dataSheet = XLSX.utils.json_to_sheet(data);
  dataSheet["!cols"] = fields.map((field) => ({
    wch: Math.min(Math.max(field.label.length + 3, 14), 34),
  }));

  const infoSheet = XLSX.utils.aoa_to_sheet([
    ["Church Desk — Report Information", ""],
    ["Report", reportName],
    ["Data source", source],
    ["Exported by", exportedBy || "Signed-in user"],
    ["Exported at", exportedAt],
    ["Rows exported", rows.length],
    ["Columns", fields.map((field) => field.label).join(", ")],
  ]);

  infoSheet["!cols"] = [{ wch: 22 }, { wch: 80 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Report Data");
  XLSX.utils.book_append_sheet(workbook, infoSheet, "Report Info");

  workbook.Props = {
    Title: reportName,
    Subject: `Church Desk ${source} report`,
    Author: exportedBy || "Church Desk user",
    CreatedDate: new Date(exportedAt),
  };

  XLSX.writeFile(workbook, `${safeFileName(reportName)}.xlsx`);
}

export function exportPdf({
  rows,
  fields,
  reportName,
  exportedBy,
  exportedAt,
  source,
}) {
  const pdf = new jsPDF({
    orientation: fields.length > 5 ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });

  pdf.setProperties({
    title: reportName,
    subject: `Church Desk ${source} report`,
    author: exportedBy || "Church Desk user",
    creator: "Church Desk",
  });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(reportName, 40, 42);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(`Source: ${source}`, 40, 59);
  pdf.text(`Rows: ${rows.length}`, 40, 71);
  pdf.text(`Exported by: ${exportedBy || "Signed-in user"}`, 40, 83);
  pdf.text(`Exported at: ${exportedAt}`, 40, 95);

  autoTable(pdf, {
    startY: 110,
    head: [fields.map((field) => field.label)],
    body: rows.map((row) =>
      fields.map((field) => formatCell(row[field.key])),
    ),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: fields.length > 7 ? 6 : 8,
      cellPadding: 4,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [30, 30, 30],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    margin: { top: 30, right: 28, bottom: 36, left: 28 },
    showHead: "everyPage",
    didDrawPage: () => {
      const pageCount = pdf.internal.getNumberOfPages();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.setFontSize(7);
      pdf.setTextColor(90);
      pdf.text(
        `Church Desk · ${exportedBy || "Signed-in user"} · ${exportedAt}`,
        28,
        pageHeight - 15,
      );
      pdf.text(
        `Page ${pdf.internal.getCurrentPageInfo().pageNumber} of ${pageCount}`,
        pageWidth - 28,
        pageHeight - 15,
        { align: "right" },
      );
    },
  });

  pdf.save(`${safeFileName(reportName)}.pdf`);
}