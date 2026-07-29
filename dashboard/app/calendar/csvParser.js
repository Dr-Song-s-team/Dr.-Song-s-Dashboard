const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const CSV_V1 = path.join(__dirname, '../data/mock_email_data.csv');
const CSV_V2 = path.join(__dirname, '../data/mock_email_data_v2.csv');

function parseSenderName(email) {
  const local = email.split('@')[0];
  return local
    .split('.')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function parseCsv(filePath, idPrefix) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const records = parse(raw, {
    columns: ['sender', 'subject', 'body'],
    skip_empty_lines: true,
    from_line: 2,
    relax_quotes: true,
    trim: true,
  });
  return records.map((record, index) => ({
    id: `${idPrefix}-${index}`,
    index,
    sender: record.sender.trim(),
    senderName: parseSenderName(record.sender.trim()),
    subject: record.subject.trim(),
    body: record.body.trim(),
  }));
}

function loadEmails() {
  return parseCsv(CSV_V1, 'email');
}

function loadSchedulingEmails() {
  return parseCsv(CSV_V2, 'sched');
}

function loadAllEmails() {
  const v1 = parseCsv(CSV_V1, 'email');
  const v2 = parseCsv(CSV_V2, 'sched');
  return [...v1, ...v2];
}

module.exports = { loadEmails, loadSchedulingEmails, loadAllEmails };
