// waits for each poll to finish before scheduling the next, so a slow network never stacks requests
export function pollEvery(intervalMs: number, poll: (signal: AbortSignal) => Promise<void>) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = async () => {
    await poll(controller.signal);
    if (!controller.signal.aborted) timer = setTimeout(run, intervalMs);
  };
  void run();

  return function stop() {
    controller.abort();
    clearTimeout(timer);
  };
}
