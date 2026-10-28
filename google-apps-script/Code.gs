/**
 * CASA BURJASSOT - GOOGLE APPS SCRIPT BACKEND (V4 - Eliminazione Istantanea & Sincronizzazione Anti-Bug)
 * 
 * Risolve definitivamente il problema della ricomparsa dei prodotti cancellati:
 * - Supporta eliminazione diretta via GET e via POST
 * - Ricostruzione pulita dei fogli con sheet.clear() invece di deleteRows (molto più veloce e sicuro)
 * - Supporto tombstones (ID cancellati)
 * - Gestione automatica foglio Google senza errori
 */

const SPREADSHEET_ID = '';

const SHEET_ITEMS = 'ListaAcquisti';
const SHEET_WORKS = 'Lavori';
const SHEET_FINANCING = 'Finanziamenti';

const HEADERS_ITEMS = [
  'ID',
  'Nome',
  'Stanza',
  'Negozio',
  'Prezzo',
  'Quantita',
  'Dimensioni',
  'Colore',
  'Priorita',
  'Stato',
  'Pagamento',
  'ID_Finanziamento',
  'Nome_Finanziamento',
  'Link',
  'Note',
  'DataAggiornamento'
];

const HEADERS_WORKS = [
  'ID',
  'Titolo',
  'Professionista',
  'PrezzoConcordato',
  'GiaPagato',
  'ResiduoDovuto',
  'Stato',
  'Note',
  'DataAggiornamento'
];

const HEADERS_FINANCING = [
  'ID',
  'NomePiano',
  'Capitale',
  'NumeroRate',
  'TipoInteresse',
  'ValoreInteresse',
  'TotaleConInteressi',
  'RataMensile',
  'DataInizio',
  'Note',
  'DataAggiornamento'
];

function getSpreadsheet() {
  let ss = null;

  if (typeof SPREADSHEET_ID === 'string' && SPREADSHEET_ID.trim().length > 5) {
    try {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID.trim());
      if (ss) return ss;
    } catch (e) {}
  }

  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}

  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty('BURJASSOT_SPREADSHEET_ID');
  if (savedId) {
    try {
      ss = SpreadsheetApp.openById(savedId);
      if (ss) return ss;
    } catch (e) {
      props.deleteProperty('BURJASSOT_SPREADSHEET_ID');
    }
  }

  ss = SpreadsheetApp.create('Casa Burjassot - Spese & Lavori');
  props.setProperty('BURJASSOT_SPREADSHEET_ID', ss.getId());
  return ss;
}

function getOrCreateSheet(ss, sheetName, headers, headerColor) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    writeHeaders(sheet, headers, headerColor);
  }
  return sheet;
}

function writeHeaders(sheet, headers, headerColor) {
  sheet.appendRow(headers);
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground(headerColor || '#C85A32');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

// Scrive le righe in modo pulito e immediato
function replaceSheetContent(sheet, headers, headerColor, rows) {
  sheet.clear();
  writeHeaders(sheet, headers, headerColor);
  if (rows && rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    sheet.autoResizeColumns(1, headers.length);
  }
}

// GET: Lettura ed eliminazione immediata anti-CORS
function doGet(e) {
  try {
    const ss = getSpreadsheet();
    const sheetItems = getOrCreateSheet(ss, SHEET_ITEMS, HEADERS_ITEMS, '#C85A32');
    const sheetWorks = getOrCreateSheet(ss, SHEET_WORKS, HEADERS_WORKS, '#1E293B');
    const sheetFin = getOrCreateSheet(ss, SHEET_FINANCING, HEADERS_FINANCING, '#6B21A8');

    // Supporto eliminazione diretta via GET (garantita al 100% contro blocchi CORS di Safari/Chrome)
    if (e && e.parameter && e.parameter.action === 'delete') {
      const deleteId = String(e.parameter.id || '');
      if (deleteId) {
        deleteRowById(sheetItems, deleteId);
        deleteRowById(sheetWorks, deleteId);
        deleteRowById(sheetFin, deleteId);
      }
    }

    // 1. Leggi Materiali
    const itemsData = sheetItems.getDataRange().getValues();
    const items = [];
    if (itemsData.length > 1) {
      for (let i = 1; i < itemsData.length; i++) {
        const row = itemsData[i];
        if (!row[0]) continue;
        items.push({
          id: String(row[0]),
          name: String(row[1] || ''),
          room: String(row[2] || ''),
          store: String(row[3] || ''),
          price: parseFloat(row[4]) || 0,
          quantity: parseInt(row[5], 10) || 1,
          dimensions: String(row[6] || ''),
          color: String(row[7] || ''),
          priority: String(row[8] || 'Media'),
          status: String(row[9] || 'pending'),
          paymentStatus: String(row[10] || 'to_pay'),
          financingId: String(row[11] || ''),
          financingName: String(row[12] || ''),
          link: String(row[13] || ''),
          notes: String(row[14] || ''),
          updatedAt: String(row[15] || new Date().toISOString())
        });
      }
    }

    // 2. Leggi Lavori
    const worksData = sheetWorks.getDataRange().getValues();
    const works = [];
    if (worksData.length > 1) {
      for (let i = 1; i < worksData.length; i++) {
        const row = worksData[i];
        if (!row[0]) continue;
        const concordato = parseFloat(row[3]) || 0;
        const pagato = parseFloat(row[4]) || 0;
        works.push({
          id: String(row[0]),
          title: String(row[1] || ''),
          worker: String(row[2] || ''),
          totalPrice: concordato,
          paidAmount: pagato,
          dueAmount: Math.max(0, concordato - pagato),
          status: String(row[6] || 'pending'),
          notes: String(row[7] || ''),
          updatedAt: String(row[8] || new Date().toISOString())
        });
      }
    }

    // 3. Leggi Finanziamenti
    const finData = sheetFin.getDataRange().getValues();
    const financings = [];
    if (finData.length > 1) {
      for (let i = 1; i < finData.length; i++) {
        const row = finData[i];
        if (!row[0]) continue;
        financings.push({
          id: String(row[0]),
          name: String(row[1] || ''),
          totalAmount: parseFloat(row[2]) || 0,
          installmentsCount: parseInt(row[3], 10) || 12,
          interestType: String(row[4] || 'zero'),
          interestValue: parseFloat(row[5]) || 0,
          totalWithInterest: parseFloat(row[6]) || 0,
          monthlyInstallment: parseFloat(row[7]) || 0,
          startDate: String(row[8] || ''),
          notes: String(row[9] || ''),
          updatedAt: String(row[10] || new Date().toISOString())
        });
      }
    }

    return createJsonResponse({
      status: 'success',
      spreadsheetUrl: ss.getUrl(),
      spreadsheetName: ss.getName(),
      lastSync: new Date().toISOString(),
      items: items,
      works: works,
      financings: financings
    });
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  }
}

// Elimina una riga specifica cercandola per ID
function deleteRowById(sheet, targetId) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === targetId) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

