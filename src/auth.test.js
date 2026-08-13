import { describe, expect, it } from 'vitest';
import { authRedirectUrl } from './auth.js';

describe('Passwort-Reset-Weiterleitung', () => {
  it('behält eine öffentliche App-Adresse bei', () => {
    expect(authRedirectUrl({
      hostname: 'example.com', origin: 'https://example.com', pathname: '/app/',
    })).toBe('https://example.com/app/');
  });

  it('verschickt niemals eine vom iPhone unerreichbare lokale Adresse', () => {
    expect(authRedirectUrl({
      hostname: '127.0.0.1', origin: 'http://127.0.0.1:5174', pathname: '/',
    })).toBe('https://latissimus.github.io/nutrition-planner/');
  });
});
