export function createClient(credentials, fetchFn = fetch) {
  async function hubspot(method, path, body) {
    const res = await fetchFn(`https://api.hubapi.com${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HubSpot API ${res.status}: ${err}`);
    }
    return res.json();
  }

  return { hubspot };
}
