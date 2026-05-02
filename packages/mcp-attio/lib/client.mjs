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
  const stageDate = vals.stage?.[0]?.created_at || '';
  const value = vals.value?.[0]?.currency_value || '';
  const createdAt = record.created_at || '';
  let line = `💰 ${name}`;
  if (stage) {
    line += `  •  ${stage}`;
    if (stageDate) {
      line += ` (since ${stageDate.slice(0, 10)}`;
      if (createdAt) {
        const days = Math.round((new Date(stageDate) - new Date(createdAt)) / 86400000);
        line += `, ${days}d from lead`;
      }
      line += `)`;
    }
  }
  if (value) line += `  •  $${value}`;
  line += `  [id: ${record.id.record_id}]`;
  return line;
}
