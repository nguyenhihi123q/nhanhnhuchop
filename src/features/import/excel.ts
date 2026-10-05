// Nhập/xuất Excel (.xlsx) theo đặc tả mục 8.
// Không thực thi công thức/macro; chỉ đọc text; từ chối .xls/.xlsm.
import ExcelJS from 'exceljs';
import type { Cell, Column, Workbook, Worksheet } from 'exceljs';
import {
  DEFAULT_TOPIC,
  LIMITS,
  type Difficulty,
  type Question,
  type QuestionSet,
} from '../../domain/types';
import { compareKey, normalizeText, uid } from '../../domain/ids';
import { OPTION_LETTERS } from '../../domain/question';
import type { Session } from '../../domain/session';
import type { Standings } from '../../domain/ranking';

export const EXCEL_SHEET = 'CauHoi';
export const GUIDE_SHEET = 'HuongDan';
export const EXCEL_HEADERS = [
  'question',
  'optionA',
  'optionB',
  'optionC',
  'optionD',
  'correctAnswer',
  'explanation',
  'topic',
  'difficulty',
] as const;

export const IMPORT_LIMITS = {
  maxBytes: LIMITS.maxImportFileBytes,
  maxRows: LIMITS.maxQuestionsPerImport,
} as const;

export type ImportRowError = { row: number; column: string; reason: string };
export type ImportDuplicate = { row: number; question: string };

export type ImportPreview = {
  totalRows: number;
  skippedEmpty: number;
  valid: Question[];
  errors: ImportRowError[];
  duplicates: ImportDuplicate[];
  formulaErrors: number;
};

const SAMPLE_ROWS: (string | number)[][] = [
  [
    'Cách nào giúp giảm rác nhựa dùng một lần?',
    'Mang bình nước cá nhân',
    'Dùng thêm cốc nhựa',
    'Dùng túi mới mỗi lần mua',
    'Bỏ chai nhựa xuống cống',
    'A',
    'Bình dùng nhiều lần giúp giảm nhu cầu chai và cốc nhựa dùng một lần.',
    'Sống xanh',
    'de',
  ],
  [
    'Việc phân loại rác tại nhà mang lại lợi ích gì?',
    'Giảm khối lượng rác chôn lấp và tăng tái chế',
    'Tăng lượng rác thải',
    'Làm rác lâu phân hủy hơn',
    'Không có lợi ích',
    'A',
    'Phân loại giúp tái chế hiệu quả và giảm rác chôn lấp.',
    'Rác thải',
    'vua',
  ],
  [
    'Hành động nào tiết kiệm nước trong sinh hoạt?',
    'Khóa vòi khi đánh răng và sửa rò rỉ',
    'Mở vòi liên tục',
    'Tắm thật lâu',
    'Xả nước đầy sân',
    'A',
    'Khóa vòi khi không dùng và sửa rò rỉ giúp tiết kiệm nước.',
    'Tiết kiệm tài nguyên',
    'de',
  ],
  [
    'Vì sao cần tắt thiết bị điện khi không dùng?',
    'Tránh tiêu thụ điện vô ích, giảm khí thải nhà kính',
    'Để thiết bị nhanh hỏng',
    'Để tăng hóa đơn',
    'Không có lý do',
    'A',
    'Tắt thiết bị khi không dùng giúp tiết kiệm năng lượng và giảm khí thải.',
    'Năng lượng',
    'vua',
  ],
  [
    'Khi có bão lớn, em nên làm gì?',
    'Ở trong nhà an toàn, theo dõi hướng dẫn',
    'Ra biển chơi',
    'Đứng dưới gốc cây',
    'Đi thuyền ra sông',
    'A',
    'Ở nơi an toàn và theo dõi hướng dẫn giúp bảo đảm an toàn khi bão.',
    'Ứng phó thiên tai',
    'kho',
  ],
];

function styleHeaderRow(worksheet: Worksheet): void {
  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6D28D9' } };
  header.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  header.height = 22;
}

