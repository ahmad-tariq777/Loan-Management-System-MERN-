import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { useAction } from "../hooks/useAction";
import { reportService } from "../services/api";
import { Alert, Button, Card, DetailList, EmptyState, ErrorState, FilterBar, Input, PageHeader, PageLoader, Select, Table, Tabs } from "../components/UI";
import { money, label, saveBlob, clean } from "../utils/format";

function Portfolio() {
  const { data, loading, error, refetch } = useFetch(reportService.portfolio);
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  return (
    <div className="two-col">
      <Card title="Disbursements">
        <DetailList items={[["Loans disbursed", data.disbursed.loans], ["Total amount", money(data.disbursed.amount)], ["Net disbursed", money(data.disbursed.net)], ["Processing fees", money(data.disbursed.fees)]]} />
      </Card>
      <Card title="Active portfolio">
        <DetailList items={[["Active loans", data.activePortfolio.loans], ["Outstanding", money(data.activePortfolio.outstanding)], ["Portfolio at risk", money(data.portfolioAtRisk.amount)], ["At-risk ratio", `${data.portfolioAtRisk.ratioPercent}%`], ["Collection rate", `${data.collectionRatePercent}%`]]} />
      </Card>
      <Card title="Collections">
        <DetailList items={[["Payments", data.collections.payments], ["Total collected", money(data.collections.amount)], ["Principal", money(data.collections.principal)], ["Interest", money(data.collections.interest)], ["Late fees", money(data.collections.lateFees)]]} />
      </Card>
      <Card title="Loans by status">
        <Table headers={["Status", "Count"]}>
          {data.statusBreakdown.map((r) => <tr key={r.status}><td>{label(r.status)}</td><td>{r.count}</td></tr>)}
        </Table>
      </Card>
    </div>
  );
}

function Aging() {
  const { data, loading, error, refetch } = useFetch(reportService.aging);
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  return (
    <Card title="Overdue aging (days past due)">
      <Table headers={["Bucket", "Loans", "Installments", "Amount"]}>
        {data.buckets.map((b) => <tr key={b.bucket}><td>{b.bucket}</td><td>{b.loans}</td><td>{b.installments}</td><td>{money(b.amount)}</td></tr>)}
      </Table>
    </Card>
  );
}

