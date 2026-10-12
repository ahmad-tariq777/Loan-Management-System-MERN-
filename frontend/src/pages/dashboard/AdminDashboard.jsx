import { Link } from "react-router-dom";
import { Users, Wallet, AlertTriangle, FolderCheck, Banknote, FilePlus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { useAction } from "../../hooks/useAction";
import { adminService } from "../../services/api";
import { Alert, Badge, Button, Card, ErrorState, PageHeader, PageLoader, StatCard, Table } from "../../components/UI";
import { money, formatDate, label } from "../../utils/format";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useFetch(adminService.getDashboard);
  const scheduler = useAction();

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const runScheduler = async () => {
    const res = await scheduler.run(() => adminService.runScheduler(), "Scheduler run complete");
    if (res) refetch();
  };

  return (
    <div className="page">
      <PageHeader
        title={`Welcome, ${user.name}`}
        subtitle="System overview"
        actions={
          <Button variant="secondary" loading={scheduler.busy} onClick={runScheduler}>
            Run daily jobs now
          </Button>
        }
      />
      <Alert type="success" message={scheduler.success} />
      <Alert message={scheduler.error} />

      <div className="stat-grid">
        <StatCard label="Total Users" value={data.totalUsers} icon={Users} sub={data.usersByRole.map((r) => `${r.count} ${r.role}`).join(", ")} />
        <StatCard label="Active Portfolio" value={money(data.activePortfolio.outstanding)} sub={`${data.activePortfolio.loans} active loan(s)`} icon={Wallet} />
        <StatCard label="Collected This Month" value={money(data.collectedThisMonth.amount)} sub={`${data.collectedThisMonth.payments} payment(s)`} icon={Banknote} />
        <StatCard label="Overdue Installments" value={data.overdueInstallments} icon={AlertTriangle} />
        <StatCard label="Documents Pending" value={data.pendingDocuments} icon={FolderCheck} />
        <StatCard label="New This Week" value={data.newApplicationsThisWeek} sub={`${data.awaitingDisbursement} awaiting disbursement`} icon={FilePlus} />
      </div>

      <div className="two-col">
        <Card title="Recent applications" actions={<Link to="/loans">All loans</Link>}>
          <Table headers={["Loan", "Applicant", "Amount", "Status", "Date"]}>
            {data.recentLoans.map((loan) => (
              <tr key={loan._id}>
                <td><Link to={`/loans/${loan._id}`}>{loan.loanNumber}</Link></td>
                <td>{loan.applicant?.name || "-"}</td>
                <td>{money(loan.amountRequested)}</td>
                <td><Badge status={loan.status} /></td>
                <td>{formatDate(loan.createdAt)}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Loans by status">
          <Table headers={["Status", "Count", "Requested"]}>
            {data.loansByStatus.map((row) => (
              <tr key={row._id}>
                <td>{label(row._id)}</td>
                <td>{row.count}</td>
                <td>{money(row.total)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <Card title="Quick links">
        <div className="quick-links">
          <Link to="/pending-loans">Review pending loans</Link>
          <Link to="/officers">Manage officers</Link>
          <Link to="/products">Loan products</Link>
          <Link to="/reports">Reports</Link>
          <Link to="/notifications">Send announcement</Link>
          <Link to="/audit-logs">Audit logs</Link>
        </div>
      </Card>
    </div>
  );
}