function setColumnWidths(worksheet: Worksheet): void {
  const widths: Record<number, number> = {
    1: 46,
    2: 26,
    3: 26,
    4: 26,
    5: 26,
    6: 14,
    7: 46,
    8: 22,
    9: 12,
  };
  worksheet.columns.forEach((column: Column, index: number) => {
    const width = widths[index + 1];
    if (width) column.width = width;
  });
}


/** Workbook mẫu: sheet CauHoi (5 câu) + sheet HuongDan. */
export async function buildTemplateWorkbook(): Promise<Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Nhanh như chớp – Vòng tinh hoa';
  const sheet = workbook.addWorksheet(EXCEL_SHEET);
  sheet.addRow([...EXCEL_HEADERS]);
  for (const row of SAMPLE_ROWS) sheet.addRow(row);
  styleHeaderRow(sheet);
  setColumnWidths(sheet);
  for (let row = 2; row <= SAMPLE_ROWS.length + 1; row += 1) {
    sheet.getCell(`F${row}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['"A,B,C,D"'] };
    sheet.getCell(`I${row}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"de,vua,kho"'] };
  }
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: 'I1' };

  const guide = workbook.addWorksheet(GUIDE_SHEET);
  guide.addRow(['Cột', 'Bắt buộc', 'Quy tắc', 'Ví dụ']);
  const guideRows: [string, string, string, string][] = [
    ['question', 'Có', 'Nội dung câu hỏi, 1–240 ký tự', 'Cách nào giúp giảm rác nhựa?'],
    ['optionA', 'Có', 'Đáp án A, 1–120 ký tự', 'Mang bình nước cá nhân'],
    ['optionB', 'Có', 'Đáp án B, 1–120 ký tự', 'Dùng thêm cốc nhựa'],
    ['optionC', 'Có', 'Đáp án C, 1–120 ký tự', 'Dùng túi mới mỗi lần'],
    ['optionD', 'Có', 'Đáp án D, 1–120 ký tự', 'Bỏ chai nhựa xuống cống'],
    ['correctAnswer', 'Có', 'A/B/C/D (trim, chấp nhận chữ thường)', 'A'],
    ['explanation', 'Không', 'Giải thích, tối đa 500 ký tự', 'Bình dùng nhiều lần...'],
    ['topic', 'Không', 'Chủ đề, tối đa 80 ký tự; thiếu dùng "Chung"', 'Sống xanh'],
    ['difficulty', 'Không', 'de/vua/kho; thiếu dùng vua', 'de'],
  ];
  for (const row of guideRows) guide.addRow(row);
  styleHeaderRow(guide);
  guide.columns.forEach((column: Column, index: number) => {
    column.width = [16, 10, 44, 34][index] ?? 20;
  });
  guide.getColumn(3).alignment = { wrapText: true, vertical: 'top' };
  return workbook;
}

