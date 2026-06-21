import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type DialogIntent = 'default' | 'danger';
type DialogKind = 'alert' | 'confirm';

interface DialogOptions {
  title?: string;
  message: string;
  intent?: DialogIntent;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface DialogState extends Required<Pick<DialogOptions, 'message'>> {
  kind: DialogKind;
  title?: string;
  intent: DialogIntent;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (value: boolean) => void;
}

interface AppDialogApi {
  alert: (options: DialogOptions | string) => Promise<void>;
  confirm: (options: DialogOptions | string) => Promise<boolean>;
}

const AppDialogContext = createContext<AppDialogApi | null>(null);

function normalizeOptions(options: DialogOptions | string): DialogOptions {
  return typeof options === 'string' ? { message: options } : options;
}

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const openDialog = useCallback((kind: DialogKind, rawOptions: DialogOptions | string) => {
    const options = normalizeOptions(rawOptions);
    return new Promise<boolean>((resolve) => {
      setDialog({
        kind,
        title: options.title,
        message: options.message,
        intent: options.intent || 'default',
        confirmLabel: options.confirmLabel,
        cancelLabel: options.cancelLabel,
        resolve,
      });
    });
  }, []);

  const api = useMemo<AppDialogApi>(
    () => ({
      alert: async (options) => {
        await openDialog('alert', options);
      },
      confirm: (options) => openDialog('confirm', options),
    }),
    [openDialog]
  );

  const closeDialog = useCallback(
    (value: boolean) => {
      if (!dialog) return;
      dialog.resolve(value);
      setDialog(null);
    },
    [dialog]
  );

  useEffect(() => {
    if (!dialog) return;
    const timeout = window.setTimeout(() => confirmButtonRef.current?.focus(), 0);
    return () => window.clearTimeout(timeout);
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return;
    const currentDialog = dialog;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog(false);
      }
      if (event.key === 'Enter' && currentDialog.kind === 'alert') {
        event.preventDefault();
        closeDialog(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeDialog, dialog]);

  const title =
    dialog?.title ||
    (dialog?.kind === 'confirm' ? t('common.sure') : t('common.error', 'Notice'));
  const confirmLabel =
    dialog?.confirmLabel ||
    (dialog?.kind === 'confirm'
      ? dialog.intent === 'danger'
        ? t('common.delete')
        : t('common.yes')
      : t('common.close'));
  const cancelLabel = dialog?.cancelLabel || t('common.cancel');
  const Icon = dialog?.intent === 'danger' ? AlertTriangle : Info;

  return (
    <AppDialogContext.Provider value={api}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/55 px-4 backdrop-blur-[2px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-dialog-title"
            className="w-full max-w-[26rem] overflow-hidden rounded-lg border border-border bg-surface shadow-elevated"
          >
            <div className="flex items-start gap-3 border-b border-border-muted px-4 py-4">
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  dialog.intent === 'danger'
                    ? 'bg-error/10 text-error'
                    : 'bg-accent/10 text-accent'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="app-dialog-title" className="text-sm font-semibold text-text-primary">
                  {title}
                </h2>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary">
                  {dialog.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => closeDialog(false)}
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex justify-end gap-2 bg-background-secondary/55 px-4 py-3">
              {dialog.kind === 'confirm' && (
                <button
                  type="button"
                  onClick={() => closeDialog(false)}
                  className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                >
                  {cancelLabel}
                </button>
              )}
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={() => closeDialog(true)}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-soft transition-colors ${
                  dialog.intent === 'danger'
                    ? 'bg-error hover:bg-error/90'
                    : 'bg-accent hover:bg-accent-hover'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppDialogContext.Provider>
  );
}

export function useAppDialog(): AppDialogApi {
  const context = useContext(AppDialogContext);
  if (!context) {
    throw new Error('useAppDialog must be used within AppDialogProvider');
  }
  return context;
}
