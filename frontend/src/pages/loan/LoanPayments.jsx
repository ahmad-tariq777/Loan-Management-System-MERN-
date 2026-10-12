import { useFetch } from "../../hooks/useFetch";
import { useAction } from "../../hooks/useAction";
import { paymentService } from "../../services/api";
import { Alert, Badge, Button, Card, EmptyState, ErrorState, PageLoader, Table } from "../../components/UI";
import { money, formatDateTime, label, saveBlob } from "../../utils/format";

export default function LoanPayments({ loan, user }) {
  const isStaff = user.role !== "applicant";
  const { data, loading, error, refetch } = useFetch(
    () => (isStaff ? paymentService.getAll({ loanId: loan._id, limit: 100 }) : paymentService.getMy({ loanId: loan._id, limit: 100 })),
    [loan._id]
  );
  const action = useAction();

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const receipt = (p) =>
    action.run(async () => {
      const res = await paymentService.downloadReceipt(p._id);
      saveBlob(res, `${p.receiptNumber}.pdf`);
      return res;
    }, "Receipt downloaded");

  return (
    <Card title={`Payments (${money(data.totalCollected)} collected)`}>
      <Alert message={action.error} />
      {data.payments.length === 0 ? (
        <EmptyState message="No payments recorded yet." />
      ) : (
        <Table headers={["Receipt", "Date", "Amount", "Method", "Type", "Status", ""]}>
          {data.payments.map((p) => (
            <tr key={p._id}>
              <td>{p.receiptNumber}</td>
              <td>{formatDateTime(p.paidAt)}</td>
              <td>{money(p.amount)}</td>
              <td>{label(p.method)}</td>
              <td>{label(p.type)}</td>
              <td><Badge status={p.status} /></td>
              <td><Button variant="secondary" onClick={() => receipt(p)}>Receipt</Button></td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
