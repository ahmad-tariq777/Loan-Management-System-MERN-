import { useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { loanService } from "../services/api";
import { Badge, Card, EmptyState, ErrorState, PageHeader, PageLoader, Pagination, Table } from "../components/UI";
import { money, formatDate, label } from "../utils/format";

export default function PendingLoans() {
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useFetch(() => loanService.getPending({ page, limit: 20 }), [page]);

  return (
    <div className="page">
      <PageHeader title="Pending Loans" subtitle="New applications waiting for your review. Open one to start." />
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <Card>
          {data.loans.length === 0 ? (
            <EmptyState message="No loans are waiting for review." />
          ) : (
            <Table headers={["Loan", "Applicant", "Type", "Requested", "Score", "Suggested limit", "DTI", "Applied", "Status", ""]}>
              {data.loans.map((loan) => (
                <tr key={loan._id}>
                  <td>{loan.loanNumber}</td>
                  <td>{loan.applicant?.name || "-"}</td>
                  <td>{label(loan.loanType)}</td>
                  <td>{money(loan.amountRequested)}</td>
                  <td>{loan.eligibilityScore}/100</td>
                  <td>{money(loan.loanLimit)}</td>
                  <td>{loan.dti !== undefined ? `${Math.round(loan.dti)}%` : "-"}</td>
                  <td>{formatDate(loan.createdAt)}</td>
                  <td><Badge status={loan.eligible ? "eligible" : "rejected"} /></td>
                  <td><Link to={`/loans/${loan._id}?tab=review`}>Review</Link></td>
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
