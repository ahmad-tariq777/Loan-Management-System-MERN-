import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { useAction } from "../hooks/useAction";
import { adminService } from "../services/api";
import { Alert, Badge, Button, Card, EmptyState, ErrorState, FilterBar, Input, PageHeader, PageLoader, Pagination, Select, Table } from "../components/UI";
import { clean, formatDate, formatDateTime } from "../utils/format";

export default function Users() {
  const { user: me } = useAuth();
  const blank = { q: "", role: "", isActive: "", isLocked: "" };
  const [filters, setFilters] = useState(blank);
  const [applied, setApplied] = useState(blank);
  const [page, setPage] = useState(1);
  const action = useAction();
  const { data, loading, error, refetch } = useFetch(() => adminService.getUsers({ page, limit: 20, ...clean(applied) }), [page, applied]);
  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });

  const change = async (u, act) => {
    const res = await action.run(() => adminService.setUserStatus(u._id, { action: act }));
    if (res) refetch();
  };

  return (
    <div className="page">
      <PageHeader title="Users" subtitle="All accounts in the system" />
      <FilterBar onSubmit={() => { setPage(1); setApplied(filters); }}>
        <Input label="Search" value={filters.q} onChange={set("q")} placeholder="Name or email" />
        <Select label="Role" value={filters.role} onChange={set("role")}>
          <option value="">All roles</option>
          <option value="applicant">Applicant</option>
          <option value="officer">Officer</option>
          <option value="admin">Admin</option>
        </Select>
        <Select label="Active" value={filters.isActive} onChange={set("isActive")}>
          <option value="">Any</option>
          <option value="true">Active</option>
          <option value="false">Deactivated</option>
        </Select>
        <Select label="Locked" value={filters.isLocked} onChange={set("isLocked")}>
          <option value="">Any</option>
          <option value="true">Locked only</option>
        </Select>
        <Button type="submit">Apply</Button>
        <Button variant="secondary" onClick={() => { setFilters(blank); setApplied(blank); setPage(1); }}>Reset</Button>
      </FilterBar>
      <Alert message={action.error} />
      <Alert type="success" message={action.success} />
      {loading ? <PageLoader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Card>
          {data.users.length === 0 ? <EmptyState message="No users found." /> : (
            <Table headers={["Name", "Email", "Role", "State", "Last login", "Joined", "Actions"]}>
              {data.users.map((u) => (
                <tr key={u._id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td><Badge status={u.role} /></td>
                  <td>
                    <Badge status={u.isActive ? "active" : "inactive"} />
                    {u.isLocked && <Badge status="locked" />}
                  </td>
                  <td>{formatDateTime(u.lastLogin)}</td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>
                    <Link to={`/users/${u._id}`}>Open</Link>
                    {u._id !== me.id && (
                      <>
                        {u.isActive ? <Button variant="danger" onClick={() => change(u, "deactivate")}>Deactivate</Button> : <Button variant="secondary" onClick={() => change(u, "activate")}>Activate</Button>}
                        {u.isLocked && <Button variant="secondary" onClick={() => change(u, "unlock")}>Unlock</Button>}
                      </>
                    )}
                  </td>
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
