import { label as toLabel } from "../utils/format";

export function Card({ title, actions, children, className = "" }) {
  return (
    <section className={`ui-card ${className}`}>
      {(title || actions) && (
        <div className="ui-card__header">
          {title && <h2 className="ui-card__title">{title}</h2>}
          {actions && <div className="ui-card__actions">{actions}</div>}
        </div>
      )}
      <div className="ui-card__body">{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="ui-page-header">
      <div className="ui-page-header__text">
        <h1 className="ui-page-header__title">{title}</h1>
        {subtitle && <p className="ui-page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </div>
  );
}

export function Badge({ status }) {
  const mod = String(status || "default").replace(/_/g, "-");
  return <span className={`ui-badge ui-badge--${mod}`}>{toLabel(status)}</span>;
}

export function Spinner({ size = "md" }) {
  return <div className={`ui-spinner ui-spinner--${size}`} />;
}

export function PageLoader() {
  return (
    <div className="ui-page-loader">
      <Spinner size="lg" />
    </div>
  );
}

export function Alert({ type = "error", message, onClose }) {
  if (!message) return null;
  return (
    <div className={`ui-alert ui-alert--${type}`} role="alert">
      <span className="ui-alert__msg">{message}</span>
      {onClose && (
        <button type="button" className="ui-alert__close" onClick={onClose} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="ui-error-state">
      <p className="ui-error-state__msg">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Field({ label, error, hint, children }) {
  return (
    <div className="ui-field">
      {label && <label className="ui-label">{label}</label>}
      {children}
      {hint && !error && <p className="ui-field__hint">{hint}</p>}
      {error && <p className="ui-field__error">{error}</p>}
    </div>
  );
}

export function Input({ label, error, hint, ...props }) {
  return (
    <Field label={label} error={error} hint={hint}>
      <input className={`ui-input ${error ? "ui-input--error" : ""}`} {...props} />
    </Field>
  );
}

export function Select({ label, error, hint, children, ...props }) {
  return (
    <Field label={label} error={error} hint={hint}>
      <select className={`ui-select ${error ? "ui-select--error" : ""}`} {...props}>
        {children}
      </select>
    </Field>
  );
}

export function Textarea({ label, error, hint, ...props }) {
  return (
    <Field label={label} error={error} hint={hint}>
      <textarea className={`ui-textarea ${error ? "ui-textarea--error" : ""}`} {...props} />
    </Field>
  );
}

export function Button({ children, loading, variant = "primary", className = "", disabled, type = "button", ...props }) {
  return (
    <button
      type={type}
      className={`ui-btn ui-btn--${variant} ${className}`}
      disabled={loading || disabled}
      {...props}
    >
      {loading && <span className="ui-btn__spinner" />}
      {children}
    </button>
  );
}

export function StatCard({ label, value, icon: Icon, color = "default", sub, to }) {
  return (
    <div className={`ui-stat ui-stat--${color}`}>
      {Icon && (
        <div className="ui-stat__icon-wrap">
          <Icon size={18} className="ui-stat__icon" />
        </div>
      )}
      <div className="ui-stat__body">
        <p className="ui-stat__label">{label}</p>
        <p className="ui-stat__value">{value}</p>
        {sub && <p className="ui-stat__sub">{sub}</p>}
      </div>
    </div>
  );
}

export function EmptyState({ message = "Nothing to show yet", action }) {
  return (
    <div className="ui-empty">
      <p className="ui-empty__msg">{message}</p>
      {action}
    </div>
  );
}

export function Table({ headers, children }) {
  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} className="ui-th">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null;
  return (
    <div className="ui-pagination">
      <span className="ui-pagination__info">
        Page {pagination.page} of {pagination.pages} ({pagination.total} total)
      </span>
      <div className="ui-pagination__controls">
        <Button variant="secondary" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" disabled={pagination.page >= pagination.pages} onClick={() => onPage(pagination.page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="ui-modal" role="dialog" aria-modal="true">
      <div className="ui-modal__backdrop" onClick={onClose} />
      <div className="ui-modal__panel">
        <div className="ui-modal__header">
          <h3 className="ui-modal__title">{title}</h3>
          <button type="button" className="ui-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="ui-modal__body">{children}</div>
      </div>
    </div>
  );
}

export function DetailList({ items }) {
  return (
    <dl className="ui-details">
      {items
        .filter(Boolean)
        .map(([key, value]) => (
          <div key={key} className="ui-details__row">
            <dt className="ui-details__label">{key}</dt>
            <dd className="ui-details__value">{value ?? "-"}</dd>
          </div>
        ))}
    </dl>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="ui-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          className={`ui-tabs__tab ${active === tab.key ? "ui-tabs__tab--active" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function FilterBar({ children, onSubmit }) {
  return (
    <form
      className="ui-filters"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      {children}
    </form>
  );
}
