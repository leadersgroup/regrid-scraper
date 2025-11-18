const fs = require('fs').promises;

/**
 * Parse CSV file and extract emails
 */
async function parseCSV(filename, emailColumn = 0) {
  try {
    const content = await fs.readFile(filename, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    const emails = [];

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns = parseCSVLine(line);

      // Determine email column
      let email;

      if (typeof emailColumn === 'number') {
        // Use column index
        email = columns[emailColumn];
      } else if (typeof emailColumn === 'string') {
        // First line is header, find column by name
        if (i === 0) continue; // Skip header

        const headers = parseCSVLine(lines[0]);
        const columnIndex = headers.findIndex(h =>
          h.toLowerCase().includes(emailColumn.toLowerCase())
        );

        if (columnIndex === -1) {
          throw new Error(`Column "${emailColumn}" not found in CSV headers`);
        }

        email = columns[columnIndex];
      }

      // Skip header row if it looks like a header
      if (i === 0 && email && email.toLowerCase() === 'email') {
        continue;
      }

      if (email && email.trim() && email.includes('@')) {
        emails.push(email.trim());
      }
    }

    return emails;

  } catch (error) {
    throw new Error(`Failed to parse CSV: ${error.message}`);
  }
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current.trim());

  return result;
}

/**
 * Read emails from a text file (one per line)
 */
async function readTextFile(filename) {
  try {
    const content = await fs.readFile(filename, 'utf8');
    const emails = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && line.includes('@'));

    return emails;

  } catch (error) {
    throw new Error(`Failed to read text file: ${error.message}`);
  }
}

/**
 * Auto-detect file format and extract emails
 */
async function extractEmails(filename) {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'csv') {
    return await parseCSV(filename);
  } else if (ext === 'txt') {
    return await readTextFile(filename);
  } else if (ext === 'json') {
    const content = await fs.readFile(filename, 'utf8');
    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      return data.filter(item =>
        typeof item === 'string' && item.includes('@')
      );
    } else if (data.emails && Array.isArray(data.emails)) {
      return data.emails;
    } else {
      throw new Error('JSON file must contain an array of emails or {emails: [...]}');
    }
  } else {
    throw new Error(`Unsupported file format: ${ext}`);
  }
}

module.exports = {
  parseCSV,
  parseCSVLine,
  readTextFile,
  extractEmails
};
