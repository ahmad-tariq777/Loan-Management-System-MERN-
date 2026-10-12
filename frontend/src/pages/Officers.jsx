import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { useAction } from "../hooks/useAction";
import { adminService } from "../services/api";
import { Alert, Badge, Button, Card, DetailList, EmptyState, ErrorState, Input, Modal, PageHeader, PageLoader, Table } from "../components/UI";
import { formatDate, formatDateTime, clean } from "../utils/format";

export default function Officers() {
  const { user: me } = useAuth();
  const { data, loading, error, refetch } = useFetch(adminService.getOfficers);
  const create = useAction();
  const edit = useAction();
  const row = useAction();
  const [form, setForm] = useState({ name: "", email: "" });
  const [credentials, setCredentials] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "" });

  const submitCreate = async (e) => {
    e.preventDefault();
    const res = await create.run(() => adminService.createOfficer(clean(form)), "Officer created");
    if (res) {
      setCredentials(res.data.credentials);
      setForm({ name: "", email: "" });
      refetch();
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    const res = await edit.run(() => adminService.updateOfficer(editing._id, editForm));
    if (res) {
      setEditing(null);
      refetch();
    }
  };

  const reset = async (o) => {
    if (!window.confirm(`Reset the password for ${o.name}? All their sessions will be signed out.`)) return;
    const res = await row.run(() => adminService.resetOfficerPassword(o._id));
    if (res) setCredentials(res.data.credentials);
  };

  const status = async (o, action) => {
    const res = await row.run(() => adminService.setUserStatus(o._id, { action }));
    if (res) refetch();
  };

  return (
    <div className="page">
      <PageHeader title="Officers" subtitle="Create and manage loan officer accounts" />

      {credentials && (
        <Card title="Login credentials (shown only once)">
          <DetailList items={[["Email", credentials.email], ["Password", credentials.password]]} />
          <p className="form__note">Copy these now and share them securely. They cannot be viewed again.</p>
          <Button variant="secondary" onClick={() => setCredentials(null)}>I have saved them</Button>
        </Card>
      )}

      <Card title="Add an officer">
        <Alert message={create.error} />
        <form className="form" onSubmit={submitCreate}>
          <Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} minLength={2} maxLength={100} required />
          <Input label="Email (optional, generated if empty)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Button type="submit" loading={create.busy}>Create officer</Button>
        </form>
      </Card>

      <Alert message={row.error} />
      <Alert type="success" message={row.success} />

      {loading ? <PageLoader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Card title="All officers">
          {data.length === 0 ? <EmptyState message="No officers yet." /> : (
            <Table headers={["Name", "Email", "State", "Assigned loans", "Last login", "Created", "Actions"]}>
              {data.map((o) => (
                <tr key={o._id}>
                  <td>{o.name}</td>
                  <td>{o.email}</td>
                  <td><Badge status={o.isActive ? "active" : "inactive"} />{o.isLocked && <Badge status="locked" />}</td>
                  <td>{o.assignedLoans}</td>
                  <td>{formatDateTime(o.lastLogin)}</td>
                  <td>{formatDate(o.createdAt)}</td>
                  <td>
                    <Button variant="secondary" onClick={() => { edit.reset(); setEditForm({ name: o.name, email: o.email }); setEditing(o); }}>Edit</Button>
                    <Button variant="secondary" onClick={() => reset(o)}>Reset password</Button>
                    {o._id !== me.id && (o.isActive
                      ? <Button variant="danger" onClick={() => status(o, "deactivate")}>Deactivate</Button>
                      : <Button variant="secondary" onClick={() => status(o, "activate")}>Activate</Button>)}
                    {o.isLocked && <Button variant="secondary" onClick={() => status(o, "unlock")}>Unlock</Button>}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      <Modal open={Boolean(editing)} title="Edit officer" onClose={() => setEditing(null)}>
        <form className="form" onSubmit={submitEdit}>
          <Alert message={edit.error} />
          <Input label="Full name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} minLength={2} maxLength={100} required />
          <Input label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
          <div className="form__actions">
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" loading={edit.busy}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
