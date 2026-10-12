import { finishToResponse, formatDate, money, writeHeader, writeKeyValues, writeTable } from "./shared.js";

export const streamReceipt = (res, { payment, loan, applicantName, receiverName }) =>
  finishToResponse(res, `${payment.receiptNumber}.pdf`, (doc) => {
    writeHeader(doc, "Payment Receipt");
    writeKeyValues(doc, [
      ["Receipt Number", payment.receiptNumber],
      ["Date", formatDate(payment.paidAt)],
      ["Received From", applicantName],
      ["Loan Number", loan.loanNumber],
      ["Payment Type", payment.type],
      ["Method", payment.method.replace("_", " ")],
      ["Reference", payment.reference || "-"],
      ["Amount Received", money(payment.amount)],
      ["Status", payment.status],
      ["Received By", receiverName]
    ]);

    doc.moveDown(0.5);
    doc.fontSize(12).fillColor("#264653").text("Allocation");
    doc.moveDown(0.4);
    writeTable(
      doc,
      [
        { label: "Installment", x: 50, width: 90 },
        { label: "Principal", x: 150, width: 100, align: "right" },
        { label: "Interest", x: 260, width: 90, align: "right" },
        { label: "Late Fee", x: 360, width: 90, align: "right" },
        { label: "Total", x: 455, width: 90, align: "right" }
      ],
      payment.allocations.map((allocation) => [
        `#${allocation.installmentNumber}`,
        money(allocation.principal),
        money(allocation.interest),
        money(allocation.lateFee),
        money(allocation.amount)
      ])
    );
  });
