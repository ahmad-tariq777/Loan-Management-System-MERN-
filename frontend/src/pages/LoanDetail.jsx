import { useState } from "react";
import { useParams, useSearchParams, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { useAction } from "../hooks/useAction";
import { loanService, paymentService } from "../services/api";
import { Alert, Badge, Button, ErrorState, Modal, PageHeader, PageLoader, Tabs, Textarea } from "../components/UI";
import { saveBlob, label, EDITABLE_LOAN_STATUSES } from "../utils/format";
import LoanOverview from "./loan/LoanOverview";
import LoanSchedule from "./loan/LoanSchedule";
import LoanPayments from "./loan/LoanPayments";
import LoanDocuments from "./loan/LoanDocuments";
import LoanGuarantors from "./loan/LoanGuarantors";
import LoanReview from "./loan/LoanReview";

const LETTER_STATUSES = ["approved", "disbursed", "closed", "defaulted", "written_off"];
const CANCELLABLE = [...EDITABLE_LOAN_STATUSES, "approved"];

export default function LoanDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const isStaff = user.role !== "applicant";
  const { data: loan, loading, error, refetch } = useFetch(() => loanService.getById(id), [id]);
  const files = useAction();
  const cancel = useAction();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const started = Boolean(loan.disbursedAt);
  const tabs = [
    { key: "overview", label: "Overview" },
    ...(started ? [{ key: "schedule", label: "Installments" }, { key: "payments", label: "Payments" }] : []),
    { key: "documents", label: "Documents" },
    { key: "guarantors", label: "Guarantors" },
    ...(isStaff ? [{ key: "review", label: "Review & Actions" }] : []),
  ];
  const requested = params.get("tab");
  const active = tabs.some((t) => t.key === requested) ? requested : "overview";
  const setTab = (key) => setParams({ tab: key }, { replace: true });

  const downloadLetter = () =>
    files.run(async () => {
      const res = await loanService.downloadApprovalLetter(id);
      saveBlob(res, `${loan.loanNumber}_approval_letter.pdf`);
      return res;
    }, "Approval letter downloaded");

  const downloadStatement = () =>
    files.run(async () => {
      const res = await paymentService.downloadStatement(id);
      saveBlob(res, `${loan.loanNumber}_statement.pdf`);
      return res;
    }, "Statement downloaded");

  const submitCancel = async (e) => {
    e.preventDefault();
    const res = await cancel.run(() => loanService.cancel(id, { reason }));
    if (res) {
      setCancelOpen(false);
      setReason("");
      refetch();
    }
  };

  const inProgress = EDITABLE_LOAN_STATUSES.includes(loan.status);

  return (
    <div className="page">
      <PageHeader
        title={`Loan ${loan.loanNumber}`}
        subtitle={`${label(loan.loanType)} loan${loan.applicant?.name ? ` for ${loan.applicant.name}` : ""}`}
        actions={
          <>
            <Badge status={loan.status} />
            {LETTER_STATUSES.includes(loan.status) && (
              <Button variant="secondary" onClick={downloadLetter}>Approval letter</Button>
            )}
            {started && <Button variant="secondary" onClick={downloadStatement}>Statement</Button>}
            {CANCELLABLE.includes(loan.status) && (
              <Button variant="danger" onClick={() => setCancelOpen(true)}>Cancel loan</Button>
            )}
          </>
        }
      />

      <Alert type="success" message={location.state?.message} />
      <Alert message={files.error} />
      <Alert type="success" message={files.success} />
      <Alert type="success" message={cancel.success} />

      {!isStaff && inProgress && (
        <Alert
          type="info"
          message={`To get this loan reviewed: upload your documents${loan.guarantorRequired ? " and add at least one guarantor" : ""}. Use the tabs below.`}
        />
      )}

      <Tabs tabs={tabs} active={active} onChange={setTab} />

      {active === "overview" && <LoanOverview loan={loan} user={user} onChanged={refetch} />}
      {active === "schedule" && <LoanSchedule loan={loan} user={user} onChanged={refetch} />}
      {active === "payments" && <LoanPayments loan={loan} user={user} />}
      {active === "documents" && <LoanDocuments loan={loan} user={user} />}
      {active === "guarantors" && <LoanGuarantors loan={loan} user={user} />}
      {active === "review" && isStaff && <LoanReview loan={loan} user={user} onChanged={refetch} />}

      <Modal open={cancelOpen} title="Cancel this loan?" onClose={() => setCancelOpen(false)}>
        <form className="form" onSubmit={submitCancel}>
          <Alert message={cancel.error} />
          <Textarea label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          <div className="form__actions">
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>Keep loan</Button>
            <Button type="submit" variant="danger" loading={cancel.busy}>Yes, cancel loan</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
