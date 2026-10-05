// Trình soạn bộ câu hỏi: sửa thông tin bộ, thêm/sửa/xóa câu, nhập và xuất Excel.
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { navigate } from '../../app/useRoute';
import { useToast } from '../../components/Toast';
import { useUnsavedChangesWarning } from '../../lib/useUnsavedChanges';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DifficultyBadge,
  EmptyState,
  Field,
  IconButton,
} from '../../components/ui';
import {
  IconDownload,
  IconEdit,
  IconPlus,
  IconTrash,
  IconUpload,
} from '../../components/icons';
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  LIMITS,
  type Difficulty,
  type QuestionSet,
} from '../../domain/types';
import {
  draftFromQuestion,
  emptyDraft,
  OPTION_LETTERS,
  validateDraft,
  type FieldIssue,
  type QuestionDraft,
} from '../../domain/question';
import { buildSetWorkbook, parseXlsxFile, workbookToBlob } from '../import/excel';
import { downloadBlob } from '../../lib/download';

function issueFor(issues: FieldIssue[], field: string): string | undefined {
  return issues.find((i) => i.field === field)?.message;
}

export function EditorPage({ setId }: { setId: string }) {
  const { ready, sets, updateSet } = useApp();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const source = useMemo(() => sets.find((s) => s.id === setId) ?? null, [sets, setId]);
  const [set, setSet] = useState<QuestionSet | null>(source);
  const [dirty, setDirty] = useState(false);
  const [title, setTitle] = useState(source?.title ?? '');
  const [description, setDescription] = useState(source?.description ?? '');

  const [editing, setEditing] = useState<{ index: number | null; draft: QuestionDraft } | null>(null);
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [busy, setBusy] = useState(false);

  useUnsavedChangesWarning(dirty);

  useEffect(() => {
    if (source && !set) {
      setSet(source);
      setTitle(source.title);
      setDescription(source.description);
    }
  }, [source, set]);

  async function persist(next: QuestionSet, message: string) {
    const stamped: QuestionSet = { ...next, updatedAt: new Date().toISOString() };
    await updateSet(stamped);
    setSet(stamped);
    setDirty(false);
    if (message) toast.success(message);
  }

  async function handleSaveMeta() {
    if (!set) return;
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error('Tên bộ câu hỏi không được để trống.');
      return;
    }
    await persist({ ...set, title: trimmed, description: description.trim() }, 'Đã lưu thông tin bộ.');
  }

  function openNew() {
    setIssues([]);
    setEditing({ index: null, draft: emptyDraft() });
  }

  function openEdit(index: number) {
    if (!set) return;
    setIssues([]);
    setEditing({ index, draft: draftFromQuestion(set.questions[index]) });
  }

  function saveQuestion() {
    if (!set || !editing) return;
    const existing = editing.index != null ? set.questions[editing.index] : undefined;
    const result = validateDraft(editing.draft, existing?.id);
    if (!result.ok) {
      setIssues(result.issues);
      return;
    }
    const questions = set.questions.slice();
    if (editing.index != null) questions[editing.index] = result.question;
    else questions.push(result.question);
    setEditing(null);
    setIssues([]);
    setDirty(true);
    void persist({ ...set, questions }, editing.index != null ? 'Đã cập nhật câu hỏi.' : 'Đã thêm câu hỏi.');
  }

  function removeQuestion(index: number) {
    if (!set) return;
    const questions = set.questions.filter((_, i) => i !== index);
    setDirty(true);
    void persist({ ...set, questions }, 'Đã xóa câu hỏi.');
  }

  function moveQuestion(index: number, delta: number) {
    if (!set) return;
    const target = index + delta;
    if (target < 0 || target >= set.questions.length) return;
    const questions = set.questions.slice();
    const [item] = questions.splice(index, 1);
    questions.splice(target, 0, item);
    setDirty(true);
    void persist({ ...set, questions }, '');
  }

  async function handleExport() {
    if (!set) return;
    try {
      const workbook = await buildSetWorkbook(set);
      const blob = await workbookToBlob(workbook);
      downloadBlob(blob, `${set.title.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.xlsx`, blob.type);
    } catch {
      toast.error('Không xuất được bộ câu hỏi.');
    }
  }

  async function onImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !set) return;
    setBusy(true);
    try {
      const preview = await parseXlsxFile(file);
      if (preview.valid.length === 0) {
        toast.error('Không có câu hợp lệ trong file.');
        return;
      }
      const questions = [...set.questions, ...preview.valid];
      await persist(
        { ...set, questions },
        `Đã nhập ${preview.valid.length} câu (bỏ qua ${preview.errors.length} dòng lỗi).`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không đọc được file.');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <main className="page">
        <div className="container">
          <Card>Đang tải bộ câu hỏi…</Card>
        </div>
      </main>
    );
  }

  if (!set) {
    return (
      <main className="page">
        <div className="container">
          <Card>
            <h2 className="card__title">Không tìm thấy bộ câu hỏi</h2>
            <p>Bộ này có thể đã bị xóa.</p>
            <Button variant="primary" onClick={() => navigate('/')}>
              Về thư viện
            </Button>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <div className="page-head">
          <div>
            <h1>{set.title || 'Bộ câu hỏi'}</h1>
            <p>{set.questions.length} câu hỏi · Cập nhật {new Date(set.updatedAt).toLocaleString('vi-VN')}</p>
          </div>
          <div className="actions-inline">
            <Button onClick={() => navigate('/')}>Về thư viện</Button>
            <Button onClick={handleExport}>
              <IconDownload size={18} /> Xuất Excel
            </Button>
            <Button onClick={() => navigate('/setup')}>Thiết lập phiên</Button>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)', marginBottom: 'calc(var(--space) * 4)' }}>
          <Card as="section">
            <h2 className="card__title">Thông tin bộ câu hỏi</h2>
            <Field label="Tên bộ" htmlFor="set-title">
              <input
                id="set-title"
                type="text"
                value={title}
                maxLength={120}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
              />
            </Field>
            <Field label="Mô tả" hint="Tùy chọn — mô tả ngắn để nhận diện bộ câu hỏi." htmlFor="set-desc">
              <textarea
                id="set-desc"
                value={description}
                maxLength={300}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDirty(true);
                }}
              />
            </Field>
            <div className="actions-inline">
              <Button variant="primary" onClick={handleSaveMeta} disabled={!dirty}>
                Lưu thông tin bộ
              </Button>
              <Badge tone="neutral">
                {LIMITS.minQuestionsPerTeam}+ câu/đội · khuyến nghị {LIMITS.recommendedQuestionsPerTeam}
              </Badge>
            </div>
          </Card>
        </div>

        <div className="toolbar">
          <Button variant="primary" onClick={openNew}>
            <IconPlus size={18} /> Thêm câu hỏi
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            style={{ display: 'none' }}
            onChange={onImportFile}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            <IconUpload size={18} /> {busy ? 'Đang đọc…' : 'Nhập thêm từ Excel'}
          </Button>
          <Badge tone="brand">{set.questions.length} câu</Badge>
        </div>

        {set.questions.length === 0 ? (
          <EmptyState
            title="Bộ câu hỏi đang trống"
            description="Thêm câu hỏi thủ công hoặc nhập từ file Excel để bắt đầu."
            action={
              <Button variant="primary" onClick={openNew}>
                <IconPlus size={18} /> Thêm câu hỏi
              </Button>
            }
          />
        ) : (
          <ul className="list-plain">
            {set.questions.map((q, index) => (
              <li key={q.id} className="list-row">
                <span className="stepper__num">{index + 1}</span>
                <div className="list-row__main">
                  <strong>{q.text}</strong>
                  <div className="list-row__hint">
                    {q.options.map((o, i) => (
                      <span key={o.id} style={{ marginRight: 12 }}>
                        {OPTION_LETTERS[i]}. {o.text}
                        {o.id === q.correctOptionId ? ' ✔' : ''}
                      </span>
                    ))}
                  </div>
                  <div className="list-row__hint">
                    {q.topic} · <DifficultyBadge difficulty={q.difficulty} />
                  </div>
                </div>
                <div className="actions-inline">
                  <IconButton label="Lên" onClick={() => moveQuestion(index, -1)} disabled={index === 0}>
                    ▲
                  </IconButton>
                  <IconButton
                    label="Xuống"
                    onClick={() => moveQuestion(index, 1)}
                    disabled={index === set.questions.length - 1}
                  >
                    ▼
                  </IconButton>
                  <IconButton label="Sửa câu hỏi" onClick={() => openEdit(index)}>
                    <IconEdit />
                  </IconButton>
                  <IconButton label="Xóa câu hỏi" onClick={() => removeQuestion(index)}>
                    <IconTrash />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}

      </div>
      <Dialog
        open={editing != null}
        onClose={() => {
          setEditing(null);
          setIssues([]);
        }}
        title={editing?.index != null ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}
        footer={
          <>
            <Button
              onClick={() => {
                setEditing(null);
                setIssues([]);
              }}
            >
              Hủy
            </Button>
            <Button variant="primary" onClick={saveQuestion}>
              {editing?.index != null ? 'Lưu câu hỏi' : 'Thêm câu hỏi'}
            </Button>
          </>
        }
      >
        {editing ? (
          <div>
            <Field label="Nội dung câu hỏi" error={issueFor(issues, 'text')} htmlFor="q-text">
              <textarea
                id="q-text"
                value={editing.draft.text}
                maxLength={LIMITS.questionText}
                onChange={(e) =>
                  setEditing({ ...editing, draft: { ...editing.draft, text: e.target.value } })
                }
              />
            </Field>
            {editing.draft.options.map((opt, i) => (
              <Field
                key={i}
                label={`Đáp án ${OPTION_LETTERS[i]}`}
                error={issueFor(issues, `option${i}`)}
                htmlFor={`q-opt-${i}`}
              >
                <div className="actions-inline" style={{ alignItems: 'center' }}>
                  <input
                    id={`q-opt-${i}`}
                    type="radio"
                    name="correct-option"
                    style={{ width: 'auto' }}
                    aria-label={`Chọn ${OPTION_LETTERS[i]} là đáp án đúng`}
                    checked={editing.draft.correctIndex === i}
                    onChange={() =>
                      setEditing({
                        ...editing,
                        draft: { ...editing.draft, correctIndex: i as 0 | 1 | 2 | 3 },
                      })
                    }
                  />
                  <input
                    type="text"
                    value={opt}
                    maxLength={LIMITS.optionText}
                    onChange={(e) => {
                      const options = editing.draft.options.slice() as [string, string, string, string];
                      options[i] = e.target.value;
                      setEditing({ ...editing, draft: { ...editing.draft, options } });
                    }}
                  />
                </div>
              </Field>
            ))}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <Field label="Chủ đề" hint="Để trống sẽ dùng nhóm “Chung”." error={issueFor(issues, 'topic')} htmlFor="q-topic">
                <input
                  id="q-topic"
                  type="text"
                  value={editing.draft.topic}
                  maxLength={LIMITS.topic}
                  onChange={(e) =>
                    setEditing({ ...editing, draft: { ...editing.draft, topic: e.target.value } })
                  }
                />
              </Field>
              <Field label="Độ khó" error={issueFor(issues, 'difficulty')} htmlFor="q-diff">
                <select
                  id="q-diff"
                  value={editing.draft.difficulty}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      draft: { ...editing.draft, difficulty: e.target.value as Difficulty },
                    })
                  }
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {DIFFICULTY_LABELS[d]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              label="Giải thích"
              hint="Tùy chọn — hiện sau khi trả lời để củng cố kiến thức."
              error={issueFor(issues, 'explanation')}
              htmlFor="q-exp"
            >
              <textarea
                id="q-exp"
                value={editing.draft.explanation}
                maxLength={LIMITS.explanation}
                onChange={(e) =>
                  setEditing({ ...editing, draft: { ...editing.draft, explanation: e.target.value } })
                }
              />
            </Field>
          </div>
        ) : null}
      </Dialog>

    </main>
  );
}

