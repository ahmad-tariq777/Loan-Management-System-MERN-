import { useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { loanService } from "../services/api";
import LoanTable from "../components/LoanTable";
import { ErrorState, FilterBar, PageHeader, PageLoader, Pagination, Select, Card } from "../components/UI";
import { LOAN_STATUSES, label } from "../utils/format";

export default function MyLoans() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const { data, loading, error, refetch } = useFetch(
    () => loanService.getMy({ page, limit: 10, ...(status ? { status } : {}) }),
    [page, status]
  );

  return (
    <div className="page">
      <PageHeader
        title="My Loans"
        subtitle="All your applications and active loans"
        actions={<Link to="/apply-loan" className="ui-btn ui-btn--primary">Apply for a Loan</Link>}
      />
      <FilterBar>
        <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {LOAN_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </Select>
      </FilterBar>
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <Card>
          <LoanTable loans={data.loans} />
          <Pagination pagination={data.pagination} onPage={setPage} />
        </Card>
      )}
    </div>
  );
}
