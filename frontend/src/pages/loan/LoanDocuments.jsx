import { useState } from "react";
import { useFetch } from "../../hooks/useFetch";
import { useAction } from "../../hooks/useAction";
import { documentService } from "../../services/api";
import { Alert, Badge, Button, Card, DetailList, ErrorState, Field, PageLoader, Select, Textarea } from "../../components/UI";
import { formatDateTime, openBlob } from "../../utils/format";

const FILES = [
  { key: "cnicFront", label: "CNIC front" },
  { key: "cnicBack", label: "CNIC back" },
  { key: "incomeProof", label: "Income proof" },
];

function UploadForm({ loan, hasExisting, onDone }) {
  const [files, setFiles] = useState({});
  const action = useAction();

  const submit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("loanId", loan._id);
    FILES.forEach((f) => formData.append(f.key, files[f.key]));
    const res = await action.run(() => documentService.upload(formData));
    if (res) {
      setFiles({});
      e.target.reset();
      onDone();
    }
  };

  const ready = FILES.every((f) => files[f.key]);

  return (
    <Card title={hasExisting ? "Replace your documents" : "Upload your documents"}>
      <p>All three files are required. Accepted: JPG, PNG or PDF, up to 1.4 MB each.</p>
      {hasExisting && <p className="form__note">Uploading again resets verification to pending.</p>}
      <Alert message={action.error} />
      <Alert type="success" message={action.success} />
      <form className="form" onSubmit={submit}>
        {FILES.map((f) => (
          <Field key={f.key} label={f.label}>
            <input
              className="ui-input"
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              onChange={(e) => setFiles({ ...files, [f.key]: e.target.files[0] })}
              required
            />
          </Field>
        ))}
        <Button type="submit" loading={action.busy} disabled={!ready}>
          {hasExisting ? "Replace documents" : "Upload documents"}
        </Button>
      </form>
    </Card>
  );
}

function VerifyForm({ document, onDone }) {
  const [form, setForm] = useState({ verificationStatus: "verified", officerComments: "" });
  const action = useAction();

  const submit = async (e) => {
    e.preventDefault();
    const res = await action.run(() => documentService.verify(document._id, form));
    if (res) onDone();
  };

  return (
    <Card title="Verify documents">
      <Alert message={action.error} />
      <Alert type="success" message={action.success} />
      <form className="form" onSubmit={submit}>
        <Select label="Decision" value={form.verificationStatus} onChange={(e) => setForm({ ...form, verificationStatus: e.target.value })}>
          <option value="verified">Verify</option>
          <option value="rejected">Reject</option>
        </Select>
        <Textarea
          label={form.verificationStatus === "rejected" ? "Reason (required)" : "Comments (optional)"}
          value={form.officerComments}
          onChange={(e) => setForm({ ...form, officerComments: e.target.value })}
          maxLength={1000}
          required={form.verificationStatus === "rejected"}
        />
        <Button type="submit" variant={form.verificationStatus === "rejected" ? "danger" : "primary"} loading={action.busy}>
          Submit decision
        </Button>
      </form>
    </Card>
  );
}

export default function LoanDocuments({ loan, user }) {
  const isStaff = user.role !== "applicant";
  const { data: document, loading, error, status, refetch } = useFetch(() => documentService.getByLoan(loan._id), [loan._id]);
  const viewer = useAction();

  if (loading) return <PageLoader />;
  if (error && status !== 404) return <ErrorState message={error} onRetry={refetch} />;

  const canUpload = !isStaff && ["pending", "under_review"].includes(loan.status);

  const view = (type) =>
    viewer.run(async () => {
      const res = await documentService.getFile(document._id, type);
      openBlob(res);
      return res;
    }, "");

  return (
    <div className="stack">
      {document ? (
        <Card title="Submitted documents">
          <Alert message={viewer.error} />
          <DetailList
            items={[
              ["Verification", <Badge key="s" status={document.verificationStatus} />],
              document.officerComments && ["Officer comments", document.officerComments],
              document.verifiedBy && ["Reviewed by", document.verifiedBy.name],
              document.verifiedAt && ["Reviewed on", formatDateTime(document.verifiedAt)],
              ["Uploaded", formatDateTime(document.updatedAt)],
            ]}
          />
          <div className="doc-links">
            {FILES.map((f) => (
              <Button key={f.key} variant="secondary" onClick={() => view(f.key)}>View {f.label}</Button>
            ))}
          </div>
        </Card>
      ) : (
        <Card title="Submitted documents">
          <p>No documents have been uploaded for this loan yet.</p>
        </Card>
      )}

      {canUpload && <UploadForm loan={loan} hasExisting={Boolean(document)} onDone={refetch} />}
      {!isStaff && !canUpload && !document && (
        <p>Documents can only be uploaded while a loan is pending or under review.</p>
      )}
      {isStaff && document && <VerifyForm document={document} onDone={refetch} />}
    </div>
  );
}
