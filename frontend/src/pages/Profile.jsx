import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { useAction } from "../hooks/useAction";
import { applicantService, authService } from "../services/api";
import { Alert, Badge, Button, Card, DetailList, Input, PageHeader, PageLoader, Textarea } from "../components/UI";
import { clean, formatDate, money } from "../utils/format";

const emptyRegistration = {
  cnic: "", cnicIssueDate: "", cnicExpiryDate: "", cnicFront: "", cnicBack: "",
  phone: "", altPhone: "", address: "", city: "", province: "", occupation: "",
  monthlyIncome: "", dependents: "",
};

function RegisterApplicant({ onDone }) {
  const [form, setForm] = useState(emptyRegistration);
  const action = useAction();
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const res = await action.run(() => applicantService.register(clean(form)), "Profile submitted for verification");
    if (res) onDone();
  };

  return (
    <Card title="Complete your applicant profile">
      <p>Fill in your details once. An officer will verify them before your loan can be approved.</p>
      <Alert message={action.error} />
      <form className="form" onSubmit={submit}>
        <Input label="CNIC (13 digits, no dashes)" value={form.cnic} onChange={set("cnic")} pattern="[0-9]{13}" maxLength={13} required />
        <Input label="CNIC issue date" type="date" value={form.cnicIssueDate} onChange={set("cnicIssueDate")} required />
        <Input label="CNIC expiry date" type="date" value={form.cnicExpiryDate} onChange={set("cnicExpiryDate")} required />
        <Input label="CNIC front image link" value={form.cnicFront} onChange={set("cnicFront")} placeholder="https://..." required />
        <Input label="CNIC back image link" value={form.cnicBack} onChange={set("cnicBack")} placeholder="https://..." required />
        <Input label="Mobile number" value={form.phone} onChange={set("phone")} placeholder="03XXXXXXXXX" pattern="03[0-9]{9}" maxLength={11} required />
        <Input label="Alternate mobile number (optional)" value={form.altPhone} onChange={set("altPhone")} placeholder="03XXXXXXXXX" pattern="03[0-9]{9}" maxLength={11} />
        <Textarea label="Address" value={form.address} onChange={set("address")} maxLength={500} required />
        <Input label="City" value={form.city} onChange={set("city")} />
        <Input label="Province" value={form.province} onChange={set("province")} />
        <Input label="Occupation" value={form.occupation} onChange={set("occupation")} />
        <Input label="Monthly income (Rs)" type="number" min="0" value={form.monthlyIncome} onChange={set("monthlyIncome")} />
        <Input label="Dependents" type="number" min="0" step="1" value={form.dependents} onChange={set("dependents")} />
        <Button type="submit" loading={action.busy}>Submit Profile</Button>
      </form>
    </Card>
  );
}

function EditApplicant({ applicant, onDone }) {
  const [form, setForm] = useState({});
  const action = useAction();

  useEffect(() => {
    setForm({
      phone: applicant.phone || "",
      altPhone: applicant.altPhone || "",
      address: applicant.address || "",
      city: applicant.city || "",
      province: applicant.province || "",
      occupation: applicant.occupation || "",
      monthlyIncome: applicant.monthlyIncome ?? "",
      dependents: applicant.dependents ?? "",
    });
  }, [applicant]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const res = await action.run(() => applicantService.update(applicant.applicantID, form), "Profile updated");
    if (res) onDone();
  };

  return (
    <Card title="Update contact and income details">
      <Alert message={action.error} />
      <Alert type="success" message={action.success} />
      <form className="form" onSubmit={submit}>
        <Input label="Mobile number" value={form.phone || ""} onChange={set("phone")} pattern="03[0-9]{9}" maxLength={11} required />
        <Input label="Alternate mobile number" value={form.altPhone || ""} onChange={set("altPhone")} pattern="03[0-9]{9}" maxLength={11} />
        <Textarea label="Address" value={form.address || ""} onChange={set("address")} maxLength={500} required />
        <Input label="City" value={form.city || ""} onChange={set("city")} />
        <Input label="Province" value={form.province || ""} onChange={set("province")} />
        <Input label="Occupation" value={form.occupation || ""} onChange={set("occupation")} />
        <Input label="Monthly income (Rs)" type="number" min="0" value={form.monthlyIncome} onChange={set("monthlyIncome")} />
        <Input label="Dependents" type="number" min="0" step="1" value={form.dependents} onChange={set("dependents")} />
        <Button type="submit" loading={action.busy}>Save Changes</Button>
      </form>
    </Card>
  );
}

function ChangePassword() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [localError, setLocalError] = useState("");
  const action = useAction();
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLocalError("");
    if (form.newPassword !== form.confirm) return setLocalError("New passwords do not match");
    const res = await action.run(() =>
      authService.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword })
    );
    if (res) {
      await logout();
      navigate("/login", { state: { message: "Password changed. Please sign in again." } });
    }
  };

  return (
    <Card title="Change password">
      <Alert message={localError || action.error} />
      <form className="form" onSubmit={submit}>
        <Input label="Current password" type="password" value={form.currentPassword} onChange={set("currentPassword")} autoComplete="current-password" required />
        <Input
          label="New password"
          type="password"
          value={form.newPassword}
          onChange={set("newPassword")}
          hint="8+ characters with uppercase, lowercase, number and a special character (@ # $ ! % & * ^ ( ))"
          autoComplete="new-password"
          required
        />
        <Input label="Confirm new password" type="password" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" required />
        <Button type="submit" loading={action.busy}>Change Password</Button>
      </form>
    </Card>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const isApplicant = user.role === "applicant";
  const profile = useFetch(() => (isApplicant ? applicantService.getMyProfile() : Promise.resolve({ data: null })), [isApplicant]);

  if (profile.loading) return <PageLoader />;

  const applicant = profile.data;
  const noProfile = isApplicant && !applicant && profile.status === 404;

  return (
    <div className="page">
      <PageHeader title={isApplicant ? "My Profile" : "My Account"} subtitle="Your details and security settings" />

      <Card title="Account">
        <DetailList
          items={[
            ["Name", user.name],
            ["Email", user.email],
            ["Role", user.role],
          ]}
        />
      </Card>

      {isApplicant && profile.error && !noProfile && <Alert message={profile.error} />}

      {noProfile && <RegisterApplicant onDone={profile.refetch} />}

      {applicant && (
        <>
          <Card title="Applicant details">
            <DetailList
              items={[
                ["Applicant ID", applicant.applicantID],
                ["Verification", <Badge key="v" status={applicant.verificationStatus} />],
                applicant.verificationRemarks && ["Officer remarks", applicant.verificationRemarks],
                applicant.isBlacklisted && ["Account standing", <Badge key="b" status="blacklisted" />],
                ["CNIC", applicant.cnic],
                ["CNIC expiry", formatDate(applicant.cnicExpiryDate)],
                ["Mobile", applicant.phone],
                ["City", applicant.city],
                ["Occupation", applicant.occupation],
                ["Monthly income", money(applicant.monthlyIncome)],
              ]}
            />
          </Card>
          <EditApplicant applicant={applicant} onDone={profile.refetch} />
        </>
      )}

      <ChangePassword />
    </div>
  );
}
