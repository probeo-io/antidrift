export function createClient(credentials, fetchFn = fetch) {
  async function nf(method, path, body) {
    const res = await fetchFn(`https://api.netlify.com/api/v1${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${credentials.token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Netlify API ${res.status}: ${err}`);
    }
    return res.json();
  }

  return { nf };
}
