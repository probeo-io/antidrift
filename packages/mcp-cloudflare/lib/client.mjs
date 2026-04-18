export function createClient(credentials, fetchFn = fetch) {
  async function cf(method, path, body) {
    const res = await fetchFn(`https://api.cloudflare.com/client/v4${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${credentials.token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Cloudflare API ${res.status}: ${err}`);
    }
    const json = await res.json();
    if (!json.success) throw new Error(json.errors?.[0]?.message || 'Unknown error');
    return json;
  }

  return { cf };
}
