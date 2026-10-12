import Installment from "../models/Installment.js";

export const generateInstallments = async ({ _id, applicantId, amountRequested, tenureMonths, interestRate = 0 }) => {
  await Installment.deleteMany({ loan: _id });

  const tenure = Math.max(1, Math.min(120, tenureMonths));
  const principal = amountRequested;
  const monthlyInterestRate = interestRate / 100 / 12;

  let monthlyPayment;
  if (monthlyInterestRate === 0) {
    monthlyPayment = principal / tenure;
  } else {
    monthlyPayment =
      (principal * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, tenure)) /
      (Math.pow(1 + monthlyInterestRate, tenure) - 1);
  }

  const installments = [];
  let balance = principal;
  const startDate = new Date();
  startDate.setDate(1);
  startDate.setMonth(startDate.getMonth() + 1);

  for (let i = 1; i <= tenure; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(startDate.getMonth() + (i - 1));

    const interestCharge = balance * monthlyInterestRate;
    const principalPayment = Math.min(monthlyPayment - interestCharge, balance);
    balance = Math.max(0, balance - principalPayment);

    const amount = i === tenure ? monthlyPayment + balance : monthlyPayment;

    installments.push({
      loan: _id,
      applicant: applicantId,
      installmentNumber: i,
      amount: parseFloat(amount.toFixed(2)),
      principal: parseFloat(principalPayment.toFixed(2)),
      interest: parseFloat(interestCharge.toFixed(2)),
      dueDate,
      paid: false
    });
  }

  await Installment.insertMany(installments);
  return installments;
};
