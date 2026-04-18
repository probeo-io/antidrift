const API = 'https://api.github.com';

export function createClient(credentials, fetchFn = fetch) {
  const headers = {
    'Authorization': `Bearer ${credentials.token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  async function gh(method, path, body) {
    const opts = { method, headers: { ...headers } };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetchFn(`${API}${path}`, opts);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GitHub API ${res.status}: ${err}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  }

  async function ghRaw(path) {
    const res = await fetchFn(`${API}${path}`, { headers });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GitHub API ${res.status}: ${err}`);
    }
    return res.text();
  }

  return { gh, ghRaw };
}

export function fmtRepo(r) {
  let line = `📦 ${r.full_name}`;
  if (r.description) line += ` — ${r.description}`;
  line += `  [⭐ ${r.stargazers_count}] [🔀 ${r.forks_count}]`;
  if (r.language) line += `  [${r.language}]`;
  return line;
}

export function fmtIssue(i) {
  const labels = i.labels?.map(l => l.name).join(', ') || '';
  let line = `#${i.number} ${i.state === 'open' ? '🟢' : '🔴'} ${i.title}`;
  if (labels) line += `  [${labels}]`;
  line += `  by ${i.user?.login || '?'}`;
  return line;
}

export function fmtPR(p) {
  let line = `#${p.number} ${p.state === 'open' ? '🟢' : p.merged_at ? '🟣' : '🔴'} ${p.title}`;
  line += `  ${p.head?.ref || '?'} → ${p.base?.ref || '?'}`;
  line += `  by ${p.user?.login || '?'}`;
  return line;
}
