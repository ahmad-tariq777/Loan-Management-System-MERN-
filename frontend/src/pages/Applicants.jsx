import { useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { applicantService } from "../services/api";
import { Badge, Button, Card, EmptyState, ErrorState, FilterBar, Input, PageHeader, PageLoader, Pagination, Select, Table } from "../components/UI";
import { clean, formatDate } from "../utils/format";

export default function Applicants() {
  const blank = { q: "", verificationStatus: "", city: "", blacklisted: "" };
  const [filters, setFilters] = useState(blank);
  const [applied, setApplied] = useState(blank);
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useFetch(
    () => applicantService.getAll({ page, limit: 20, ...clean(applied) }),
    [page, applied]
  );
  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });

  return (
    <div className="page">
      <PageHeader title="Applicants" subtitle="Search applicant profiles and verify new ones" />
      <FilterBar onSubmit={() => { setPage(1); setApplied(filters); }}>
        <Input label="Search" value={filters.q} onChange={set("q")} placeholder="ID, CNIC, phone or occupation" />
        <Select label="Verification" value={filters.verificationStatus} onChange={set("verificationStatus")}>
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </Select>
        <Input label="City" value={filters.city} onChange={set("city")} />
        <Select label="Blacklist" value={filters.blacklisted} onChange={set("blacklisted")}>
          <option value="">Everyone</option>
          <option value="true">Blacklisted only</option>
        </Select>
        <Button type="submit">Apply</Button>
        <Button variant="secondary" onClick={() => { setFilters(blank); setApplied(blank); setPage(1); }}>Reset</Button>
      </FilterBar>
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <Card>
          {data.applicants.length === 0 ? (
            <EmptyState message="No applicants found." />
          ) : (
            <Table headers={["Applicant ID", "Name", "CNIC", "Phone", "City", "Verification", "Registered", ""]}>
              {data.applicants.map((a) => (
                <tr key={a._id}>
                  <td>{a.applicantID}</td>
                  <td>{a.userID?.name || "-"}</td>
                  <td>{a.cnic}</td>
                  <td>{a.phone}</td>
                  <td>{a.city || "-"}</td>
                  <td>
                    <Badge status={a.verificationStatus} />
                    {a.isBlacklisted && <Badge status="blacklisted" />}
                  </td>
                  <td>{formatDate(a.createdAt)}</td>
                  <td><Link to={`/applicants/${a.applicantID}`}>Open</Link></td>
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
