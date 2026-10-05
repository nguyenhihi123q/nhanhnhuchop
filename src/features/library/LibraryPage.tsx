// Thư viện bộ câu hỏi và lịch sử phiên thi.
import { useRef, useState, type ChangeEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { navigate } from '../../app/useRoute';
import { useToast } from '../../components/Toast';
import { Badge, Button, Card, Dialog, EmptyState, IconButton } from '../../components/ui';
import { IconDownload, IconEdit, IconPlus, IconTrash, IconUpload } from '../../components/icons';
import {
  buildSetWorkbook,
  buildTemplateBuffer,
  parseXlsxFile,
  workbookToBlob,
  type ImportPreview,
} from '../import/excel';
import { downloadBlob } from '../../lib/download';
import { createQuestionSet } from '../../domain/question';
import { TIEBREAK_SET_DEF } from '../../data';
import type { QuestionSet } from '../../domain/types';

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function LibraryPage() {
  const { ready, sets, sessions, createSet, deleteSet, deleteSession, restoreSampleSets } = useApp();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ preview: ImportPreview; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const mainSets = sets.filter((s) => s.title !== TIEBREAK_SET_DEF.title);
  const tiebreakPresent = sets.some((s) => s.title === TIEBREAK_SET_DEF.title);

  async function handleNewSet() {
    const set = createQuestionSet('Bộ câu hỏi mới', '');
    await createSet(set);
    toast.success('Đã tạo bộ câu hỏi mới.');
    navigate(`/set/${set.id}`);
  }

  async function handleDownloadTemplate() {
    try {
      const buffer = await buildTemplateBuffer();
      downloadBlob(
        buffer,
        'mau-cau-hoi-nhanh-nhu-chop.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    } catch {
      toast.error('Không tạo được file mẫu.');
    }
  }

  async function handleExport(set: QuestionSet) {
    try {
      const workbook = await buildSetWorkbook(set);
      const blob = await workbookToBlob(workbook);
      downloadBlob(blob, `${set.title.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.xlsx`, blob.type);
    } catch {
      toast.error('Không xuất được bộ câu hỏi.');
    }
  }

  async function handleDuplicate(set: QuestionSet) {
    const copy: QuestionSet = {
      ...set,
      id: `set_${Date.now()}`,
      title: `${set.title} (bản sao)`,
      questions: set.questions.map((q) => ({
        ...q,
        id: `q_${Math.random().toString(36).slice(2, 10)}`,
        options: q.options.map((o) => ({ ...o, id: `opt_${Math.random().toString(36).slice(2, 10)}` })) as typeof q.options,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await createSet(copy);
    toast.success('Đã nhân bản bộ câu hỏi.');
  }

  async function handleDeleteSet(set: QuestionSet) {
    if (!window.confirm(`Xóa bộ "${set.title}"? Thao tác không thể hoàn tác.`)) return;
    await deleteSet(set.id);
    toast.success('Đã xóa bộ câu hỏi.');
  }

  async function handleDeleteSession(id: string, name: string) {
    if (!window.confirm(`Xóa phiên "${name}"?`)) return;
    await deleteSession(id);
    toast.success('Đã xóa phiên thi.');
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const preview = await parseXlsxFile(file);
      setPending({ preview, name: file.name.replace(/\.xlsx$/i, '') });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không đọc được file.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!pending) return;
    const { preview, name } = pending;
    if (preview.valid.length === 0) {
      toast.error('Không có câu hợp lệ để nhập.');
      return;
    }
    const now = new Date().toISOString();
    const set: QuestionSet = {
      id: `set_${Date.now()}`,
      schemaVersion: 1,
      title: name || 'Bộ nhập từ Excel',
      description: `Nhập từ file Excel (${preview.valid.length} câu).`,
      questions: preview.valid,
      createdAt: now,
      updatedAt: now,
    };
    await createSet(set);
    setPending(null);
    toast.success(`Đã nhập ${preview.valid.length} câu hỏi.`);
    navigate(`/set/${set.id}`);
  }

  if (!ready) {
    return (
      <main className="page">
        <div className="container">
          <Card>Đang tải thư viện…</Card>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <div className="page-head">
          <div>
            <h1>Thư viện câu hỏi</h1>
            <p>Quản lý bộ câu hỏi, nhập từ Excel và bắt đầu phiên thi mới.</p>
          </div>
          <div className="actions-inline">
            <Button variant="primary" onClick={handleNewSet}>
              <IconPlus size={18} /> Bộ mới
            </Button>
            <Button onClick={() => navigate('/setup')}>Thiết lập phiên thi</Button>
          </div>
        </div>

        <div className="toolbar">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            style={{ display: 'none' }}
            onChange={onFileChange}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            <IconUpload size={18} /> {busy ? 'Đang đọc…' : 'Nhập từ Excel'}
          </Button>
          <Button onClick={handleDownloadTemplate}>
            <IconDownload size={18} /> Tải file mẫu
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await restoreSampleSets();
              toast.success('Đã khôi phục bộ câu hỏi mẫu.');
            }}
          >
            Khôi phục bộ mẫu
          </Button>
          <Badge tone="neutral">{mainSets.length} bộ câu hỏi</Badge>
          {tiebreakPresent ? <Badge tone="brand">Có bộ câu phụ</Badge> : null}
        </div>

        {mainSets.length === 0 ? (
          <EmptyState
            title="Chưa có bộ câu hỏi"
            description="Tạo bộ mới, nhập từ Excel hoặc khôi phục các bộ mẫu để bắt đầu."
            action={
              <Button variant="primary" onClick={() => fileRef.current?.click()}>
                <IconUpload size={18} /> Nhập từ Excel
              </Button>
            }
          />
        ) : (
          <div className="grid grid--cards">
            {mainSets.map((set) => (
              <Card key={set.id} as="article">
                <h3 className="card__title">{set.title}</h3>
                <p className="card__meta">
                  <span>
                    <strong>{set.questions.length}</strong> câu hỏi
                  </span>
                  <span>Cập nhật {formatDate(set.updatedAt)}</span>
                </p>
                {set.description ? <p>{set.description}</p> : null}
                <div className="card__actions">
                  <Button variant="primary" onClick={() => navigate(`/set/${set.id}`)}>
                    <IconEdit size={18} /> Sửa
                  </Button>
                  <IconButton label="Nhân bản" onClick={() => handleDuplicate(set)}>
                    <IconPlus />
                  </IconButton>
                  <IconButton label="Xuất Excel" onClick={() => handleExport(set)}>
                    <IconDownload />
                  </IconButton>
                  <IconButton label="Xóa bộ" onClick={() => handleDeleteSet(set)}>
                    <IconTrash />
                  </IconButton>
                </div>
              </Card>
            ))}
          </div>
        )}

        <section style={{ marginTop: 'calc(var(--space) * 6)' }}>
          <div className="page-head">
            <div>
              <h2>Phiên thi gần đây</h2>
              <p>Tiếp tục chơi hoặc xem lại kết quả các phiên đã tổ chức.</p>
            </div>
            <Button onClick={() => navigate('/setup')}>Tạo phiên mới</Button>
          </div>
          {sessions.length === 0 ? (
            <EmptyState
              title="Chưa có phiên thi"
              description="Thiết lập đội chơi và chọn câu hỏi để bắt đầu phiên đầu tiên."
            />
          ) : (
            <ul className="list-plain">
              {sessions.map((s) => (
                <li key={s.id} className="list-row">
                  <div className="list-row__main">
                    <strong>{s.name}</strong>
                    <div className="list-row__hint">
                      {s.config.teams.length} đội · {s.rounds.length} lượt · {formatDate(s.createdAt)}
                      {s.finalized ? ' · đã kết thúc' : ' · đang diễn ra'}
                    </div>
                  </div>
                  <div className="actions-inline">
                    {!s.finalized ? (
                      <Button variant="primary" className="btn--sm" onClick={() => navigate(`/play/${s.id}`)}>
                        Tiếp tục
                      </Button>
                    ) : null}
                    <Button className="btn--sm" onClick={() => navigate(`/results/${s.id}`)}>
                      Kết quả
                    </Button>
                    <IconButton label="Xóa phiên" onClick={() => handleDeleteSession(s.id, s.name)}>
                      <IconTrash />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>
      <Dialog
        open={pending != null}
        onClose={() => setPending(null)}
        title="Xem trước nhập Excel"
        footer={
          <>
            <Button onClick={() => setPending(null)}>Hủy</Button>
            <Button
              variant="primary"
              onClick={confirmImport}
              disabled={(pending?.preview.valid.length ?? 0) === 0}
            >
              Nhập {pending?.preview.valid.length ?? 0} câu
            </Button>
          </>
        }
      >
        {pending ? (
          <div>
            <p className="card__meta">
              <span>
                Tổng dòng: <strong>{pending.preview.totalRows}</strong>
              </span>
              <span>
                Hợp lệ: <strong>{pending.preview.valid.length}</strong>
              </span>
              <span>
                Lỗi: <strong>{pending.preview.errors.length}</strong>
              </span>
              <span>
                Trùng: <strong>{pending.preview.duplicates.length}</strong>
              </span>
            </p>
            {pending.preview.errors.length > 0 ? (
              <>
                <h3 className="card__title">Dòng lỗi (bỏ qua)</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Dòng</th>
                      <th>Cột</th>
                      <th>Lý do</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.preview.errors.slice(0, 20).map((e, i) => (
                      <tr key={i}>
                        <td>{e.row}</td>
                        <td>{e.column}</td>
                        <td>{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pending.preview.errors.length > 20 ? (
                  <p className="field__hint">Hiển thị 20 lỗi đầu tiên…</p>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </Dialog>

    </main>
  );
}

