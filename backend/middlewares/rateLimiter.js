import rateLimit from "express-rate-limit";

const shared = {
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  validate: { trustProxy: false, xForwardedForHeader: false }
};

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { message: "Too many login attempts, please try again after 15 minutes" },
  ...shared
});

export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: "Too many registration attempts, please try again later" },
  ...shared
});

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { message: "Too many requests, please slow down" },
  ...shared
});

export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { message: "Too many upload requests, please try again later" },
  ...shared
});
