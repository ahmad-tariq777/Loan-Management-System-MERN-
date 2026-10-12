import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { useAction } from "../hooks/useAction";
import { adminService } from "../services/api";
import { Alert, Badge, Button, Card, DetailList, EmptyState, ErrorState, Input, PageHeader, PageLoader, Table } from "../components/UI";
import { money, formatDate, formatDateTime, label } from "../utils/format";

export default function UserDetail() {
  const { id } = useParams();
  const { data, loading, error, refetch } = useFetch(() => adminService.getUser(id), [id]);
  const action = useAction();
  const [form, setForm] = useState({ income: "", liabilities: "", repaymentHistoryScore: "" });

  useEffect(() => {
    if (data) {
      setForm({
        income: data.user.income ?? 0,
        liabilities: data.user.liabilities ?? 0,
        repaymentHistoryScore: data.user.repaymentHistoryScore ?? 0,
      });
    }
  }, [data]);

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const { user, applicantProfile, loans } = data;
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    const res = await action.run(() =>
      adminService.updateFinancials(id, {
        income: Number(form.income),
        liabilities: Number(form.liabilities),
        repaymentHistoryScore: Number(form.repaymentHistoryScore),
      })
    );
    if (res) refetch();
  };

  return (
    <div className="page">
      <PageHeader title={user.name} subtitle={user.email} actions={<Badge status={user.role} />} />

      <div className="two-col">
        <Card title="Account">
          <DetailList
            items={[
              ["Active", user.isActive ? "Yes" : "No"],
              ["Locked", user.isLocked ? "Yes" : "No"],
              ["Failed login attempts", user.loginAttempts],
              ["Last login", formatDateTime(user.lastLogin)],
              ["Joined", formatDate(user.createdAt)],
              applicantProfile && ["Applicant ID", <Link key="a" to={`/applicants/${applicantProfile.applicantID}`}>{applicantProfile.applicantID}</Link>],
            ]}
          />
        </Card>

        <Card title="Financial profile used for eligibility">
          <Alert message={action.error} />
          <Alert type="success" message={action.success} />
          <form className="form" onSubmit={save}>
            <Input label="Monthly income (Rs)" type="number" min="0" value={form.income} onChange={set("income")} required />
            <Input label="Monthly liabilities (Rs)" type="number" min="0" value={form.liabilities} onChange={set("liabilities")} required />
            <Input label="Repayment history score (0-100)" type="number" min="0" max="100" step="0.01" value={form.repaymentHistoryScore} onChange={set("repaymentHistoryScore")} required />
            <Button type="submit" loading={action.busy}>Save financial profile</Button>
          </form>
        </Card>
      </div>

      <Card title="Loans">
        {loans.length === 0 ? <EmptyState message="No loans for this user." /> : (
          <Table headers={["Loan", "Type", "Requested", "Approved", "Balance", "Status", ""]}>
            {loans.map((l) => (
              <tr key={l._id}>
                <td>{l.loanNumber}</td><td>{label(l.loanType)}</td><td>{money(l.amountRequested)}</td>
                <td>{l.approvedAmount ? money(l.approvedAmount) : "-"}</td><td>{money(l.remainingBalance)}</td>
                <td><Badge status={l.status} /></td><td><Link to={`/loans/${l._id}`}>Open</Link></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
