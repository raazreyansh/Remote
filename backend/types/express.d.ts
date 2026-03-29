import type { AdminJwtPayload } from "../src/lib/token";

declare global {
  namespace Express {
    interface Request {
      auth?: AdminJwtPayload;
    }
  }
}

export {};
