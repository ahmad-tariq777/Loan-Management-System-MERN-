import { useState } from "react";
import { useFetch } from "../../hooks/useFetch";
import { useAction } from "../../hooks/useAction";
import { guarantorService } from "../../services/api";
import { Alert, Badge, Button, Card, DetailList, EmptyState, ErrorState, Input, PageLoader, Select, Textarea } from "../../components/UI";
import { money, clean, EDITABLE_LOAN_STATUSES } from "../../utils/format";

const blank = { name: "", cnic: "", phone: "", address: "", relationship: "", occupation: "", monthlyIncome: "" };

function GuarantorForm({ initial, onSubmit, onCancel, action, submitLabel }) {
  const [form, setForm] = useState(initial);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await onSubmit(form);
        if (ok) setForm(blank);
      }}
    >
      <Alert message={action.error} />
      <Input label="Full name" value={form.name} onChange={set("name")} maxLength={100} required />
      <Input label="CNIC (13 digits)" value={form.cnic} onChange={set("cnic")} pattern="[0-9]{13}" maxLength={13} required />
      <Input label="Mobile number" value={form.phone} onChange={set("phone")} placeholder="03XXXXXXXXX" pattern="03[0-9]{9}" maxLength={11} required />
      <Textarea label="Address" value={form.address} onChange={set("address")} maxLength={500} required />
      <Input label="Relationship to applicant" value={form.relationship} onChange={set("relationship")} maxLength={50} required />
      <Input label="Occupation" value={form.occupation} onChange={set("occupation")} maxLength={100} />
      <Input label="Monthly income (Rs)" type="number" min="0" value={form.monthlyIncome} onChange={set("monthlyIncome")} />
      <div className="form__actions">
        {onCancel && <Button variant="secondary" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" loading={action.busy}>{submitLabel}</Button>
      </div>
    </form>
  );
}

function VerifyForm({ guarantor, onDone }) {
  const [form, setForm] = useState({ status: "verified", remarks: "" });
  const action = useAction();

  const submit = async (e) => {
    e.preventDefault();
    const res = await action.run(() => guarantorService.verify(guarantor._id, clean(form)));
    if (res) onDone();
  };

  return (
    <form className="form form--inline" onSubmit={submit}>
      <Alert message={action.error} />
      <Select label="Decision" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
        <option value="verified">Verify</option>
        <option value="rejected">Reject</option>
      </Select>
      <Input
        label={form.status === "rejected" ? "Remarks (required)" : "Remarks (optional)"}
        value={form.remarks}
        onChange={(e) => setForm({ ...form, remarks: e.target.value })}
        maxLength={500}
        required={form.status === "rejected"}
      />
      <Button type="submit" loading={action.busy}>Submit</Button>
    </form>
  );
}

export default function LoanGuarantors({ loan, user }) {
  const isStaff = user.role !== "applicant";
  const { data, loading, error, refetch } = useFetch(() => guarantorService.getByLoan(loan._id), [loan._id]);
  const addAction = useAction();
  const editAction = useAction();
  const removeAction = useAction();
  const [editing, setEditing] = useState(null);

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const editable = EDITABLE_LOAN_STATUSES.includes(loan.status) || isStaff;
  const canAdd = editable && data.guarantors.length < 3;

  const add = async (form) => {
    const res = await addAction.run(() => guarantorService.add(loan._id, clean(form)));
    if (res) refetch();
    return Boolean(res);
  };

  const update = async (form) => {
    const res = await editAction.run(() => guarantorService.update(editing._id, clean(form)));
    if (res) {
      setEditing(null);
      refetch();
    }
    return Boolean(res);
  };

  const remove = async (g) => {
    if (!window.confirm(`Remove guarantor ${g.name}?`)) return;
    const res = await removeAction.run(() => guarantorService.remove(g._id));
    if (res) refetch();
  };

  return (
    <div className="stack">
      <Card title={`Guarantors (${data.guarantors.length}/3)`}>
        <p>{data.guarantorRequired ? "This loan requires at least one verified guarantor." : "A guarantor is not required for this loan."}</p>
        <Alert message={removeAction.error} />
        <Alert type="success" message={addAction.success || editAction.success || removeAction.success} />
        {data.guarantors.length === 0 ? (
          <EmptyState message="No guarantors added yet." />
        ) : (
          data.guarantors.map((g) => (
            <div key={g._id} className="guarantor">
              {editing?._id === g._id ? (
                <GuarantorForm
                  initial={{ ...blank, ...g, monthlyIncome: g.monthlyIncome ?? "" }}
                  onSubmit={update}
                  onCancel={() => setEditing(null)}
                  action={editAction}
                  submitLabel="Save changes"
                />
              ) : (
                <>
                  <DetailList
                    items={[
                      ["Name", g.name],
                      ["Status", <Badge key="s" status={g.status} />],
                      ["CNIC", g.cnic],
                      ["Mobile", g.phone],
                      ["Relationship", g.relationship],
                      ["Occupation", g.occupation],
                      ["Monthly income", money(g.monthlyIncome)],
                      ["Address", g.address],
                      g.remarks && ["Remarks", g.remarks],
                    ]}
                  />
                  {editable && (
                    <div className="form__actions">
                      <Button variant="secondary" onClick={() => { editAction.reset(); setEditing(g); }}>Edit</Button>
                      <Button variant="danger" onClick={() => remove(g)}>Remove</Button>
                    </div>
                  )}
                  {isStaff && <VerifyForm guarantor={g} onDone={refetch} />}
                </>
              )}
            </div>
          ))
        )}
      </Card>

      {canAdd && (
        <Card title="Add a guarantor">
          <GuarantorForm initial={blank} onSubmit={add} action={addAction} submitLabel="Add guarantor" />
        </Card>
      )}
    </div>
  );
}
