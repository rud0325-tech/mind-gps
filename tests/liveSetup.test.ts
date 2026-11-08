import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RULES_VERSION } from '../src/lib/liveSetupCheck';
import { missingIndexError, MissingIndexError } from '../src/lib/activityService';

test('the connection check probes the version the rules file actually allows', () => {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, new RegExp(`allow get: if version in \\[.*'${RULES_VERSION}'.*\\];`));
});

test('a missing-index error passes on only the Firebase console link', () => {
  const link = 'https://console.firebase.google.com/v1/r/project/p/firestore/indexes?create_composite=Abc123';
  const found = missingIndexError({ code: 'failed-precondition', message: `The query requires an index. You can create it here: ${link}` });
  assert.ok(found instanceof MissingIndexError);
  assert.equal(found.createUrl, link);
  assert.equal(missingIndexError({ code: 'failed-precondition', message: 'see https://example.com/steal' }), null);
  assert.equal(missingIndexError({ code: 'permission-denied', message: link }), null);
  assert.equal(missingIndexError(new Error(link)), null);
});
