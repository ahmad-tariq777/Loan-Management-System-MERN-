import { useState } from "react";
import { useFetch } from "../../hooks/useFetch";
import { useAction } from "../../hooks/useAction";
import { adminService, loanService, paymentService } from "../../services/api";
import { Alert, Badge, Button, Card, DetailList, Input, Select, Textarea } from "../../components/UI";
import { money, label, clean, PAYMENT_METHODS, ACTIVE_LOAN_STATUSES, EDITABLE_LOAN_STATUSES } from "../../utils/format";

function Checklist({ loan }) {
  const { data, loading, error, refetch } = useFetch(() => loanService.getChecklist(loan._id), [loan._id, loan.status]);
  const labels = {
    applicantProfileExists: "Applicant profile registered",
    applicantVerified: "Applicant profile verified",
    applicantNotBlacklisted: "Applicant not blacklisted",
    documentsVerified: "Loan documents verified",
    guarantorVerified: "Guarantor verified (if required)",
  };
  return (
    <Card title="Review checklist" actions={<Button variant="secondary" onClick={refetch}>Refresh</Button>}>
      {loading && <p>Loading checklist...</p>}
      <Alert message={error} />
      {data && (
        <>
          <ul className="checklist">
            {Object.entries(data.items).map(([key, ok]) => (
              <li key={key} className={`checklist__item ${ok ? "checklist__item--ok" : "checklist__item--missing"}`}>
                {ok ? "✓" : "✗"} {labels[key]}
              </li>
            ))}
          </ul>
          <Badge status={data.ready ? "ready" : "incomplete"} />
          {!data.ready && <p className="form__note">Complete the items above before approving. Use the Documents and Guarantors tabs.</p>}
        </>
      )}
    </Card>
  );
}

function Eligibility({ loan, onChanged }) {
  const action = useAction();
  const [result, setResult] = useState(null);

  const run = async () => {
    const res = await action.run(() => loanService.evaluateEligibility(loan._id), "Eligibility evaluated");
    if (res) {
      setResult(res.data.eligibility);
      onChanged();
    }
  };

  return (
    <Card title="Eligibility evaluation">
      <p>Scores the applicant on income, debt and repayment history. A passing result marks the loan eligible. A failing result leaves it open so an officer can decide whether to approve or reject.</p>
      <Alert message={action.error} />
      <Button loading={action.busy} onClick={run}>Run evaluation</Button>
      {result && (
        <DetailList
          items={[
            ["Result", result.eligible ? <Badge key="r" status="eligible" /> : <span key="r" className="ui-badge ui-badge--incomplete">Not eligible</span>],
            ["Score", `${result.eligibilityScore}/100`],
            ["Debt-to-income", result.dti !== undefined ? `${Math.round(result.dti)}%` : "-"],
            ["Maximum eligible amount", money(result.maxEligibleAmount)],
            result.reasons?.length > 0 && ["Reasons", result.reasons.join("; ")],
          ]}
        />
      )}
    </Card>
  );
}

function Decision({ loan, user, onChanged }) {
  const isAdmin = user.role === "admin";
  const action = useAction();
  const [form, setForm] = useState({ officerComments: "", approvedAmount: "", interestRate: "" });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = (status) => async (e) => {
    e.preventDefault();
    const payload = { status, officerComments: form.officerComments };
    if (status === "approved") {
      if (form.approvedAmount) payload.approvedAmount = Number(form.approvedAmount);
      if (isAdmin && form.interestRate) payload.interestRate = Number(form.interestRate);
    }
    const res = await action.run(() => loanService.updateStatus(loan._id, payload));
    if (res) onChanged();
  };

  return (
    <Card title="Decision">
      <Alert message={action.error} />
      <Alert type="success" message={action.success} />
      {loan.status === "pending" && (
        <div className="form__actions">
          <Button variant="secondary" loading={action.busy} onClick={submit("under_review")}>Start review</Button>
        </div>
      )}
      <form className="form">
        <Textarea label="Comments (required to reject)" value={form.officerComments} onChange={set("officerComments")} maxLength={1000} />
        <Input
          label="Approved amount (optional)"
          type="number"
          min="1"
          value={form.approvedAmount}
          onChange={set("approvedAmount")}
          hint={`Defaults to the lower of requested (${money(loan.amountRequested)}) and eligible limit${loan.loanLimit !== undefined ? ` (${money(loan.loanLimit)})` : ""}`}
        />
        {isAdmin && (
          <Input label="Interest rate override % (admin only)" type="number" min="0" max="100" step="0.01" value={form.interestRate} onChange={set("interestRate")} />
        )}
        <div className="form__actions">
          <Button loading={action.busy} onClick={submit("approved")}>Approve</Button>
          <Button variant="danger" loading={action.busy} disabled={!form.officerComments.trim()} onClick={submit("rejected")}>Reject</Button>
        </div>
      </form>
    </Card>
  );
}

function Disburse({ loan, onChanged }) {
  const action = useAction();
  const [form, setForm] = useState({ method: "cash", reference: "" });

  const submit = async (e) => {
    e.preventDefault();
    const res = await action.run(() => loanService.disburse(loan._id, clean(form)));
    if (res) onChanged();
  };

  return (
    <Card title="Disburse funds">
      <p>Approved amount {money(loan.approvedAmount)}. Processing fee {money(loan.processingFee)} will be deducted.</p>
      <Alert message={action.error} />
      <Alert type="success" message={action.success} />
      <form className="form" onSubmit={submit}>
        <Select label="Method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{label(m)}</option>)}
        </Select>
        <Input label="Reference (optional)" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} maxLength={100} />
        <Button type="submit" loading={action.busy}>Disburse loan</Button>
      </form>
    </Card>
  );
}

