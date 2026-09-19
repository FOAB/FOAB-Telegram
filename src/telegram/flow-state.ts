/** Exact identity and group scope for a transient conversational flow. */
export interface FlowKey {
  readonly installationId: string;
  readonly telegramChatId: bigint;
  readonly userId: number;
}

/** The currently supported transient flow names. */
export type FlowName = 'settings' | 'welcome' | 'rules' | 'goodbye';

/**
 * Stores only active-flow markers in memory. No message content or credentials
 * enter this store, and a cancellation key includes installation, chat, and user.
 */
export class ActiveFlowStore {
  private readonly activeFlows = new Set<string>();

  /** Marks one exact user/chat flow as active. */
  public begin(key: FlowKey, flow: FlowName): void {
    this.activeFlows.add(serializeFlowKey(key, flow));
  }

  /** Returns whether the exact user/chat flow is active. */
  public has(key: FlowKey, flow: FlowName): boolean {
    return this.activeFlows.has(serializeFlowKey(key, flow));
  }

  /** Cancels only the exact user/chat flow and reports whether it existed. */
  public cancel(key: FlowKey, flow: FlowName): boolean {
    return this.activeFlows.delete(serializeFlowKey(key, flow));
  }
}

/** Serializes trusted typed identifiers without accepting user-supplied scope. */
function serializeFlowKey(key: FlowKey, flow: FlowName): string {
  return `${flow}:${key.installationId}:${key.telegramChatId.toString()}:${key.userId}`;
}
