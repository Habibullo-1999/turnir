// ──────────────────────────────────────────────────────────────────────────────
// ВАЖНО: тестировать только через URL Web App, не через кнопку "Выполнить"!
// ──────────────────────────────────────────────────────────────────────────────

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === 'ping') {
    return json('"pong"');
  }

  if (action === 'loadState') {
    const sheet = getOrCreate(ss, 'State');
    const val = sheet.getRange('A1').getValue();
    return json(val || 'null');
  }

  if (action === 'loadHistory') {
    const sheet = getOrCreate(ss, 'History');
    const last = sheet.getLastRow();
    if (last < 2) return json('[]');
    const rows = sheet.getRange(2, 1, last - 1, 1).getValues();
    const history = rows
      .map(r => { try { return JSON.parse(r[0]); } catch { return null; } })
      .filter(Boolean);
    return json(JSON.stringify(history));
  }

  // Writes via GET (обходим проблему с redirect на POST)
  if (action === 'saveState') {
    const data = (e.parameter.data) || '';
    if (data) {
      const sheet = getOrCreate(ss, 'State');
      sheet.getRange('A1').setValue(data);
    }
    return json('"ok"');
  }

  if (action === 'saveHistory') {
    const data = (e.parameter.data) || '';
    if (data) {
      const entry = JSON.parse(data);
      appendHistory(ss, entry);
    }
    return json('"ok"');
  }

  return json('"unknown action"');
}

// POST оставляем как запасной вариант
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (body.action === 'saveState') {
      const sheet = getOrCreate(ss, 'State');
      sheet.getRange('A1').setValue(JSON.stringify(body.data));
      return json('"ok"');
    }

    if (body.action === 'saveHistory') {
      appendHistory(ss, body.data);
      return json('"ok"');
    }
  } catch(err) {
    return json(JSON.stringify({ error: err.message }));
  }
  return json('"unknown"');
}

function appendHistory(ss, entry) {
  const sheet = getOrCreate(ss, 'History');
  const last = sheet.getLastRow();

  if (last === 0) {
    sheet.appendRow(['json', 'id', 'name', 'date', 'winner', 'players']);
  }

  // Проверить дубликат по id
  if (last >= 2) {
    const ids = sheet.getRange(2, 2, last - 1, 1).getValues().flat().map(String);
    const idx = ids.indexOf(String(entry.id));
    if (idx !== -1) {
      sheet.getRange(idx + 2, 1, 1, 6).setValues([[
        JSON.stringify(entry), entry.id, entry.name || '', entry.date || '',
        entry.winner || '', (entry.players || []).length
      ]]);
      return;
    }
  }

  sheet.appendRow([
    JSON.stringify(entry), entry.id, entry.name || '', entry.date || '',
    entry.winner || '', (entry.players || []).length
  ]);
}

function getOrCreate(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function json(text) {
  return ContentService
    .createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}
