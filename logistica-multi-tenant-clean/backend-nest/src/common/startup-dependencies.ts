export interface StartupDependency {
  name: string;
  check: () => Promise<void>;
}

export interface StartupDependencyOptions {
  maxAttempts?: number;
  retryDelayMs?: number;
  allowDegraded?: boolean;
  sleep?: (milliseconds: number) => Promise<void>;
  onAttemptFailure?: (name: string, attempt: number, error: unknown) => void;
  onDegraded?: (name: string, error: unknown) => void;
}

function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function readNonnegativeInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a nonnegative integer`);
  }
  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function verifyStartupDependencies(
  dependencies: StartupDependency[],
  options: StartupDependencyOptions = {},
): Promise<void> {
  const maxAttempts =
    options.maxAttempts ?? readPositiveInteger('STARTUP_MAX_ATTEMPTS', 5);
  const retryDelayMs =
    options.retryDelayMs ??
    readNonnegativeInteger('STARTUP_RETRY_DELAY_MS', 250);
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('STARTUP_MAX_ATTEMPTS must be a positive integer');
  }
  if (!Number.isSafeInteger(retryDelayMs) || retryDelayMs < 0) {
    throw new Error('STARTUP_RETRY_DELAY_MS must be a nonnegative integer');
  }
  const allowDegraded =
    options.allowDegraded ?? process.env.ALLOW_DEGRADED === 'true';
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

  for (const dependency of dependencies) {
    let lastError: unknown;
    let connected = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await dependency.check();
        connected = true;
        break;
      } catch (error) {
        lastError = error;
        options.onAttemptFailure?.(dependency.name, attempt, error);
        if (attempt < maxAttempts) {
          await sleep(retryDelayMs * 2 ** (attempt - 1));
        }
      }
    }

    if (!connected) {
      const failure = new Error(
        `Startup dependency "${dependency.name}" unavailable after ${maxAttempts} attempts: ${errorMessage(lastError)}`,
      );
      if (!allowDegraded) throw failure;
      options.onDegraded?.(dependency.name, failure);
    }
  }
}
