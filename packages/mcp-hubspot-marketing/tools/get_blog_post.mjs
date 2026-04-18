import { createClient } from './client.mjs';

export default {
  description: 'Get full details for a blog post by ID.',
  input: {
    postId: { type: 'string', description: 'The blog post ID' }
  },
  execute: async ({ postId }, ctx) => {
    const { hubspot } = createClient(ctx.credentials, ctx.fetch);
    const res = await hubspot('GET', `/cms/v3/blogs/posts/${postId}`);
    const lines = [];
    lines.push(`\uD83D\uDCDD ${res.name || res.title || 'Untitled'}`);
    if (res.state) lines.push(`State: ${res.state}`);
    if (res.publishDate) lines.push(`Published: ${res.publishDate}`);
    if (res.authorName) lines.push(`Author: ${res.authorName}`);
    if (res.slug) lines.push(`Slug: ${res.slug}`);
    if (res.metaDescription) lines.push(`Meta: ${res.metaDescription}`);
    if (res.url) lines.push(`URL: ${res.url}`);
    lines.push(`[id: ${postId}]`);
    return lines.join('\n');
  }
};
