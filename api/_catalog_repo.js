const OWNER = 'tanuct05-bot';
const REPO = 'moccnc';

function headers() {
  return { Authorization: 'Bearer ' + process.env.CATALOG_GH_TOKEN, Accept: 'application/vnd.github+json' };
}

async function ghGetFile(path) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, { headers: headers() });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Đọc ' + path + ' lỗi ' + r.status);
  return r.json();
}

async function ghPutFile(path, contentB64, message, sha) {
  const body = { message, content: contentB64, branch: 'master' };
  if (sha) body.sha = sha;
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) { let t = ''; try { t = (await r.json()).message || ''; } catch (e) {} throw new Error(path + ': ' + r.status + ' ' + t); }
  return r.json();
}

module.exports = { ghGetFile, ghPutFile };
