import { round2 } from "../utils/helpers.js";

const monthlyRate = (annualRate) => annualRate / 100 / 12;

export const firstDueDateFrom = (date = new Date()) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));

export const addMonths = (date, months) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));

export const calculateEmi = (principal, annualRate, months) => {
  const rate = monthlyRate(annualRate);
  if (rate === 0) return round2(principal / months);
  const factor = Math.pow(1 + rate, months);
  return round2((principal * rate * factor) / (factor - 1));
};

export const maxPrincipalForEmi = (emi, annualRate, months) => {
  if (emi <= 0) return 0;
  const rate = monthlyRate(annualRate);
  if (rate === 0) return emi * months;
  const factor = Math.pow(1 + rate, months);
  return (emi * (factor - 1)) / (rate * factor);
};

export const buildSchedule = ({ principal, annualRate = 0, months, firstDueDate, startNumber = 1 }) => {
  const rate = monthlyRate(annualRate);
  const emi = calculateEmi(principal, annualRate, months);
  const rows = [];
  let balance = round2(principal);

  for (let index = 0; index < months; index++) {
    const interest = round2(balance * rate);
    let principalPart = round2(emi - interest);
    let amount = emi;
    if (index === months - 1 || principalPart > balance) {
      principalPart = balance;
      amount = round2(principalPart + interest);
    }
    balance = round2(balance - principalPart);
    rows.push({
      installmentNumber: startNumber + index,
      dueDate: addMonths(firstDueDate, index),
      amount,
      principal: principalPart,
      interest,
      balance
    });
  }
  return rows;
};

export const summarizeSchedule = (rows) => {
  const totalPayable = round2(rows.reduce((sum, row) => sum + row.amount, 0));
  const totalInterest = round2(rows.reduce((sum, row) => sum + row.interest, 0));
  return {
    monthlyInstallment: rows[0]?.amount || 0,
    totalPayable,
    totalInterest,
    totalPrincipal: round2(totalPayable - totalInterest)
  };
};