function RecordPayment({ loan, onChanged }) {
  const action = useAction();
  const [form, setForm] = useState({ amount: "", method: "cash", reference: "", notes: "" });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const res = await action.run(() => paymentService.create(clean({ ...form, loanId: loan._id, amount: Number(form.amount) })));
    if (res) {
      setForm({ amount: "", method: "cash", reference: "", notes: "" });
      onChanged();
    }
  };

  return (
    <Card title="Record a payment">
      <p>Payments are applied to the oldest unpaid installments first.</p>
      <Alert message={action.error} />
      <Alert type="success" message={action.success} />
      <form className="form" onSubmit={submit}>
        <Input label="Amount (Rs)" type="number" step="0.01" min="0.01" value={form.amount} onChange={set("amount")} required />
        <Select label="Method" value={form.method} onChange={set("method")}>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{label(m)}</option>)}
        </Select>
        <Input label="Reference (optional)" value={form.reference} onChange={set("reference")} maxLength={100} />
        <Textarea label="Notes (optional)" value={form.notes} onChange={set("notes")} maxLength={500} />
        <Button type="submit" loading={action.busy}>Save payment</Button>
      </form>
    </Card>
  );
}

function AdminTools({ loan, onChanged }) {
  const officers = useFetch(adminService.getOfficers);
  const assign = useAction();
  const restructure = useAction();
  const writeOff = useAction();
  const [officerId, setOfficerId] = useState("");
  const [rForm, setRForm] = useState({ tenureMonths: "", interestRate: "", waiveLateFees: false, reason: "" });
  const [reason, setReason] = useState("");
  const active = ACTIVE_LOAN_STATUSES.includes(loan.status);

  const doAssign = async (e) => {
    e.preventDefault();
    const res = await assign.run(() => loanService.assignOfficer(loan._id, { officerId }));
    if (res) onChanged();
  };

  const doRestructure = async (e) => {
    e.preventDefault();
    const payload = clean({
      reason: rForm.reason,
      tenureMonths: rForm.tenureMonths ? Number(rForm.tenureMonths) : "",
      interestRate: rForm.interestRate ? Number(rForm.interestRate) : "",
    });
    payload.waiveLateFees = rForm.waiveLateFees;
    const res = await restructure.run(() => loanService.restructure(loan._id, payload));
    if (res) onChanged();
  };

  const doWriteOff = async (e) => {
    e.preventDefault();
    if (!window.confirm("Write off this loan? This cannot be undone.")) return;
    const res = await writeOff.run(() => loanService.writeOff(loan._id, { reason }));
    if (res) onChanged();
  };

  return (
    <>
      <Card title="Assign officer">
        <Alert message={assign.error} />
        <Alert type="success" message={assign.success} />
        <form className="form" onSubmit={doAssign}>
          <Select label={`Currently: ${loan.assignedOfficer?.name || "Unassigned"}`} value={officerId} onChange={(e) => setOfficerId(e.target.value)} required>
            <option value="">Select an officer</option>
            {(officers.data || []).filter((o) => o.isActive).map((o) => (
              <option key={o._id} value={o._id}>{o.name} ({o.assignedLoans} loans)</option>
            ))}
          </Select>
          <Button type="submit" loading={assign.busy}>Assign</Button>
        </form>
      </Card>

      {active && (
        <>
          <Card title="Restructure loan">
            <p>Rolls the unpaid principal into a new schedule.</p>
            <Alert message={restructure.error} />
            <Alert type="success" message={restructure.success} />
            <form className="form" onSubmit={doRestructure}>
              <Input label="New tenure in months (optional)" type="number" step="1" min="1" max="240" value={rForm.tenureMonths} onChange={(e) => setRForm({ ...rForm, tenureMonths: e.target.value })} />
              <Input label="New interest rate % (optional)" type="number" step="0.01" min="0" max="100" value={rForm.interestRate} onChange={(e) => setRForm({ ...rForm, interestRate: e.target.value })} />
              <label className="auth-form__toggle">
                <input type="checkbox" checked={rForm.waiveLateFees} onChange={(e) => setRForm({ ...rForm, waiveLateFees: e.target.checked })} />
                <span>Waive outstanding late fees</span>
              </label>
              <Textarea label="Reason" value={rForm.reason} onChange={(e) => setRForm({ ...rForm, reason: e.target.value })} maxLength={500} required />
              <Button type="submit" loading={restructure.busy}>Restructure</Button>
            </form>
          </Card>

          <Card title="Write off loan">
            <Alert message={writeOff.error} />
            <Alert type="success" message={writeOff.success} />
            <form className="form" onSubmit={doWriteOff}>
              <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
              <Button type="submit" variant="danger" loading={writeOff.busy}>Write off</Button>
            </form>
          </Card>
        </>
      )}
    </>
  );
}

export default function LoanReview({ loan, user, onChanged }) {
  const inProgress = EDITABLE_LOAN_STATUSES.includes(loan.status);
  const active = ACTIVE_LOAN_STATUSES.includes(loan.status);
  const closedFinal = ["rejected", "closed", "cancelled", "written_off"].includes(loan.status);

  return (
    <div className="stack">
      {closedFinal && <Alert type="info" message={`This loan is ${label(loan.status)}. No further review actions are available.`} />}
      {inProgress && <Checklist loan={loan} />}
      {["pending", "under_review"].includes(loan.status) && <Eligibility loan={loan} onChanged={onChanged} />}
      {inProgress && <Decision loan={loan} user={user} onChanged={onChanged} />}
      {loan.status === "approved" && <Disburse loan={loan} onChanged={onChanged} />}
      {active && <RecordPayment loan={loan} onChanged={onChanged} />}
      {user.role === "admin" && <AdminTools loan={loan} onChanged={onChanged} />}
    </div>
  );
}
