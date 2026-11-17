import { useEffect, useState } from 'react';
import { CircleCheck, LoaderCircle } from 'lucide-react';
import { LANG_TAGS, useLang, useT, withI18n } from '../i18n';
import { ACCOUNT_EVENT, getProviders, getUser, type AccountUser } from '../lib/account';
import { getCheckoutConfig, getPlan, openCheckout, openSettings, waitForPro, type CheckoutConfig, type Period, type PlanInfo } from '../lib/billing';
import { PRO_PRICE } from '../lib/plans';
import Segmented from './ui/Segmented';

/**
 * The buy area of the Pro card on the pricing page. Shows "coming soon" until the server has payments set up,
 * asks the user to sign in first, then opens Paddle's checkout.
 */
function ProCheckout() {
  const t = useT();
  const p = t.pricing;
  const lang = useLang();
  const [cfg, setCfg] = useState<CheckoutConfig | null | undefined>(undefined);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [period, setPeriod] = useState<Period>('yearly');
  const [state, setState] = useState<'idle' | 'opening' | 'paid' | 'active' | 'slow' | 'error'>('idle');
  const [askSignIn, setAskSignIn] = useState(false);

  const refresh = async () => {
    const c = await getCheckoutConfig();
    let u: AccountUser | null = null;
    if (c && (await getProviders())?.enabled) {
      try {
        u = await getUser();
      } catch {
        u = null;
      }
    }
    setUser(u);
    setPlan(u ? await getPlan() : null);
    setCfg(c);
  };

  useEffect(() => {
    refresh();
    // Signing in happens in the settings sheet; pick it up when the user comes back to this tab
    const again = () => document.visibilityState === 'visible' && refresh();
    window.addEventListener(ACCOUNT_EVENT, refresh);
    document.addEventListener('visibilitychange', again);
    return () => {
      window.removeEventListener(ACCOUNT_EVENT, refresh);
      document.removeEventListener('visibilitychange', again);
    };
  }, []);

  const money = (n: number) => new Intl.NumberFormat(LANG_TAGS[lang], { style: 'currency', currency: PRO_PRICE.currency, maximumFractionDigits: 0 }).format(n);
  const date = (iso: string) => new Date(iso).toLocaleDateString(LANG_TAGS[lang], { dateStyle: 'long' });

  if (cfg === undefined) {
    return (
      <button type="button" className="btn btn-primary w-full" disabled>
        <LoaderCircle size={15} className="animate-spin" />
      </button>
    );
  }
  if (!cfg) {
    return (
      <button type="button" className="btn btn-primary w-full" disabled data-pro-cta="soon">
        {p.soon}
      </button>
    );
  }
  if (plan?.plan === 'pro' || state === 'active') {
    return (
      <div className="space-y-2" data-pro-cta="active">
        <p className="flex items-center justify-center gap-2 text-[14px] font-semibold text-ok">
          <CircleCheck size={16} />
          {p.active}
        </p>
        {plan?.cancelAt ? (
          <p className="text-center text-[13px] text-muted">{p.endsOn(date(plan.cancelAt))}</p>
        ) : plan?.periodEnd ? (
          <p className="text-center text-[13px] text-muted">{p.renewsOn(date(plan.periodEnd))}</p>
        ) : null}
      </div>
    );
  }
  if (state === 'paid') {
    return (
      <p className="flex items-center justify-center gap-2 text-[14px]" role="status" data-pro-cta="paid">
        <LoaderCircle size={15} className="animate-spin" />
        {p.activating}
      </p>
    );
  }

  const buy = async () => {
    if (!user) {
      setAskSignIn(true);
      openSettings();
      return;
    }
    setState('opening');
    try {
      await openCheckout(cfg, period, user, lang, async () => {
        setState('paid');
        const ok = await waitForPro();
        if (ok) await refresh();
        setState(ok ? 'active' : 'slow');
      });
      setState('idle');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="space-y-3" data-pro-cta="buy">
      <Segmented<Period>
        label={p.billingPeriod}
        value={period}
        onChange={setPeriod}
        options={[
          ['monthly', p.monthly(money(PRO_PRICE.monthly))],
          ['yearly', p.yearly(money(PRO_PRICE.yearly))],
        ]}
      />
      <button type="button" className="btn btn-primary w-full" onClick={buy} disabled={state === 'opening'}>
        {state === 'opening' && <LoaderCircle size={15} className="animate-spin" />}
        {user ? p.plans.pro.cta : p.signInToBuy}
      </button>
      {askSignIn && !user && <p className="text-center text-[13px] text-muted">{p.signInFirst}</p>}
      {state === 'slow' && (
        <p className="text-center text-[13px] text-muted" role="status">
          {p.slow}
        </p>
      )}
      {state === 'error' && (
        <p className="text-center text-[13px] text-danger" role="alert">
          {p.checkoutError}
        </p>
      )}
    </div>
  );
}

export default withI18n(ProCheckout);