export async function buildTemplateBuffer(): Promise<ArrayBuffer> {
  const workbook = await buildTemplateWorkbook();
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function workbookToBlob(workbook: Workbook): Promise<Blob> {
  const out = await workbook.xlsx.writeBuffer();
  return new Blob([out as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** Xuất một bộ câu hỏi theo đúng schema; dùng A/B/C/D theo thứ tự gốc. */
export async function buildSetWorkbook(set: QuestionSet): Promise<Workbook> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(EXCEL_SHEET);
  sheet.addRow([...EXCEL_HEADERS]);
  for (const q of set.questions) {
    const correctIndex = q.options.findIndex((o) => o.id === q.correctOptionId);
    sheet.addRow([
      q.text,
      q.options[0].text,
      q.options[1].text,
      q.options[2].text,
      q.options[3].text,
      OPTION_LETTERS[correctIndex >= 0 ? correctIndex : 0],
      q.explanation,
      q.topic,
      q.difficulty,
    ]);
  }
  styleHeaderRow(sheet);
  setColumnWidths(sheet);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: 'I1' };
  return workbook;
}

/** Báo cáo lỗi .xlsx để giáo viên sửa nhanh. */
export async function buildErrorWorkbook(errors: ImportRowError[]): Promise<Workbook> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Loi');
  sheet.addRow(['row', 'column', 'reason']);
  for (const e of errors) sheet.addRow([e.row, e.column, e.reason]);
  styleHeaderRow(sheet);
  sheet.columns.forEach((column: Column, index: number) => {
    column.width = [10, 16, 60][index] ?? 20;
  });
  return workbook;
}

type CellRead = { text: string; isFormula: boolean };

/** Đọc một ô thành text; đánh dấu ô công thức (kể cả có cached result). */
function readCell(cell: Cell): CellRead {
  const value = cell.value;
  if (value === null || value === undefined) return { text: '', isFormula: false };
  if (typeof value === 'string') return { text: value, isFormula: value.startsWith('=') };
  if (typeof value === 'number' || typeof value === 'boolean') {
    return { text: String(value), isFormula: false };
  }
  if (value instanceof Date) return { text: value.toISOString(), isFormula: false };
  if (typeof value === 'object') {
    const obj = value as unknown as Record<string, unknown>;
    if ('formula' in obj || 'sharedFormula' in obj) return { text: cell.text ?? '', isFormula: true };
    if ('richText' in obj && Array.isArray(obj.richText)) {
      const parts = obj.richText as { text?: string }[];
      return { text: parts.map((p) => p.text ?? '').join(''), isFormula: false };
    }
    if ('text' in obj) return { text: String(obj.text ?? ''), isFormula: false };
    if ('result' in obj) return { text: String(obj.result ?? ''), isFormula: true };
  }
  return { text: cell.text ?? '', isFormula: false };
}

function headerToIndex(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((raw, index) => {
    const key = normalizeText(raw).toLowerCase();
    if (key) map.set(key, index);
  });
  return map;
}

/** Đọc file .xlsx từ input; kiểm tra đuôi, kích thước rồi parse. */
export async function parseXlsxFile(file: File): Promise<ImportPreview> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsm') || name.endsWith('.xls')) {
    throw new Error('Chỉ hỗ trợ .xlsx. Hãy mở file trong Excel và lưu lại dạng .xlsx.');
  }
  if (!name.endsWith('.xlsx')) {
    throw new Error('File phải có đuôi .xlsx.');
  }
  if (file.size > IMPORT_LIMITS.maxBytes) {
    throw new Error('File vượt quá 5 MB. Hãy tách nhỏ file trước khi nhập.');
  }
  const buffer = await file.arrayBuffer();
  return parseXlsxBuffer(buffer);
}
/** Parse buffer .xlsx thành preview với kiểm tra header, dòng, công thức, ràng buộc. */
export async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<ImportPreview> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new Error('Không đọc được file Excel. File có thể bị hỏng hoặc sai định dạng.');
  }

  const sheet = workbook.getWorksheet(EXCEL_SHEET);
  if (!sheet) {
    throw new Error(`Thiếu sheet "${EXCEL_SHEET}". Hãy dùng file mẫu và giữ đúng tên sheet.`);
  }

  const headerValues: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell: Cell, colNumber: number) => {
    headerValues[colNumber - 1] = readCell(cell).text;
  });
  const headerMap = headerToIndex(headerValues);

  const required = EXCEL_HEADERS.filter(
    (h) => h !== 'explanation' && h !== 'topic' && h !== 'difficulty',
  );
  const missing = required.filter((h) => !headerMap.has(h.toLowerCase()));
  if (missing.length > 0) {
    throw new Error(`Thiếu cột bắt buộc: ${missing.join(', ')}.`);
  }

  const headerCounts = new Map<string, number>();
  headerValues.forEach((raw) => {
    const key = normalizeText(raw).toLowerCase();
    if (key) headerCounts.set(key, (headerCounts.get(key) ?? 0) + 1);
  });
  const duplicatedHeader = [...headerCounts.entries()].filter(([, count]) => count > 1);
  if (duplicatedHeader.length > 0) {
    throw new Error(`Header bị trùng: ${duplicatedHeader.map(([k]) => k).join(', ')}.`);
  }

  const errors: ImportRowError[] = [];
  const duplicates: ImportDuplicate[] = [];
  const valid: Question[] = [];
  const seenQuestionKeys = new Map<string, number>();
  let skippedEmpty = 0;
  let formulaErrors = 0;
  let dataRows = 0;

  const lastRow = sheet.actualRowCount || sheet.rowCount;
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const cells: Record<string, CellRead> = {};
    let hasAnyValue = false;
    for (const header of EXCEL_HEADERS) {
      const colIndex = headerMap.get(header.toLowerCase());
      const read: CellRead =
        colIndex == null ? { text: '', isFormula: false } : readCell(row.getCell(colIndex + 1));
      cells[header] = read;
      if (read.text.trim() !== '') hasAnyValue = true;
    }
    if (!hasAnyValue) {
      skippedEmpty += 1;
      continue;
    }
    dataRows += 1;
    if (dataRows > IMPORT_LIMITS.maxRows) {
      errors.push({ row: rowNumber, column: '-', reason: 'Vượt quá 2.000 dòng dữ liệu.' });
      break;
    }
    if (Object.values(cells).some((c) => c.isFormula)) {
      formulaErrors += 1;
      errors.push({ row: rowNumber, column: '-', reason: 'Ô chứa công thức không được phép.' });
      continue;
    }
    const built = buildQuestionFromRow(rowNumber, cells, errors);
    if (!built) continue;

    const key = compareKey(built.text);
    if (seenQuestionKeys.has(key)) {
      duplicates.push({ row: rowNumber, question: built.text });
    } else {
      seenQuestionKeys.set(key, rowNumber);
    }
    valid.push(built);
  }

  return { totalRows: dataRows, skippedEmpty, valid, errors, duplicates, formulaErrors };
}



