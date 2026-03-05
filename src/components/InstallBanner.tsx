import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

const InstallBanner = () => {
  const { canInstall, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (!canInstall || dismissed) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg">
        <Download className="w-5 h-5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">התקן את האפליקציה</p>
          <p className="text-xs opacity-80">גישה מהירה ממסך הבית</p>
        </div>
        <button
          onClick={install}
          className="bg-primary-foreground text-primary text-sm font-bold px-4 py-1.5 rounded-xl shrink-0 hover:opacity-90 transition-opacity"
        >
          התקן
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-full hover:bg-primary-foreground/20 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default InstallBanner;
