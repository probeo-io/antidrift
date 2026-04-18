export function createClient(credentials, fetchFn = fetch) {
  const base = `https://${credentials.domain}.pipedrive.com/api/v1`;

  async function pd(method, path, body) {
    const url = new URL(`${base}${path}`);
    url.searchParams.set('api_token', credentials.apiToken);

    const res = await fetchFn(url.toString(), {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Pipedrive API ${res.status}: ${err}`);
    }
    return res.json();
  }

  return { pd };
}

export function formatDeal(deal) {
  let line = `${deal.title}`;
  if (deal.stage_id) line += `  [stage: ${deal.stage_id}]`;
  if (deal.value) line += `  $${deal.value} ${deal.currency || ''}`;
  if (deal.person_name) line += `  \u2192 ${deal.person_name}`;
  if (deal.status) line += `  (${deal.status})`;
  line += `  [id: ${deal.id}]`;
  return line;
}

export function formatPerson(person) {
  let line = `${person.name}`;
  if (person.email?.length) line += `  ${person.email[0].value}`;
  if (person.phone?.length) line += `  ${person.phone[0].value}`;
  if (person.org_name) line += `  @ ${person.org_name}`;
  line += `  [id: ${person.id}]`;
  return line;
}

export function formatOrg(org) {
  let line = `${org.name}`;
  if (org.address) line += `  ${org.address}`;
  line += `  [id: ${org.id}]`;
  return line;
}
