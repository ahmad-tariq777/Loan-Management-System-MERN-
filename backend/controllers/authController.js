import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import validator from "validator";
import AuditLog from "../models/AuditLog.js";

const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000;

const issueTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m" }
  );
  const refreshToken = jwt.sign(
    { id: userId, role },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || "7d" }
  );
  return { accessToken, refreshToken };
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  const isProduction = process.env.NODE_ENV === "production";
  const sameSite = process.env.COOKIE_SAMESITE || (isProduction ? "strict" : "lax");
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProduction || sameSite === "none",
    sameSite,
    maxAge: 15 * 60 * 1000,
    path: "/",
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProduction || sameSite === "none",
    sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/auth/refresh",
  });
};

export const register = async (req, res) => {
  try {
    let { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    name = name.trim();
    email = email.trim().toLowerCase();

    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({ message: "Name must be between 2 and 100 characters" });
    }

    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[@#$!%&*^()]/.test(password)
    ) {
      return res.status(400).json({
        message: "Password must be at least 8 characters with uppercase, lowercase, number, and special character",
      });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 12);

    await User.create({
      name,
      email,
      password: hashedPassword,
      role: "applicant",
      loginAttempts: 0,
      isLocked: false,
    });

    res.status(201).json({ message: "Registration successful. You can now log in." });
  } catch (err) {
    console.error("register error:", err);
    res.status(500).json({ message: "Registration failed" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      "+password +refreshTokens"
    );
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    if (!user.isActive) {
      return res.status(403).json({ message: "Account has been deactivated" });
    }

    if (user.isLocked) {
      if (user.lockedAt && Date.now() - user.lockedAt.getTime() > LOCK_DURATION_MS) {
        user.isLocked = false;
        user.loginAttempts = 0;
        user.lockedAt = null;
        await user.save();
      } else {
        return res.status(403).json({
          message: "Account locked due to multiple failed attempts. Try again after 30 minutes.",
        });
      }
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      user.loginAttempts += 1;
      if (user.loginAttempts >= LOCK_THRESHOLD) {
        user.isLocked = true;
        user.lockedAt = new Date();
      }
      await user.save();

      await AuditLog.create({
        userID: user._id,
        action: "LOGIN_FAILED",
        resource: "auth",
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get("User-Agent"),
        success: false,
      });

      return res.status(401).json({ message: "Invalid credentials" });
    }

    user.loginAttempts = 0;
    user.isLocked = false;
    user.lockedAt = null;
    user.lastLogin = new Date();

    const { accessToken, refreshToken } = issueTokens(user._id, user.role);

    user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
    await user.save();

    setAuthCookies(res, accessToken, refreshToken);

    await AuditLog.create({
      userID: user._id,
      action: "LOGIN_SUCCESS",
      resource: "auth",
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      success: true,
    });

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
};

export const refreshTokenHandler = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ message: "Refresh token required" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    const user = await User.findById(decoded.id).select("+refreshTokens");
    if (!user || !user.refreshTokens.includes(token)) {
      return res.status(401).json({ message: "Refresh token revoked" });
    }

    if (!user.isActive || user.isLocked) {
      return res.status(403).json({ message: "Account is not accessible" });
    }

    const { accessToken, refreshToken: newRefreshToken } = issueTokens(user._id, user.role);

    user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
    user.refreshTokens.push(newRefreshToken);
    await user.save();

    setAuthCookies(res, accessToken, newRefreshToken);

    res.json({ message: "Tokens refreshed" });
  } catch (err) {
    console.error("refreshToken error:", err);
    res.status(500).json({ message: "Token refresh failed" });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;

    if (token) {
      const user = await User.findOne({ refreshTokens: token }).select("+refreshTokens");
      if (user) {
        user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
        await user.save();
      }
    }

    res.clearCookie("accessToken", { path: "/" });
    res.clearCookie("refreshToken", { path: "/api/auth/refresh" });

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("logout error:", err);
    res.status(500).json({ message: "Logout failed" });
  }
};

export const getMe = async (req, res) => {
  try {
    res.json(req.user);
  } catch (err) {
    console.error("getMe error:", err);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Both current and new passwords are required" });
    }

    if (
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword) ||
      !/[@#$!%&*^()]/.test(newPassword)
    ) {
      return res.status(400).json({ message: "New password does not meet complexity requirements" });
    }

    const user = await User.findById(req.user._id).select("+password +refreshTokens");
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ message: "Current password is incorrect" });

    user.password = await bcrypt.hash(newPassword, 12);
    user.refreshTokens = [];
    await user.save();

    res.clearCookie("accessToken", { path: "/" });
    res.clearCookie("refreshToken", { path: "/api/auth/refresh" });

    res.json({ message: "Password changed successfully. Please log in again." });
  } catch (err) {
    console.error("changePassword error:", err);
    res.status(500).json({ message: "Password change failed" });
  }
};