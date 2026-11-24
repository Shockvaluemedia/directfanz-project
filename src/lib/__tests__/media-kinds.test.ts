import {
  formatRuntime,
  isKindForType,
  kindFromMetadata,
  kindsForType,
  suggestKind,
} from '@/lib/media-kinds';
import { parseStoredTags } from '@/lib/content-tags';

describe('media kinds', () => {
  it('offers music kinds for audio and creative video kinds for video', () => {
    expect(Object.keys(kindsForType('AUDIO'))).toEqual(expect.arrayContaining(['SINGLE', 'PROJECT_TRACK']));
    expect(Object.keys(kindsForType('VIDEO'))).toEqual(
      expect.arrayContaining(['SHORT', 'MUSIC_VIDEO', 'DOCUMENTARY', 'FILM', 'EPISODE'])
    );
    expect(kindsForType('IMAGE')).toEqual({});
  });

  it('only accepts a kind that fits the content type', () => {
    expect(isKindForType('DOCUMENTARY', 'VIDEO')).toBe(true);
    expect(isKindForType('DOCUMENTARY', 'AUDIO')).toBe(false);
    expect(isKindForType('SINGLE', 'AUDIO')).toBe(true);
    expect(isKindForType('toString', 'VIDEO')).toBe(false);
    expect(isKindForType(undefined, 'VIDEO')).toBe(false);
  });

  it('suggests shorts and films from length, and leaves the middle to the artist', () => {
    expect(suggestKind('VIDEO', 45)).toBe('SHORT');
    expect(suggestKind('VIDEO', 95 * 60)).toBe('FILM');
    expect(suggestKind('VIDEO', 12 * 60)).toBeUndefined();
    expect(suggestKind('VIDEO', undefined)).toBeUndefined();
    expect(suggestKind('AUDIO', 200)).toBe('SINGLE');
    expect(suggestKind('IMAGE', 0)).toBeUndefined();
  });

  it('reads the kind from metadata JSON and ignores anything else', () => {
    expect(kindFromMetadata('{"kind":"FILM","moderation":{}}', 'VIDEO')).toBe('FILM');
    expect(kindFromMetadata('{"kind":"FILM"}', 'AUDIO')).toBeNull();
    expect(kindFromMetadata('not json', 'VIDEO')).toBeNull();
    expect(kindFromMetadata(null, 'VIDEO')).toBeNull();
  });

  it('formats runtimes for short and long releases', () => {
    expect(formatRuntime(247)).toBe('4:07');
    expect(formatRuntime(3725)).toBe('1:02:05');
    expect(formatRuntime(0)).toBeNull();
    expect(formatRuntime(undefined)).toBeNull();
  });
});

describe('stored tags', () => {
  it('reads JSON arrays, comma lists and empty values', () => {
    expect(parseStoredTags('["live","doc"]')).toEqual(['live', 'doc']);
    expect(parseStoredTags('live, doc,')).toEqual(['live', 'doc']);
    expect(parseStoredTags('')).toEqual([]);
    expect(parseStoredTags(null)).toEqual([]);
    expect(parseStoredTags('[1,"a"]')).toEqual(['a']);
  });
});
