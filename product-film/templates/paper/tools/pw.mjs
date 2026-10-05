// Playwright for the film's ES-module scripts, from the film folder's pw.cjs (see its header for how it is found).
import { createRequire } from 'node:module';
export const { chromium } = createRequire(import.meta.url)('../pw.cjs');
