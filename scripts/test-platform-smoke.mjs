#!/usr/bin/env node
// Run only against a disposable Adventure staging account and database.
import assert from 'node:assert/strict';

const base = process.env.ADVENTURE_SMOKE_API_URL || 'http://127.0.0.1:3200/api';
const origin = process.env.ADVENTURE_SMOKE_ORIGIN || 'http://localhost:3000';
let cookie = '';
async function call(path, method = 'GET', body, token) {
  const response = await fetch(base + path, { method, headers: { origin, ...(cookie ? { cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { 'x-adventure-project-token': token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const value = await response.json().catch(() => ({}));
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  return { status: response.status, value };
}
function okay(result, status = 200) { assert.equal(result.status, status, JSON.stringify(result)); return result.value; }
const email = process.env.ADVENTURE_SMOKE_EMAIL;
const password = process.env.ADVENTURE_SMOKE_PASSWORD;
if (email && password) okay(await call('/auth/sign-in/email', 'POST', { email, password }));
else okay(await call('/auth/sign-up/email', 'POST', { name: 'Adventure staging smoke', email: `smoke-${crypto.randomUUID()}@example.test`, password: 'disposable-test-password-12345' }));
okay(await call('/me'));
const industries = okay(await call('/industries'));
assert.ok(Array.isArray(industries) && industries.length, 'A service industry is required');
const industryId = industries[0].id;
const accountId = okay(await call('/accounts', 'POST', { name: `Staging smoke ${Date.now()}` }), 201).id;
const serviceId = okay(await call(`/accounts/${accountId}/services`, 'POST', { industryId, name: 'Disposable custom service', range: { currency: 'USD', minCents: 10000, maxCents: 50000, source: 'owner' } }), 201).id;
const created = okay(await call(`/accounts/${accountId}/instances`, 'POST', { name: 'Disposable experience', industryId, serviceIds: [serviceId] }), 201);
assert.equal(created.publishable, true);
const instanceId = created.instanceId;
const config = okay(await call(`/adventure/${instanceId}`));
assert.ok(!('priceRanges' in config.experience), 'Public config leaked hidden prices');
const project = okay(await call(`/adventure/${instanceId}/projects`, 'POST', {}), 201);
const path = `/adventure/${instanceId}/projects/${project.projectId}`;
okay(await call(`${path}/answers`, 'PATCH', { serviceId, answers: {} }, project.token));
okay(await call(`${path}/answers`, 'PATCH', { serviceId, answers: {} }, project.token));
const billing = okay(await call(`/billing/${accountId}`));
assert.equal(billing.engagementsUsed, 1, 'Duplicate first step metered twice');
const revealed = okay(await call(`${path}/contact`, 'POST', { email: 'visitor@example.test', phone: '5555551212' }, project.token), 201);
assert.equal(revealed.range.minCents, 10000);
okay(await call(`${path}/quote`, 'POST', { note: 'Disposable fixture' }, project.token), 201);
const draft = okay(await call(`/instances/${instanceId}/experience`)).draft;
draft.priceRanges[serviceId] = { currency: 'USD', minCents: 20000, maxCents: 60000, source: 'owner' };
draft.elements.splice(1, 0, { id: 'smoke_tryon', kind: 'visual', label: 'Try on the item', required: false, serviceIds: [serviceId], options: [], visualJob: 'tryon' });
okay(await call(`/instances/${instanceId}/experience`, 'PATCH', draft));
okay(await call(`/instances/${instanceId}/publish`, 'POST', {}), 201);
const resumed = okay(await call(path, 'GET', undefined, project.token));
assert.equal(resumed.revealedRange.minCents, 10000, 'Published edit changed an in-progress price snapshot');
const updated = okay(await call(`/adventure/${instanceId}`));
assert.ok(updated.experience.elements.some(element => element.visualJob === 'tryon'));
const preview = okay(await call(`/instances/${instanceId}/preview-link`));
const previewToken = new URL(preview.url).searchParams.get('preview');
const previewProject = okay(await call(`/adventure/${instanceId}/projects`, 'POST', { previewToken }), 201);
okay(await call(`/adventure/${instanceId}/projects/${previewProject.projectId}/answers`, 'PATCH', { serviceId, answers: {} }, previewProject.token));
assert.equal(okay(await call(`/billing/${accountId}`)).engagementsUsed, 1, 'Owner preview metered as a customer');
cookie = '';
if (email && password) {
  const otherEmail = process.env.ADVENTURE_SMOKE_OTHER_EMAIL;
  const otherPassword = process.env.ADVENTURE_SMOKE_OTHER_PASSWORD;
  if (!otherEmail || !otherPassword) throw new Error('A second disposable account is required for the account-isolation check');
  okay(await call('/auth/sign-in/email', 'POST', { email: otherEmail, password: otherPassword }));
} else okay(await call('/auth/sign-up/email', 'POST', { name: 'Other smoke owner', email: `other-${crypto.randomUUID()}@example.test`, password: 'disposable-test-password-12345' }));
assert.equal((await call(`/instances/${instanceId}/experience`)).status, 403, 'Cross-account experience was accessible');
console.log(JSON.stringify({ ok: true, accountId, instanceId, checks: ['signup', 'custom service', 'nonvisual publish', 'project', 'idempotent engagement', 'contact gate', 'price snapshot', 'tryon configuration', 'free preview', 'account isolation'] }));
