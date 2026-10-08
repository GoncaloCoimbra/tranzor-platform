import { verifyStartupDependencies } from './startup-dependencies';

describe('verifyStartupDependencies', () => {
  it('continues when a dependency responds', async () => {
    const check = jest.fn().mockResolvedValue(undefined);
    await expect(
      verifyStartupDependencies([{ name: 'database', check }], {
        maxAttempts: 3,
        retryDelayMs: 0,
        allowDegraded: false,
      }),
    ).resolves.toBeUndefined();
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('fails after the configured attempts', async () => {
    const check = jest.fn().mockRejectedValue(new Error('connection refused'));
    await expect(
      verifyStartupDependencies([{ name: 'database', check }], {
        maxAttempts: 3,
        retryDelayMs: 0,
      }),
    ).rejects.toThrow(
      'database" unavailable after 3 attempts: connection refused',
    );
    expect(check).toHaveBeenCalledTimes(3);
  });

  it('retries with exponential backoff until a dependency responds', async () => {
    const check = jest
      .fn()
      .mockRejectedValueOnce(new Error('starting'))
      .mockRejectedValueOnce(new Error('starting'))
      .mockResolvedValueOnce(undefined);
    const sleep = jest.fn().mockResolvedValue(undefined);
    await verifyStartupDependencies([{ name: 'redis', check }], {
      maxAttempts: 3,
      retryDelayMs: 5,
      sleep,
      allowDegraded: false,
    });
    expect(check).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[5], [10]]);
  });

  it('continues with an explicit degraded-mode warning after failure', async () => {
    const check = jest.fn().mockRejectedValue(new Error('unavailable'));
    const onDegraded = jest.fn();
    await expect(
      verifyStartupDependencies([{ name: 'redis', check }], {
        maxAttempts: 2,
        retryDelayMs: 0,
        allowDegraded: true,
        onDegraded,
      }),
    ).resolves.toBeUndefined();
    expect(check).toHaveBeenCalledTimes(2);
    expect(onDegraded).toHaveBeenCalledWith('redis', expect.any(Error));
  });
});
