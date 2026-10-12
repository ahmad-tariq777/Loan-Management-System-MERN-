import { Link } from "react-router-dom";
import { ClipboardList, FolderCheck, AlertTriangle, Wallet } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { loanService, documentService } from "../../services/api";
import { Card, ErrorState, PageHeader, PageLoader, StatCard, Table } from "../../components/UI";
import { money, label } from "../../utils/format";

export default function OfficerDashboard() {
  const { user } = useAuth();
  const stats = useFetch(loanService.getStats);
  const docs = useFetch(() => documentService.getPending({ limit: 1 }));

  if (stats.loading || docs.loading) return <PageLoader />;
  if (stats.error) return <ErrorState message={stats.error} onRetry={stats.refetch} />;

  const s = stats.data;
  const countOf = (status) => s.byStatus.find((row) => row._id === status)?.count || 0;

  return (
    <div className="page">
      <PageHeader title={`Welcome, ${user.name}`} subtitle="Your review queues and portfolio at a glance." />

      <div className="stat-grid">
        <Link to="/pending-loans" className="stat-link">
          <StatCard label="Loans Awaiting Review" value={countOf("pending")} icon={ClipboardList} />
        </Link>
        <Link to="/documents" className="stat-link">
          <StatCard label="Documents to Verify" value={docs.data?.pagination?.total ?? 0} icon={FolderCheck} />
        </Link>
        <Link to="/overdue" className="stat-link">
          <StatCard label="Overdue Installments" value={s.overdueInstallments} icon={AlertTriangle} />
        </Link>
        <StatCard
          label="Outstanding Portfolio"
          value={money(s.activePortfolio.outstanding)}
          sub={`${s.activePortfolio.loans} active loan(s)`}
          icon={Wallet}
        />
      </div>

      <div className="two-col">
        <Card title="Loans by status" actions={<Link to="/loans">All loans</Link>}>
          <Table headers={["Status", "Count", "Requested"]}>
            {s.byStatus.map((row) => (
              <tr key={row._id}>
                <td><Link to={`/loans?status=${row._id}`}>{label(row._id)}</Link></td>
                <td>{row.count}</td>
                <td>{money(row.totalRequested)}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Loans by type">
          <Table headers={["Type", "Count", "Requested"]}>
            {s.byType.map((row) => (
              <tr key={row._id}>
                <td>{label(row._id)}</td>
                <td>{row.count}</td>
                <td>{money(row.totalRequested)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </div>
  );
}
