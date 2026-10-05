import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
  buildSetWorkbook,
  buildTemplateWorkbook,
  EXCEL_HEADERS,
  EXCEL_SHEET,
  parseXlsxBuffer,
  workbookToBlob,
} from '../src/features/import/excel';
import { createQuestionSet } from '../src/domain/question';
import { OPTION_LETTERS } from '../src/domain/question';
import type { Question, QuestionSet } from '../src/domain/types';

function makeQuestion(id: string, correctIndex = 0): Question {
  const options = [0, 1, 2, 3].map((i) => ({ id: `${id}_o${i}`, text: `Đáp án ${OPTION_LETTERS[i]}` })) as Question['options'];
  return {
    id,
    text: `Câu hỏi ${id}?`,
    options,
    correctOptionId: options[correctIndex].id,
    explanation: 'Giải thích',
    topic: 'Chủ đề',
    difficulty: 'vua',
  };
}

function makeSet(overrides: Partial<QuestionSet> = {}): QuestionSet {
  return { ...createQuestionSet('Bộ thử', 'mô tả'), questions: [makeQuestion('q1', 1)], ...overrides };
}

describe('parseXlsxBuffer — round-trip', () => {
  it('đọc lại đúng bộ câu hỏi đã xuất', async () => {
    const set = makeSet();
    const workbook = await buildSetWorkbook(set);
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
    const preview = await parseXlsxBuffer(buffer);
    expect(preview.valid).toHaveLength(1);
    expect(preview.errors).toEqual([]);
    expect(preview.valid[0].text).toBe('Câu hỏi q1?');
    expect(preview.valid[0].correctOptionId).toBe(preview.valid[0].options[1].id);
    expect(preview.valid[0].topic).toBe('Chủ đề');
  });

  it('báo lỗi khi thiếu sheet CauHoi', async () => {
    const workbook = await buildTemplateWorkbook();
    workbook.removeWorksheet(workbook.getWorksheet(EXCEL_SHEET)!.id);
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
    await expect(parseXlsxBuffer(buffer)).rejects.toThrow(/CauHoi/);
  });

  it('báo lỗi khi thiếu cột bắt buộc', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(EXCEL_SHEET);
    sheet.addRow(['question', 'optionA', 'explanation', 'topic', 'difficulty']);
    sheet.addRow(['Chỉ có cột A', 'A', '', '', 'de']);
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
    await expect(parseXlsxBuffer(buffer)).rejects.toThrow(/Thiếu cột bắt buộc/);
  });
});

describe('parseXlsxBuffer — kiểm tra ràng buộc', () => {
  function sheetWith(rows: (string | number)[][]): Promise<ArrayBuffer> {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet(EXCEL_SHEET);
    sheet.addRow([...EXCEL_HEADERS]);
    for (const row of rows) sheet.addRow(row);
    return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
  }

  const goodRow = ['Câu hợp lệ?', 'A', 'B', 'C', 'D', OPTION_LETTERS[0], 'Giải thích', 'Chủ đề', 'de'];

  it('chấp nhận dòng hợp lệ và đánh dấu đáp án đúng theo chữ cái', async () => {
    const buffer = await sheetWith([goodRow]);
    const preview = await parseXlsxBuffer(buffer);
    expect(preview.valid).toHaveLength(1);
    expect(preview.errors).toEqual([]);
    const q = preview.valid[0];
    expect(q.correctOptionId).toBe(q.options[0].id);
    expect(q.difficulty).toBe('de');
  });

  it('từ chối đáp án đúng không nằm trong A–D', async () => {
    const buffer = await sheetWith([[...goodRow.slice(0, 5), 'Z', ...goodRow.slice(6)]]);
    const preview = await parseXlsxBuffer(buffer);
    expect(preview.valid).toHaveLength(0);
    expect(preview.errors.some((e) => e.column === 'correctAnswer')).toBe(true);
  });

  it('từ chối đáp án trùng nhau', async () => {
    const buffer = await sheetWith([['Câu?', 'A', 'A', 'C', 'D', 'A', '', '', '']]);
    const preview = await parseXlsxBuffer(buffer);
    expect(preview.valid).toHaveLength(0);
    expect(preview.errors.some((e) => /trùng/.test(e.reason))).toBe(true);
  });

  it('từ chối độ khó không hợp lệ', async () => {
    const buffer = await sheetWith([[...goodRow.slice(0, 8), 'kho-lam']]);
    const preview = await parseXlsxBuffer(buffer);
    expect(preview.valid).toHaveLength(0);
    expect(preview.errors.some((e) => e.column === 'difficulty')).toBe(true);
  });

  it('bỏ qua dòng trống và đếm số dòng', async () => {
    const buffer = await sheetWith([goodRow, ['', '', '', '', '', '', '', '', ''], goodRow.slice(0, 9).map(() => '')]);
    const preview = await parseXlsxBuffer(buffer);
    expect(preview.valid).toHaveLength(1);
    expect(preview.skippedEmpty).toBeGreaterThanOrEqual(1);
  });

  it('đánh dấu câu trùng nội dung', async () => {
    const dup = ['Câu trùng?', 'A', 'B', 'C', 'D', 'A', '', '', ''];
    const buffer = await sheetWith([dup, [...dup]]);
    const preview = await parseXlsxBuffer(buffer);
    expect(preview.duplicates.length).toBeGreaterThanOrEqual(1);
  });
});

describe('workbookToBlob', () => {
  it('trả về Blob với MIME xlsx', async () => {
    const workbook = await buildSetWorkbook(makeSet());
    const blob = await workbookToBlob(workbook);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain('spreadsheetml');
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe('EXCEL_HEADERS', () => {
  it('khai báo đủ chín cột theo đặc tả', () => {
    expect(EXCEL_HEADERS).toEqual([
      'question',
      'optionA',
      'optionB',
      'optionC',
      'optionD',
      'correctAnswer',
      'explanation',
      'topic',
      'difficulty',
    ]);
  });
});
