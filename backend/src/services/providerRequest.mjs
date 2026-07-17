const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function retryOnce(operation) {
  try {
    return await operation();
  } catch (error) {
    console.warn("[provider] retry", { nextAttempt: 2, message: error?.message || String(error) });
    await wait(150);
    return operation();
  }
}

// Retries transient failures once. Provider response bodies and secrets are
// deliberately excluded from these common logs.
export async function fetchWithRetry(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await globalThis.fetch(url, {
        ...options,
        signal: options.signal || AbortSignal.timeout(12_000),
      });
      if (response.ok || (response.status < 500 && response.status !== 429) || attempt === 2) {
        console.info(`[provider] ${response.ok ? "success" : "failure"}`, { status: response.status, attempt });
        return response;
      }
      lastError = Object.assign(new Error(`Provider returned ${response.status}`), { status: response.status });
    } catch (error) {
      lastError = error;
      console.error("[provider] failure", { attempt, message: error?.message || String(error) });
      if (attempt === 2 || options.signal?.aborted) throw error;
    }
    console.warn("[provider] retry", { nextAttempt: attempt + 1 });
    await wait(150);
  }
  throw lastError;
}
