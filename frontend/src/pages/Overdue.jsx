import { useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { installmentService } from "../services/api";
import { Badge, Card, EmptyState, ErrorState, FilterBar, Input, PageHeader, PageLoader, Pagination, Table } from "../components/UI";
import { money, formatDate } from "../utils/format";

export default function Overdue() {
  const [page, setPage] = useState(1);
  const [minDays, setMinDays] = useState("1");
  const { data, loading, error, refetch } = useFetch(
    () => installmentService.getOverdue({ page, limit: 20, minDays: minDays === "" ? 1 : minDays }),
    [page, minDays]
  );

  return (
    <div className="page">
      <PageHeader title="Overdue Installments" subtitle={data ? `${data.count} overdue installment(s). Contact numbers are shown for follow-up.` : ""} />
      <FilterBar>
        <Input label="Overdue for at least (days)" type="number" min="0" step="1" value={minDays} onChange={(e) => { setMinDays(e.target.value); setPage(1); }} />
      </FilterBar>
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <Card>
          {data.installments.length === 0 ? (
            <EmptyState message="No overdue installments." />
          ) : (
            <Table headers={["Applicant", "Contact", "Loan", "#", "Due date", "Days late", "Amount due", "Status", ""]}>
              {data.installments.map((i) => (
                <tr key={i._id}>
                  <td>{i.applicant?.name || "-"}</td>
                  <td>{i.contact ? [i.contact.phone, i.contact.altPhone].filter(Boolean).join(" / ") : "-"}</td>
                  <td>{i.loan?.loanNumber || "-"}</td>
                  <td>{i.installmentNumber}</td>
                  <td>{formatDate(i.dueDate)}</td>
                  <td>{i.daysOverdue}</td>
                  <td>{money(i.totalOutstanding)}</td>
                  <td><Badge status={i.status} /></td>
                  <td>{i.loan?._id && <Link to={`/loans/${i.loan._id}?tab=schedule`}>Collect</Link>}</td>
                </tr>
              ))}
            </Table>
          )}
          <Pagination pagination={data.pagination} onPage={setPage} />
        </Card>
      )}
    </div>
  );
}
