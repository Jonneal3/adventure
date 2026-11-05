import { lookup } from 'node:dns/promises';
import https from 'node:https';
import ipaddr from 'ipaddr.js';

function text(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, ' ').trim().slice(0, 500);
}
function meta(html: string, name: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const tag = tags.find(value => new RegExp(`(?:name|property)=["']${name}["']`, 'i').test(value));
  return tag ? text(tag.match(/content=["']([^"']*)["']/i)?.[1] || '') : '';
}

export async function scanWebsite(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.port && url.port !== '443' || url.username || url.password || url.href.length > 2048) throw new Error('Enter a public HTTPS website');
  if (ipaddr.isValid(url.hostname) || !url.hostname.includes('.') || /\.(?:local|internal|test|invalid)$/i.test(url.hostname)) throw new Error('Enter a public website domain');
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(item => ipaddr.parse(item.address).range() !== 'unicast')) throw new Error('Website address is not public');
  const address = addresses[0];
  const html = await new Promise<string>((resolve, reject) => {
    const request = https.get(url, {
      timeout: 10000,
      headers: { Accept: 'text/html', 'User-Agent': 'AdventureSiteScan/1.0' },
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
    }, response => {
      if (response.statusCode !== 200 || !String(response.headers['content-type'] || '').includes('text/html')) { response.resume(); reject(new Error('Website did not return an HTML page')); return; }
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; if (body.length > 500_000) { request.destroy(new Error('Website page is too large')); } });
      response.on('end', () => resolve(body));
      response.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error('Website scan timed out')));
    request.on('error', reject);
  });
  const heading = text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const description = meta(html, 'description') || meta(html, 'og:description');
  const color = meta(html, 'theme-color');
  return { websiteUrl: url.origin, heading, description, accent: /^#[0-9a-f]{6}$/i.test(color) ? color : null };
}
