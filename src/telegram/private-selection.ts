/** Identity of a private conversation that is selecting a known group. */
export interface PrivateSelectionKey {
  readonly installationId: string;
  readonly privateChatId: number;
  readonly userId: number;
}

interface StoredSelection {
  readonly groupIds: readonly bigint[];
  readonly selectedGroupId?: bigint;
  readonly expiresAt: number;
}

/** Options for the short-lived, in-memory private group selection registry. */
export interface PrivateSelectionStoreOptions {
  readonly clock?: () => number;
  readonly ttlMs?: number;
}

/**
 * Binds a private user's numeric choices to a server-created group list.
 * Entries expire quickly and contain IDs only; group names remain in the database.
 */
export class PrivateGroupSelectionStore {
  private readonly selections = new Map<string, StoredSelection>();
  private readonly clock: () => number;
  private readonly ttlMs: number;

  public constructor(options: PrivateSelectionStoreOptions = {}) {
    this.clock = options.clock ?? (() => Date.now());
    this.ttlMs = options.ttlMs ?? 10 * 60 * 1_000;
    if (!Number.isSafeInteger(this.ttlMs) || this.ttlMs < 1_000 || this.ttlMs > 60 * 60 * 1_000) {
      throw new RangeError('Private selection TTL must be between one second and one hour.');
    }
  }

  /** Stores a bounded list of server-owned group IDs for one private user. */
  public set(key: PrivateSelectionKey, groupIds: readonly bigint[]): void {
    if (groupIds.length === 0 || groupIds.length > 100) {
      throw new RangeError('Private group selections must contain between 1 and 100 groups.');
    }
    this.selections.set(serializeKey(key), {
      groupIds: [...groupIds],
      expiresAt: this.clock() + this.ttlMs,
    });
  }

  /** Resolves a one-based user choice to an ID from the previously stored list. */
  public resolve(key: PrivateSelectionKey, index: number): bigint | null {
    const selection = this.getValidSelection(key);
    if (!selection || !Number.isSafeInteger(index) || index < 1 || index > selection.groupIds.length) {
      return null;
    }
    return selection.groupIds[index - 1] ?? null;
  }

  /** Stores one explicit list choice as the target for subsequent private commands. */
  public select(key: PrivateSelectionKey, index: number): bigint | null {
    const groupId = this.resolve(key, index);
    if (groupId === null) {
      return null;
    }
    const selection = this.getValidSelection(key);
    if (!selection) {
      return null;
    }
    this.selections.set(serializeKey(key), {
      ...selection,
      selectedGroupId: groupId,
      expiresAt: this.clock() + this.ttlMs,
    });
    return groupId;
  }

  /** Returns the selected server-owned group for subsequent private commands. */
  public resolveSelected(key: PrivateSelectionKey): bigint | null {
    return this.getValidSelection(key)?.selectedGroupId ?? null;
  }

  /** Reports whether the private conversation has a still-valid selection flow. */
  public has(key: PrivateSelectionKey): boolean {
    return this.getValidSelection(key) !== null;
  }

  /** Removes a private selection flow and reports whether one existed. */
  public clear(key: PrivateSelectionKey): boolean {
    this.getValidSelection(key);
    return this.selections.delete(serializeKey(key));
  }

  private getValidSelection(key: PrivateSelectionKey): StoredSelection | null {
    const serializedKey = serializeKey(key);
    const selection = this.selections.get(serializedKey);
    if (!selection) {
      return null;
    }
    if (selection.expiresAt <= this.clock()) {
      this.selections.delete(serializedKey);
      return null;
    }
    return selection;
  }
}

/** Serializes only server-resolved identity fields for the in-memory key. */
function serializeKey(key: PrivateSelectionKey): string {
  return `${key.installationId}:${key.privateChatId}:${key.userId}`;
}
