import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

const NO_REFRESH = ["/auth/login", "/auth/refresh", "/auth/logout", "/auth/register"];

let isRefreshing = false;
let queue = [];

const flush = (error) => {
  queue.forEach((p) => (error ? p.reject(error) : p.resolve()));
  queue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const skip = NO_REFRESH.some((p) => original?.url?.startsWith(p));

    if (error.response?.status === 401 && !original._retry && !skip) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => queue.push({ resolve, reject })).then(() => api(original));
      }
      original._retry = true;
      isRefreshing = true;
      try {
        await api.post("/auth/refresh");
        flush(null);
        return api(original);
      } catch (err) {
        flush(err);
        if (original.url !== "/auth/me" && window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

const blob = { responseType: "blob" };

export const authService = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  logout: () => api.post("/auth/logout"),
  getMe: () => api.get("/auth/me"),
  changePassword: (data) => api.put("/auth/change-password", data),
};

export const applicantService = {
  register: (data) => api.post("/applicants/register", data),
  getMyProfile: () => api.get("/applicants/me"),
  getAll: (params) => api.get("/applicants/all", { params }),
  getById: (id) => api.get(`/applicants/${id}`),
  getLoans: (id) => api.get(`/applicants/${id}/loans`),
  update: (id, data) => api.patch(`/applicants/${id}`, data),
  verify: (id, data) => api.patch(`/applicants/${id}/verification`, data),
  setBlacklist: (id, data) => api.patch(`/applicants/${id}/blacklist`, data),
};

export const productService = {
  getAll: () => api.get("/products"),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post("/products", data),
  update: (id, data) => api.put(`/products/${id}`, data),
};

export const loanService = {
  calculate: (params) => api.get("/loans/calculator", { params }),
  apply: (data) => api.post("/loans/apply", data),
  getMy: (params) => api.get("/loans/my", { params }),
  getAll: (params) => api.get("/loans/all", { params }),
  getPending: (params) => api.get("/loans/pending", { params }),
  getStats: () => api.get("/loans/stats"),
  getById: (id) => api.get(`/loans/${id}`),
  getSummary: (id) => api.get(`/loans/${id}/summary`),
  getChecklist: (id) => api.get(`/loans/${id}/checklist`),
  getSettlementQuote: (id) => api.get(`/loans/${id}/settlement-quote`),
  evaluateEligibility: (id) => api.post(`/loans/eligibility/${id}`),
  updateStatus: (id, data) => api.patch(`/loans/status/${id}`, data),
  disburse: (id, data) => api.post(`/loans/${id}/disburse`, data),
  cancel: (id, data) => api.post(`/loans/${id}/cancel`, data),
  settle: (id, data) => api.post(`/loans/${id}/settle`, data),
  restructure: (id, data) => api.post(`/loans/${id}/restructure`, data),
  writeOff: (id, data) => api.post(`/loans/${id}/write-off`, data),
  assignOfficer: (id, data) => api.patch(`/loans/${id}/assign`, data),
  downloadApprovalLetter: (id) => api.get(`/loans/approval-letter/${id}`, blob),
};

export const documentService = {
  upload: (formData) =>
    api.post("/documents/upload", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  getAll: (params) => api.get("/documents", { params }),
  getPending: (params) => api.get("/documents/pending", { params }),
  getByLoan: (loanId) => api.get(`/documents/${loanId}`),
  getFile: (id, type) => api.get(`/documents/file/${id}/${type}`, blob),
  verify: (id, data) => api.patch(`/documents/verify/${id}`, data),
};

export const guarantorService = {
  add: (loanId, data) => api.post(`/guarantors/loan/${loanId}`, data),
  getByLoan: (loanId) => api.get(`/guarantors/loan/${loanId}`),
  update: (id, data) => api.patch(`/guarantors/${id}`, data),
  verify: (id, data) => api.patch(`/guarantors/${id}/verify`, data),
  remove: (id) => api.delete(`/guarantors/${id}`),
};

export const installmentService = {
  getMy: (params) => api.get("/installments/my", { params }),
  getUpcoming: (params) => api.get("/installments/upcoming", { params }),
  getOverdue: (params) => api.get("/installments/overdue/all", { params }),
  getByLoan: (loanId) => api.get(`/installments/${loanId}`),
  pay: (id, data) => api.put(`/installments/pay/${id}`, data),
  waiveLateFee: (id, data) => api.patch(`/installments/${id}/waive-late-fee`, data),
  exportSchedule: (loanId) => api.get(`/installments/export/${loanId}`, blob),
};

export const paymentService = {
  create: (data) => api.post("/payments", data),
  getAll: (params) => api.get("/payments", { params }),
  getMy: (params) => api.get("/payments/my", { params }),
  getById: (id) => api.get(`/payments/${id}`),
  reverse: (id, data) => api.post(`/payments/${id}/reverse`, data),
  downloadReceipt: (id) => api.get(`/payments/${id}/receipt`, blob),
  downloadStatement: (loanId) => api.get(`/payments/statement/${loanId}`, blob),
};

export const notificationService = {
  getAll: (params) => api.get("/notifications", { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch("/notifications/read-all"),
  remove: (id) => api.delete(`/notifications/${id}`),
  clearRead: () => api.delete("/notifications/read"),
  broadcast: (data) => api.post("/notifications/broadcast", data),
};

export const adminService = {
  getDashboard: () => api.get("/admin/dashboard"),
  getOfficers: () => api.get("/admin/officers"),
  createOfficer: (data) => api.post("/admin/officers", data),
  updateOfficer: (id, data) => api.patch(`/admin/officers/${id}`, data),
  resetOfficerPassword: (id) => api.post(`/admin/officers/${id}/reset-password`),
  getUsers: (params) => api.get("/admin/users", { params }),
  getUser: (id) => api.get(`/admin/users/${id}`),
  setUserStatus: (id, data) => api.patch(`/admin/users/${id}/status`, data),
  updateFinancials: (id, data) => api.patch(`/admin/users/${id}/financials`, data),
  getAuditLogs: (params) => api.get("/admin/audit-logs", { params }),
  runScheduler: () => api.post("/admin/scheduler/run"),
};

export const reportService = {
  portfolio: () => api.get("/reports/portfolio"),
  aging: () => api.get("/reports/aging"),
  collections: (params) => api.get("/reports/collections", { params }),
  disbursements: (params) => api.get("/reports/disbursements", { params }),
  loanTypes: () => api.get("/reports/loan-types"),
  officers: () => api.get("/reports/officers"),
  exportLoans: (params) => api.get("/reports/export/loans", { params, ...blob }),
  exportPayments: (params) => api.get("/reports/export/payments", { params, ...blob }),
};

export default api;
