import { useEffect } from 'react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-[360px] rounded-xl bg-surface p-5 shadow-2xl ring-1 ring-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1.5 text-base font-semibold text-ink">{title}</h2>
        <p className="mb-5 text-sm text-ink-muted">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 rounded-md border border-black/10 px-4 text-sm text-ink-muted hover:text-ink hover:bg-surface-sunken"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-8 rounded-md bg-red-500 px-4 text-sm text-white hover:opacity-90"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}