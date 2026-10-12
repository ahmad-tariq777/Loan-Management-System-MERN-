# Loan Management System - Backend v3.0

Express 5, Mongoose 9, JWT cookie auth. The authentication module is unchanged in this release; all work is in the loan, payment, applicant, document, notification, admin and reporting modules.

## Setup

1. Copy `.env.example` to `.env` and fill in your values
2. `npm install`
3. `npm run dev` or `npm start`
4. `npm test` runs the unit tests for the calculator and payment allocation logic

On first start the server seeds one loan product per loan type, syncs the ID counters with existing data, creates the super admin and starts the scheduler (set `SCHEDULER_ENABLED=false` to turn it off).

## Loan lifecycle

`pending -> under_review -> eligible -> approved -> disbursed -> closed`

Side exits: `rejected`, `cancelled` (before disbursement), `defaulted` (90+ days overdue, recovers automatically when cleared), `written_off`.

Every transition is validated and recorded in the loan's `statusHistory`.

## What was added

- **Loan products**: admin-managed terms per loan type (amount and tenure limits, interest rate, processing fee, late fee, grace period, guarantor rule). Terms are snapshotted on each loan at application time
- **Approval checklist**: approval requires a registered and verified applicant, not blacklisted, verified documents, and a verified guarantor when the product demands one
- **Eligibility engine v2**: accounts for existing loan installments, defaulted history and an affordability cap on the monthly installment
- **Disbursement**: records method, reference and processing fee, and generates the repayment schedule from the disbursement date
- **Payments**: partial and full payments, allocated oldest-first (late fee, then interest/principal), receipts with sequential numbers, PDF receipts, loan statements, admin reversal
- **Late fees and overdue handling**: daily scheduler marks overdue installments, applies late fees after the grace period, sends due-soon reminders, flags defaulted loans; admin can waive late fees
- **Early settlement**: quote and settle with an interest rebate on future installments
- **Restructuring**: admin can reschedule outstanding balance over a new tenure
- **Write-off**, **cancellation**, **officer assignment**
- **Guarantors**: up to three per loan with officer verification
- **Applicant management**: search, profile verification, blacklist, per-applicant loan history
- **Documents**: secure file download, orphan file cleanup on re-upload or failed upload, status filter
- **Reports**: portfolio, aging (portfolio at risk), collections, disbursements, loan types, officer performance, CSV exports
- **Loan calculator** (public) with full amortization schedule
- **Notifications**: filters, clear read, admin broadcast
- **Admin**: user list and detail, officer update, officer password reset, richer dashboard, manual scheduler run
- **Platform**: central error handler with consistent JSON errors, 404 handler, API rate limiter now active, audit logging on sensitive actions, race-safe ID generation (counters), safer query parsing

## API reference

Roles: A = applicant, O = officer, Ad = admin. "Any" means any authenticated user.

### Loan products
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | /api/products | Any | List products (applicants see active only) |
| GET | /api/products/:id | Any | Product detail |
| POST | /api/products | Ad | Create product |
| PUT | /api/products/:id | Ad | Update product |

### Loans
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | /api/loans/calculator?amount&months&rate&loanType | Public | EMI and schedule preview |
| POST | /api/loans/apply | A | Apply for a loan |
| GET | /api/loans/my | Any | Own loans (filters: status, loanType, dateFrom, dateTo) |
| GET | /api/loans/all | O | All loans (filters above plus q, minAmount, maxAmount, assignedOfficer, sortBy, order) |
| GET | /api/loans/pending | O | Pending loans with eligibility preview |
| GET | /api/loans/stats | O | Portfolio statistics |
| GET/POST | /api/loans/eligibility/:loanId | O | Run eligibility evaluation |
| GET | /api/loans/:loanId | Any | Loan detail with repayment summary |
| GET | /api/loans/:loanId/summary | Any | Repayment summary |
| GET | /api/loans/:loanId/checklist | O | Approval readiness checklist |
| PATCH | /api/loans/status/:loanId | O | `under_review`, `approved` or `rejected` |
| POST | /api/loans/:loanId/disburse | O | Disburse an approved loan |
| POST | /api/loans/:loanId/cancel | A owner, O | Cancel before disbursement |
| GET | /api/loans/:loanId/settlement-quote | Any | Early settlement amount |
| POST | /api/loans/:loanId/settle | O | Early settlement |
| POST | /api/loans/:loanId/restructure | Ad | Reschedule outstanding balance |
| POST | /api/loans/:loanId/write-off | Ad | Write off a loan |
| PATCH | /api/loans/:loanId/assign | Ad | Assign an officer |
| GET | /api/loans/approval-letter/:loanId | Any | Approval letter PDF |

