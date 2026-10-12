import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Alert, Button, Input } from "../components/UI";
import { errorMessage } from "../utils/format";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form);
      navigate("/dashboard");
    } catch (err) {
      setError(errorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <h1 className="auth-card__title">Akhuwat Loan Management</h1>
          <p className="auth-card__subtitle">Sign in to continue</p>
        </div>

        <Alert type="success" message={location.state?.message} />
        <Alert message={error} />

        <form className="auth-form" onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            value={form.password}
            onChange={set("password")}
            autoComplete="current-password"
            required
          />
          <label className="auth-form__toggle">
            <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
            <span>Show password</span>
          </label>
          <Button type="submit" loading={loading} className="auth-form__submit">
            Sign In
          </Button>
        </form>

        <p className="auth-card__footer">
          New applicant? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
