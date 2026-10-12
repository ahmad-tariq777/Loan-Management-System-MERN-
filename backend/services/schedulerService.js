import Loan from "../models/Loan.js";
import Installment from "../models/Installment.js";
import { ACTIVE_STATUSES, POLICY, SETTLED_INSTALLMENT_STATES } from "../config/loanConfig.js";
import { createNotification } from "../utils/notificationHelper.js";
import { assessLateFee, applyState, daysOverdue, totalOutstanding } from "./installmentService.js";
import { isEligibleForDefault } from "./lifecycleService.js";
import { syncLoanFinancials, transitionLoan } from "./loanService.js";

const MS_PER_DAY = 86400000;

const processLoan = async (loan, now) => {
  const installments = await Installment.find({ loan: loan._id, status: { $nin: SETTLED_INSTALLMENT_STATES } });
  const stats = { overdue: 0, lateFees: 0, reminders: 0, defaulted: 0 };
  const reminderLimit = new Date(now.getTime() + POLICY.reminderLeadDays * MS_PER_DAY);

  for (const installment of installments) {
    const previousStatus = installment.status;
    const fee = assessLateFee(installment, loan, now);
    if (fee > 0) {
      installment.lateFee = fee;
      stats.lateFees += 1;
    }
    applyState(installment, now);

    if (installment.status === "overdue" && !installment.overdueNotifiedAt) {
      installment.overdueNotifiedAt = now;
      stats.overdue += 1;
      await createNotification({
        userID: loan.applicant,
        title: "Installment Overdue",
        message: `Installment #${installment.installmentNumber} of loan ${loan.loanNumber} is overdue. Amount due: Rs ${totalOutstanding(installment).toLocaleString()}.`,
        type: "payment_overdue",
        relatedLoan: loan._id
      });
    }

    const dueSoon = installment.status !== "overdue" && new Date(installment.dueDate) <= reminderLimit;
    if (dueSoon && !installment.reminderSentAt) {
      installment.reminderSentAt = now;
      stats.reminders += 1;
      await createNotification({
        userID: loan.applicant,
        title: "Installment Due Soon",
        message: `Installment #${installment.installmentNumber} of loan ${loan.loanNumber} is due on ${new Date(installment.dueDate).toISOString().slice(0, 10)}. Amount: Rs ${totalOutstanding(installment).toLocaleString()}.`,
        type: "payment_due",
        relatedLoan: loan._id
      });
    }

    if (installment.isModified() || previousStatus !== installment.status) await installment.save();
  }

  if (loan.status === "disbursed" && isEligibleForDefault(installments, now)) {
    transitionLoan(loan, "defaulted", { comment: `Installment overdue for more than ${POLICY.defaultAfterDaysOverdue} days` });
    stats.defaulted += 1;
    await createNotification({
      userID: loan.applicant,
      title: "Loan Marked as Defaulted",
      message: `Loan ${loan.loanNumber} has been marked as defaulted due to long-overdue installments. Please contact the office.`,
      type: "loan_status",
      relatedLoan: loan._id
    });
  }

  if (installments.length) await syncLoanFinancials(loan);
  return stats;
};

export const runDailyJobs = async (now = new Date()) => {
  const totals = { loans: 0, overdue: 0, lateFees: 0, reminders: 0, defaulted: 0 };
  const cursor = Loan.find({ status: { $in: ACTIVE_STATUSES } }).cursor();

  for await (const loan of cursor) {
    try {
      const stats = await processLoan(loan, now);
      totals.loans += 1;
      for (const key of Object.keys(stats)) totals[key] += stats[key];
    } catch (err) {
      console.error(`Scheduler failed for loan ${loan.loanNumber}:`, err.message);
    }
  }
  return totals;
};

export const startScheduler = () => {
  if (process.env.SCHEDULER_ENABLED === "false") return null;

  const run = async () => {
    try {
      const totals = await runDailyJobs();
      console.log("Scheduler run complete:", JSON.stringify(totals));
    } catch (err) {
      console.error("Scheduler error:", err.message);
    }
  };

  setTimeout(run, 10000).unref();
  return setInterval(run, POLICY.schedulerIntervalMs).unref();
};
