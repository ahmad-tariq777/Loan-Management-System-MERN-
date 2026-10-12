import { useState } from "react";
import { useFetch } from "../hooks/useFetch";
import { useAction } from "../hooks/useAction";
import { productService } from "../services/api";
import { Alert, Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, PageLoader, Select, Table, Textarea } from "../components/UI";
import { money, label } from "../utils/format";

const TYPES = ["personal", "business", "education", "housing", "agriculture", "other"];
const NUMBERS = [
  ["minAmount", "Minimum amount (Rs)"], ["maxAmount", "Maximum amount (Rs)"],
  ["minTenureMonths", "Minimum tenure (months)"], ["maxTenureMonths", "Maximum tenure (months)"],
  ["defaultTenureMonths", "Default tenure (months)"], ["interestRate", "Interest rate (%)"],
  ["processingFeePercent", "Processing fee (%)"], ["lateFeePercent", "Late fee (%)"],
  ["gracePeriodDays", "Grace period (days)"], ["guarantorThreshold", "Guarantor needed above (Rs)"],
];
const blank = {
  loanType: "personal", name: "", description: "", minAmount: 1000, maxAmount: 100000,
  minTenureMonths: 3, maxTenureMonths: 12, defaultTenureMonths: 12, interestRate: 0,
  processingFeePercent: 0, lateFeePercent: 2, gracePeriodDays: 5, guarantorThreshold: 0,
  requiresGuarantor: true, isActive: true,
};

export default function Products() {
  const { data, loading, error, refetch } = useFetch(productService.getAll);
  const action = useAction();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);

  const isNew = editing === "new";
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const setBool = (key) => (e) => setForm({ ...form, [key]: e.target.checked });

  const open = (product) => {
    action.reset();
    if (product) {
      setForm({ ...blank, ...product });
      setEditing(product);
    } else {
      const free = TYPES.find((t) => !data.products.some((p) => p.loanType === t));
      setForm({ ...blank, loanType: free || "personal" });
      setEditing("new");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      description: form.description || "",
      requiresGuarantor: Boolean(form.requiresGuarantor),
      isActive: Boolean(form.isActive),
    };
    NUMBERS.forEach(([key]) => { payload[key] = Number(form[key]); });
    if (isNew) payload.loanType = form.loanType;
    const res = await action.run(() => (isNew ? productService.create(payload) : productService.update(editing._id, payload)));
    if (res) {
      setEditing(null);
      refetch();
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const allTaken = TYPES.every((t) => data.products.some((p) => p.loanType === t));

  return (
    <div className="page">
      <PageHeader
        title="Loan Products"
        subtitle="Terms apply to new applications only"
        actions={<Button disabled={allTaken} onClick={() => open(null)}>Add product</Button>}
      />
      <Card>
        {data.products.length === 0 ? <EmptyState message="No products yet." /> : (
          <Table headers={["Product", "Type", "Amount range", "Tenure", "Interest", "Fees", "Guarantor", "State", ""]}>
            {data.products.map((p) => (
              <tr key={p._id}>
                <td>{p.name}</td>
                <td>{label(p.loanType)}</td>
                <td>{money(p.minAmount)} - {money(p.maxAmount)}</td>
                <td>{p.minTenureMonths}-{p.maxTenureMonths} months</td>
                <td>{p.interestRate}%</td>
                <td>Processing {p.processingFeePercent}%, late {p.lateFeePercent}%</td>
                <td>{p.requiresGuarantor ? `Above ${money(p.guarantorThreshold)}` : "No"}</td>
                <td><Badge status={p.isActive ? "active" : "inactive"} /></td>
                <td><Button variant="secondary" onClick={() => open(p)}>Edit</Button></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={Boolean(editing)} title={isNew ? "Add loan product" : `Edit ${editing?.name}`} onClose={() => setEditing(null)}>
        <form className="form" onSubmit={submit}>
          <Alert message={action.error} />
          {isNew && (
            <Select label="Loan type" value={form.loanType} onChange={set("loanType")}>
              {TYPES.filter((t) => !data.products.some((p) => p.loanType === t)).map((t) => <option key={t} value={t}>{label(t)}</option>)}
            </Select>
          )}
          <Input label="Name" value={form.name} onChange={set("name")} maxLength={100} required />
          <Textarea label="Description" value={form.description || ""} onChange={set("description")} maxLength={500} />
          {NUMBERS.map(([key, text]) => (
            <Input key={key} label={text} type="number" min="0" step="any" value={form[key]} onChange={set(key)} required />
          ))}
          <label className="auth-form__toggle">
            <input type="checkbox" checked={Boolean(form.requiresGuarantor)} onChange={setBool("requiresGuarantor")} />
            <span>Requires a guarantor above the threshold</span>
          </label>
          <label className="auth-form__toggle">
            <input type="checkbox" checked={Boolean(form.isActive)} onChange={setBool("isActive")} />
            <span>Available to applicants</span>
          </label>
          <div className="form__actions">
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" loading={action.busy}>{isNew ? "Create product" : "Save changes"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