function PeriodReport({ kind }) {
  const blank = { dateFrom: "", dateTo: "", groupBy: "month" };
  const [filters, setFilters] = useState(blank);
  const [applied, setApplied] = useState(blank);
  const fn = kind === "collections" ? reportService.collections : reportService.disbursements;
  const { data, loading, error, refetch } = useFetch(() => fn(clean(applied)), [kind, applied]);
  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });

  return (
    <div className="stack">
      <FilterBar onSubmit={() => setApplied(filters)}>
        <Input label="From" type="date" value={filters.dateFrom} onChange={set("dateFrom")} />
        <Input label="To" type="date" value={filters.dateTo} onChange={set("dateTo")} />
        <Select label="Group by" value={filters.groupBy} onChange={set("groupBy")}>
          <option value="month">Month</option>
          <option value="day">Day</option>
        </Select>
        <Button type="submit">Apply</Button>
      </FilterBar>
      {loading ? <PageLoader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <>
          <Card title={kind === "collections" ? `Collections (total ${money(data.total)})` : "Disbursements"}>
            {data.periods.length === 0 ? <EmptyState message="No data for this range." /> : kind === "collections" ? (
              <Table headers={["Period", "Payments", "Amount", "Principal", "Interest", "Late fees"]}>
                {data.periods.map((r) => <tr key={r.period}><td>{r.period}</td><td>{r.payments}</td><td>{money(r.amount)}</td><td>{money(r.principal)}</td><td>{money(r.interest)}</td><td>{money(r.lateFees)}</td></tr>)}
              </Table>
            ) : (
              <Table headers={["Period", "Loans", "Amount", "Net disbursed", "Processing fees"]}>
                {data.periods.map((r) => <tr key={r.period}><td>{r.period}</td><td>{r.loans}</td><td>{money(r.amount)}</td><td>{money(r.netDisbursed)}</td><td>{money(r.processingFees)}</td></tr>)}
              </Table>
            )}
          </Card>
          {kind === "collections" && data.byMethod.length > 0 && (
            <Card title="By payment method">
              <Table headers={["Method", "Payments", "Amount"]}>
                {data.byMethod.map((r) => <tr key={r.method}><td>{label(r.method)}</td><td>{r.payments}</td><td>{money(r.amount)}</td></tr>)}
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function LoanTypes() {
  const { data, loading, error, refetch } = useFetch(reportService.loanTypes);
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  return (
    <Card title="Performance by loan type">
      <Table headers={["Type", "Applications", "Approved", "Rejected", "Defaulted", "Approval rate", "Requested", "Approved amount"]}>
        {data.types.map((t) => (
          <tr key={t.loanType}>
            <td>{label(t.loanType)}</td><td>{t.applications}</td><td>{t.approved}</td><td>{t.rejected}</td><td>{t.defaulted}</td>
            <td>{t.approvalRatePercent}%</td><td>{money(t.requestedAmount)}</td><td>{money(t.approvedAmount)}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

function OfficerPerformance() {
  const { data, loading, error, refetch } = useFetch(reportService.officers);
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  return (
    <Card title="Officer performance">
      {data.officers.length === 0 ? <EmptyState message="No decisions recorded yet." /> : (
        <Table headers={["Officer", "Decisions", "Approved", "Rejected", "Approved amount", "Payments received", "Collected"]}>
          {data.officers.map((o) => (
            <tr key={o.officerId}>
              <td>{o.name}<br />{o.email}</td><td>{o.decisions}</td><td>{o.approved}</td><td>{o.rejected}</td>
              <td>{money(o.approvedAmount)}</td><td>{o.paymentsReceived}</td><td>{money(o.amountCollected)}</td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

function Exports() {
  const action = useAction();
  const [range, setRange] = useState({ dateFrom: "", dateTo: "" });
  const run = (fn, name) => action.run(async () => {
    const res = await fn(clean(range));
    saveBlob(res, name);
    return res;
  }, "Export downloaded");

  return (
    <Card title="Export data (CSV)">
      <Alert message={action.error} />
      <Alert type="success" message={action.success} />
      <FilterBar>
        <Input label="From" type="date" value={range.dateFrom} onChange={(e) => setRange({ ...range, dateFrom: e.target.value })} />
        <Input label="To" type="date" value={range.dateTo} onChange={(e) => setRange({ ...range, dateTo: e.target.value })} />
        <Button variant="secondary" loading={action.busy} onClick={() => run(reportService.exportLoans, "loans.csv")}>Export loans</Button>
        <Button variant="secondary" loading={action.busy} onClick={() => run(reportService.exportPayments, "payments.csv")}>Export payments</Button>
      </FilterBar>
    </Card>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const [tab, setTab] = useState("portfolio");
  const tabs = [
    { key: "portfolio", label: "Portfolio" },
    { key: "aging", label: "Overdue aging" },
    { key: "collections", label: "Collections" },
    { key: "disbursements", label: "Disbursements" },
    { key: "types", label: "Loan types" },
    ...(user.role === "admin" ? [{ key: "officers", label: "Officers" }] : []),
    { key: "export", label: "Export" },
  ];

  return (
    <div className="page">
      <PageHeader title="Reports" subtitle="Pick a report from the tabs" />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === "portfolio" && <Portfolio />}
      {tab === "aging" && <Aging />}
      {tab === "collections" && <PeriodReport kind="collections" />}
      {tab === "disbursements" && <PeriodReport kind="disbursements" />}
      {tab === "types" && <LoanTypes />}
      {tab === "officers" && <OfficerPerformance />}
      {tab === "export" && <Exports />}
    </div>
  );
}