/** Kiểm tra một dòng và tạo Question; trả null nếu dòng có lỗi. */
function buildQuestionFromRow(
  rowNumber: number,
  cells: Record<string, CellRead>,
  errors: ImportRowError[],
): Question | null {
  const questionText = normalizeText(cells.question.text);
  const optionTexts = [
    normalizeText(cells.optionA.text),
    normalizeText(cells.optionB.text),
    normalizeText(cells.optionC.text),
    normalizeText(cells.optionD.text),
  ];
  const correctRaw = normalizeText(cells.correctAnswer.text).toUpperCase();
  const explanation = normalizeText(cells.explanation.text);
  const topicRaw = normalizeText(cells.topic.text);
  const difficultyRaw = normalizeText(cells.difficulty.text).toLowerCase();

  let hasError = false;
  if (!questionText) {
    errors.push({ row: rowNumber, column: 'question', reason: 'Thiếu nội dung câu hỏi.' });
    hasError = true;
  } else if (questionText.length > LIMITS.questionText) {
    errors.push({
      row: rowNumber,
      column: 'question',
      reason: `Nội dung tối đa ${LIMITS.questionText} ký tự.`,
    });
    hasError = true;
  }

  const optionKeys = new Set<string>();
  optionTexts.forEach((text, index) => {
    const column = `option${OPTION_LETTERS[index]}`;
    if (!text) {
      errors.push({ row: rowNumber, column, reason: 'Đáp án không được để trống.' });
      hasError = true;
      return;
    }
    if (text.length > LIMITS.optionText) {
      errors.push({ row: rowNumber, column, reason: `Đáp án tối đa ${LIMITS.optionText} ký tự.` });
      hasError = true;
    }
    const key = compareKey(text);
    if (optionKeys.has(key)) {
      errors.push({ row: rowNumber, column, reason: 'Đáp án trùng với lựa chọn khác.' });
      hasError = true;
    }
    optionKeys.add(key);
  });

  const correctIndex = OPTION_LETTERS.indexOf(correctRaw as (typeof OPTION_LETTERS)[number]);
  if (correctIndex < 0) {
    errors.push({
      row: rowNumber,
      column: 'correctAnswer',
      reason: 'Đáp án đúng phải là A, B, C hoặc D.',
    });
    hasError = true;
  }

  if (explanation.length > LIMITS.explanation) {
    errors.push({
      row: rowNumber,
      column: 'explanation',
      reason: `Giải thích tối đa ${LIMITS.explanation} ký tự.`,
    });
    hasError = true;
  }
  if (topicRaw.length > LIMITS.topic) {
    errors.push({ row: rowNumber, column: 'topic', reason: `Chủ đề tối đa ${LIMITS.topic} ký tự.` });
    hasError = true;
  }

  const difficulty: Difficulty = difficultyRaw === '' ? 'vua' : (difficultyRaw as Difficulty);
  if (difficultyRaw !== '' && !['de', 'vua', 'kho'].includes(difficultyRaw)) {
    errors.push({ row: rowNumber, column: 'difficulty', reason: 'Độ khó phải là de, vua hoặc kho.' });
    hasError = true;
  }

  if (hasError) return null;

  const options: Question['options'] = [
    { id: uid('opt'), text: optionTexts[0] },
    { id: uid('opt'), text: optionTexts[1] },
    { id: uid('opt'), text: optionTexts[2] },
    { id: uid('opt'), text: optionTexts[3] },
  ];

  return {
    id: uid('q'),
    text: questionText,
    options,
    correctOptionId: options[correctIndex].id,
    explanation,
    topic: topicRaw || DEFAULT_TOPIC,
    difficulty,
  };
}



