import { createClient } from './client.mjs';

export default {
  description: 'Create a new issue in Linear.',
  input: {
    title: { type: 'string', description: 'Issue title' },
    teamKey: { type: 'string', description: 'Team key (e.g. "ENG")' },
    description: { type: 'string', description: 'Issue description (markdown supported)', optional: true },
    priority: { type: 'number', description: 'Priority: 1=Urgent, 2=High, 3=Medium, 4=Low', optional: true },
    assigneeName: { type: 'string', description: 'Name of the person to assign to', optional: true }
  },
  execute: async ({ title, teamKey, description, priority, assigneeName }, ctx) => {
    const { linear } = createClient(ctx.credentials, ctx.fetch);
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
    return `Created ${issue.identifier} \u2014 ${issue.title} [${issue.state.name}]`;
  }
};
