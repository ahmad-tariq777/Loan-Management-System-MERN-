import { Link } from "react-router-dom";
import { CreditCard, CalendarClock, Bell, Wallet } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { applicantService, loanService, installmentService, notificationService } from "../../services/api";
import { Alert, Badge, Card, EmptyState, PageHeader, PageLoader, StatCard, Table } from "../../components/UI";
import { money, formatDate, label } from "../../utils/format";

export default function ApplicantDashboard() {
  const { user } = useAuth();
  const profile = useFetch(applicantService.getMyProfile);
  const loans = useFetch(() => loanService.getMy({ limit: 5 }));
  const upcoming = useFetch(() => installmentService.getUpcoming({ days: 30 }));
  const notes = useFetch(() => notificationService.getAll({ unread: "true", limit: 1 }));

  if (profile.loading || loans.loading || upcoming.loading) return <PageLoader />;

  const hasProfile = Boolean(profile.data);
  const verification = profile.data?.verificationStatus;
  const loanList = loans.data?.loans || [];
  const activeLoans = loanList.filter((l) => ["disbursed", "defaulted"].includes(l.status));
  const next = upcoming.data?.installments?.[0];

  return (
    <div className="page">
      <PageHeader
        title={`Welcome, ${user.name}`}
        subtitle="Here is a quick look at your loans and what to do next."
        actions={
          <Link to="/apply-loan" className="ui-btn ui-btn--primary">
            Apply for a Loan
          </Link>
        }
      />

      {!hasProfile && (
        <Card title="Next step: complete your profile">
          <p>You need an applicant profile before you can apply for a loan.</p>
          <Link to="/profile" className="ui-btn ui-btn--primary">
            Complete Profile
          </Link>
        </Card>
      )}
      {hasProfile && verification === "pending" && (
        <Alert type="info" message="Your profile is waiting for verification by an officer." />
      )}
      {hasProfile && verification === "rejected" && (
        <Alert message={`Your profile was rejected: ${profile.data.verificationRemarks || "no reason given"}. Update it from My Profile.`} />
      )}

      <div className="stat-grid">
        <StatCard label="Total Loans" value={loans.data?.pagination?.total ?? 0} icon={CreditCard} />
        <StatCard label="Active Loans" value={activeLoans.length} icon={Wallet} />
        <StatCard
          label="Due in 30 Days"
          value={money(upcoming.data?.totalDue)}
          sub={`${upcoming.data?.count || 0} installment(s)`}
          icon={CalendarClock}
        />
        <StatCard label="Unread Notifications" value={notes.data?.unreadCount ?? 0} icon={Bell} />
      </div>

      {next && (
        <Card title="Next payment due" actions={<Link to="/my-installments">All installments</Link>}>
          <p>
            Installment #{next.installmentNumber} of loan {next.loan?.loanNumber} is due on {formatDate(next.dueDate)}:{" "}
            <strong>{money(next.totalOutstanding)}</strong>
          </p>
        </Card>
      )}

      <Card title="Recent loans" actions={<Link to="/my-loans">View all</Link>}>
        {loanList.length === 0 ? (
          <EmptyState
            message="You have not applied for any loans yet."
            action={<Link to="/apply-loan">Apply now</Link>}
          />
        ) : (
          <Table headers={["Loan", "Type", "Amount", "Status", "Applied", ""]}>
            {loanList.map((loan) => (
              <tr key={loan._id}>
                <td>{loan.loanNumber}</td>
                <td>{label(loan.loanType)}</td>
                <td>{money(loan.approvedAmount || loan.amountRequested)}</td>
                <td><Badge status={loan.status} /></td>
                <td>{formatDate(loan.createdAt)}</td>
                <td><Link to={`/loans/${loan._id}`}>Open</Link></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
