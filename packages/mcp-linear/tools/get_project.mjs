import { createClient, formatIssue } from './client.mjs';

export default {
  description: 'Get details for a Linear project including linked issues.',
  input: {
    name: { type: 'string', description: 'Project name to search for' }
  },
  execute: async ({ name }, ctx) => {
    const { linear } = createClient(ctx.credentials, ctx.fetch);
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
};
