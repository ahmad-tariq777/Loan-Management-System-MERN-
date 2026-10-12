import PDFDocument from "pdfkit";
import { ORG_NAME, ORG_TAGLINE } from "../../config/loanConfig.js";

export const money = (value) => `Rs ${Number(value || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "-";

export const createDocument = () => new PDFDocument({ size: "A4", margin: 50, bufferPages: true });

export const writeHeader = (doc, title) => {
  doc.fontSize(22).fillColor("#264653").text(ORG_NAME, { align: "center" });
  doc.fontSize(11).fillColor("#666").text(ORG_TAGLINE, { align: "center" });
  doc.moveDown(0.8);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#264653");
  doc.moveDown(0.6);
  doc.fontSize(17).fillColor("#000").text(title, { align: "center", underline: true });
  doc.moveDown(1);
  doc.fontSize(11).fillColor("#333");
};

export const writeFooters = (doc) => {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index++) {
    doc.switchToPage(index);
    doc.fontSize(8).fillColor("#888").text(
      `This is a computer-generated document. ${ORG_NAME}. Page ${index + 1} of ${range.count}`,
      50,
      800,
      { align: "center", width: 495, lineBreak: false }
    );
  }
};

export const writeKeyValues = (doc, pairs) => {
  doc.fontSize(11).fillColor("#000");
  for (const [label, value] of pairs) {
    doc.font("Helvetica-Bold").text(`${label}: `, { continued: true, indent: 10 });
    doc.font("Helvetica").text(String(value ?? "-"));
  }
  doc.moveDown(0.5);
};

export const writeTable = (doc, columns, rows) => {
  const drawRow = (cells, bold) => {
    const y = doc.y;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor("#000");
    columns.forEach((column, index) => {
      doc.text(String(cells[index] ?? ""), column.x, y, { width: column.width, align: column.align || "left", lineBreak: false });
    });
    doc.y = y + 15;
  };

  drawRow(columns.map((column) => column.label), true);
  doc.moveTo(50, doc.y - 3).lineTo(545, doc.y - 3).stroke("#bbb");
  for (const row of rows) {
    if (doc.y > 760) {
      doc.addPage();
      drawRow(columns.map((column) => column.label), true);
    }
    drawRow(row, false);
  }
  doc.font("Helvetica").moveDown(0.5);
};

export const finishToResponse = (res, filename, build) => {
  const doc = createDocument();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);
  build(doc);
  writeFooters(doc);
  doc.end();
};
