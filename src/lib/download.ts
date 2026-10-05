// Tải nội dung dạng file trong trình duyệt (blob/chuỗi) với MIME đúng.
export function downloadBlob(data: BlobPart, filename: string, mime: string): void {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Thu hồi URL sau một nhịp để trình duyệt kịp bắt đầu tải.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, mime = 'text/plain'): void {
  downloadBlob(text, filename, `${mime};charset=utf-8`);
}
