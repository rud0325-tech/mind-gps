import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isFirebaseConfigured } from '../src/lib/firebase';
import { DATA_MODE, GOOGLE_SCRIPT_URL } from '../src/lib/runtimeConfig';

const json = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

// The public edition must never ship with a school's live Firebase project or alert endpoint.
test('the public edition defaults to demo and carries no live connection', () => {
  assert.equal(json('../app-mode.json').dataMode, 'demo');
  for (const value of Object.values(json('../firebase-applet-config.json'))) assert.equal(value, '');
  assert.equal(isFirebaseConfigured, false);
  assert.equal(json('../.firebaserc').projects.default, 'your-firebase-project-id');
  assert.equal(json('../services/apps-script/deployment.json').webAppUrl, '');
  assert.equal(DATA_MODE, 'demo');
  assert.equal(GOOGLE_SCRIPT_URL, '');
});
