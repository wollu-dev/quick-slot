import { useEffect, useState, type ReactNode } from 'react';
import { CircleCheck, LoaderCircle, Mail, UserRound } from 'lucide-react';
import { LANG_TAGS, useLang, useT } from '../i18n';
import { getPlan, type PlanInfo } from '../lib/billing';
import Rich from '../i18n/Rich';
import { AccountFailure, deleteAccount, getProviders, getUser, isEmail, sendSignInLink, signInWith, signOut, type AccountError, type AccountUser, type Providers } from '../lib/account';

/**
 * The "Account" group at the top of the settings sheet. Hidden when the server has accounts off
 * (or can't be reached), so self-hosted copies without a database look exactly as before.
 */
export default function AccountSection({ Group }: { Group: (p: { title: string; footer?: string; children: ReactNode }) => ReactNode }) {
  const t = useT();
  const a = t.settings.account;
  const lang = useLang();
  const [providers, setProviders] = useState<Providers | null | undefined>(undefined);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<AccountError | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await getProviders();
      if (!alive) return;
      if (p?.enabled) {
        try {
          const u = await getUser();
          if (alive) setUser(u);
          if (u) {
            const pl = await getPlan();
            if (alive) setPlan(pl);
          }
        } catch {
          /* treat as signed out */
        }
      }
      if (alive) setProviders(p?.enabled ? p : null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof AccountFailure ? e.code : 'failed');
    }
    setBusy(null);
  };

  if (providers === undefined) {
    return (
      <Group title={a.title}>
        <div className="flex min-h-12 items-center gap-2 px-4 text-[15px] text-muted">
          <LoaderCircle size={15} className="animate-spin" />
        </div>
      </Group>
    );
  }
  if (!providers) return null;

  const errorRow = error && (
    <p className="px-4 py-2.5 text-[13px] text-danger" role="alert">
      {a.errors[error]}
    </p>
  );

  if (user) {
    return (
      <Group title={a.title} footer={a.signedInNote}>
        <div className="flex min-h-14 items-center gap-3 py-2 pr-2 pl-4" data-account-user>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-[15px] font-semibold text-accent-fg" aria-hidden>
            {(user.name || user.email).trim().charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            {user.name && <span className="block truncate text-[15px] font-medium">{user.name}</span>}
            <span className="block truncate text-[14px] text-muted">{user.email}</span>
          </span>
        </div>
        <div className="flex min-h-12 items-center justify-between gap-3 py-2 pr-4 pl-4">
          <span className="text-[15px]">{a.plan}</span>
          <span className="min-w-0 text-right" data-account-plan>
            <span className={`block text-[15px] ${plan?.plan === 'pro' ? 'font-semibold text-accent' : 'text-muted'}`}>{plan?.plan === 'pro' ? 'Pro' : a.free}</span>
            {plan?.plan === 'pro' && (plan.cancelAt || plan.periodEnd) && (
              <span className="block text-[12px] text-muted">
                {plan.cancelAt
                  ? a.ends(new Date(plan.cancelAt).toLocaleDateString(LANG_TAGS[lang], { dateStyle: 'medium' }))
                  : a.renews(new Date(plan.periodEnd!).toLocaleDateString(LANG_TAGS[lang], { dateStyle: 'medium' }))}
              </span>
            )}
          </span>
        </div>
        {errorRow}
        <button
          type="button"
          className="flex min-h-12 w-full items-center px-4 text-left text-[15px] text-accent hover:bg-panel-2 disabled:opacity-50"
          disabled={!!busy}
          onClick={() =>
            run('signOut', async () => {
              await signOut();
              setUser(null);
            })
          }
        >
          {a.signOut}
        </button>
        {confirmDelete ? (
          <div className="space-y-3 p-4" role="group" aria-labelledby="account-delete-warning">
            <p id="account-delete-warning" className="text-[14px] leading-snug">
              <Rich text={a.deleteWarning} />
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn bg-danger text-accent-fg hover:opacity-90"
                disabled={!!busy}
                onClick={() =>
                  run('delete', async () => {
                    await deleteAccount();
                    setUser(null);
                    setConfirmDelete(false);
                    setDeleted(true);
                  })
                }
              >
                {busy === 'delete' && <LoaderCircle size={15} className="animate-spin" />}
                {a.deleteYes}
              </button>
              <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
                {a.cancel}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="flex min-h-12 w-full items-center px-4 text-left text-[15px] text-danger hover:bg-panel-2" onClick={() => setConfirmDelete(true)}>
            {a.delete}
          </button>
        )}
      </Group>
    );
  }

  return (
    <Group title={a.title} footer={a.why}>
      {deleted && (
        <p className="flex items-center gap-2 px-4 py-3 text-[14px] text-ok" role="status">
          <CircleCheck size={16} className="shrink-0" />
          {a.deleted}
        </p>
      )}
      {providers.email &&
        (sentTo ? (
          <div className="space-y-1 px-4 py-3" role="status" data-link-sent>
            <p className="flex items-start gap-2 text-[15px]">
              <Mail size={16} className="mt-0.5 shrink-0 text-accent" />
              <span className="min-w-0 break-words">
                <Rich text={a.sent(sentTo)} />
              </span>
            </p>
            <button type="button" className="text-[14px] text-accent hover:opacity-80" onClick={() => setSentTo(null)}>
              {a.otherEmail}
            </button>
          </div>
        ) : (
          <form
            className="flex flex-wrap items-center gap-2 p-3 pl-4"
            onSubmit={(e) => {
              e.preventDefault();
              run('email', async () => {
                await sendSignInLink(email, lang);
                setSentTo(email.trim());
                setDeleted(false);
              });
            }}
          >
            <input
              type="email"
              className="input min-w-0 flex-1 basis-48"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={a.emailPlaceholder}
              aria-label={a.email}
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
            />
            <button type="submit" className="btn btn-primary" disabled={!!busy || !isEmail(email)}>
              {busy === 'email' && <LoaderCircle size={15} className="animate-spin" />}
              {a.sendLink}
            </button>
          </form>
        ))}
      {errorRow}
      {(['google', 'apple'] as const)
        .filter((p) => providers[p])
        .map((p) => (
          <button
            key={p}
            type="button"
            className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-[15px] text-accent hover:bg-panel-2 disabled:opacity-50"
            disabled={!!busy}
            onClick={() => run(p, () => signInWith(p))}
          >
            {busy === p ? <LoaderCircle size={15} className="animate-spin" /> : <UserRound size={15} />}
            {p === 'google' ? a.google : a.apple}
          </button>
        ))}
    </Group>
  );
}
