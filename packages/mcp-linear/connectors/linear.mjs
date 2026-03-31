import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const config = JSON.parse(readFileSync(join(homedir(), '.antidrift', 'linear.json'), 'utf8'));

async function linear(query, variables = {}) {
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Authorization': config.apiKey,
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

function formatIssue(issue) {
  const priority = ['None', 'Urgent', 'High', 'Medium', 'Low'][issue.priority] || '';
  let line = `${issue.identifier} — ${issue.title}`;
  if (issue.state?.name) line += `  [${issue.state.name}]`;
  if (priority && priority !== 'None') line += `  (${priority})`;
  if (issue.assignee?.name) line += `  → ${issue.assignee.name}`;
  return line;
}

function formatProject(project) {
  let line = `${project.name}`;
  if (project.state) line += `  [${project.state}]`;
  if (project.progress != null) line += `  ${Math.round(project.progress * 100)}%`;
  if (project.lead?.name) line += `  → ${project.lead.name}`;
  return line;
}

export const tools = [
  {
    name: 'linear_search_issues',
    description: 'Search issues in Linear with filters. Returns matching issues with status, priority, and assignee.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to search for in issue titles and descriptions' },
        teamKey: { type: 'string', description: 'Team key to filter by (e.g. "ENG", "PROD")' },
        status: { type: 'string', description: 'Status name to filter by (e.g. "In Progress", "Todo", "Done")' },
        assignee: { type: 'string', description: 'Assignee name to filter by' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ query, teamKey, status, assignee, limit = 20 }) => {
      let filter = '';
      const filters = [];
      if (teamKey) filters.push(`team: { key: { eq: "${teamKey}" } }`);
      if (status) filters.push(`state: { name: { eq: "${status}" } }`);
      if (assignee) filters.push(`assignee: { name: { contains: "${assignee}" } }`);
      if (query) filters.push(`or: [{ title: { contains: "${query}" } }, { description: { contains: "${query}" } }]`);
      if (filters.length) filter = `filter: { ${filters.join(', ')} },`;

      const data = await linear(`{
        issues(${filter} first: ${limit}, orderBy: updatedAt) {
          nodes { identifier title state { name } priority assignee { name } updatedAt }
        }
      }`);
      if (!data.issues.nodes.length) return 'No issues found.';
      return data.issues.nodes.map(formatIssue).join('\n');
    }
  },
  {
    name: 'linear_get_issue',
    description: 'Get full details for a Linear issue by identifier (e.g. ENG-123).',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: { type: 'string', description: 'Issue identifier (e.g. ENG-123)' }
      },
      required: ['identifier']
    },
    handler: async ({ identifier }) => {
      const [teamKey, num] = identifier.split('-');
      const data = await linear(`{
        issues(filter: { team: { key: { eq: "${teamKey}" } }, number: { eq: ${num} } }) {
          nodes {
            identifier title description state { name } priority
            assignee { name } creator { name } project { name }
            labels { nodes { name } }
            comments { nodes { body user { name } createdAt } }
            createdAt updatedAt
          }
        }
      }`);
      const issue = data.issues.nodes[0];
      if (!issue) return `Issue ${identifier} not found.`;

      const lines = [];
      lines.push(`${issue.identifier} — ${issue.title}`);
      lines.push(`Status: ${issue.state?.name || 'Unknown'}`);
      const priority = ['None', 'Urgent', 'High', 'Medium', 'Low'][issue.priority] || '';
      if (priority && priority !== 'None') lines.push(`Priority: ${priority}`);
      if (issue.assignee?.name) lines.push(`Assignee: ${issue.assignee.name}`);
      if (issue.creator?.name) lines.push(`Creator: ${issue.creator.name}`);
      if (issue.project?.name) lines.push(`Project: ${issue.project.name}`);
      if (issue.labels?.nodes?.length) lines.push(`Labels: ${issue.labels.nodes.map(l => l.name).join(', ')}`);
      if (issue.description) lines.push(`\n${issue.description}`);
      if (issue.comments?.nodes?.length) {
        lines.push(`\n--- Comments (${issue.comments.nodes.length}) ---`);
        for (const c of issue.comments.nodes.slice(0, 10)) {
          lines.push(`${c.user?.name || 'Unknown'} (${new Date(c.createdAt).toLocaleDateString()}): ${c.body.slice(0, 200)}`);
        }
      }
      return lines.join('\n');
    }
  },
  {
    name: 'linear_create_issue',
    description: 'Create a new issue in Linear.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Issue title' },
        teamKey: { type: 'string', description: 'Team key (e.g. "ENG")' },
        description: { type: 'string', description: 'Issue description (markdown supported)' },
        priority: { type: 'number', description: 'Priority: 1=Urgent, 2=High, 3=Medium, 4=Low' },
        assigneeName: { type: 'string', description: 'Name of the person to assign to' }
      },
      required: ['title', 'teamKey']
    },
    handler: async ({ title, teamKey, description, priority, assigneeName }) => {
      // Get team ID
      const teamData = await linear(`{ teams(filter: { key: { eq: "${teamKey}" } }) { nodes { id } } }`);
      const teamId = teamData.teams.nodes[0]?.id;
      if (!teamId) return `Team "${teamKey}" not found.`;

      let assigneeId;
      if (assigneeName) {
        const userData = await linear(`{ users(filter: { name: { contains: "${assigneeName}" } }) { nodes { id } } }`);
        assigneeId = userData.users.nodes[0]?.id;
      }

      const vars = { title, teamId, description: description || '' };
      if (priority) vars.priority = priority;
      if (assigneeId) vars.assigneeId = assigneeId;

      const data = await linear(`
        mutation($title: String!, $teamId: String!, $description: String, $priority: Int, $assigneeId: String) {
          issueCreate(input: { title: $title, teamId: $teamId, description: $description, priority: $priority, assigneeId: $assigneeId }) {
            issue { identifier title state { name } }
          }
        }
      `, vars);
      const issue = data.issueCreate.issue;
      return `Created ${issue.identifier} — ${issue.title} [${issue.state.name}]`;
    }
  },
  {
    name: 'linear_update_issue',
    description: 'Update an existing Linear issue.',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: { type: 'string', description: 'Issue identifier (e.g. ENG-123)' },
        title: { type: 'string', description: 'New title' },
        description: { type: 'string', description: 'New description' },
        priority: { type: 'number', description: 'Priority: 1=Urgent, 2=High, 3=Medium, 4=Low' }
      },
      required: ['identifier']
    },
    handler: async ({ identifier, title, description, priority }) => {
      const [teamKey, num] = identifier.split('-');
      const issueData = await linear(`{ issues(filter: { team: { key: { eq: "${teamKey}" } }, number: { eq: ${num} } }) { nodes { id } } }`);
      const issueId = issueData.issues.nodes[0]?.id;
      if (!issueId) return `Issue ${identifier} not found.`;

      const input = {};
      if (title) input.title = title;
      if (description) input.description = description;
      if (priority) input.priority = priority;

      const data = await linear(`
        mutation($id: String!, $input: IssueUpdateInput!) {
          issueUpdate(id: $id, input: $input) { issue { identifier title state { name } } }
        }
      `, { id: issueId, input });
      const issue = data.issueUpdate.issue;
      return `Updated ${issue.identifier} — ${issue.title}`;
    }
  },
  {
    name: 'linear_change_status',
    description: 'Move a Linear issue to a different status (e.g. "In Progress", "Done").',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: { type: 'string', description: 'Issue identifier (e.g. ENG-123)' },
        status: { type: 'string', description: 'Target status name (e.g. "In Progress", "Done", "Todo")' }
      },
      required: ['identifier', 'status']
    },
    handler: async ({ identifier, status }) => {
      const [teamKey, num] = identifier.split('-');
      const issueData = await linear(`{
        issues(filter: { team: { key: { eq: "${teamKey}" } }, number: { eq: ${num} } }) {
          nodes { id team { id } }
        }
      }`);
      const issue = issueData.issues.nodes[0];
      if (!issue) return `Issue ${identifier} not found.`;

      const stateData = await linear(`{
        workflowStates(filter: { team: { id: { eq: "${issue.team.id}" } }, name: { eq: "${status}" } }) {
          nodes { id name }
        }
      }`);
      const state = stateData.workflowStates.nodes[0];
      if (!state) return `Status "${status}" not found for this team.`;

      await linear(`
        mutation($id: String!, $stateId: String!) {
          issueUpdate(id: $id, input: { stateId: $stateId }) { issue { identifier title state { name } } }
        }
      `, { id: issue.id, stateId: state.id });
      return `${identifier} → ${status}`;
    }
  },
  {
    name: 'linear_assign_issue',
    description: 'Assign or reassign a Linear issue to a team member.',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: { type: 'string', description: 'Issue identifier (e.g. ENG-123)' },
        assigneeName: { type: 'string', description: 'Name of the person to assign to' }
      },
      required: ['identifier', 'assigneeName']
    },
    handler: async ({ identifier, assigneeName }) => {
      const [teamKey, num] = identifier.split('-');
      const issueData = await linear(`{ issues(filter: { team: { key: { eq: "${teamKey}" } }, number: { eq: ${num} } }) { nodes { id } } }`);
      const issueId = issueData.issues.nodes[0]?.id;
      if (!issueId) return `Issue ${identifier} not found.`;

      const userData = await linear(`{ users(filter: { name: { contains: "${assigneeName}" } }) { nodes { id name } } }`);
      const user = userData.users.nodes[0];
      if (!user) return `User "${assigneeName}" not found.`;

      await linear(`
        mutation($id: String!, $assigneeId: String!) {
          issueUpdate(id: $id, input: { assigneeId: $assigneeId }) { issue { identifier } }
        }
      `, { id: issueId, assigneeId: user.id });
      return `${identifier} → assigned to ${user.name}`;
    }
  },
  {
    name: 'linear_list_projects',
    description: 'List projects in Linear with status and progress.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ limit = 20 }) => {
      const data = await linear(`{
        projects(first: ${limit}, orderBy: updatedAt) {
          nodes { name state progress lead { name } startDate targetDate }
        }
      }`);
      if (!data.projects.nodes.length) return 'No projects found.';
      return data.projects.nodes.map(formatProject).join('\n');
    }
  },
  {
    name: 'linear_get_project',
    description: 'Get details for a Linear project including linked issues.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project name to search for' }
      },
      required: ['name']
    },
    handler: async ({ name }) => {
      const data = await linear(`{
        projects(filter: { name: { contains: "${name}" } }) {
          nodes {
            name state progress description lead { name }
            startDate targetDate
            issues { nodes { identifier title state { name } priority assignee { name } } }
          }
        }
      }`);
      const project = data.projects.nodes[0];
      if (!project) return `Project "${name}" not found.`;

      const lines = [];
      lines.push(`${project.name}  [${project.state}]  ${Math.round((project.progress || 0) * 100)}%`);
      if (project.lead?.name) lines.push(`Lead: ${project.lead.name}`);
      if (project.startDate) lines.push(`Start: ${project.startDate}`);
      if (project.targetDate) lines.push(`Target: ${project.targetDate}`);
      if (project.description) lines.push(`\n${project.description}`);
      if (project.issues?.nodes?.length) {
        lines.push(`\n--- Issues (${project.issues.nodes.length}) ---`);
        project.issues.nodes.forEach(i => lines.push(formatIssue(i)));
      }
      return lines.join('\n');
    }
  },
  {
    name: 'linear_current_cycle',
    description: 'Get the active cycle (sprint) for a team with all its issues.',
    inputSchema: {
      type: 'object',
      properties: {
        teamKey: { type: 'string', description: 'Team key (e.g. "ENG")' }
      },
      required: ['teamKey']
    },
    handler: async ({ teamKey }) => {
      const data = await linear(`{
        teams(filter: { key: { eq: "${teamKey}" } }) {
          nodes {
            activeCycle {
              number startsAt endsAt progress
              issues { nodes { identifier title state { name } priority assignee { name } } }
            }
          }
        }
      }`);
      const cycle = data.teams.nodes[0]?.activeCycle;
      if (!cycle) return `No active cycle for team ${teamKey}.`;

      const lines = [];
      lines.push(`Cycle ${cycle.number}  ${Math.round((cycle.progress || 0) * 100)}% complete`);
      lines.push(`${new Date(cycle.startsAt).toLocaleDateString()} → ${new Date(cycle.endsAt).toLocaleDateString()}`);
      if (cycle.issues?.nodes?.length) {
        lines.push(`\n${cycle.issues.nodes.length} issues:`);
        cycle.issues.nodes.forEach(i => lines.push(formatIssue(i)));
      }
      return lines.join('\n');
    }
  },
  {
    name: 'linear_list_teams',
    description: 'List all teams in your Linear workspace.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const data = await linear(`{
        teams { nodes { key name description issueCount } }
      }`);
      if (!data.teams.nodes.length) return 'No teams found.';
      return data.teams.nodes.map(t => `${t.key} — ${t.name}  (${t.issueCount} issues)`).join('\n');
    }
  },
  {
    name: 'linear_add_comment',
    description: 'Add a comment to a Linear issue.',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: { type: 'string', description: 'Issue identifier (e.g. ENG-123)' },
        body: { type: 'string', description: 'Comment text (markdown supported)' }
      },
      required: ['identifier', 'body']
    },
    handler: async ({ identifier, body }) => {
      const [teamKey, num] = identifier.split('-');
      const issueData = await linear(`{ issues(filter: { team: { key: { eq: "${teamKey}" } }, number: { eq: ${num} } }) { nodes { id } } }`);
      const issueId = issueData.issues.nodes[0]?.id;
      if (!issueId) return `Issue ${identifier} not found.`;

      await linear(`
        mutation($issueId: String!, $body: String!) {
          commentCreate(input: { issueId: $issueId, body: $body }) { comment { id } }
        }
      `, { issueId, body });
      return `Comment added to ${identifier}`;
    }
  },
  {
    name: 'linear_search',
    description: 'Full-text search across all issues in Linear.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search text' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      },
      required: ['query']
    },
    handler: async ({ query, limit = 20 }) => {
      const data = await linear(`{
        searchIssues(term: "${query}", first: ${limit}) {
          nodes { identifier title state { name } priority assignee { name } }
        }
      }`);
      if (!data.searchIssues.nodes.length) return `No results for "${query}".`;
      return data.searchIssues.nodes.map(formatIssue).join('\n');
    }
  }
];
