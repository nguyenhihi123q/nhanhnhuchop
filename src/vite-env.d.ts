/// <reference types="vite/client" />

declare module 'exceljs' {
  export type CellValue =
    | string
    | number
    | boolean
    | Date
    | null
    | undefined
    | { error?: string; result?: unknown; formula?: string; sharedFormula?: string; text?: string }
    | { richText: { text?: string }[] }
    | { text: string };

  export interface Cell {
    value: CellValue;
    text: string;
    font: unknown;
    fill: unknown;
    alignment: unknown;
    dataValidation: unknown;
  }
  export interface Column {
    width: number;
    alignment: unknown;
  }
  export interface Row {
    height: number;
    font: unknown;
    fill: unknown;
    alignment: unknown;
    eachCell(
      opts: { includeEmpty?: boolean },
      cb: (cell: Cell, colNumber: number) => void,
    ): void;
    getCell(col: number): Cell;
  }
  export interface Worksheet {
    id: number;
    columns: Column[];
    views: unknown;
    autoFilter: unknown;
    actualRowCount: number;
    rowCount: number;
    addRow(values: unknown[]): Row;
    getRow(n: number): Row;
    getCell(ref: string): Cell;
    getColumn(n: number): Column;
    spliceRows(start: number, deleteCount: number, ...rows: unknown[][]): void;
  }
  export interface Workbook {
    creator: string;
    addWorksheet(name?: string): Worksheet;
    getWorksheet(name: string): Worksheet | undefined;
    removeWorksheet(id: number): void;
    xlsx: {
      load(buffer: ArrayBuffer): Promise<unknown>;
      writeBuffer(): Promise<unknown>;
    };
  }
  interface ExcelJSCtor {
    new (): Workbook;
  }
  const ExcelJS: { Workbook: ExcelJSCtor };
  export default ExcelJS;
}
