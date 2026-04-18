import { createClient } from './client.mjs';

export default {
  description: 'Download a file from Google Drive. For Google-native files (Docs, Sheets, Slides), exports to the requested format. For uploaded files (PDF, DOCX, XLSX, PPTX, etc.), downloads as-is or converts. Saves to a local path.',
  input: {
    fileId: { type: 'string', description: 'The file ID' },
    outputPath: { type: 'string', description: 'Local path to save the file (e.g. ./downloads/report.pdf)' },
    format: { type: 'string', description: 'Export format: pdf, docx, xlsx, pptx, csv, txt, html. Only needed for Google-native files. Uploaded files download in their original format by default.', optional: true }
  },
  execute: async ({ fileId, outputPath, format }, ctx) => {
    const { getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    const { writeFileSync, mkdirSync } = await import('fs');
    const { dirname } = await import('path');

    const meta = await (await getDrive()).files.get({ fileId, fields: 'mimeType, name' });
    const mime = meta.data.mimeType;

    const googleExportMap = {
      'application/vnd.google-apps.document': {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        txt: 'text/plain',
        html: 'text/html'
      },
      'application/vnd.google-apps.spreadsheet': {
        pdf: 'application/pdf',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        csv: 'text/csv'
      },
      'application/vnd.google-apps.presentation': {
        pdf: 'application/pdf',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      }
    };

    mkdirSync(dirname(outputPath), { recursive: true });

    const isGoogleNative = mime in googleExportMap;

    if (isGoogleNative) {
      const exportFormats = googleExportMap[mime];
      const exportFormat = format || Object.keys(exportFormats)[0];
      const exportMime = exportFormats[exportFormat];

      if (!exportMime) {
        return { error: `Cannot export ${mime} as ${format}. Supported: ${Object.keys(exportFormats).join(', ')}` };
      }

      const res = await (await getDrive()).files.export(
        { fileId, mimeType: exportMime },
        { responseType: 'arraybuffer' }
      );
      writeFileSync(outputPath, Buffer.from(res.data));
      return { name: meta.data.name, format: exportFormat, savedTo: outputPath };
    } else {
      const res = await (await getDrive()).files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );
      writeFileSync(outputPath, Buffer.from(res.data));
      return { name: meta.data.name, mimeType: mime, savedTo: outputPath };
    }
  }
};
