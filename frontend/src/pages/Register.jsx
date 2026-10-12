import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authService } from "../services/api";
import { Alert, Button, Input } from "../components/UI";
import { errorMessage } from "../utils/format";

const passwordRules = (p) => [
  { ok: p.length >= 8, text: "At least 8 characters" },
  { ok: /[A-Z]/.test(p), text: "One uppercase letter" },
  { ok: /[a-z]/.test(p), text: "One lowercase letter" },
  { ok: /[0-9]/.test(p), text: "One number" },
  { ok: /[@#$!%&*^()]/.test(p), text: "One special character (@ # $ ! % & * ^ ( ))" },
];

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const rules = passwordRules(form.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!rules.every((r) => r.ok)) return setError("Password does not meet all requirements");
    if (form.password !== form.confirm) return setError("Passwords do not match");
    setLoading(true);
    try {
      await authService.register({ name: form.name, email: form.email, password: form.password });
      navigate("/login", { state: { message: "Account created. You can now sign in." } });
    } catch (err) {
      setError(errorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <h1 className="auth-card__title">Create your account</h1>
          <p className="auth-card__subtitle">Step 1 of 2. You will complete your applicant profile after signing in.</p>
        </div>

        <Alert message={error} />

        <form className="auth-form" onSubmit={handleSubmit}>
          <Input label="Full name" value={form.name} onChange={set("name")} minLength={2} maxLength={100} required />
          <Input label="Email" type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
          <Input label="Password" type="password" value={form.password} onChange={set("password")} autoComplete="new-password" required />
          <ul className="auth-form__rules">
            {rules.map((r) => (
              <li key={r.text} className={`auth-form__rule ${r.ok ? "auth-form__rule--ok" : ""}`}>
                {r.ok ? "✓" : "○"} {r.text}
              </li>
            ))}
          </ul>
          <Input label="Confirm password" type="password" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" required />
          <Button type="submit" loading={loading} className="auth-form__submit">
            Create Account
          </Button>
        </form>

        <p className="auth-card__footer">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
