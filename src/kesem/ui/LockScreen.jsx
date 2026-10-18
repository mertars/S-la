import { useEffect, useRef, useState } from "react";
import { Fingerprint } from "lucide-react";
import { Jar } from "./art";
import { useApp } from "./appctx";
import { confirmForgotPin, LOCK_SUB, LOCK_WAIT, LOCK_WRONG, lockTitle } from "../texts";
import { PinPad } from "./PinPad";
import Sheet from "./Sheet";
import { ConfirmSheetBody } from "./common";
import { bioAuth, bioAvailable, nextLockoutMs, verifyPin } from "../state/lock";
import { useKesem } from "../state/store";

// Tam ekran kilit — kilit açılana dek hiçbir sayfa/veri DOM'a konmaz.
export default function LockScreen({ onUnlock }) {
  const k = useKesem();
  const app = useApp();
  const lock = k.lock;
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [bio, setBio] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const busy = useRef(false);
  const remaining = Math.max(0, Math.ceil(((lock.lockedUntil || 0) - now) / 1000));

  useEffect(() => { if (lock.bio?.credId) bioAvailable().then(setBio); }, [lock.bio?.credId]);
  useEffect(() => {
    if (!remaining) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [remaining > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const check = async (value) => {
    if (busy.current) return;
    busy.current = true;
    const ok = await verifyPin(lock, value);
    if (ok) {
      await k.saveLock({ fails: 0, lockedUntil: 0 });
      onUnlock();
    } else {
      const fails = (lock.fails || 0) + 1;
      const wait = nextLockoutMs(fails);
      await k.saveLock({ fails, lockedUntil: wait ? Date.now() + wait : 0 });
      setNow(Date.now());
      setError(wait ? LOCK_WAIT : LOCK_WRONG);
      setTimeout(() => { setPin(""); setError(""); }, 650);
    }
    busy.current = false;
  };
  const tryBio = async () => {
    if (await bioAuth(lock.bio.credId)) {
      await k.saveLock({ fails: 0, lockedUntil: 0 });
      onUnlock();
    } else setError("Biyometrik doğrulama yapılamadı. PIN'ini gir.");
  };

  return (
    <div className="k-lock" role="dialog" aria-modal="true" aria-label="Uygulama kilitli">
      <div className="k-lock-inner">
        <Jar level={0.42} size={64} coins={false} />
        <h1 className="k-lock-title">{lockTitle(app.names)}</h1>
        <p className="k-lock-sub" role={error || remaining ? "alert" : undefined}>
          {remaining ? `${remaining} sn sonra tekrar deneyebilirsin` : error || LOCK_SUB}
        </p>
        <PinPad length={lock.len || 4} value={pin} onChange={setPin} onComplete={check} error={!!error} disabled={remaining > 0}
          extra={bio ? <button type="button" className="k-key" onClick={tryBio} aria-label="Biyometrik ile aç"><Fingerprint size={24} /></button> : null} />
        <button type="button" className="k-btn ghost sm" style={{ marginTop: 18 }} onClick={() => setConfirmWipe(true)}>PIN'imi unuttum</button>
      </div>
      {confirmWipe && (
        <Sheet open onClose={() => setConfirmWipe(false)} title="PIN'ini mi unuttun?" size="sm">
          <ConfirmSheetBody
            text={confirmForgotPin(app.names)}
            confirmLabel="Tüm verileri sil"
            onCancel={() => setConfirmWipe(false)}
            onConfirm={async () => { setConfirmWipe(false); await k.wipeAll(); onUnlock(); }}
          />
        </Sheet>
      )}
    </div>
  );
}
