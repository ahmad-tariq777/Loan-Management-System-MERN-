import { useState } from "react";
import { Link } from "react-router-dom";
import { useAction } from "../../hooks/useAction";
import { loanService } from "../../services/api";
import { Alert, Button, Card, DetailList, Input, Select } from "../../components/UI";
import { money, formatDate, formatDateTime, label, PAYMENT_METHODS, ACTIVE_LOAN_STATUSES } from "../../utils/format";

function Settlement({ loan, isStaff, onChanged }) {
  const quoteAction = useAction();
  const settleAction = useAction();
  const [quote, setQuote] = useState(null);
  const [form, setForm] = useState({ method: "cash", reference: "" });

  const getQuote = async () => {
    const res = await quoteAction.run(() => loanService.getSettlementQuote(loan._id), "");
    if (res) setQuote(res.data);
  };

  const settle = async (e) => {
    e.preventDefault();
    const res = await settleAction.run(() =>
      loanService.settle(loan._id, { amount: quote.amount, method: form.method, ...(form.reference ? { reference: form.reference } : {}) })
    );
    if (res) {
      setQuote(null);
      onChanged();
    }
  };

  return (
    <Card title="Early settlement">
      <Alert message={quoteAction.error || settleAction.error} />
      <Alert type="success" message={settleAction.success} />
      {!quote ? (
        <Button variant="secondary" loading={quoteAction.busy} onClick={getQuote}>Get settlement quote</Button>
      ) : (
        <>
          <DetailList
            items={[
              ["Amount to settle today", money(quote.amount)],
              ["Interest rebate", money(quote.interestRebate)],
              ["Installments covered", quote.outstandingInstallments],
            ]}
          />
          {isStaff ? (
            <form className="form" onSubmit={settle}>
              <Select label="Payment method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{label(m)}</option>)}
              </Select>
              <Input label="Reference (optional)" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} maxLength={100} />
              <Button type="submit" loading={settleAction.busy}>Record settlement payment</Button>
            </form>
          ) : (
            <p className="form__note">To settle early, pay this amount at your Akhuwat branch. An officer will record it.</p>
          )}
        </>
      )}
    </Card>
  );
}

export default function LoanOverview({ loan, user, onChanged }) {
  const isStaff = user.role !== "applicant";
  const isActive = ACTIVE_LOAN_STATUSES.includes(loan.status);
  const s = loan.summary;

  return (
    <div className="stack">
      {s && (
        <Card title="Repayment progress">
          <DetailList
            items={[
              ["Progress", `${s.progressPercent}%`],
              ["Installments paid", `${s.paidInstallments} of ${s.totalInstallments}`],
              ["Total paid", money(s.totalPaid)],
              ["Outstanding balance", money(s.outstandingBalance)],
              ["Outstanding late fees", money(s.outstandingLateFees)],
              s.overdueInstallments > 0 && ["Overdue", `${s.overdueInstallments} installment(s), ${money(s.overdueAmount)}`],
              s.nextDue && ["Next due", `#${s.nextDue.installmentNumber} on ${formatDate(s.nextDue.dueDate)} - ${money(s.nextDue.amountDue)}`],
            ]}
          />
        </Card>
      )}

      <div className="two-col">
        <Card title="Loan terms">
          <DetailList
            items={[
              ["Loan number", loan.loanNumber],
              loan.loanID && ["Loan ID", loan.loanID],
              ["Type", label(loan.loanType)],
              ["Purpose", loan.purpose],
              ["Amount requested", money(loan.amountRequested)],
              loan.approvedAmount && ["Amount approved", money(loan.approvedAmount)],
              ["Tenure", `${loan.tenureMonths} months`],
              ["Interest rate", `${loan.interestRate}%`],
              ["Processing fee", `${loan.processingFeePercent}% (${money(loan.processingFee)})`],
              ["Late fee", `${loan.lateFeePercent}% after ${loan.gracePeriodDays} grace days`],
              loan.monthlyInstallment > 0 && ["Monthly installment", money(loan.monthlyInstallment)],
              loan.totalPayable > 0 && ["Total payable", money(loan.totalPayable)],
              ["Remaining balance", money(loan.remainingBalance)],
              ["Guarantor", loan.guarantorRequired ? "Required" : "Not required"],
              ["Applied on", formatDate(loan.createdAt)],
              loan.disbursedAt && ["Disbursed on", formatDate(loan.disbursedAt)],
              loan.disbursedAt && ["Net disbursed", money(loan.netDisbursed)],
              loan.closedAt && ["Closed on", formatDate(loan.closedAt)],
              loan.officerComments && ["Officer comments", loan.officerComments],
            ]}
          />
        </Card>

        {isStaff && (
          <Card title="Applicant">
            <DetailList
              items={[
                ["Name", loan.applicant?.name],
                ["Email", loan.applicant?.email],
                ["Declared income", money(loan.applicant?.income)],
                ["Liabilities", money(loan.applicant?.liabilities)],
                ["Repayment score", `${loan.applicant?.repaymentHistoryScore ?? 0}/100`],
                loan.eligibilityScore !== undefined && ["Eligibility score", `${loan.eligibilityScore}/100`],
                loan.loanLimit !== undefined && ["Eligible limit", money(loan.loanLimit)],
                ["Assigned officer", loan.assignedOfficer?.name || "Unassigned"],
                loan.approvedBy && ["Approved by", loan.approvedBy.name],
              ]}
            />
            {user.role === "admin" && loan.applicant?._id && (
              <Link to={`/users/${loan.applicant._id}`}>Open user record</Link>
            )}
          </Card>
        )}
      </div>

      {isActive && <Settlement loan={loan} isStaff={isStaff} onChanged={onChanged} />}

      <Card title="Status history">
        {loan.statusHistory?.length ? (
          <ol className="timeline">
            {[...loan.statusHistory].reverse().map((h, i) => (
              <li key={i} className="timeline__item">
                <span className="timeline__status">{label(h.status)}</span>
                <span className="timeline__time">{formatDateTime(h.changedAt)}</span>
                {h.comment && <p className="timeline__comment">{h.comment}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p>No history yet.</p>
        )}
      </Card>
    </div>
  );
}
