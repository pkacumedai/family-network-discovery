'use client';
import { useState } from 'react';
export function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(verify: boolean) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/auth/${verify ? 'sign-in/email-otp' : 'email-otp/send-verification-otp'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verify ? { email: email.trim().toLowerCase(), otp: code } : { email: email.trim().toLowerCase(), type: 'sign-in' }),
      });
      if (!response.ok) { setMessage(response.status === 429 ? 'Please wait a minute before trying again.' : verify ? 'Code could not be verified. Check it or request a new code.' : 'Unable to send a code right now. Please try again.'); return; }
      if (verify) window.location.reload();
      else { setSent(true); setCode(''); setMessage('If this email is eligible, a code is on its way. It expires in five minutes.'); }
    } catch { setMessage('Unable to connect. Please try again.'); }
    finally { setBusy(false); }
  }
  return <main className="notice auth-panel"><h1>Family Network</h1><p>Sign in to explore your family.</p>
    <form onSubmit={e => { e.preventDefault(); void submit(sent); }}>
      <label htmlFor="auth-email">Email address</label><input id="auth-email" type="email" autoComplete="email" required value={email} disabled={sent || busy} onChange={e => setEmail(e.target.value)} />
      {sent && <><label htmlFor="auth-code">Six-digit code</label><input id="auth-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value)} /></>}
      <button disabled={busy}>{busy ? 'Please wait…' : sent ? 'Verify code' : 'Send code'}</button>
    </form>
    {sent && <div><button disabled={busy} onClick={() => void submit(false)}>Resend code</button> <button disabled={busy} onClick={() => { setSent(false); setMessage(''); }}>Use another email</button></div>}
    <p role="status">{message}</p>
  </main>;
}
export function Logout() {
  const [failed, setFailed] = useState(false);
  return <><button className="logout-button" onClick={async () => {
    try { const response = await fetch('/api/auth/sign-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) throw new Error(); window.location.reload();
    } catch { setFailed(true); }
  }}>Log out</button>{failed && <p role="alert">Logout failed. Please try again.</p>}</>;
}
