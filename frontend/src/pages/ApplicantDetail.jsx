import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { useAction } from "../hooks/useAction";
import { applicantService } from "../services/api";
import { Alert, Badge, Button, Card, DetailList, EmptyState, ErrorState, PageLoader, Select, Table, Textarea } from "../components/UI";
import { money, formatDate, label } from "../utils/format";

function Verify({ applicant, onDone }) {
  const [form, setForm] = useState({ status: "verified", remarks: "" });
  const action = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const res = await action.run(() => applicantService.verify(applicant.applicantID, form));
    if (res) onDone();
  };
  return (
    <Card title="Verify profile">
      <Alert message={action.error} />
      <Alert type="success" message={action.success} />
      <form className="form" onSubmit={submit}>
        <Select label="Decision" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="verified">Verify</option>
          <option value="rejected">Reject</option>
        </Select>
        <Textarea
          label={form.status === "rejected" ? "Remarks (required)" : "Remarks (optional)"}
          value={form.remarks}
          onChange={(e) => setForm({ ...form, remarks: e.target.value })}
          maxLength={500}
          required={form.status === "rejected"}
        />
        <Button type="submit" variant={form.status === "rejected" ? "danger" : "primary"} loading={action.busy}>Submit decision</Button>
      </form>
    </Card>
  );
}

function Blacklist({ applicant, onDone }) {
  const [reason, setReason] = useState("");
  const action = useAction();
  const listed = applicant.isBlacklisted;
  const submit = async (e) => {
    e.preventDefault();
    const res = await action.run(() =>
      applicantService.setBlacklist(applicant.applicantID, listed ? { blacklisted: false } : { blacklisted: true, reason })
    );
    if (res) {
      setReason("");
      onDone();
    }
  };
  return (
    <Card title="Blacklist">
      <Alert message={action.error} />
      <Alert type="success" message={action.success} />
      <form className="form" onSubmit={submit}>
        {listed ? (
          <p>Blacklisted: {applicant.blacklistReason}</p>
        ) : (
          <Textarea label="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
        )}
        <Button type="submit" variant={listed ? "secondary" : "danger"} loading={action.busy}>
          {listed ? "Remove from blacklist" : "Blacklist applicant"}
        </Button>
      </form>
    </Card>
  );
}

export default function ApplicantDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const profile = useFetch(() => applicantService.getById(id), [id]);
  const loans = useFetch(() => applicantService.getLoans(id), [id]);

  if (profile.loading || loans.loading) return <PageLoader />;
  if (profile.error) return <ErrorState message={profile.error} onRetry={profile.refetch} />;

  const a = profile.data;
  const s = loans.data?.summary;

  return (
    <div className="page">
      <div className="ui-page-header">
        <div className="ui-page-header__text">
          <h1 className="ui-page-header__title">{a.userID?.name || a.applicantID}</h1>
          <p className="ui-page-header__subtitle">{a.applicantID}</p>
        </div>
        <div className="ui-page-header__actions">
          <Badge status={a.verificationStatus} />
          {a.isBlacklisted && <Badge status="blacklisted" />}
        </div>
      </div>

      <div className="two-col">
        <Card title="Profile">
          <DetailList
            items={[
              ["Email", a.userID?.email],
              ["CNIC", a.cnic],
              ["CNIC issued", formatDate(a.cnicIssueDate)],
              ["CNIC expires", formatDate(a.cnicExpiryDate)],
              ["Mobile", a.phone],
              ["Alternate mobile", a.altPhone],
              ["Address", a.address],
              ["City", a.city],
              ["Province", a.province],
              ["Occupation", a.occupation],
              ["Monthly income", money(a.monthlyIncome)],
              ["Dependents", a.dependents],
              a.verificationRemarks && ["Remarks", a.verificationRemarks],
              ["CNIC front", a.cnicFront && <a key="f" href={a.cnicFront} target="_blank" rel="noreferrer">Open link</a>],
              ["CNIC back", a.cnicBack && <a key="b" href={a.cnicBack} target="_blank" rel="noreferrer">Open link</a>],
            ]}
          />
        </Card>

        <div className="stack">
          <Card title="Financial standing">
            <DetailList
              items={[
                ["Declared income", money(a.userID?.income)],
                ["Liabilities", money(a.userID?.liabilities)],
                ["Repayment score", `${a.userID?.repaymentHistoryScore ?? 0}/100`],
                s && ["Total loans", s.totalLoans],
                s && ["Active loans", s.activeLoans],
                s && ["Closed loans", s.closedLoans],
                s && ["Defaulted loans", s.defaultedLoans],
                s && ["Outstanding balance", money(s.outstandingBalance)],
              ]}
            />
            {user.role === "admin" && a.userID?._id && <Link to={`/users/${a.userID._id}`}>Edit financial profile</Link>}
          </Card>
          <Verify applicant={a} onDone={profile.refetch} />
          {user.role === "admin" && <Blacklist applicant={a} onDone={profile.refetch} />}
        </div>
      </div>

      <Card title="Loans">
        {!loans.data?.loans?.length ? (
          <EmptyState message="This applicant has no loans." />
        ) : (
          <Table headers={["Loan", "Type", "Requested", "Approved", "Balance", "Status", ""]}>
            {loans.data.loans.map((l) => (
              <tr key={l._id}>
                <td>{l.loanNumber}</td>
                <td>{label(l.loanType)}</td>
                <td>{money(l.amountRequested)}</td>
                <td>{l.approvedAmount ? money(l.approvedAmount) : "-"}</td>
                <td>{money(l.remainingBalance)}</td>
                <td><Badge status={l.status} /></td>
                <td><Link to={`/loans/${l._id}`}>Open</Link></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
