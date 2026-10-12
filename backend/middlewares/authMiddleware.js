import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken;
    if (!token) return res.status(401).json({ message: "Authentication required" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token expired", code: "TOKEN_EXPIRED" });
      }
      return res.status(401).json({ message: "Invalid token" });
    }

    const user = await User.findById(decoded.id).select("-password -refreshTokens");
    if (!user) return res.status(401).json({ message: "User not found" });
    if (!user.isActive) return res.status(403).json({ message: "Account deactivated" });
    if (user.isLocked) return res.status(403).json({ message: "Account is locked" });

    req.user = user;
    next();
  } catch (err) {
    console.error("authMiddleware error:", err);
    res.status(401).json({ message: "Authentication failed" });
  }
};

export const roleMiddleware = (roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (!roles.includes(req.user.role)) return res.status(403).json({ message: "Access denied" });
  next();
};

export const officerMiddleware = roleMiddleware(["officer", "admin"]);
export const adminMiddleware = roleMiddleware(["admin"]);