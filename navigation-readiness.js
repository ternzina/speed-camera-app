// Retry only the transient Android Activity handoff, never billing, routing or
// permissions failures. The caller supplies cancellation when its screen closes.
export async function withNavigationWindow(operation, isActive, sleep = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  for (let attempt = 0; attempt < 6; attempt++) {
    if (!isActive()) throw new Error('navigationInactive');
    try { return await operation(); }
    catch (error) {
      if (error?.code !== 'noActivity' || attempt === 5) throw error;
      await sleep(200);
    }
  }
}
