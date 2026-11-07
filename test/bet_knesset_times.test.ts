import { isIsraelDst } from '../src/lookupTimes';

describe('Israel DST calculation', () => {
  test('correctly identifies winter standard time (IST)', () => {
    expect(isIsraelDst('2026-11-07')).toBe(false);
    expect(isIsraelDst('2026-11-14')).toBe(false);
    expect(isIsraelDst('2026-01-15')).toBe(false);
  });

  test('correctly identifies summer daylight saving time (IDT)', () => {
    expect(isIsraelDst('2026-06-20')).toBe(true);
    expect(isIsraelDst('2026-08-15')).toBe(true);
  });

  test('correctly identifies transition boundaries in 2026', () => {
    expect(isIsraelDst('2026-03-21')).toBe(false);
    expect(isIsraelDst('2026-03-28')).toBe(true);
    expect(isIsraelDst('2026-10-24')).toBe(true);
    expect(isIsraelDst('2026-10-31')).toBe(false);
  });
});