/** Xuất bảng kết quả phiên thi: sheet XepHang + sheet ChiTiet (nhật ký từng lượt). */
export async function buildResultsWorkbook(
  session: Session,
  standings: Standings,
): Promise<Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Nhanh như chớp – Vòng tinh hoa';

  const rank = workbook.addWorksheet('XepHang');
  rank.addRow(['Hạng', 'Đội', 'Điểm', 'Đúng', 'Sai', 'Bỏ qua', 'Đồng hạng']);
  for (const item of standings.ranked) {
    const teamRounds = session.rounds.filter((r) => r.counted && r.teamId === item.teamId);
    const correct = teamRounds.reduce((sum, r) => sum + r.correctCount, 0);
    const wrong = teamRounds.reduce((sum, r) => sum + r.wrongCount, 0);
    const cancelled = teamRounds.reduce((sum, r) => sum + r.cancelledCount, 0);
    rank.addRow([item.rank, item.teamName, item.score, correct, wrong, cancelled, item.tied ? 'Có' : '']);
  }
  styleHeaderRow(rank);
  [10, 28, 12, 12, 12, 14, 14].forEach((w, i) => {
    rank.getColumn(i + 1).width = w;
  });

  const detail = workbook.addWorksheet('ChiTiet');
  detail.addRow(['#', 'Đội', 'Câu hỏi', 'Đã chọn', 'Đáp án đúng', 'Kết quả', 'Giây']);
  let n = 0;
  for (const round of session.rounds) {
    if (!round.counted) continue;
    for (const log of round.logs) {
      n += 1;
      const q = session.config.questionSnapshot[log.questionId];
      const selected = q?.options.find((o) => o.id === log.selectedOptionId);
      const correct = q?.options.find((o) => o.id === log.correctOptionId);
      detail.addRow([
        n,
        round.teamName,
        q?.text ?? '(không rõ)',
        selected?.text ?? '(không trả lời)',
        correct?.text ?? '(không rõ)',
        log.outcome === 'correct' ? 'Đúng' : 'Sai',
        (log.elapsedMs / 1000).toFixed(1),
      ]);
    }
  }
  styleHeaderRow(detail);
  [6, 24, 46, 28, 28, 12, 10].forEach((w, i) => {
    detail.getColumn(i + 1).width = w;
  });

  return workbook;
}
