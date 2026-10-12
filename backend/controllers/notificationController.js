import Notification from "../models/Notifications.js";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { assertObjectId, buildPagination, cleanText, getPagination, pickEnum } from "../utils/helpers.js";
import { notifyMany } from "../utils/notificationHelper.js";

const NOTIFICATION_TYPES = Notification.schema.path("type").enumValues;

export const listNotifications = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { maxLimit: 50 });
  const filter = { userID: req.user.id };
  if (req.query.unread === "true") filter.read = false;
  const type = pickEnum(req.query.type, NOTIFICATION_TYPES, "type");
  if (type) filter.type = type;

  const [total, unreadCount, notifications] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.countDocuments({ userID: req.user.id, read: false }),
    Notification.find(filter).populate("relatedLoan", "loanNumber status").sort({ createdAt: -1 }).skip(skip).limit(limit)
  ]);
  res.json({ notifications, unreadCount, pagination: buildPagination(total, page, limit) });
};

export const markRead = async (req, res) => {
  assertObjectId(req.params.id, "notification ID");
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userID: req.user.id },
    { read: true, readAt: new Date() }
  );
  if (!notification) throw new AppError("Notification not found", 404);
  res.json({ message: "Notification marked as read" });
};

export const markAllRead = async (req, res) => {
  const result = await Notification.updateMany({ userID: req.user.id, read: false }, { read: true, readAt: new Date() });
  res.json({ message: "All notifications marked as read", updated: result.modifiedCount });
};

export const deleteNotification = async (req, res) => {
  assertObjectId(req.params.id, "notification ID");
  const notification = await Notification.findOneAndDelete({ _id: req.params.id, userID: req.user.id });
  if (!notification) throw new AppError("Notification not found", 404);
  res.json({ message: "Notification deleted" });
};

export const clearRead = async (req, res) => {
  const result = await Notification.deleteMany({ userID: req.user.id, read: true });
  res.json({ message: "Read notifications cleared", deleted: result.deletedCount });
};

export const broadcast = async (req, res) => {
  const title = cleanText(req.body.title);
  const message = cleanText(req.body.message);
  if (!title || !message) throw new AppError("title and message are required");
  const role = pickEnum(req.body.role, ["applicant", "officer", "admin"], "role");

  const filter = { isActive: true };
  if (role) filter.role = role;
  const users = await User.find(filter).select("_id");
  await notifyMany(users.map((user) => user._id), { title: title.slice(0, 200), message: message.slice(0, 1000), type: "announcement" });
  res.status(201).json({ message: "Announcement sent", recipients: users.length });
};
