/** Client-side CSV export (TD §3.7: downloadB2BCsv/downloadB2CCsv/downloadCdnrCsv/downloadHsnCsv).
 * Pure browser download — never a Cloud Function, never an unauthorized cross-business read (the
 * caller must only pass data the current user is already permitted to see). */
function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const lines = [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
