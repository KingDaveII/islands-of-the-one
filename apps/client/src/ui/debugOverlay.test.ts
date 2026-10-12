import { describe, expect, it } from 'vitest';
import { WRIT_DEMO_TEXT, writDemoStates } from './debugOverlay.js';

describe('Writ demo', () => {
  it('shows emet and a Name; in the dark row only the aleph is dark, so emet reads as met', () => {
    expect(Array.from(WRIT_DEMO_TEXT.replace(/\s/g, ''))).toHaveLength(7);
    expect(writDemoStates('lit')).toEqual(Array<string>(7).fill('lit'));
    expect(writDemoStates('ember')).toEqual(Array<string>(7).fill('ember'));
    expect(writDemoStates('dark')).toEqual(['dark', 'lit', 'lit', 'dark', 'dark', 'dark', 'dark']);
  });
});
