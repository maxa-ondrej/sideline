import React from 'react';

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface DismissRecord {
  timestamp: number;
}

function isDismissRecord(value: unknown): value is DismissRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'timestamp' in value &&
    typeof (value as Record<string, unknown>).timestamp === 'number'
  );
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw === null) return false;
    const parsed: unknown = JSON.parse(raw);
    if (!isDismissRecord(parsed)) return false;
    return Date.now() - parsed.timestamp < DISMISS_EXPIRY_MS;
  } catch {
    return false;
  }
}

function persistDismiss(): void {
  const record: DismissRecord = { timestamp: Date.now() };
  localStorage.setItem(DISMISS_KEY, JSON.stringify(record));
}

function detectIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function detectStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches;
}

interface PwaInstallState {
  canInstall: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  promptInstall: () => Promise<void>;
  dismiss: () => void;
}

export function usePwaInstall(): PwaInstallState {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = React.useState<boolean>(() => isDismissed());
  const [isInstalled, setIsInstalled] = React.useState<boolean>(false);
  const [isIOS, setIsIOS] = React.useState<boolean>(false);

  React.useEffect(() => {
    setIsInstalled(detectStandalone());
    setIsIOS(detectIOS());

    const handler = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const standaloneHandler = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches);
    };
    standaloneQuery.addEventListener('change', standaloneHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      standaloneQuery.removeEventListener('change', standaloneHandler);
    };
  }, []);

  const promptInstall = React.useCallback(async () => {
    if (deferredPrompt === null) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const dismiss = React.useCallback(() => {
    persistDismiss();
    setDismissed(true);
  }, []);

  const canInstall = !isInstalled && !dismissed && (deferredPrompt !== null || isIOS);

  return { canInstall, isInstalled, isIOS, promptInstall, dismiss };
}
