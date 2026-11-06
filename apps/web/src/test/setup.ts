import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import i18n from '../i18n';

beforeAll(async () => {
  await i18n.changeLanguage('tr');
});

afterEach(() => {
  cleanup();
});
