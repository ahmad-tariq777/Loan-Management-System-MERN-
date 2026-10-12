import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { useAction } from "../hooks/useAction";
import { notificationService } from "../services/api";
import { Alert, Badge, Button, Card, EmptyState, ErrorState, FilterBar, Input, PageHeader, PageLoader, Pagination, Select, Textarea } from "../components/UI";
import { formatDateTime, label } from "../utils/format";

const TYPES = [
  "loan_status", "payment_due", "payment_received", "payment_overdue", "disbursement",
  "document_update", "guarantor", "announcement", "system", "account",
];

function Broadcast() {
  const [form, setForm] = useState({ title: "", message: "", role: "" });
  const action = useAction();
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const payload = { title: form.title, message: form.message, ...(form.role ? { role: form.role } : {}) };
    const res = await action.run(() => notificationService.broadcast(payload));
    if (res) setForm({ title: "", message: "", role: "" });
  };

  return (
    <Card title="Send an announcement">
      <Alert message={action.error} />
      <Alert type="success" message={action.success} />
      <form className="form" onSubmit={submit}>
        <Input label="Title" value={form.title} onChange={set("title")} maxLength={200} required />
        <Textarea label="Message" value={form.message} onChange={set("message")} maxLength={1000} required />
        <Select label="Send to" value={form.role} onChange={set("role")}>
          <option value="">Everyone</option>
          <option value="applicant">Applicants</option>
          <option value="officer">Officers</option>
          <option value="admin">Admins</option>
        </Select>
        <Button type="submit" loading={action.busy}>Send Announcement</Button>
      </form>
    </Card>
  );
}

export default function Notifications() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState("");
  const [type, setType] = useState("");
  const action = useAction();

  const { data, loading, error, refetch } = useFetch(
    () => notificationService.getAll({ page, limit: 15, ...(unreadOnly ? { unread: "true" } : {}), ...(type ? { type } : {}) }),
    [page, unreadOnly, type]
  );

  const doAction = async (fn) => {
    const res = await action.run(fn);
    if (res) refetch();
  };

  return (
    <div className="page">
      <PageHeader
        title="Notifications"
        subtitle={data ? `${data.unreadCount} unread` : ""}
        actions={
          <>
            <Button variant="secondary" onClick={() => doAction(() => notificationService.markAllRead())}>Mark all read</Button>
            <Button variant="secondary" onClick={() => doAction(() => notificationService.clearRead())}>Clear read</Button>
          </>
        }
      />
      <Alert message={action.error} />

      <FilterBar>
        <Select label="Show" value={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.value); setPage(1); }}>
          <option value="">All</option>
          <option value="1">Unread only</option>
        </Select>
        <Select label="Type" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">All types</option>
          {TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
        </Select>
      </FilterBar>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : data.notifications.length === 0 ? (
        <EmptyState message="You are all caught up." />
      ) : (
        <ul className="notification-list">
          {data.notifications.map((n) => (
            <li key={n._id} className={`notification ${n.read ? "notification--read" : "notification--unread"}`}>
              <div className="notification__head">
                <strong className="notification__title">{n.title}</strong>
                <Badge status={n.type} />
                <span className="notification__time">{formatDateTime(n.createdAt)}</span>
              </div>
              <p className="notification__message">{n.message}</p>
              <div className="notification__actions">
                {n.relatedLoan && <Link to={`/loans/${n.relatedLoan._id}`}>Open loan {n.relatedLoan.loanNumber}</Link>}
                {!n.read && (
                  <Button variant="secondary" onClick={() => doAction(() => notificationService.markRead(n._id))}>Mark read</Button>
                )}
                <Button variant="danger" onClick={() => doAction(() => notificationService.remove(n._id))}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination pagination={data?.pagination} onPage={setPage} />

      {user.role === "admin" && <Broadcast />}
    </div>
  );
}
