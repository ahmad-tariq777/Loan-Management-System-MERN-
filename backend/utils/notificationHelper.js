import Notification from "../models/Notifications.js";

export const createNotification = async ({ userID, title, message, type, relatedLoan }) => {
  try {
    await Notification.create({ userID, title, message, type, relatedLoan });
  } catch (err) {
    console.error("Notification creation error:", err.message);
  }
};

export const notifyMany = async (userIDs, { title, message, type }) => {
  if (!userIDs.length) return;
  try {
    await Notification.insertMany(userIDs.map((userID) => ({ userID, title, message, type })));
  } catch (err) {
    console.error("Bulk notification error:", err.message);
  }
};
