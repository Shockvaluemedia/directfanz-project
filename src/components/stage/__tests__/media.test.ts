import { describeMedia, formatRuntime } from '../media';

const audio = { type: 'AUDIO', thumbnailUrl: null, duration: 200 };
const video = (duration: number | null, thumbnailUrl: string | null = null) => ({
  type: 'VIDEO',
  thumbnailUrl,
  duration,
});

describe('describeMedia', () => {
  it('calls one track a single and several a project', () => {
    expect(describeMedia([audio]).format).toBe('Single');
    expect(describeMedia([audio, audio]).format).toBe('Project');
    expect(describeMedia([audio]).kind).toBe('music');
  });

  it('treats any video as a video release and uses its poster', () => {
    const media = describeMedia([audio, video(600, 'poster.jpg')]);
    expect(media.kind).toBe('video');
    expect(media.poster).toBe('poster.jpg');
    expect(media.runtimeSeconds).toBe(600);
  });

  it('labels shorts, films, series and unknown runtimes', () => {
    expect(describeMedia([video(40 * 60)]).format).toBe('Short');
    expect(describeMedia([video(40 * 60 + 1)]).format).toBe('Film');
    expect(describeMedia([video(300), video(300)]).format).toBe('Series');
    expect(describeMedia([video(null)]).format).toBe('Video');
  });

  it('accepts lower-case content types', () => {
    expect(describeMedia([{ type: 'video', thumbnailUrl: null, duration: 90 }]).kind).toBe('video');
  });

  it('never exposes a preview it was not given', () => {
    expect(describeMedia([video(90, 'p.jpg')]).previewUrl).toBeNull();
  });
});

describe('formatRuntime', () => {
  it('formats minutes and hours', () => {
    expect(formatRuntime(754)).toBe('13 min');
    expect(formatRuntime(5520)).toBe('1 hr 32 min');
    expect(formatRuntime(3600)).toBe('1 hr');
    expect(formatRuntime(null)).toBeNull();
    expect(formatRuntime(0)).toBeNull();
  });
});
