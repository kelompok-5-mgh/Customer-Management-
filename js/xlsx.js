/* Relasi – penulis file Excel (.xlsx) mandiri, tanpa pustaka luar.
 *
 * RelasiXlsx.build([
 *   { name: 'Pelanggan',
 *     columns: [{ header: 'Nama', width: 24, type: 'text' | 'number' | 'mixed' | 'date' | 'datetime' }],
 *     rows: [['Budi', ...]] }
 * ]) -> Blob
 */
(function (global) {
  'use strict';

  const encoder = new TextEncoder();

  /* ---------- ZIP (tanpa kompresi) ---------- */

  const CRC_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function zip(files) {
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    const parts = [];
    const central = [];
    let offset = 0;

    files.forEach(function (file) {
      const name = encoder.encode(file.name);
      const data = file.data;
      const crc = crc32(data);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034B50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true);
      local.setUint16(8, 0, true);
      local.setUint16(10, dosTime, true);
      local.setUint16(12, dosDate, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);

      parts.push(new Uint8Array(local.buffer), name, data);

      const entry = new DataView(new ArrayBuffer(46));
      entry.setUint32(0, 0x02014B50, true);
      entry.setUint16(4, 20, true);
      entry.setUint16(6, 20, true);
      entry.setUint16(8, 0x0800, true);
      entry.setUint16(10, 0, true);
      entry.setUint16(12, dosTime, true);
      entry.setUint16(14, dosDate, true);
      entry.setUint32(16, crc, true);
      entry.setUint32(20, data.length, true);
      entry.setUint32(24, data.length, true);
      entry.setUint16(28, name.length, true);
      entry.setUint32(42, offset, true);
      central.push(new Uint8Array(entry.buffer), name);

      offset += 30 + name.length + data.length;
    });

    let centralSize = 0;
    central.forEach(function (chunk) { centralSize += chunk.length; });

    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054B50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);

    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  /* ---------- XML ---------- */

  function escapeXml(value) {
    return String(value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function columnName(index) {
    let n = index + 1;
    let name = '';
    while (n > 0) {
      const m = (n - 1) % 26;
      name = String.fromCharCode(65 + m) + name;
      n = Math.floor((n - 1) / 26);
    }
    return name;
  }

  // Tanggal Excel: jumlah hari sejak 30 Des 1899, memakai waktu lokal
  function toSerial(value) {
    let date;
    if (typeof value === 'string') {
      const p = value.split('-').map(Number);
      date = new Date(p[0], p[1] - 1, p[2]);
    } else {
      date = new Date(value);
    }
    if (isNaN(date.getTime())) return null;
    const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(),
      date.getHours(), date.getMinutes(), date.getSeconds());
    return utc / 86400000 + 25569;
  }

  const STYLE = { header: 1, date: 2, datetime: 3 };

  function cellXml(ref, value, type, isHeader) {
    if (value == null || value === '') return '';

    if (isHeader) {
      return '<c r="' + ref + '" s="' + STYLE.header + '" t="inlineStr"><is><t>' + escapeXml(value) + '</t></is></c>';
    }

    if ((type === 'number' || type === 'mixed') && typeof value === 'number' && isFinite(value)) {
      return '<c r="' + ref + '"><v>' + value + '</v></c>';
    }

    if (type === 'date' || type === 'datetime') {
      const serial = toSerial(value);
      if (serial != null) {
        return '<c r="' + ref + '" s="' + STYLE[type] + '"><v>' + serial + '</v></c>';
      }
    }

    // Teks selalu disimpan sebagai teks (bukan rumus), sehingga aman dari injeksi rumus
    return '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + escapeXml(value) + '</t></is></c>';
  }

  function sheetXml(sheet) {
    const columns = sheet.columns;
    const lastCol = columnName(columns.length - 1);
    const lastRow = sheet.rows.length + 1;

    const cols = columns.map(function (col, i) {
      return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (col.width || 16) + '" customWidth="1"/>';
    }).join('');

    let rowsXml = '<row r="1">' + columns.map(function (col, i) {
      return cellXml(columnName(i) + '1', col.header, 'text', true);
    }).join('') + '</row>';

    sheet.rows.forEach(function (row, r) {
      const rowNumber = r + 2;
      rowsXml += '<row r="' + rowNumber + '">' + columns.map(function (col, i) {
        return cellXml(columnName(i) + rowNumber, row[i], col.type, false);
      }).join('') + '</row>';
    });

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<cols>' + cols + '</cols>' +
      '<sheetData>' + rowsXml + '</sheetData>' +
      (sheet.rows.length ? '<autoFilter ref="A1:' + lastCol + lastRow + '"/>' : '') +
      '</worksheet>';
  }

  const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd mmm yyyy"/><numFmt numFmtId="165" formatCode="dd mmm yyyy hh:mm"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE4E6F7"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="4">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  function safeSheetName(name, used) {
    let clean = String(name).replace(/[\[\]:*?\/\\]/g, ' ').trim().slice(0, 31) || 'Sheet';
    let candidate = clean;
    let n = 2;
    while (used.indexOf(candidate) !== -1) candidate = clean.slice(0, 28) + ' ' + n++;
    used.push(candidate);
    return candidate;
  }

  function build(sheets) {
    const used = [];
    const names = sheets.map(function (sheet) { return safeSheetName(sheet.name, used); });

    const files = [];
    const add = function (name, text) { files.push({ name: name, data: encoder.encode(text) }); };

    add('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map(function (s, i) {
        return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
      }).join('') +
      '</Types>');

    add('_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>');

    add('xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets>' + names.map(function (name, i) {
        return '<sheet name="' + escapeXml(name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
      }).join('') + '</sheets></workbook>');

    add('xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map(function (s, i) {
        return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
      }).join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>');

    add('xl/styles.xml', STYLES_XML);
    sheets.forEach(function (sheet, i) { add('xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml(sheet)); });

    return zip(files);
  }

  global.RelasiXlsx = { build: build };
})(window);
