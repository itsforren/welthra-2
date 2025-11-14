import pdfParse from "pdf-parse";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import * as mammoth from "mammoth";
import { Buffer } from "node:buffer";

const MAX_DOCUMENT_CHARS = 15000;

export async function extractTextFromDocument(options: {
  url: string;
  mediaType: string;
  name: string;
}): Promise<string> {
  const { url, mediaType, name } = options;

  const response = await fetch(url);

  if (!response.ok) {
    return `[Document ${name}] (failed to fetch: ${response.status})`;
  }

  switch (mediaType) {
    case "application/pdf": {
      const arrayBuffer = await response.arrayBuffer();
      const data = await pdfParse(Buffer.from(arrayBuffer));
      return truncateDocumentText(data.text, name);
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const arrayBuffer = await response.arrayBuffer();
      const result = await mammoth.extractRawText({
        buffer: Buffer.from(arrayBuffer),
      });
      return truncateDocumentText(result.value ?? "", name);
    }
    case "text/csv": {
      const text = await response.text();
      const parsed = Papa.parse<string[]>(text);
      const rows = parsed.data
        .filter((row) => Array.isArray(row) && row.length > 0)
        .map((row) => row.join(", "));
      return truncateDocumentText(rows.join("\n"), name);
    }
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: "buffer" });
      const sheetTexts = workbook.SheetNames.map((sheetName) =>
        XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])
      );
      return truncateDocumentText(sheetTexts.join("\n"), name);
    }
    default: {
      return `[Document ${name}] (unsupported media type ${mediaType})`;
    }
  }
}

function truncateDocumentText(text: string, name: string): string {
  const trimmed = text.trim();

  if (trimmed.length <= MAX_DOCUMENT_CHARS) {
    return `[Document ${name}]\n${trimmed}`;
  }

  return `[Document ${name}] (truncated)\n${trimmed.slice(
    0,
    MAX_DOCUMENT_CHARS
  )}`;
}


