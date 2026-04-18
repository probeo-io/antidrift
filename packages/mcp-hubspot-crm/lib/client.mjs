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

export function formatContact(record) {
  const p = record.properties || {};
  const name = [p.firstname, p.lastname].filter(Boolean).join(' ') || 'Unknown';
  const email = p.email || '';
  let line = `\uD83D\uDC64 ${name}`;
  if (email) line += ` \u2014 ${email}`;
  line += ` [id: ${record.id}]`;
  return line;
}

export function formatCompany(record) {
  const p = record.properties || {};
  const name = p.name || 'Unknown';
  const domain = p.domain || '';
  let line = `\uD83C\uDFE2 ${name}`;
  if (domain) line += ` \u2014 ${domain}`;
  line += ` [id: ${record.id}]`;
  return line;
}

export function formatDeal(record) {
  const p = record.properties || {};
  const name = p.dealname || 'Unknown';
  const stage = p.dealstage || '';
  const amount = p.amount || '';
  let line = `\uD83D\uDCB0 ${name}`;
  if (stage) line += ` \u2014 ${stage}`;
  if (amount) line += ` $${amount}`;
  line += ` [id: ${record.id}]`;
  return line;
}

export const CONTACT_PROPERTIES = ['firstname', 'lastname', 'email', 'phone', 'company', 'jobtitle', 'lifecyclestage'];
export const COMPANY_PROPERTIES = ['name', 'domain', 'industry', 'numberofemployees', 'annualrevenue'];
export const DEAL_PROPERTIES = ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate'];

export function searchPropertiesForType(objectType) {
  if (objectType === 'contacts') return ['firstname', 'lastname', 'email'];
  if (objectType === 'companies') return ['name', 'domain'];
  if (objectType === 'deals') return ['dealname', 'amount', 'dealstage'];
  return [];
}
