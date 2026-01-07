import { setTimeout } from "node:timers/promises";

const MIN_SPINNER_TIME = 500; // Minimum time to show spinner state (ms)

/**
 * Run an async operation with minimum display time for the spinner
 * Ensures UI feedback is visible even for fast operations
 */
export async function withMinTime<T>(promise: Promise<T>, minTime = MIN_SPINNER_TIME): Promise<T> {
    const [result] = await Promise.all([promise, setTimeout(minTime)]);
    return result;
}
