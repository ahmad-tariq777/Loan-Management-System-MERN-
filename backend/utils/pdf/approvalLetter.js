import { ORG_NAME } from "../../config/loanConfig.js";
import { createDocument, formatDate, money, writeFooters, writeHeader, writeKeyValues } from "./shared.js";

export const generateApprovalLetterPDF = (loan, applicantName) =>
  new Promise((resolve, reject) => {
    const doc = createDocument();
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    writeHeader(doc, "Loan Approval Letter");
    doc.text(`Date: ${formatDate(loan.approvedAt)}`, { align: "right" });
    doc.text(`Reference: ${loan.loanID}`, { align: "right" });
    doc.moveDown(1.5);
    doc.text(`Dear ${applicantName},`);
    doc.moveDown(0.5);
    doc.text(
      `We are pleased to inform you that your loan application with ${ORG_NAME} has been reviewed and approved. The details of your approved loan are below.`,
      { lineGap: 4 }
    );
    doc.moveDown(1.5);
    doc.fontSize(12).fillColor("#264653").text("Loan Details", { underline: true });
    doc.moveDown(0.5);

    writeKeyValues(doc, [
      ["Loan Reference ID", loan.loanID],
      ["Application Number", loan.loanNumber],
      ["Loan Type", loan.loanType.charAt(0).toUpperCase() + loan.loanType.slice(1)],
      ["Approved Amount", money(loan.approvedAmount)],
      ["Tenure", `${loan.tenureMonths} months`],
      ["Interest Rate", `${loan.interestRate}% per annum`],
      ["Processing Fee", money(loan.processingFee)],
      ["Monthly Installment", money(loan.monthlyInstallment)],
      ["Total Payable", money(loan.totalPayable)],
      ["Officer Comments", loan.officerComments || "N/A"]
    ]);

    doc.moveDown(1);
    doc.fontSize(11).fillColor("#333").text(
      "Your repayment schedule will be generated at the time of disbursement. Timely payments will maintain your eligibility for future financing.",
      { lineGap: 4 }
    );
    doc.moveDown(2);
    doc.text("Sincerely,");
    doc.moveDown(1.5);
    doc.text("_______________________");
    doc.text("Loan Officer");
    doc.text(ORG_NAME);

    writeFooters(doc);
    doc.end();
  });
