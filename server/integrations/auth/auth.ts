import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import crypto from "crypto";
import { SiweMessage } from "siwe";
import { authStorage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  app.get("/api/config/walletconnect", (_req, res) => {
    res.json({ projectId: process.env.WALLETCONNECT_PROJECT_ID || "" });
  });

  app.get("/api/auth/nonce", (req, res) => {
    const nonce = crypto.randomBytes(16).toString("hex");
    (req.session as any).nonce = nonce;
    (req.session as any).nonceIssuedAt = Date.now();
    res.json({ nonce });
  });

  app.post("/api/auth/verify", async (req, res) => {
    try {
      const { message, signature } = req.body;
      if (!message || !signature) {
        return res.status(400).json({ message: "Missing message or signature" });
      }

      const siweMessage = new SiweMessage(message);
      const { data } = await siweMessage.verify({ signature });

      const expectedNonce = (req.session as any).nonce;
      const nonceIssuedAt = (req.session as any).nonceIssuedAt;

      if (!expectedNonce || data.nonce !== expectedNonce) {
        return res.status(422).json({ message: "Invalid nonce" });
      }

      const nonceAge = Date.now() - (nonceIssuedAt || 0);
      if (nonceAge > 5 * 60 * 1000) {
        delete (req.session as any).nonce;
        delete (req.session as any).nonceIssuedAt;
        return res.status(422).json({ message: "Nonce expired" });
      }

      delete (req.session as any).nonce;
      delete (req.session as any).nonceIssuedAt;

      const walletAddress = data.address.toLowerCase();

      if (!/^0x[a-fA-F0-9]{40}$/.test(data.address)) {
        return res.status(400).json({ message: "Invalid wallet address" });
      }

      const user = await authStorage.upsertUser({
        walletAddress,
      });

      (req.session as any).userId = user.id;
      (req.session as any).walletAddress = walletAddress;

      res.json(user);
    } catch (error) {
      console.error("SIWE verification error:", error);
      res.status(400).json({ message: "Signature verification failed" });
    }
  });

  app.post("/api/auth/wallet", async (req, res) => {
    try {
      const { address } = req.body;
      if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
        return res.status(400).json({ message: "Invalid wallet address" });
      }

      const walletAddress = address.toLowerCase();
      const user = await authStorage.upsertUser({ walletAddress });

      (req.session as any).userId = user.id;
      (req.session as any).walletAddress = walletAddress;

      res.json(user);
    } catch (error) {
      console.error("Wallet auth error:", error);
      res.status(500).json({ message: "Authentication failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};
