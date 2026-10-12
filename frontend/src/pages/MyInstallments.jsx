import { useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { installmentService } from "../services/api";
import { Badge, Card, EmptyState, ErrorState, FilterBar, PageHeader, PageLoader, Select, Table, DetailList } from "../components/UI";
import { money, formatDate } from "../utils/format";

export default function MyInstallments() {
  const [status, setStatus] = useState("");
  const upcoming = useFetch(() => installmentService.getUpcoming({ days: 30 }));
  const { data, loading, error, refetch } = useFetch(() => installmentService.getMy(status ? { status } : {}), [status]);

  return (
    <div className="page">
      <PageHeader title="My Installments" subtitle="Your repayment schedule across all loans" />

      {upcoming.data && (
        <Card title="Due in the next 30 days">
          <DetailList
            items={[
              ["Installments", upcoming.data.count],
              ["Total due", money(upcoming.data.totalDue)],
            ]}
          />
          <p className="form__note">Payments are recorded by an officer at your branch. Keep your receipt.</p>
        </Card>
      )}

      <FilterBar>
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="partial">Partially paid</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
        </Select>
      </FilterBar>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <Card>
          {data.installments.length === 0 ? (
            <EmptyState message="No installments found." />
          ) : (
            <Table headers={["Loan", "#", "Due date", "Amount", "Paid", "Late fee", "Due now", "Status"]}>
              {data.installments.map((i) => (
                <tr key={i._id}>
                  <td>{i.loan?._id ? <Link to={`/loans/${i.loan._id}?tab=schedule`}>{i.loan.loanNumber}</Link> : "-"}</td>
                  <td>{i.installmentNumber}</td>
                  <td>{formatDate(i.dueDate)}</td>
                  <td>{money(i.amount)}</td>
                  <td>{money(i.paidAmount)}</td>
                  <td>{money(i.lateFee)}</td>
                  <td>{money(i.totalOutstanding)}</td>
                  <td>
                    <Badge status={i.status} />
                    {i.daysOverdue > 0 && <span className="cell-note"> {i.daysOverdue} days late</span>}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
