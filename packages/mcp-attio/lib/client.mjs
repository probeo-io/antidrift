export function createClient(credentials, fetchFn = fetch) {
  async function attio(method, path, body) {
    const res = await fetchFn(`https://api.attio.com/v2${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${credentials.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Attio API ${res.status}: ${err}`);
    }
    return res.json();
  }

  return { attio };
}

export function formatPerson(record) {
  const vals = record.values || {};
  const name = vals.name?.[0]?.full_name || vals.name?.[0]?.first_name || 'Unknown';
  const email = vals.email_addresses?.[0]?.email_address || '';
  const company = vals.company?.[0]?.target_object_id ? vals.company[0].target_record_id : '';
  let line = `👤 ${name}`;
  if (email) line += `  •  ${email}`;
  line += `  [id: ${record.id.record_id}]`;
  return line;
}

export function formatCompany(record) {
  const vals = record.values || {};
  const name = vals.name?.[0]?.value || 'Unknown';
  const domain = vals.domains?.[0]?.domain || '';
  let line = `🏢 ${name}`;
  if (domain) line += `  •  ${domain}`;
  line += `  [id: ${record.id.record_id}]`;
  return line;
}

export function formatDeal(record) {
  const vals = record.values || {};
  const name = vals.name?.[0]?.value || 'Unknown';
  const stage = vals.stage?.[0]?.status?.title || '';
  const value = vals.value?.[0]?.currency_value || '';
  let line = `💰 ${name}`;
  if (stage) line += `  •  ${stage}`;
  if (value) line += `  •  $${value}`;
  line += `  [id: ${record.id.record_id}]`;
  return line;
}
