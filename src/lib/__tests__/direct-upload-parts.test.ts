import { PART_ATTEMPTS, PART_LINK_REFRESH_MS, uploadParts, type PartUploadDeps } from '@/lib/direct-upload';

const PART = 10;

function plan(partCount: number) {
  return {
    uploadId: 'up-1',
    partSize: PART,
    parts: Array.from({ length: partCount }, (_, i) => ({ partNumber: i + 1, url: `old-${i + 1}` })),
  };
}

function fakeDeps(overrides: Partial<PartUploadDeps> = {}) {
  let clock = 0;
  const signed: number[][] = [];
  const puts: string[] = [];
  const deps: PartUploadDeps = {
    now: () => clock,
    signParts: jest.fn(async (numbers: number[]) => {
      signed.push(numbers);
      return numbers.map(n => ({ partNumber: n, url: `new-${n}` }));
    }),
    putPart: jest.fn(async (url: string, body: Blob, onProgress: (n: number) => void) => {
      puts.push(url);
      onProgress(body.size);
      return `"etag-${url}"`;
    }),
    ...overrides,
  };
  return { deps, signed, puts, advance: (ms: number) => (clock += ms) };
}

describe('multipart upload of long videos', () => {
  it('sends every part with the links it was given while they are fresh', async () => {
    const { deps, signed, puts } = fakeDeps();
    const file = new Blob([new Uint8Array(35)]);
    const parts = await uploadParts(file, plan(4), deps);
    expect(parts.map(p => p.partNumber)).toEqual([1, 2, 3, 4]);
    expect(puts.sort()).toEqual(['old-1', 'old-2', 'old-3', 'old-4']);
    expect(signed).toEqual([]);
  });

  it('re-signs links once they are old, batching the queued parts', async () => {
    const harness = fakeDeps();
    harness.deps.putPart = jest.fn(async (url: string) => {
      harness.puts.push(url);
      harness.advance(PART_LINK_REFRESH_MS / 2 + 1);
      return `"etag-${url}"`;
    });
    const file = new Blob([new Uint8Array(60)]);
    const parts = await uploadParts(file, plan(6), harness.deps);
    expect(parts).toHaveLength(6);
    expect(harness.signed.length).toBeGreaterThan(0);
    expect(harness.puts.some(url => url.startsWith('new-'))).toBe(true);
    // Each refresh covers the part being sent plus parts still waiting.
    expect(harness.signed.some(batch => batch.length > 1)).toBe(true);
  });

  it('retries a failed part with a fresh link', async () => {
    const harness = fakeDeps();
    let failures = 0;
    harness.deps.putPart = jest.fn(async (url: string) => {
      harness.puts.push(url);
      if (url === 'old-2' && failures++ === 0) throw new Error('Upload to storage failed (HTTP 403)');
      return `"etag-${url}"`;
    });
    const parts = await uploadParts(new Blob([new Uint8Array(20)]), plan(2), harness.deps);
    expect(parts.find(p => p.partNumber === 2)?.etag).toBe('"etag-new-2"');
    expect(harness.signed[0][0]).toBe(2);
  });

  it(`gives up on a part after ${PART_ATTEMPTS} tries`, async () => {
    const harness = fakeDeps();
    harness.deps.putPart = jest.fn(async () => {
      throw new Error('Network error during upload');
    });
    await expect(uploadParts(new Blob([new Uint8Array(5)]), plan(1), harness.deps)).rejects.toThrow(/Network/);
    expect(harness.deps.putPart).toHaveBeenCalledTimes(PART_ATTEMPTS);
  });

  it('does not retry when storage hides the ETag (a CORS setup problem)', async () => {
    const harness = fakeDeps();
    harness.deps.putPart = jest.fn(async () => null);
    await expect(uploadParts(new Blob([new Uint8Array(5)]), plan(1), harness.deps)).rejects.toThrow(/ETag/);
    expect(harness.deps.putPart).toHaveBeenCalledTimes(1);
  });
});
