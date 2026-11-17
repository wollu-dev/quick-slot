/**
 * Sending sign-in emails. SMTP_URL picks the server (any provider that speaks SMTP).
 * Without it, links are printed to the console in development only; in production email sign-in is off.
 * Email addresses and links are never written to the log.
 */
import { config } from './config.ts';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}
export type Mailer = (mail: Mail) => Promise<void>;

export function createMailer(): Mailer | null {
  if (config.smtpUrl) {
    let transport: { sendMail: (m: object) => Promise<unknown> } | null = null;
    return async (mail) => {
      if (!transport) {
        const { createTransport } = await import('nodemailer');
        transport = createTransport(config.smtpUrl);
      }
      await transport.sendMail({ from: config.mailFrom, ...mail });
    };
  }
  if (process.env.NODE_ENV !== 'production') {
    return async (mail) => {
      // Development only: there is no mail server, so show the link where the developer can click it
      console.log(`[dev mail] ${mail.subject}\n${mail.text}`);
    };
  }
  return null;
}

type Lang = 'ko' | 'en' | 'ja';
const COPY: Record<Lang, { subject: string; lead: string; button: string; note: string }> = {
  ko: { subject: 'QuickSlot 로그인 링크', lead: '아래 버튼을 누르면 QuickSlot에 로그인돼요. 링크는 10분 동안, 한 번만 쓸 수 있어요.', button: '로그인', note: '로그인을 요청하지 않았다면 이 메일은 무시하세요.' },
  en: { subject: 'Your QuickSlot sign-in link', lead: 'Press the button below to sign in to QuickSlot. The link works once, for 10 minutes.', button: 'Sign in', note: 'If you didn’t ask to sign in, you can ignore this email.' },
  ja: { subject: 'QuickSlot ログインリンク', lead: '下のボタンを押すと QuickSlot にログインします。リンクは10分間、1回だけ使えます。', button: 'ログイン', note: 'ログインを依頼していない場合は、このメールを無視してください。' },
};

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The sign-in email in the language the user chose on the site (Korean when unknown) */
export function signInMail(to: string, url: string, lang: unknown): Mail {
  const c = COPY[(['ko', 'en', 'ja'] as const).find((l) => l === lang) ?? 'ko'];
  return {
    to,
    subject: c.subject,
    text: `${c.lead}\n\n${url}\n\n${c.note}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;line-height:1.6;color:#1d1d1f">
<p>${escape(c.lead)}</p>
<p><a href="${escape(url)}" style="display:inline-block;padding:10px 22px;border-radius:999px;background:#0071e3;color:#fff;text-decoration:none;font-weight:600">${escape(c.button)}</a></p>
<p style="color:#6e6e73;font-size:13px">${escape(c.note)}</p>
</div>`,
  };
}
