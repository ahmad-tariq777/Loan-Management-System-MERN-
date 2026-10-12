import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { useAction } from "../hooks/useAction";
import { applicantService, loanService, productService } from "../services/api";
import { Alert, Button, Card, DetailList, ErrorState, Input, PageHeader, PageLoader, Select, Textarea } from "../components/UI";
import { money, label } from "../utils/format";

export default function ApplyLoan() {
  const navigate = useNavigate();
  const profile = useFetch(applicantService.getMyProfile);
  const products = useFetch(productService.getAll);
  const [form, setForm] = useState({ loanType: "", amountRequested: "", tenureMonths: "", purpose: "" });
  const [quote, setQuote] = useState(null);
  const calc = useAction();
  const submit = useAction();

  if (profile.loading || products.loading) return <PageLoader />;
  if (products.error) return <ErrorState message={products.error} onRetry={products.refetch} />;

  const list = products.data.products;
  const product = list.find((p) => p.loanType === form.loanType);
  const noProfile = profile.status === 404;

  const pickType = (e) => {
    const next = list.find((p) => p.loanType === e.target.value);
    setQuote(null);
    setForm({
      ...form,
      loanType: e.target.value,
      tenureMonths: next ? String(next.defaultTenureMonths) : "",
      amountRequested: "",
    });
  };

  const set = (key) => (e) => {
    setQuote(null);
    setForm({ ...form, [key]: e.target.value });
  };

  const calculate = async () => {
    const res = await calc.run(
      () => loanService.calculate({ amount: form.amountRequested, months: form.tenureMonths, loanType: form.loanType }),
      ""
    );
    if (res) setQuote(res.data);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const res = await submit.run(() =>
      loanService.apply({
        loanType: form.loanType,
        amountRequested: Number(form.amountRequested),
        tenureMonths: Number(form.tenureMonths),
        purpose: form.purpose,
      })
    );
    if (res) {
      navigate(`/loans/${res.data.loan._id}?tab=documents`, {
        state: {
          message: res.data.requirements.guarantorRequired
            ? "Application submitted. Next: upload your documents and add a guarantor."
            : "Application submitted. Next: upload your documents.",
        },
      });
    }
  };

  if (noProfile) {
    return (
      <div className="page">
        <PageHeader title="Apply for a Loan" />
        <Card title="Complete your profile first">
          <p>You need a verified-ready applicant profile before applying.</p>
          <Link to="/profile" className="ui-btn ui-btn--primary">Go to My Profile</Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title="Apply for a Loan" subtitle="Choose a loan type, check the repayment plan, then submit." />
      <Alert message={profile.error && !noProfile ? profile.error : ""} />

      <div className="two-col">
        <Card title="1. Loan details">
          <Alert message={submit.error} />
          <form className="form" onSubmit={onSubmit}>
            <Select label="Loan type" value={form.loanType} onChange={pickType} required>
              <option value="">Select a loan type</option>
              {list.map((p) => (
                <option key={p._id} value={p.loanType}>{p.name}</option>
              ))}
            </Select>
            <Input
              label="Amount (Rs)"
              type="number"
              value={form.amountRequested}
              onChange={set("amountRequested")}
              min={product?.minAmount}
              max={product?.maxAmount}
              hint={product ? `Between ${money(product.minAmount)} and ${money(product.maxAmount)}` : "Select a loan type first"}
              disabled={!product}
              required
            />
            <Input
              label="Repayment period (months)"
              type="number"
              step="1"
              value={form.tenureMonths}
              onChange={set("tenureMonths")}
              min={product?.minTenureMonths}
              max={product?.maxTenureMonths}
              hint={product ? `Between ${product.minTenureMonths} and ${product.maxTenureMonths} months` : ""}
              disabled={!product}
              required
            />
            <Textarea
              label="Purpose of the loan"
              value={form.purpose}
              onChange={set("purpose")}
              minLength={10}
              maxLength={500}
              hint="10 to 500 characters"
              required
            />
            <div className="form__actions">
              <Button
                variant="secondary"
                loading={calc.busy}
                disabled={!form.loanType || !form.amountRequested || !form.tenureMonths}
                onClick={calculate}
              >
                Preview repayment plan
              </Button>
              <Button type="submit" loading={submit.busy} disabled={!form.loanType}>
                Submit Application
              </Button>
            </div>
            <Alert message={calc.error} />
          </form>
        </Card>

        <div className="stack">
          {product && (
            <Card title={product.name}>
              <p>{product.description}</p>
              <DetailList
                items={[
                  ["Amount range", `${money(product.minAmount)} - ${money(product.maxAmount)}`],
                  ["Tenure", `${product.minTenureMonths} - ${product.maxTenureMonths} months`],
                  ["Interest rate", `${product.interestRate}%`],
                  ["Processing fee", `${product.processingFeePercent}%`],
                  ["Late fee", `${product.lateFeePercent}% after ${product.gracePeriodDays} grace days`],
                  ["Guarantor", product.requiresGuarantor ? `Required above ${money(product.guarantorThreshold)}` : "Not required"],
                ]}
              />
            </Card>
          )}
          {quote && (
            <Card title="2. Repayment preview">
              <DetailList
                items={[
                  ["Monthly installment", money(quote.monthlyInstallment)],
                  ["Total interest", money(quote.totalInterest)],
                  ["Total payable", money(quote.totalPayable)],
                  ["Processing fee", money(quote.processingFee)],
                  ["You receive", money(quote.netDisbursement)],
                ]}
              />
              <p className="form__note">You will upload documents after submitting. {label(form.loanType)} loans are reviewed by an officer.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
