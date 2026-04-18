import { createClient } from './client.mjs';

export default {
  description: 'Get spreadsheet metadata — title, sheets/tabs, row counts.',
  input: {
    spreadsheetId: { type: 'string', description: 'The spreadsheet ID' }
  },
  execute: async ({ spreadsheetId }, ctx) => {
    const { getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    const res = await (await getSheets()).spreadsheets.get({ spreadsheetId });
    return {
      title: res.data.properties.title,
      sheets: res.data.sheets.map(s => ({
        title: s.properties.title,
        index: s.properties.index,
        rowCount: s.properties.gridProperties.rowCount,
        columnCount: s.properties.gridProperties.columnCount
      }))
    };
  }
};
