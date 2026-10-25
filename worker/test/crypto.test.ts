import { describe, expect, it } from 'vitest';
import { open, seal } from '../src/crypto';

const KEY = 'ab'.repeat(32);

describe('token sealing', () => {
  it('round-trips and never stores plain text', async () => {
    const sealed = await seal(KEY, 'secret-token');
    expect(sealed).not.toContain('secret-token');
    expect(await open(KEY, sealed)).toBe('secret-token');
  });
  it('fails with the wrong key', async () => {
    const sealed = await seal(KEY, 'x');
    await expect(open('cd'.repeat(32), sealed)).rejects.toThrow();
  });
});
