export const money = (value) =>
  `Rs ${Number(value || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

export const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "-";

export const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

export const label = (value) => (value ? String(value).replace(/_/g, " ") : "-");

export const errorMessage = (err, fallback = "Something went wrong") => {
  const data = err?.response?.data;
  if (!data || data instanceof Blob) return err?.response ? fallback : err?.message || fallback;
  const details = Array.isArray(data.details) ? `: ${data.details.join("; ")}` : "";
  return `${data.message || fallback}${details}`;
};

export const saveBlob = (response, filename) => {
  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const openBlob = (response) => {
  const url = window.URL.createObjectURL(response.data);
  window.open(url, "_blank", "noopener");
  setTimeout(() => window.URL.revokeObjectURL(url), 60000);
};

export const clean = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== "" && v !== null && v !== undefined));

export const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "online", "mobile_wallet"];
export const LOAN_STATUSES = [
  "pending", "under_review", "eligible", "approved", "rejected",
  "disbursed", "closed", "defaulted", "written_off", "cancelled",
];
export const ACTIVE_LOAN_STATUSES = ["disbursed", "defaulted"];
export const EDITABLE_LOAN_STATUSES = ["pending", "under_review", "eligible"];
