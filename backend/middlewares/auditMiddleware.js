import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";

export const auditLog = (action, resource) => (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (req.user?.id) {
      const candidate = req.params?.id || req.params?.loanId || req.params?.userId;
      AuditLog.create({
        userID: req.user.id,
        action,
        resource,
        resourceId: mongoose.Types.ObjectId.isValid(candidate) ? candidate : undefined,
        details: { method: req.method, path: req.originalUrl.split("?")[0], message: body?.message },
        ip: req.ip || req.socket?.remoteAddress || "unknown",
        userAgent: req.get("User-Agent"),
        success: res.statusCode < 400
      }).catch((err) => console.error("Audit log error:", err.message));
    }
    return originalJson(body);
  };

  next();
};
