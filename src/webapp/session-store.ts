import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_TTL_MS = 60 * 60 * 1_000;
const SESSION_IDLE_TTL_MS = 15 * 60 * 1_000;
const TOKEN_BYTES = 32;
const MAX_SESSIONS = 10_000;

/** Identity retained by a server-side Mini App session. */
export interface WebAppSessionUser {
  readonly id: number;
  readonly languageCode: string | null;
}

/** A session record that never contains the raw cookie or CSRF token. */
export interface WebAppSession {
  readonly sessionTokenHash: string;
  readonly csrfTokenHash: Buffer;
  readonly user: WebAppSessionUser;
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  readonly expiresAt: Date;
}

/** Raw values returned once to the HTTP layer when a session is created. */
export interface CreatedWebAppSession {
  readonly sessionToken: string;
  readonly csrfToken: string;
  readonly session: WebAppSession;
}

/**
 * Short-lived in-memory session storage for the first Mini App API slice.
 *
 * Raw tokens are returned only at creation time. Restarting the process revokes
 * all sessions; durable server-side storage can replace this class behind the
 * same route contract before a multi-instance deployment.
 */
export class WebAppSessionStore {
  private readonly sessions = new Map<string, WebAppSession>();

  /** Creates a bounded session with an absolute and idle expiration. */
  public create(user: WebAppSessionUser, now = new Date()): CreatedWebAppSession {
    this.removeExpired(now);
    if (this.sessions.size >= MAX_SESSIONS) {
      throw new Error('Web App session capacity has been reached.');
    }

    const sessionToken = randomBytes(TOKEN_BYTES).toString('base64url');
    const csrfToken = randomBytes(TOKEN_BYTES).toString('base64url');
    const session: WebAppSession = {
      sessionTokenHash: hashToken(sessionToken),
      csrfTokenHash: hashTokenBytes(csrfToken),
      user: { id: user.id, languageCode: user.languageCode },
      createdAt: new Date(now.getTime()),
      lastSeenAt: new Date(now.getTime()),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    };
    this.sessions.set(session.sessionTokenHash, session);

    return { sessionToken, csrfToken, session };
  }

  /** Returns a live session and refreshes its bounded idle window. */
  public get(sessionToken: string, now = new Date()): WebAppSession | null {
    const sessionHash = safeTokenHash(sessionToken);
    if (!sessionHash) {
      return null;
    }

    const session = this.sessions.get(sessionHash);
    if (!session || isExpired(session, now)) {
      if (session) {
        this.sessions.delete(sessionHash);
      }
      return null;
    }

    const touched: WebAppSession = {
      ...session,
      lastSeenAt: new Date(now.getTime()),
    };
    this.sessions.set(sessionHash, touched);
    return touched;
  }

  /** Checks the CSRF secret against the already-authenticated session. */
  public validateCsrf(
    session: WebAppSession,
    csrfToken: string,
  ): boolean {
    const suppliedHash = safeTokenHashBytes(csrfToken);
    if (!suppliedHash || suppliedHash.length !== session.csrfTokenHash.length) {
      return false;
    }
    return timingSafeEqual(suppliedHash, session.csrfTokenHash);
  }

  /** Revokes one session by its opaque cookie value. */
  public revoke(sessionToken: string): void {
    const sessionHash = safeTokenHash(sessionToken);
    if (sessionHash) {
      this.sessions.delete(sessionHash);
    }
  }

  /** Exposes only the number of active records for bounded synthetic tests. */
  public size(now = new Date()): number {
    this.removeExpired(now);
    return this.sessions.size;
  }

  private removeExpired(now: Date): void {
    for (const [sessionHash, session] of this.sessions) {
      if (isExpired(session, now)) {
        this.sessions.delete(sessionHash);
      }
    }
  }
}

/** Uses both absolute and idle limits, whichever expires first. */
function isExpired(session: WebAppSession, now: Date): boolean {
  return (
    now.getTime() >= session.expiresAt.getTime() ||
    now.getTime() - session.lastSeenAt.getTime() > SESSION_IDLE_TTL_MS
  );
}

/** Hashes an opaque token into the map key without retaining the token itself. */
function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Returns a fixed-size digest for constant-time CSRF comparison. */
function hashTokenBytes(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

/** Rejects malformed or oversized cookie input before hashing it. */
function safeTokenHash(token: string): string | null {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(token)) {
    return null;
  }
  return hashToken(token);
}

/** Rejects malformed or oversized CSRF input before hashing it. */
function safeTokenHashBytes(token: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(token)) {
    return null;
  }
  return hashTokenBytes(token);
}
