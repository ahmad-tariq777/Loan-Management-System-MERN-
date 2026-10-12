const escapeCell = (value) => {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (rows, columns) => {
  const header = columns.map((column) => escapeCell(column.label)).join(",");
  const lines = rows.map((row) => columns.map((column) => escapeCell(column.value(row))).join(","));
  return [header, ...lines].join("\n");
};

export const sendCsv = (res, filename, csv) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
};
