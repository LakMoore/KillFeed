import { randomUUID } from "node:crypto";

interface WandererSetupSession {
  channelId: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

const SESSION_TTL_MS = 15 * 60 * 1000;

export class WandererSetupSessions {
  private static instance: WandererSetupSessions;

  private sessions = new Map<string, WandererSetupSession>();

  public static getInstance(): WandererSetupSessions {
    if (!WandererSetupSessions.instance) {
      WandererSetupSessions.instance = new WandererSetupSessions();
    }
    return WandererSetupSessions.instance;
  }

  public create(channelId: string, userId: string): string {
    this.cleanupExpired();

    const token = randomUUID();
    const now = Date.now();

    this.sessions.set(token, {
      channelId,
      userId,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });

    return token;
  }

  public validate(token: string, channelId: string, userId?: string): boolean {
    const session = this.get(token);
    return (
      !!session &&
      session.channelId === channelId &&
      (userId ? session.userId === userId : true)
    );
  }

  public consume(token: string): WandererSetupSession | undefined {
    this.cleanupExpired();

    const session = this.sessions.get(token);
    if (!session) {
      return undefined;
    }

    this.sessions.delete(token);
    return session;
  }

  private get(token: string): WandererSetupSession | undefined {
    this.cleanupExpired();
    return this.sessions.get(token);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(token);
      }
    }
  }
}
