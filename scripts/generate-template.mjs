// Sinh lại template Excel mẫu để tránh lệch schema giữa tài liệu và file phát hành.
// Chạy: node scripts/generate-template.mjs
import ExcelJS from 'exceljs';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEADERS = [
  'question',
  'optionA',
  'optionB',
  'optionC',
  'optionD',
  'correctAnswer',
  'explanation',
  'topic',
  'difficulty',
];

const SAMPLE_ROWS = [
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

const GUIDE_ROWS = [
  ['Cột', 'Bắt buộc', 'Quy tắc', 'Ví dụ'],
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

function styleHeader(sheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6D28D9' } };
  header.height = 22;
}

const workbook = new ExcelJS.Workbook();
workbook.creator = 'Nhanh như chớp – Vòng tinh hoa';

const sheet = workbook.addWorksheet('CauHoi');
sheet.addRow(HEADERS);
for (const row of SAMPLE_ROWS) sheet.addRow(row);
styleHeader(sheet);
[46, 26, 26, 26, 26, 14, 46, 22, 12].forEach((w, i) => {
  sheet.getColumn(i + 1).width = w;
});
for (let r = 2; r <= SAMPLE_ROWS.length + 1; r += 1) {
  sheet.getCell(`F${r}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['"A,B,C,D"'] };
  sheet.getCell(`I${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"de,vua,kho"'] };
}
sheet.views = [{ state: 'frozen', ySplit: 1 }];

const guide = workbook.addWorksheet('HuongDan');
for (const row of GUIDE_ROWS) guide.addRow(row);
styleHeader(guide);
[16, 10, 44, 34].forEach((w, i) => {
  guide.getColumn(i + 1).width = w;
});

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '..', 'public', 'templates', 'mau-cau-hoi-nhanh-nhu-chop.xlsx');
mkdirSync(dirname(outPath), { recursive: true });
await workbook.xlsx.writeFile(outPath);
console.log('Đã tạo:', outPath);
