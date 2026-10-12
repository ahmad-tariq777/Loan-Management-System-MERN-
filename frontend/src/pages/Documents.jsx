import { useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { documentService } from "../services/api";
import { Badge, Card, EmptyState, ErrorState, FilterBar, PageHeader, PageLoader, Pagination, Select, Table } from "../components/UI";
import { money, formatDate, label } from "../utils/format";

export default function Documents() {
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useFetch(
    () => documentService.getAll({ page, limit: 20, ...(status ? { status } : {}) }),
    [page, status]
  );

  return (
    <div className="page">
      <PageHeader title="Document Review" subtitle="Open a document set to view the files and verify or reject them." />
      <FilterBar>
        <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
        </Select>
      </FilterBar>
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <Card>
          {data.documents.length === 0 ? (
            <EmptyState message="No documents found for this filter." />
          ) : (
            <Table headers={["Applicant", "Loan", "Type", "Amount", "Uploaded", "Status", ""]}>
              {data.documents.map((d) => (
                <tr key={d._id}>
                  <td>{d.applicantId?.name || "-"}</td>
                  <td>{d.loanId?.loanNumber || "-"}</td>
                  <td>{label(d.loanId?.loanType)}</td>
                  <td>{money(d.loanId?.amountRequested)}</td>
                  <td>{formatDate(d.updatedAt)}</td>
                  <td><Badge status={d.verificationStatus} /></td>
                  <td>{d.loanId?._id && <Link to={`/loans/${d.loanId._id}?tab=documents`}>Review</Link>}</td>
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
