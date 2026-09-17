import { describe, expect, it, vi } from 'vitest';

import { BUCKETS, warnOnBucketDrift } from './kommons_nodes';

describe('warnOnBucketDrift', () => {
  it('is silent when the server buckets match the client union', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    warnOnBucketDrift([...BUCKETS]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns when the server declares a bucket the client does not know', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    warnOnBucketDrift([...BUCKETS, 'kosmos']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('kosmos'));
    warn.mockRestore();
  });

  it('warns when the client has a bucket the server no longer sends', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    warnOnBucketDrift(BUCKETS.filter((b) => b !== 'hub'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('hub'));
    warn.mockRestore();
  });
});
