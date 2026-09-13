import { useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

interface AuthPanelProps {
  authLoading: boolean;
  userEmail?: string;
  onSignedOut: () => void;
}

type AuthMode = 'sign-in' | 'sign-up';

const AuthPanel = ({ authLoading, userEmail, onSignedOut }: AuthPanelProps) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (!isSupabaseConfigured || !supabase) {
    return (
      <span className="cloud-status cloud-status-local" title="当前为本地模式，数据只保存在本浏览器。配置 Supabase 后可跨设备同步。">
        本地模式（仅本浏览器）
      </span>
    );
  }
  const client = supabase;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    const result = mode === 'sign-in'
      ? await client.auth.signInWithPassword({ email, password })
      : await client.auth.signUp({
          email,
          password,
          options: {
            // Do not rely on Supabase's global Site URL: this app is hosted under
            // a GitHub Pages project path rather than the account root.
            emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).toString(),
          },
        });

    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === 'sign-up' && !result.data.session) {
      setMessage('注册成功，请检查邮箱完成确认后再登录。');
      return;
    }

    setMessage('登录成功');
    setOpen(false);
    setPassword('');
  };

  const handleSignOut = async () => {
    setBusy(true);
    const { error } = await client.auth.signOut();
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    onSignedOut();
  };

  if (authLoading) return <span className="cloud-status">检查云端登录状态…</span>;

  if (userEmail) {
    return (
      <div className="auth-summary">
        <span className="cloud-status cloud-status-connected" title={userEmail}>
          已连接云端 · {userEmail}
        </span>
        <button type="button" className="btn btn-mini btn-light" onClick={handleSignOut} disabled={busy}>
          退出登录
        </button>
        {message ? <span className="auth-message">{message}</span> : null}
      </div>
    );
  }

  return (
    <>
      <span className="cloud-status">登录后跨设备同步</span>
      <button
        type="button"
        className="btn btn-mini btn-light"
        onClick={() => {
          setOpen(true);
          setMessage('');
        }}
      >
        登录 / 注册
      </button>

      {open ? (
        <div className="modal-backdrop no-print" role="dialog" aria-modal="true" aria-label="登录云端">
          <section className="modal-card auth-modal-card">
            <div className="section-title-line">
              <h4>{mode === 'sign-in' ? '登录云端' : '注册账号'}</h4>
              <button type="button" className="btn btn-mini btn-light" onClick={() => setOpen(false)}>
                关闭
              </button>
            </div>
            <p className="auth-help">登录后可在不同浏览器和设备间同步你的全部人物与版本。冲突时以云端为准，本地改动会保留为快照。</p>
            <form className="auth-form" onSubmit={handleSubmit}>
              <label>
                邮箱
                <input
                  className="text-input"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                密码
                <input
                  className="text-input"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                  minLength={6}
                  required
                />
              </label>
              {message ? <p className="error-text">{message}</p> : null}
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? '处理中…' : mode === 'sign-in' ? '登录' : '注册'}
              </button>
            </form>
            <button
              type="button"
              className="auth-mode-switch"
              onClick={() => {
                setMode((current) => current === 'sign-in' ? 'sign-up' : 'sign-in');
                setMessage('');
              }}
            >
              {mode === 'sign-in' ? '还没有账号？注册' : '已有账号？返回登录'}
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
};

export default AuthPanel;
