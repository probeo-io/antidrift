import { createClient } from './client.mjs';

export default {
  description: 'Write data to a Google Sheet range.',
  input: {
    spreadsheetId: { type: 'string', description: 'The spreadsheet ID' },
    range: { type: 'string', description: 'Range like Sheet1!A1' },
    values: { type: 'array', description: 'Array of rows (each row is an array of values)' }
  },
  execute: async ({ spreadsheetId, range, values }, ctx) => {
    const { getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    const res = await (await getSheets()).spreadsheets.values.update({
      spreadsheetId, range,
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });
    return { updatedCells: res.data.updatedCells };
  }
};