// POST: Salvataggio sincrono con supporto tombstones
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      return createJsonResponse({ status: 'error', message: 'Nessun dato inviato' });
    }

    const ss = getSpreadsheet();
    const deletedSet = new Set(Array.isArray(payload.deletedIds) ? payload.deletedIds.map(String) : []);

    // 1. Salva Materiali (escludendo categoricamente gli ID cancellati)
    if (Array.isArray(payload.items)) {
      const sheetItems = getOrCreateSheet(ss, SHEET_ITEMS, HEADERS_ITEMS, '#C85A32');
      const validItems = payload.items.filter(it => !deletedSet.has(String(it.id)));
      const rows = validItems.map(it => [
        it.id || Utilities.getUuid(),
        it.name || '',
        it.room || '',
        it.store || '',
        Number(it.price) || 0,
        Number(it.quantity) || 1,
        it.dimensions || '',
        it.color || '',
        it.priority || 'Media',
        it.status || 'pending',
        it.paymentStatus || 'to_pay',
        it.financingId || '',
        it.financingName || '',
        it.link || '',
        it.notes || '',
        it.updatedAt || new Date().toISOString()
      ]);
      replaceSheetContent(sheetItems, HEADERS_ITEMS, '#C85A32', rows);
    }

    // 2. Salva Lavori
    if (Array.isArray(payload.works)) {
      const sheetWorks = getOrCreateSheet(ss, SHEET_WORKS, HEADERS_WORKS, '#1E293B');
      const validWorks = payload.works.filter(w => !deletedSet.has(String(w.id)));
      const rowsWorks = validWorks.map(w => {
        const conc = Number(w.totalPrice) || 0;
        const pag = Number(w.paidAmount) || 0;
        return [
          w.id || Utilities.getUuid(),
          w.title || '',
          w.worker || '',
          conc,
          pag,
          Math.max(0, conc - pag),
          w.status || 'pending',
          w.notes || '',
          w.updatedAt || new Date().toISOString()
        ];
      });
      replaceSheetContent(sheetWorks, HEADERS_WORKS, '#1E293B', rowsWorks);
    }

    // 3. Salva Finanziamenti
    if (Array.isArray(payload.financings)) {
      const sheetFin = getOrCreateSheet(ss, SHEET_FINANCING, HEADERS_FINANCING, '#6B21A8');
      const validFin = payload.financings.filter(f => !deletedSet.has(String(f.id)));
      const rowsFin = validFin.map(f => [
        f.id || Utilities.getUuid(),
        f.name || '',
        Number(f.totalAmount) || 0,
        Number(f.installmentsCount) || 12,
        f.interestType || 'zero',
        Number(f.interestValue) || 0,
        Number(f.totalWithInterest) || 0,
        Number(f.monthlyInstallment) || 0,
        f.startDate || '',
        f.notes || '',
        f.updatedAt || new Date().toISOString()
      ]);
      replaceSheetContent(sheetFin, HEADERS_FINANCING, '#6B21A8', rowsFin);
    }

    return createJsonResponse({
      status: 'success',
      message: 'Dati sincronizzati e cancellazioni applicate con successo',
      spreadsheetUrl: ss.getUrl()
    });
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
