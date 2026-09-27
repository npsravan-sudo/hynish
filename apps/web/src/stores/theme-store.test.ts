import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from './theme-store';

describe('theme-store', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
  });

  it('applies dark mode to the document and persists the preference', () => {
    useThemeStore.getState().setMode('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('hynish:theme')).toBe('dark');
    expect(useThemeStore.getState().resolved).toBe('dark');
  });

  it('switches back to light', () => {
    useThemeStore.getState().setMode('dark');
    useThemeStore.getState().setMode('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(useThemeStore.getState().resolved).toBe('light');
  });

  it('resolves system mode from the OS preference (stubbed false -> light)', () => {
    useThemeStore.getState().setMode('system');
    expect(useThemeStore.getState().mode).toBe('system');
    expect(useThemeStore.getState().resolved).toBe('light');
  });
});
