import { createClient } from './client.mjs';

export default {
  description: 'Get the authenticated GitHub user\'s info.',
  input: {},
  execute: async (_args, ctx) => {
    const { gh } = createClient(ctx.credentials, ctx.fetch);
    const u = await gh('GET', '/user');
    const lines = [];
    lines.push(`👤 ${u.login}`);
    if (u.name) lines.push(`   Name: ${u.name}`);
    if (u.email) lines.push(`   Email: ${u.email}`);
    if (u.bio) lines.push(`   Bio: ${u.bio}`);
    lines.push(`   Public repos: ${u.public_repos}`);
    lines.push(`   Followers: ${u.followers} / Following: ${u.following}`);
    return lines.join('\n');
  }
};
