import { Link } from "react-router-dom";

export default function Unauthorized() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">Access denied</h1>
        <p className="auth-card__subtitle">You do not have permission to view this page.</p>
        <Link to="/dashboard" className="ui-btn ui-btn--primary">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
