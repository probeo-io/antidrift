export function createClient(credentials, fetchFn = fetch) {
  async function vc(method, path, body) {
    const res = await fetchFn(`https://api.vercel.com${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${credentials.token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Vercel API ${res.status}: ${err}`);
    }
    return res.json();
  }

  return { vc };
}
