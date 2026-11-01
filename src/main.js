/**
 * @fileoverview Entry-point shim — re-exports the boot promise from
 * src/app/main.js so existing import paths (index.html, tests) keep working.
 */
export { ready } from './app/main.js';
