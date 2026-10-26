import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone } from './phone.js';
import { render } from './template.js';
import { classifySendRejection, classifyHttpError, classifyDeliveryFailure } from './errors.js';

test('normalizePhone', () => {
  assert.equal(normalizePhone('555 12 34 56'), '995555123456');
  assert.equal(normalizePhone('+995 555 123 456'), '995555123456');
  assert.equal(normalizePhone('00995555123456'), '995555123456');
  assert.equal(normalizePhone('12345'), null);
  assert.equal(normalizePhone(''), null);
});

test('render', () => {
  assert.deepEqual(render('გამარჯობა {{name}}!', { name: ' გიო ' }), { text: 'გამარჯობა გიო!' });
  assert.deepEqual(render('{{a}} {{b}}', { a: '1' }), { missing: ['b'] });
});

test('error classification', () => {
  assert.equal(classifySendRejection({ code: 'INVALID_PHONE_NUMBER' }), 'PERMANENT');
  assert.equal(classifySendRejection({ code: 'X', retryable: true }), 'TEMPORARY');
  assert.equal(classifySendRejection({ code: 'X', retryable: false }), 'PERMANENT');
  assert.equal(classifyHttpError(401, null), 'CONFIG');
  assert.equal(classifyHttpError(429, 'RATE_LIMITED'), 'THROTTLED');
  assert.equal(classifyHttpError(500, 'INTERNAL_ERROR'), 'TEMPORARY');
  assert.equal(classifyHttpError(400, 'VALIDATION_FAILED'), 'PERMANENT');
  assert.equal(classifyDeliveryFailure('EXPIRED', null), 'TEMPORARY');
  assert.equal(classifyDeliveryFailure('FAILED', 'INVALID_DESTINATION'), 'PERMANENT');
  assert.equal(classifyDeliveryFailure('FAILED', 'SUBSCRIBER_ABSENT'), 'TEMPORARY');
});