### Installments
| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | /api/installments/my | Any | Own installments (filter: status) |
| GET | /api/installments/upcoming?days= | Any | Due soon and overdue |
| GET | /api/installments/overdue/all | O | Collections list with contact numbers (minDays, page, limit) |
| GET | /api/installments/export/:loanId | Any | Schedule CSV |
| GET | /api/installments/:loanId | Any | Schedule with summary |
| PUT | /api/installments/pay/:id | O | Pay an installment (full or partial via `amount`) |
| PATCH | /api/installments/:id/waive-late-fee | Ad | Waive a late fee |

### Payments
| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | /api/payments | O | Record a payment `{ loanId, amount, method, reference, notes, installmentId? }` |
| GET | /api/payments | O | All payments (filters: loanId, applicantId, method, status, dateFrom, dateTo, q) |
| GET | /api/payments/my | Any | Own payments |
| GET | /api/payments/:id | Any | Payment detail |
| GET | /api/payments/:id/receipt | Any | Receipt PDF |
| GET | /api/payments/statement/:loanId | Any | Loan statement PDF |
| POST | /api/payments/:id/reverse | Ad | Reverse a payment |

### Guarantors
| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | /api/guarantors/loan/:loanId | A owner, O | Add guarantor |
| GET | /api/guarantors/loan/:loanId | Any | List guarantors |
| PATCH | /api/guarantors/:id | A owner, O | Update guarantor |
| PATCH | /api/guarantors/:id/verify | O | Verify or reject |
| DELETE | /api/guarantors/:id | A owner, O | Remove guarantor |

### Applicants
| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | /api/applicants/register | A | Create profile |
| GET | /api/applicants/me | Any | Own profile |
| GET | /api/applicants/all | O | Search and filter (q, city, verificationStatus, blacklisted) |
| GET | /api/applicants/:id | O | Applicant by APP-ID |
| GET | /api/applicants/:id/loans | O | Loan history and summary |
| PATCH | /api/applicants/:id | Any | Update profile |
| PATCH | /api/applicants/:id/verification | O | Verify or reject profile |
| PATCH | /api/applicants/:id/blacklist | Ad | Blacklist or restore |

### Documents
| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | /api/documents/upload | A | Upload cnicFront, cnicBack, incomeProof |
| GET | /api/documents | O | All documents (filter: status) |
| GET | /api/documents/pending | O | Pending documents |
| GET | /api/documents/file/:id/:type | Any | Secure file download |
| GET | /api/documents/:loanId | Any | Documents for a loan |
| PATCH | /api/documents/verify/:id | O | Verify or reject |

### Reports (officer, officers report admin only)
`GET /api/reports/portfolio`, `/aging`, `/collections`, `/disbursements`, `/loan-types`, `/officers`, `/export/loans`, `/export/payments`. Date filters: `dateFrom`, `dateTo`; `groupBy=day|month` on time series.

### Notifications
`GET /api/notifications`, `PATCH /:id/read`, `PATCH /read-all`, `DELETE /:id`, `DELETE /read`, `POST /broadcast` (admin).

### Admin
`GET /api/admin/dashboard`, `/users`, `/users/:userId`, `/audit-logs`; `POST /officers`, `/officers/:userId/reset-password`, `/scheduler/run`; `PATCH /officers/:userId`, `/users/:userId/status`, `/users/:userId/financials`.

### Auth
Unchanged: `/api/auth/register`, `/login`, `/refresh`, `/logout`, `/me`, `/change-password`.

## Notes for existing data

- Loans created before this version keep working. ID counters are seeded from the highest existing loan, loan reference and applicant numbers
- Existing applicant profiles default to `verificationStatus: pending`; an officer must verify them before their loans can be approved
- Installments of already approved loans keep their stored schedule; new loans generate the schedule at disbursement

## Deploying to Vercel

1. Import this folder as its own Vercel project (framework preset: Other)
2. Add the variables from `.env.example` in Project Settings, Environment Variables. Set `CLIENT_ORIGIN` to the frontend URL and `CRON_SECRET` to any long random string
3. In MongoDB Atlas, Network Access, allow `0.0.0.0/0` (Vercel uses dynamic IPs)
4. Deploy, then open `/api/health` to confirm it responds

Notes for the serverless setup:

- `api/index.js` is the entry point, `server.js` is only for local runs
- The scheduler runs as a Vercel cron at 03:00 UTC through `/api/cron/daily` (protected by `CRON_SECRET`); `SCHEDULER_ENABLED` only affects local runs
- Uploaded documents are stored in MongoDB (collection `storedfiles`), limited to 1.4MB per file because Vercel caps request bodies at 4.5MB
- Approval letters are generated on demand, nothing is written to disk
- If the frontend calls this API from a different domain without the proxy rewrite, set `COOKIE_SAMESITE=none`
