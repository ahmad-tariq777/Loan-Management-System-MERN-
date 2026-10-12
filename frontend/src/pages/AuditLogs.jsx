import { useState } from "react";
import { useFetch } from "../hooks/useFetch";
import { adminService } from "../services/api";
import { Badge, Button, Card, EmptyState, ErrorState, FilterBar, Input, PageHeader, PageLoader, Pagination, Select, Table } from "../components/UI";
import { clean, formatDateTime } from "../utils/format";

export default function AuditLogs() {
  const blank = { action: "", success: "", dateFrom: "", dateTo: "" };
  const [filters, setFilters] = useState(blank);
  const [applied, setApplied] = useState(blank);
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useFetch(() => adminService.getAuditLogs({ page, limit: 50, ...clean(applied) }), [page, applied]);
  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });

  return (
    <div className="page">
      <PageHeader title="Audit Logs" subtitle="A record of sensitive actions in the system" />
      <FilterBar onSubmit={() => { setPage(1); setApplied(filters); }}>
        <Input label="Action" value={filters.action} onChange={set("action")} placeholder="e.g. LOAN_APPROVE, LOGIN_FAILED" />
        <Select label="Outcome" value={filters.success} onChange={set("success")}>
          <option value="">All</option>
          <option value="true">Success</option>
          <option value="false">Failed</option>
        </Select>
        <Input label="From" type="date" value={filters.dateFrom} onChange={set("dateFrom")} />
        <Input label="To" type="date" value={filters.dateTo} onChange={set("dateTo")} />
        <Button type="submit">Apply</Button>
        <Button variant="secondary" onClick={() => { setFilters(blank); setApplied(blank); setPage(1); }}>Reset</Button>
      </FilterBar>
      {loading ? <PageLoader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Card>
          {data.logs.length === 0 ? <EmptyState message="No log entries match." /> : (
            <Table headers={["Time", "User", "Action", "Resource", "Outcome", "IP"]}>
              {data.logs.map((l) => (
                <tr key={l._id}>
                  <td>{formatDateTime(l.timestamp)}</td>
                  <td>{l.userID?.name || "-"}<br />{l.userID?.role}</td>
                  <td>{l.action}</td>
                  <td>{l.resource || "-"}</td>
                  <td><Badge status={l.success ? "success" : "failed"} /></td>
                  <td>{l.ip}</td>
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
