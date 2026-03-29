import jwt from "jsonwebtoken";

import { config } from "../config";

export type AdminJwtPayload = {
  adminId: string;
  restaurantId: string;
  email: string;
};

export const signAdminToken = (payload: AdminJwtPayload) =>
  jwt.sign(payload, config.jwtSecret, {
    expiresIn: "7d",
  });

export const verifyAdminToken = (token: string) =>
  jwt.verify(token, config.jwtSecret) as AdminJwtPayload;
