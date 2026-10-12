import Counter from "../models/Counter.js";
import Loan from "../models/Loan.js";
import Applicant from "../models/Applicant.js";

export const nextSequence = async (key) => {
  const counter = await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return counter.seq;
};

const maxSuffix = async (Model, field) => {
  const [result] = await Model.aggregate([
    { $match: { [field]: { $type: "string" } } },
    {
      $project: {
        value: {
          $convert: {
            input: { $arrayElemAt: [{ $split: [`$${field}`, "-"] }, 1] },
            to: "int",
            onError: 0,
            onNull: 0
          }
        }
      }
    },
    { $group: { _id: null, max: { $max: "$value" } } }
  ]);
  return result?.max || 0;
};

export const syncSequences = async () => {
  const seeds = {
    loanNumber: await maxSuffix(Loan, "loanNumber"),
    loanId: await maxSuffix(Loan, "loanID"),
    applicantId: await maxSuffix(Applicant, "applicantID")
  };
  await Promise.all(
    Object.entries(seeds).map(([key, seq]) =>
      Counter.updateOne({ key }, { $setOnInsert: { seq } }, { upsert: true })
    )
  );
};
