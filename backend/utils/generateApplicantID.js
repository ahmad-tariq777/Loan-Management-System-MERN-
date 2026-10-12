import { nextSequence } from "./sequence.js";
import { formatId } from "./helpers.js";

export const generateApplicantID = async () => formatId("APP", await nextSequence("applicantId"), 6);
