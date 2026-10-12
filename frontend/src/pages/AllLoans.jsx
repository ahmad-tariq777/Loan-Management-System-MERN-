import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { loanService } from "../services/api";
import LoanTable from "../components/LoanTable";
import { Button, Card, ErrorState, FilterBar, Input, PageHeader, PageLoader, Pagination, Select } from "../components/UI";
import { LOAN_STATUSES, clean, label } from "../utils/format";

const TYPES = ["personal", "business", "education", "housing", "agriculture", "other"];

export default function AllLoans() {
  const [params] = useSearchParams();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: params.get("status") || "", loanType: "", q: "", dateFrom: "", dateTo: "", sortBy: "createdAt", order: "desc" });
  const [applied, setApplied] = useState(filters);

  const { data, loading, error, refetch } = useFetch(
    () => loanService.getAll({ page, limit: 20, ...clean(applied) }),
    [page, applied]
  );

  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });
  const apply = () => { setPage(1); setApplied(filters); };
  const reset = () => {
    const blank = { status: "", loanType: "", q: "", dateFrom: "", dateTo: "", sortBy: "createdAt", order: "desc" };
    setFilters(blank);
    setApplied(blank);
    setPage(1);
  };

  return (
    <div className="page">
      <PageHeader title="All Loans" subtitle="Search and filter every loan application" />
      <FilterBar onSubmit={apply}>
        <Input label="Search" value={filters.q} onChange={set("q")} placeholder="Loan number or applicant" />
        <Select label="Status" value={filters.status} onChange={set("status")}>
          <option value="">All statuses</option>
          {LOAN_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </Select>
        <Select label="Type" value={filters.loanType} onChange={set("loanType")}>
          <option value="">All types</option>
          {TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
        </Select>
        <Input label="From" type="date" value={filters.dateFrom} onChange={set("dateFrom")} />
        <Input label="To" type="date" value={filters.dateTo} onChange={set("dateTo")} />
        <Select label="Sort by" value={filters.sortBy} onChange={set("sortBy")}>
          <option value="createdAt">Date applied</option>
          <option value="amountRequested">Amount requested</option>
          <option value="approvedAmount">Amount approved</option>
          <option value="disbursedAt">Disbursed date</option>
          <option value="remainingBalance">Remaining balance</option>
        </Select>
        <Select label="Order" value={filters.order} onChange={set("order")}>
          <option value="desc">Newest / highest first</option>
          <option value="asc">Oldest / lowest first</option>
        </Select>
        <Button type="submit">Apply filters</Button>
        <Button variant="secondary" onClick={reset}>Reset</Button>
      </FilterBar>
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <Card>
          <LoanTable loans={data.loans} showApplicant />
          <Pagination pagination={data.pagination} onPage={setPage} />
        </Card>
      )}
    </div>
  );
}
