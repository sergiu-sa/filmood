import {
  applyEra,
  applyTempo,
  mergeExtraKeywords,
} from '@/lib/moodRefinements';

describe('applyEra', () => {
  it('bounds each era window', () => {
    const classic: Record<string, string> = {};
    applyEra(classic, 'classic');
    expect(classic).toEqual({ 'primary_release_date.lte': '1989-12-31' });

    const modern: Record<string, string> = {};
    applyEra(modern, 'modern');
    expect(modern).toEqual({
      'primary_release_date.gte': '1990-01-01',
      'primary_release_date.lte': '2009-12-31',
    });

    const fresh: Record<string, string> = {};
    applyEra(fresh, 'fresh');
    expect(fresh).toEqual({ 'primary_release_date.gte': '2010-01-01' });
  });

  it('leaves params untouched when no era is chosen', () => {
    const p: Record<string, string> = { with_genres: '35' };
    applyEra(p, null);
    expect(p).toEqual({ with_genres: '35' });
  });

  // Era must not disturb a runtime filter — the two axes are independent.
  it('does not touch with_runtime', () => {
    const p: Record<string, string> = { 'with_runtime.gte': '120' };
    applyEra(p, 'classic');
    expect(p['with_runtime.gte']).toBe('120');
  });
});

describe('applyTempo', () => {
  // The delete is the load-bearing half: tempo overrides an existing runtime
  // bound rather than fighting it, so both bounds are never set at once.
  it('slow-burn clears an opposing upper bound before setting its lower one', () => {
    const p: Record<string, string> = { 'with_runtime.lte': '100' };
    applyTempo(p, 'slowburn');
    expect(p).toEqual({ 'with_runtime.gte': '120' });
  });

  it('fast-paced clears an opposing lower bound', () => {
    const p: Record<string, string> = { 'with_runtime.gte': '150' };
    applyTempo(p, 'fastpaced');
    expect(p).toEqual({ 'with_runtime.lte': '110' });
  });
});

describe('mergeExtraKeywords', () => {
  it('merges with existing keywords and dedupes', () => {
    const p: Record<string, string> = { with_keywords: '6054,180' };
    mergeExtraKeywords(p, [180, 9999]);
    expect(p.with_keywords).toBe('6054,180,9999');
  });

  it('sets keywords when none are present', () => {
    const p: Record<string, string> = {};
    mergeExtraKeywords(p, [1, 2]);
    expect(p.with_keywords).toBe('1,2');
  });

  it('is a no-op for an empty list', () => {
    const p: Record<string, string> = { with_keywords: '6054' };
    mergeExtraKeywords(p, []);
    expect(p.with_keywords).toBe('6054');
  });
});
