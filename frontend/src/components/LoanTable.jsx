import { Link } from "react-router-dom";
import { Badge, EmptyState, Table } from "./UI";
import { money, formatDate, label } from "../utils/format";

export default function LoanTable({ loans, showApplicant = false, extraHeaders = [], renderExtra }) {
  if (!loans?.length) return <EmptyState message="No loans found." />;
  const headers = ["Loan", ...(showApplicant ? ["Applicant"] : []), "Type", "Requested", "Approved", "Status", "Applied", ...extraHeaders, ""];
  return (
    <Table headers={headers}>
      {loans.map((loan) => (
        <tr key={loan._id}>
          <td>{loan.loanNumber}</td>
          {showApplicant && <td>{loan.applicant?.name || "-"}</td>}
          <td>{label(loan.loanType)}</td>
          <td>{money(loan.amountRequested)}</td>
          <td>{loan.approvedAmount ? money(loan.approvedAmount) : "-"}</td>
          <td><Badge status={loan.status} /></td>
          <td>{formatDate(loan.createdAt)}</td>
          {renderExtra && renderExtra(loan)}
          <td><Link to={`/loans/${loan._id}`}>Open</Link></td>
        </tr>
      ))}
    </Table>
  );
}
