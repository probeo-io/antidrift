import { createClient } from './client.mjs';

export default {
  description: 'Read data from a Google Sheet range. Returns rows as arrays.',
  input: {
    spreadsheetId: { type: 'string', description: 'The spreadsheet ID' },
    range: { type: 'string', description: 'Range like Sheet1!A1:D10 or just Sheet1' }
  },
  execute: async ({ spreadsheetId, range }, ctx) => {
    const { getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    const res = await (await getSheets()).spreadsheets.values.get({ spreadsheetId, range });
    return res.data.values || [];
  }
};
