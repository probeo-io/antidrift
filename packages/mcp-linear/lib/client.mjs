export function createClient(credentials, fetchFn = fetch) {
  async function linear(query, variables = {}) {
    const res = await fetchFn('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Authorization': credentials.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Linear API ${res.status}: ${err}`);
    }
    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0].message);
    return json.data;
  }

  return { linear };
}

export function formatIssue(issue) {
  const priority = ['None', 'Urgent', 'High', 'Medium', 'Low'][issue.priority] || '';
  let line = `${issue.identifier} \u2014 ${issue.title}`;
  if (issue.state?.name) line += `  [${issue.state.name}]`;
  if (priority && priority !== 'None') line += `  (${priority})`;
  if (issue.assignee?.name) line += `  \u2192 ${issue.assignee.name}`;
  return line;
}

export function formatProject(project) {
  let line = `${project.name}`;
  if (project.state) line += `  [${project.state}]`;
  if (project.progress != null) line += `  ${Math.round(project.progress * 100)}%`;
  if (project.lead?.name) line += `  \u2192 ${project.lead.name}`;
  return line;
}
