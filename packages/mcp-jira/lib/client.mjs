export function createClient(credentials, fetchFn = fetch) {
  const baseUrl = `https://${credentials.domain}.atlassian.net`;
  const auth = Buffer.from(`${credentials.email}:${credentials.token}`).toString('base64');

  async function jira(method, path, body) {
    const isAgile = path.startsWith('/rest/agile/');
    const url = isAgile ? `${baseUrl}${path}` : `${baseUrl}/rest/api/3${path}`;
    const res = await fetchFn(url, {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Jira API ${res.status}: ${err}`);
    }
    if (res.status === 204) return {};
    return res.json();
  }

  return { jira };
}

export function extractAdfText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  if (Array.isArray(node.content)) {
    return node.content.map(extractAdfText).join('');
  }
  if (Array.isArray(node)) {
    return node.map(extractAdfText).join('\n');
  }
  return '';
}

export function toAdf(text) {
  return {
    type: 'doc',
    version: 1,
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text: text || '' }]
    }]
  };
}
