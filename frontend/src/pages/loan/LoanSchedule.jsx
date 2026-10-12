import { useState } from "react";
import { useFetch } from "../../hooks/useFetch";
import { useAction } from "../../hooks/useAction";
import { installmentService } from "../../services/api";
import { Alert, Badge, Button, Card, DetailList, EmptyState, ErrorState, Input, Modal, PageLoader, Select, Table, Textarea } from "../../components/UI";
import { money, formatDate, label, saveBlob, PAYMENT_METHODS, clean } from "../../utils/format";

export default function LoanSchedule({ loan, user, onChanged }) {
  const isStaff = user.role !== "applicant";
  const isAdmin = user.role === "admin";
  const { data, loading, error, refetch } = useFetch(() => installmentService.getByLoan(loan._id), [loan._id]);
  const exportAction = useAction();
  const payAction = useAction();
  const waiveAction = useAction();
  const [payTarget, setPayTarget] = useState(null);
  const [waiveTarget, setWaiveTarget] = useState(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "cash", reference: "", notes: "" });
  const [reason, setReason] = useState("");

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const openPay = (item) => {
    payAction.reset();
    setPayForm({ amount: String(item.totalOutstanding), method: "cash", reference: "", notes: "" });
    setPayTarget(item);
  };

  const submitPay = async (e) => {
    e.preventDefault();
    const res = await payAction.run(() =>
      installmentService.pay(payTarget._id, clean({ ...payForm, amount: Number(payForm.amount) }))
    );
    if (res) {
      setPayTarget(null);
      refetch();
      onChanged();
    }
  };

  const submitWaive = async (e) => {
    e.preventDefault();
    const res = await waiveAction.run(() => installmentService.waiveLateFee(waiveTarget._id, { reason }));
    if (res) {
      setWaiveTarget(null);
      setReason("");
      refetch();
      onChanged();
    }
  };

  const exportCsv = () =>
    exportAction.run(async () => {
      const res = await installmentService.exportSchedule(loan._id);
      saveBlob(res, `${loan.loanNumber}_schedule.csv`);
      return res;
    }, "Schedule downloaded");

  const rows = data.installments.filter((i) => i.status !== "restructured");
  const s = data.summary;

  return (
    <div className="stack">
      <Card
        title="Summary"
        actions={<Button variant="secondary" loading={exportAction.busy} onClick={exportCsv}>Download schedule (CSV)</Button>}
      >
        <Alert message={exportAction.error} />
        <DetailList
          items={[
            ["Installments", s.total],
            ["Paid", s.paid],
            ["Overdue", s.overdue],
            ["Remaining", s.remaining],
            ["Outstanding balance", money(s.outstandingBalance)],
            ["Outstanding late fees", money(s.outstandingLateFees)],
          ]}
        />
      </Card>

      <Card title="Installment schedule">
        <Alert type="success" message={payAction.success || waiveAction.success} />
        {rows.length === 0 ? (
          <EmptyState message="No installments yet." />
        ) : (
          <Table headers={["#", "Due date", "Amount", "Principal", "Interest", "Paid", "Late fee", "Due now", "Status", ...(isStaff ? ["Actions"] : [])]}>
            {rows.map((i) => (
              <tr key={i._id}>
                <td>{i.installmentNumber}</td>
                <td>{formatDate(i.dueDate)}</td>
                <td>{money(i.amount)}</td>
                <td>{money(i.principal)}</td>
                <td>{money(i.interest)}</td>
                <td>{money(i.paidAmount)}</td>
                <td>{money(i.lateFee)}</td>
                <td>{money(i.totalOutstanding)}</td>
                <td>
                  <Badge status={i.status} />
                  {i.daysOverdue > 0 && <span className="cell-note"> {i.daysOverdue} days late</span>}
                </td>
                {isStaff && (
                  <td>
                    {i.status !== "paid" && ["disbursed", "defaulted"].includes(loan.status) && (
                      <Button variant="secondary" onClick={() => openPay(i)}>Record payment</Button>
                    )}
                    {isAdmin && i.lateFeeOutstanding > 0 && (
                      <Button variant="secondary" onClick={() => { waiveAction.reset(); setWaiveTarget(i); }}>Waive late fee</Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={Boolean(payTarget)} title={`Record payment for installment #${payTarget?.installmentNumber}`} onClose={() => setPayTarget(null)}>
        <form className="form" onSubmit={submitPay}>
          <Alert message={payAction.error} />
          <Input
            label="Amount (Rs)"
            type="number"
            step="0.01"
            min="0.01"
            value={payForm.amount}
            onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
            hint={`Amount due now: ${money(payTarget?.totalOutstanding)}`}
            required
          />
          <Select label="Method" value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{label(m)}</option>)}
          </Select>
          <Input label="Reference (optional)" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} maxLength={100} />
          <Textarea label="Notes (optional)" value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} maxLength={500} />
          <div className="form__actions">
            <Button variant="secondary" onClick={() => setPayTarget(null)}>Cancel</Button>
            <Button type="submit" loading={payAction.busy}>Save payment</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(waiveTarget)} title={`Waive late fee on installment #${waiveTarget?.installmentNumber}`} onClose={() => setWaiveTarget(null)}>
        <form className="form" onSubmit={submitWaive}>
          <Alert message={waiveAction.error} />
          <p>Late fee to waive: {money(waiveTarget?.lateFeeOutstanding)}</p>
          <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
          <div className="form__actions">
            <Button variant="secondary" onClick={() => setWaiveTarget(null)}>Cancel</Button>
            <Button type="submit" loading={waiveAction.busy}>Waive late fee</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
