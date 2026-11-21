import React from 'react';

interface InstallModalProps {
  isIos: boolean;
  onClose: () => void;
}

export const InstallModal: React.FC<InstallModalProps> = ({ isIos, onClose }) => {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#070b14]/88 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-modal-title"
      data-testid="install-modal"
    >
      <div className="animate-modal-enter w-full max-w-md bg-[#0e1424] border border-[#00f5d4]/60 rounded-xl p-5 sm:p-6 shadow-[0_0_45px_rgba(0,245,212,0.2)]">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <p className="text-[11px] font-mono-num uppercase tracking-widest text-[#00f5d4]">
              100% Offline-Capable Standalone PWA
            </p>
            <h2
              id="install-modal-title"
              className="font-display text-xl sm:text-2xl font-bold text-slate-100 mt-0.5"
            >
              Install WOB: Tommy &amp; Polly
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close install instructions"
            className="px-3 py-1.5 rounded-lg bg-[#111827] border border-slate-700 text-xs font-display font-bold uppercase tracking-wider text-slate-300 hover:border-[#00f5d4] hover:text-[#00f5d4] cursor-pointer"
          >
            Close
          </button>
        </div>

        <div className="my-4 space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {isIos ? (
            <>
              <p>
                Install <strong className="text-[#00f5d4]">WOB</strong> to your Home
                Screen for full-screen standalone launch and 100% offline play (even in
                Airplane Mode):
              </p>
              <ol className="list-decimal list-inside space-y-2 bg-[#0b0f19] border border-slate-800 rounded-lg p-3.5 font-mono-num text-xs">
                <li>
                  Tap the <strong className="text-[#00f5d4]">Share</strong> icon in
                  Safari&apos;s toolbar.
                </li>
                <li>
                  Scroll down and tap{' '}
                  <strong className="text-[#a3ff12]">Add to Home Screen</strong>.
                </li>
                <li>
                  Tap <strong className="text-[#00f5d4]">Add</strong> to launch WOB as a
                  standalone 3D app.
                </li>
              </ol>
            </>
          ) : (
            <>
              <p>
                Install <strong className="text-[#00f5d4]">WOB</strong> directly onto your
                device for standalone full-screen launch and zero-data offline play:
              </p>
              <ol className="list-decimal list-inside space-y-2 bg-[#0b0f19] border border-slate-800 rounded-lg p-3.5 font-mono-num text-xs">
                <li>
                  Open your browser menu (<strong className="text-[#00f5d4]">⋮</strong> or
                  address bar install icon).
                </li>
                <li>
                  Select{' '}
                  <strong className="text-[#a3ff12]">
                    Install App / Add to Home Screen
                  </strong>
                  .
                </li>
                <li>
                  Launch <strong className="text-[#00f5d4]">WOB</strong> anytime from your
                  home screen—even with mobile data turned off.
                </li>
              </ol>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-lg bg-[#00f5d4] text-[#070b14] font-display font-bold text-sm uppercase tracking-wider hover:bg-[#38ffe5] transition-colors cursor-pointer"
        >
          Got It
        </button>
      </div>
    </div>
  );
};
