import { NextFunction, Request, Response } from "express";

import { verifyAdminToken } from "../lib/token";

export const requireAdminAuth = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ message: "Missing bearer token" });
    return;
  }

  try {
    req.auth = verifyAdminToken(token);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};
