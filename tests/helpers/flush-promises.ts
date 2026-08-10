/**
 * flush-promises.ts
 * Shared test helper for the message handlers.
 *
 * A handler returns `true` synchronously to keep the message port open, then
 * awaits the session-storage-backed store before calling sendResponse. Drain the
 * microtask queue so assertions observe the response no matter how deep the
 * promise chain is.
 */
export const flushPromises = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
};
