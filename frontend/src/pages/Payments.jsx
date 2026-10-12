import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { useAction } from "../hooks/useAction";
import { paymentService } from "../services/api";
import { Alert, Badge, Button, Card, EmptyState, ErrorState, FilterBar, Input, Modal, PageHeader, PageLoader, Pagination, Select, Table, Textarea } from "../components/UI";
import { money, formatDateTime, label, saveBlob, clean, PAYMENT_METHODS } from "../utils/format";

export default function Payments() {
  const { user } = useAuth();
  const isStaff = user.role !== "applicant";
  const isAdmin = user.role === "admin";
  const blank = { q: "", method: "", status: "", dateFrom: "", dateTo: "" };
  const [filters, setFilters] = useState(blank);
  const [applied, setApplied] = useState(blank);
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState("");
  const receipt = useAction();
  const reverse = useAction();

  const { data, loading, error, refetch } = useFetch(
    () => (isStaff ? paymentService.getAll : paymentService.getMy)({ page, limit: 20, ...clean(applied) }),
    [page, applied, isStaff]
  );

  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });

  const download = (p) =>
    receipt.run(async () => {
      const res = await paymentService.downloadReceipt(p._id);
      saveBlob(res, `${p.receiptNumber}.pdf`);
      return res;
    }, "");

  const submitReverse = async (e) => {
    e.preventDefault();
    const res = await reverse.run(() => paymentService.reverse(target._id, { reason }));
    if (res) {
      setTarget(null);
      setReason("");
      refetch();
    }
  };

  return (
    <div className="page">
      <PageHeader title={isStaff ? "Payments" : "My Payments"} subtitle={data ? `Total collected in this view: ${money(data.totalCollected)}` : ""} />

      <FilterBar onSubmit={() => { setPage(1); setApplied(filters); }}>
        {isStaff && <Input label="Search" value={filters.q} onChange={set("q")} placeholder="Receipt number or reference" />}
        <Select label="Method" value={filters.method} onChange={set("method")}>
          <option value="">All methods</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{label(m)}</option>)}
        </Select>
        <Select label="Status" value={filters.status} onChange={set("status")}>
          <option value="">All</option>
          <option value="completed">Completed</option>
          <option value="reversed">Reversed</option>
        </Select>
        <Input label="From" type="date" value={filters.dateFrom} onChange={set("dateFrom")} />
        <Input label="To" type="date" value={filters.dateTo} onChange={set("dateTo")} />
        <Button type="submit">Apply</Button>
        <Button variant="secondary" onClick={() => { setFilters(blank); setApplied(blank); setPage(1); }}>Reset</Button>
      </FilterBar>

      <Alert message={receipt.error} />
      <Alert type="success" message={reverse.success} />

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <Card>
          {data.payments.length === 0 ? (
            <EmptyState message="No payments found." />
          ) : (
            <Table headers={["Receipt", "Date", "Loan", ...(isStaff ? ["Applicant", "Received by"] : []), "Amount", "Method", "Status", "Actions"]}>
              {data.payments.map((p) => (
                <tr key={p._id}>
                  <td>{p.receiptNumber}</td>
                  <td>{formatDateTime(p.paidAt)}</td>
                  <td>{p.loan?._id ? <Link to={`/loans/${p.loan._id}`}>{p.loan.loanNumber}</Link> : "-"}</td>
                  {isStaff && <td>{p.applicant?.name || "-"}</td>}
                  {isStaff && <td>{p.receivedBy?.name || "-"}</td>}
                  <td>{money(p.amount)}</td>
                  <td>{label(p.method)}</td>
                  <td><Badge status={p.status} /></td>
                  <td>
                    <Button variant="secondary" onClick={() => download(p)}>Receipt</Button>
                    {isAdmin && p.status === "completed" && (
                      <Button variant="danger" onClick={() => { reverse.reset(); setTarget(p); }}>Reverse</Button>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
          <Pagination pagination={data.pagination} onPage={setPage} />
        </Card>
      )}

      <Modal open={Boolean(target)} title={`Reverse payment ${target?.receiptNumber}`} onClose={() => setTarget(null)}>
        <form className="form" onSubmit={submitReverse}>
          <Alert message={reverse.error} />
          <p>Amount {money(target?.amount)} will be taken back from the loan schedule.</p>
          <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
          <div className="form__actions">
            <Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
            <Button type="submit" variant="danger" loading={reverse.busy}>Reverse payment</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
