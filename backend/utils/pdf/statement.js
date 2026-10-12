import { finishToResponse, formatDate, money, writeHeader, writeKeyValues, writeTable } from "./shared.js";

export const streamStatement = (res, { loan, applicantName, installments, payments, summary }) =>
  finishToResponse(res, `${loan.loanNumber}_Statement.pdf`, (doc) => {
    writeHeader(doc, "Loan Statement");
    writeKeyValues(doc, [
      ["Borrower", applicantName],
      ["Loan Number", loan.loanNumber],
      ["Loan Type", loan.loanType],
      ["Status", loan.status],
      ["Approved Amount", money(loan.approvedAmount)],
      ["Interest Rate", `${loan.interestRate}% per annum`],
      ["Tenure", `${loan.tenureMonths} months`],
      ["Total Payable", money(loan.totalPayable)],
      ["Total Paid", money(summary.totalPaid)],
      ["Outstanding Balance", money(summary.outstandingBalance)],
      ["Outstanding Late Fees", money(summary.outstandingLateFees)]
    ]);

    doc.fontSize(12).fillColor("#264653").text("Repayment Schedule");
    doc.moveDown(0.4);
    writeTable(
      doc,
      [
        { label: "#", x: 50, width: 30 },
        { label: "Due Date", x: 85, width: 90 },
        { label: "Amount", x: 180, width: 90, align: "right" },
        { label: "Paid", x: 275, width: 90, align: "right" },
        { label: "Late Fee", x: 370, width: 70, align: "right" },
        { label: "Status", x: 450, width: 95 }
      ],
      installments.map((installment) => [
        installment.installmentNumber,
        formatDate(installment.dueDate),
        money(installment.amount),
        money(installment.paidAmount),
        money(installment.lateFee),
        installment.status
      ])
    );

    doc.moveDown(0.5);
    doc.fontSize(12).fillColor("#264653").text("Payments");
    doc.moveDown(0.4);
    writeTable(
      doc,
      [
        { label: "Receipt", x: 50, width: 100 },
        { label: "Date", x: 155, width: 90 },
        { label: "Method", x: 250, width: 90 },
        { label: "Amount", x: 345, width: 90, align: "right" },
        { label: "Status", x: 450, width: 95 }
      ],
      payments.map((payment) => [
        payment.receiptNumber,
        formatDate(payment.paidAt),
        payment.method.replace("_", " "),
        money(payment.amount),
        payment.status
      ])
    );
  });
