/** Lightweight perf / debug logs for flicker diagnosis. */
const TAG = '[Catedral]';

export function perfLog(event: string, detail?: unknown) {
  if (detail !== undefined) {
    console.log(`${TAG} ${event}`, detail);
  } else {
    console.log(`${TAG} ${event}`);
  }
}

export function perfWarn(event: string, detail?: unknown) {
  if (detail !== undefined) {
    console.warn(`${TAG} ${event}`, detail);
  } else {
    console.warn(`${TAG} ${event}`);
  }
}
