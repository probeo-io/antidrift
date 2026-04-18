export function createClient(credentials, fetchFn = fetch) {
  async function clickup(method, path, body) {
    const res = await fetchFn(`https://api.clickup.com/api/v2${path}`, {
      method,
      headers: {
        'Authorization': credentials.apiToken,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`ClickUp API ${res.status}: ${err}`);
    }
    return res.json();
  }

  return { clickup };
}

export function priorityEmoji(p) {
  if (p === 1) return '\ud83d\udd34';
  if (p === 2) return '\ud83d\udfe0';
  if (p === 3) return '\ud83d\udfe1';
  if (p === 4) return '\ud83d\udd35';
  return '\u2b1c';
}

export function formatTask(task) {
  const prio = task.priority ? parseInt(task.priority.id || task.priority, 10) : null;
  const emoji = priorityEmoji(prio);
  const status = task.status?.status || '';
  const assignees = (task.assignees || []).map(a => a.username || a.email || '').filter(Boolean).join(', ');
  let line = `\ud83d\udccb ${emoji} ${task.name} \u2014 ${status}`;
  if (assignees) line += ` [${assignees}]`;
  line += `  [id: ${task.id}]`;
  return line;
}
