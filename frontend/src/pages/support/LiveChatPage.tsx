import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '../../layouts/AppLayout';

/* ─────────────────────────────────────────
   TIPOS
───────────────────────────────────────── */
interface Option {
  label: string;
  next: string;
  icon?: React.ReactNode;
  href?: string;
  labelKey?: string;
}

interface BotNode {
  message: string;
  options?: Option[];
  isEnd?: boolean;
}

interface ChatMsg {
  id: number;
  sender: 'bot' | 'user';
  text: string;
  textKey?: string;
  time: string;
  options?: Option[];
  optionsUsed?: boolean;
}

/* ─────────────────────────────────────────
   ÍCONES SVG
───────────────────────────────────────── */
const IconBot = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <path d="M12 11V7" />
    <circle cx="12" cy="5" r="2" />
    <path d="M8 15h.01M16 15h.01" />
  </svg>
);

const IconArrow = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const IconCheck = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

const IconKey = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.59 7.59a5 5 0 1 0-7.07 7.07 5 5 0 0 0 7.07-7.07z" />
    <path d="M15 6l3 3" />
  </svg>
);
const IconBox = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);
const IconReturn = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);
const IconFile = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);
const IconTruck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);
const IconDots = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);
const IconExternal = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

/* ─────────────────────────────────────────
   ÁRVORE DE DECISÃO
───────────────────────────────────────── */
const BOT: Record<string, BotNode> = {

  start: {
    message: 'help.bot.start.message',
    options: [
      { label: 'help.bot.start.options.key_menu',  next: 'key_menu',      icon: <IconKey /> },
      { label: 'help.bot.start.options.order_menu',    next: 'order_menu',    icon: <IconBox /> },
      { label: 'help.bot.start.options.return_menu',        next: 'return_menu',   icon: <IconReturn /> },
      { label: 'help.bot.start.options.invoice_menu',   next: 'invoice_menu',  icon: <IconFile /> },
      { label: 'help.bot.start.options.shipping_menu',     next: 'shipping_menu', icon: <IconTruck /> },
      { label: 'help.bot.start.options.account_link',         next: 'account_link',  icon: <IconDots />, href: '/account/orders' },
      { label: 'help.bot.start.options.other',                next: 'other',         icon: <IconDots /> },
    ],
  },

  account_link: {
    message: 'help.bot.account_link.message',
    options: [
      { label: 'help.bot.account_link.options.go_to_account', next: 'start', href: '/account/orders' },
      { label: 'help.bot.account_link.options.back_to_menu',        next: 'start' },
    ],
  },

  /* ── Chaves ── */
  key_menu: {
    message: 'help.bot.key_menu.message',
    options: [
      { label: 'help.bot.key_menu.options.no_email',   next: 'key_no_email' },
      { label: 'help.bot.key_menu.options.not_work',   next: 'key_not_work' },
      { label: 'help.bot.key_menu.options.activate',    next: 'key_activate' },
      { label: 'help.bot.key_menu.options.lost',  next: 'key_lost'     },
      { label: 'help.bot.key_menu.options.view_keys',  next: 'start',        href: '/account/orders' },
      { label: 'help.bot.key_menu.options.main_menu',       next: 'start'        },
    ],
  },
  key_no_email: {
    message: 'help.bot.key_no_email.message',
    options: [
      { label: 'help.bot.key_no_email.options.view_keys',            next: 'start',        href: '/account/orders' },
      { label: 'help.bot.key_no_email.options.checked_all',        next: 'key_contact' },
      { label: 'help.bot.key_no_email.options.resolved',            next: 'resolved'    },
      { label: 'help.bot.key_no_email.options.back',                         next: 'key_menu'    },
    ],
  },
  key_not_work: {
    message: 'help.bot.key_not_work.message',
    options: [
      { label: 'help.bot.key_not_work.options.view_keys',            next: 'start',        href: '/account/orders' },
      { label: 'help.bot.key_not_work.options.still_failing',         next: 'key_contact' },
      { label: 'help.bot.key_not_work.options.resolved',            next: 'resolved'    },
      { label: 'help.bot.key_not_work.options.back',                         next: 'key_menu'    },
    ],
  },
  key_activate: {
    message: 'help.bot.key_activate.message',
    options: [
      { label: 'help.bot.key_activate.options.need_more_help',          next: 'key_contact' },
      { label: 'help.bot.key_activate.options.activated',                next: 'resolved'    },
      { label: 'help.bot.key_activate.options.back',                         next: 'key_menu'    },
    ],
  },
  key_lost: {
    message: 'help.bot.key_lost.message',
    options: [
      { label: 'help.bot.key_lost.options.go_orders',   next: 'start',        href: '/account/orders' },
      { label: 'help.bot.key_lost.options.no_account_access',     next: 'key_contact' },
      { label: 'help.bot.key_lost.options.found_key',              next: 'resolved'    },
      { label: 'help.bot.key_lost.options.back',                         next: 'key_menu'    },
    ],
  },
  key_contact: {
    message: 'help.bot.key_contact.message',
    options: [
      { label: 'help.bot.key_contact.options.got_it',                  next: 'resolved' },
      { label: 'help.bot.key_contact.options.back_to_menu',   next: 'start'    },
    ],
  },

  /* ── Pedido ── */
  order_menu: {
    message: 'help.bot.order_menu.message',
    options: [
      { label: 'help.bot.order_menu.options.track_order',           next: 'order_track' },
      { label: 'help.bot.order_menu.options.order_not_arrived',         next: 'order_late'  },
      { label: 'help.bot.order_menu.options.wrong_product',          next: 'order_wrong' },
      { label: 'help.bot.order_menu.options.damaged_product',          next: 'order_damaged' },
      { label: 'help.bot.order_menu.options.view_orders',              next: 'start',        href: '/account/orders' },
      { label: 'help.bot.order_menu.options.main_menu',             next: 'start'        },
    ],
  },
  order_track: {
    message: 'help.bot.order_track.message',
    options: [
      { label: 'help.bot.order_track.options.go_orders',       next: 'start',        href: '/account/orders' },
      { label: 'help.bot.order_track.options.no_tracking_link',        next: 'order_contact' },
      { label: 'help.bot.order_track.options.tracked',                  next: 'resolved'      },
      { label: 'help.bot.order_track.options.back',                             next: 'order_menu'    },
    ],
  },
  order_late: {
    message: 'help.bot.order_late.message',
    options: [
      { label: 'help.bot.order_late.options.open_investigation',            next: 'order_contact' },
      { label: 'help.bot.order_late.options.wait',                        next: 'resolved'      },
      { label: 'help.bot.order_late.options.back',                              next: 'order_menu'    },
    ],
  },
  order_wrong: {
    message: 'help.bot.order_wrong.message',
    options: [
      { label: 'help.bot.order_wrong.options.contact_support',          next: 'order_contact' },
      { label: 'help.bot.order_wrong.options.back',                     next: 'order_menu'    },
    ],
  },
  order_damaged: {
    message: 'help.bot.order_damaged.message',
    options: [
      { label: 'help.bot.order_damaged.options.contact_support',          next: 'order_contact' },
      { label: 'help.bot.order_damaged.options.back',                     next: 'order_menu'    },
    ],
  },
  order_contact: {
    message: 'help.bot.order_contact.message',
    options: [
      { label: 'help.bot.order_contact.options.got_it',               next: 'resolved' },
      { label: 'help.bot.order_contact.options.back_to_menu', next: 'start'    },
    ],
  },

  /* ── Devoluções ── */
  return_menu: {
    message: 'help.bot.return_menu.message',
    options: [
      { label: 'help.bot.return_menu.options.return_product',          next: 'return_how'      },
      { label: 'help.bot.return_menu.options.return_deadline',                next: 'return_deadline' },
      { label: 'help.bot.return_menu.options.no_refund_yet',       next: 'return_refund'   },
      { label: 'help.bot.return_menu.options.start_return_online',          next: 'start',          href: '/account/returns/request' },
      { label: 'help.bot.return_menu.options.main_menu',           next: 'start'           },
    ],
  },
  return_how: {
    message: 'help.bot.return_how.message',
    options: [
      { label: 'help.bot.return_how.options.start_return',            next: 'start',          href: '/account/returns/request' },
      { label: 'help.bot.return_how.options.can_t_start_online',         next: 'return_contact' },
      { label: 'help.bot.return_how.options.started_return',                 next: 'resolved'       },
      { label: 'help.bot.return_how.options.back',                             next: 'return_menu'    },
    ],
  },
  return_deadline: {
    message: 'help.bot.return_deadline.message',
    options: [
      { label: 'help.bot.return_deadline.options.proceed_return',              next: 'return_how'     },
      { label: 'help.bot.return_deadline.options.more_questions',                       next: 'return_contact' },
      { label: 'help.bot.return_deadline.options.back',                             next: 'return_menu'    },
    ],
  },
  return_refund: {
    message: 'help.bot.return_refund.message',
    options: [
      { label: 'help.bot.return_refund.options.no_refund_yet',             next: 'return_contact' },
      { label: 'help.bot.return_refund.options.no_confirmation',              next: 'return_contact' },
      { label: 'help.bot.return_refund.options.back',                             next: 'return_menu'    },
    ],
  },
  return_contact: {
    message: 'help.bot.return_contact.message',
    options: [
      { label: 'help.bot.return_contact.options.got_it',               next: 'resolved' },
      { label: 'help.bot.return_contact.options.back_to_menu', next: 'start'    },
    ],
  },

  /* ── Fatura ── */
  invoice_menu: {
    message: 'help.bot.invoice_menu.message',
    options: [
      { label: 'help.bot.invoice_menu.options.where_invoice',       next: 'invoice_where'   },
      { label: 'help.bot.invoice_menu.options.company_invoice',      next: 'invoice_company' },
      { label: 'help.bot.invoice_menu.options.wrong_details',              next: 'invoice_wrong'   },
      { label: 'help.bot.invoice_menu.options.view_invoices',               next: 'start',          href: '/account/invoices' },
      { label: 'help.bot.invoice_menu.options.main_menu',            next: 'start'           },
    ],
  },
  invoice_where: {
    message: 'help.bot.invoice_where.message',
    options: [
      { label: 'help.bot.invoice_where.options.go_invoices',          next: 'start',            href: '/account/invoices' },
      { label: 'help.bot.invoice_where.options.cant_find',                next: 'invoice_contact' },
      { label: 'help.bot.invoice_where.options.found_it',         next: 'resolved'         },
      { label: 'help.bot.invoice_where.options.back',                      next: 'invoice_menu'     },
    ],
  },
  invoice_company: {
    message: 'help.bot.invoice_company.message',
    options: [
      { label: 'help.bot.invoice_company.options.change_order',  next: 'invoice_contact' },
      { label: 'help.bot.invoice_company.options.understood',           next: 'resolved'        },
      { label: 'help.bot.invoice_company.options.back',                      next: 'invoice_menu'    },
    ],
  },
  invoice_wrong: {
    message: 'help.bot.invoice_wrong.message',
    options: [
      { label: 'help.bot.invoice_wrong.options.contact_now',            next: 'invoice_contact' },
      { label: 'help.bot.invoice_wrong.options.back',                     next: 'invoice_menu'    },
    ],
  },
  invoice_contact: {
    message: 'help.bot.invoice_contact.message',
    options: [
      { label: 'help.bot.invoice_contact.options.got_it',               next: 'resolved' },
      { label: 'help.bot.invoice_contact.options.back_to_menu', next: 'start'    },
    ],
  },

  /* ── Envios ── */
  shipping_menu: {
    message: 'help.bot.shipping_menu.message',
    options: [
      { label: 'help.bot.shipping_menu.options.delivery_times',          next: 'shipping_times' },
      { label: 'help.bot.shipping_menu.options.shipping_cost',             next: 'shipping_cost'  },
      { label: 'help.bot.shipping_menu.options.intl_shipping',  next: 'shipping_intl'  },
      { label: 'help.bot.shipping_menu.options.main_menu',   next: 'start'          },
    ],
  },
  shipping_times: {
    message: 'help.bot.shipping_times.message',
    options: [
      { label: 'help.bot.shipping_times.options.order_late',        next: 'order_late'     },
      { label: 'help.bot.shipping_times.options.thanks',                  next: 'resolved'       },
      { label: 'help.bot.shipping_times.options.back',                    next: 'shipping_menu'  },
    ],
  },
  shipping_cost: {
    message: 'help.bot.shipping_cost.message',
    options: [
      { label: 'help.bot.shipping_cost.options.more_questions',              next: 'other'          },
      { label: 'help.bot.shipping_cost.options.thanks',                  next: 'resolved'       },
      { label: 'help.bot.shipping_cost.options.back',                    next: 'shipping_menu'  },
    ],
  },
  shipping_intl: {
    message: 'help.bot.shipping_intl.message',
    options: [
      { label: 'help.bot.shipping_intl.options.contact_team',        next: 'other'          },
      { label: 'help.bot.shipping_intl.options.thanks',                  next: 'resolved'       },
      { label: 'help.bot.shipping_intl.options.back',                    next: 'shipping_menu'  },
    ],
  },

  /* ── Outro ── */
  other: {
    message: 'help.bot.other.message',
    options: [
      { label: 'help.bot.other.options.go_faq',             next: 'start', href: '/faq' },
      { label: 'help.bot.other.options.contact_page',        next: 'start', href: '/contact' },
      { label: 'help.bot.other.options.main_menu',  next: 'start' },
    ],
  },

  /* ── Resolvido ── */
  resolved: {
    message: 'help.bot.resolved.message',
    options: [
      { label: 'help.bot.resolved.options.main_menu', next: 'start' },
      { label: 'help.bot.resolved.options.go_account',    next: 'start', href: '/account/orders' },
    ],
    isEnd: true,
  },
};

const getBotNode = (key: string, t: ReturnType<typeof useTranslation>['t']) => {
  const node = BOT[key];
  if (!node) return undefined;

  return {
    ...node,
    messageKey: node.message,
    message: t(node.message),
    options: node.options?.map(opt => ({ ...opt, label: t(opt.label), labelKey: opt.label })),
  };
};

/* ─────────────────────────────────────────
   BREADCRUMB LABELS
───────────────────────────────────────── */
const nodeLabels: Record<string, string> = {
  start: 'help.breadcrumbs.start',
  key_menu: 'help.breadcrumbs.key_menu',
  order_menu: 'help.breadcrumbs.order_menu',
  return_menu: 'help.breadcrumbs.return_menu',
  invoice_menu: 'help.breadcrumbs.invoice_menu',
  shipping_menu: 'help.breadcrumbs.shipping_menu',
  other: 'help.breadcrumbs.other',
  account_link: 'help.breadcrumbs.account_link',
  key_no_email: 'help.breadcrumbs.key_no_email',
  key_not_work: 'help.breadcrumbs.key_not_work',
  key_activate: 'help.breadcrumbs.key_activate',
  key_lost: 'help.breadcrumbs.key_lost',
  key_contact: 'help.breadcrumbs.key_contact',
  order_track: 'help.breadcrumbs.order_track',
  order_late: 'help.breadcrumbs.order_late',
  order_wrong: 'help.breadcrumbs.order_wrong',
  order_damaged: 'help.breadcrumbs.order_damaged',
  order_contact: 'help.breadcrumbs.order_contact',
  return_how: 'help.breadcrumbs.return_how',
  return_deadline: 'help.breadcrumbs.return_deadline',
  return_refund: 'help.breadcrumbs.return_refund',
  return_contact: 'help.breadcrumbs.return_contact',
  invoice_where: 'help.breadcrumbs.invoice_where',
  invoice_company: 'help.breadcrumbs.invoice_company',
  invoice_wrong: 'help.breadcrumbs.invoice_wrong',
  invoice_contact: 'help.breadcrumbs.invoice_contact',
  shipping_times: 'help.breadcrumbs.shipping_times',
  shipping_cost: 'help.breadcrumbs.shipping_cost',
  shipping_intl: 'help.breadcrumbs.shipping_intl',
};

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const clock = () =>
  new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

/* ─────────────────────────────────────────
   COMPONENTE PRINCIPAL
───────────────────────────────────────── */
export default function LiveChatPage() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [botTyping, setBotTyping] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  const initialized = React.useRef(false);

  /* ── useRef impede dupla execução do React Strict Mode ── */
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    pushBot('start', 500);
  }, []);

  const updateBreadcrumb = (key: string) => {
    if (key === 'start' || key === 'resolved') {
      setBreadcrumb(['start']);
      return;
    }
    setBreadcrumb(prev => {
      const existingIndex = prev.indexOf(key);
      if (existingIndex !== -1) {
        return prev.slice(0, existingIndex + 1);
      }
      return [...prev, key];
    });
  };

  useEffect(() => {
    if (!messages.length) return;
    setMessages(prev =>
      prev.map(msg => {
        if (!msg.textKey) return msg;
        return {
          ...msg,
          text: t(msg.textKey),
          options: msg.options?.map(opt =>
            opt.labelKey ? { ...opt, label: t(opt.labelKey) } : opt
          ),
        };
      })
    );
  }, [t, messages.length]);

  const pushBot = (key: string, delay = 0) => {
    const node = getBotNode(key, t);
    if (!node) return;
    setBotTyping(true);
    updateBreadcrumb(key);
    setTimeout(() => {
      setBotTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          sender: 'bot',
          text: node.message,
          textKey: node.messageKey,
          time: clock(),
          options: node.options,
          optionsUsed: false,
        },
      ]);
    }, delay);
  };

  const choose = (opt: Option, msgId: number) => {
    if (opt.href) {
      window.location.href = opt.href;
      return;
    }

    setMessages(prev =>
      prev.map(m => (m.id === msgId ? { ...m, optionsUsed: true } : m))
    );
    setMessages(prev => [
      ...prev,
      {
        id: Date.now() + 1,
        sender: 'user',
        text: opt.label,
        textKey: opt.labelKey || opt.label,
        time: clock(),
      },
    ]);
    pushBot(opt.next, 750);
  };

  const restart = () => {
    setMessages([]);
    setBreadcrumb(['start']);
    setTimeout(() => pushBot('start', 300), 80);
  };

  return (
    <AppLayout
      title={t('help.title')}
      description={t('help.liveChatDescription')}
      canonical="/support/live-chat"
    >
      <style>{`        .Tranzor-chat * { font-family: 'Manrope', sans-serif; }

        @keyframes msgIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes optIn {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes dot {
          0%,60%,100% { transform: translateY(0);   opacity: .25; }
          30%          { transform: translateY(-5px); opacity: 1;   }
        }

        .opt-row {
          animation: optIn .22s ease both;
        }
        .opt-row:nth-child(1) { animation-delay: .04s }
        .opt-row:nth-child(2) { animation-delay: .09s }
        .opt-row:nth-child(3) { animation-delay: .14s }
        .opt-row:nth-child(4) { animation-delay: .19s }
        .opt-row:nth-child(5) { animation-delay: .24s }
        .opt-row:nth-child(6) { animation-delay: .29s }

        .opt-btn {
          transition: background .15s, border-color .15s, color .15s, transform .15s, box-shadow .15s;
        }
        .opt-btn:hover {
          background: #7f1d1d !important;
          border-color: #7f1d1d !important;
          color: #ffffff !important;
          transform: translateX(3px);
          box-shadow: 0 4px 10px rgba(127,29,29,.2);
        }
        .opt-btn:hover .opt-arrow,
        .opt-btn:hover .opt-icon,
        .opt-btn:hover .opt-external { color: #ffffff !important; }

        .chat-scroll::-webkit-scrollbar { width: 3px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #dba; border-radius: 99px; }

        .restart-btn {
          transition: background .15s, color .15s, border-color .15s;
        }
        .restart-btn:hover {
          background: #fef2f2 !important;
          border-color: #b91c1c !important;
          color: #b91c1c !important;
        }

        @media (max-width: 520px) {
          .opt-btn { padding: .5rem .7rem !important; font-size: .78rem !important; }
          .chat-scroll { padding: 1rem !important; }
        }
      `}</style>

      <div className="Tranzor-chat" style={{ background: '#f7f5f4', padding: '2rem 1rem 4rem', minHeight: '100vh' }}>
        <div style={{
          maxWidth: 680, margin: '0 auto',
          background: '#ffffff', borderRadius: 2,
          boxShadow: '0 2px 4px rgba(0,0,0,.04), 0 12px 48px rgba(127,29,29,.1)',
          overflow: 'hidden', border: '1px solid #f0d4d4',
        }}>

          {/* Cabeçalho */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            padding: '1rem 1.5rem', borderBottom: '1px solid #fde8e8',
            background: '#ffffff',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 2,
              background: 'linear-gradient(135deg, #b91c1c, #7f1d1d)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ffffff', flexShrink: 0,
            }}>
              <IconBot />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '.9rem', color: '#1a0505' }}>{t('help.liveChatHeader')}</div>
              <div style={{ color: '#9b1919', fontSize: '.74rem', opacity: .7 }}>{t('help.liveChatSubheader')}</div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '.4rem',
              padding: '4px 12px', borderRadius: 2,
              background: 'rgba(34,197,94,.08)',
              border: '1px solid rgba(34,197,94,.2)',
              color: '#166534', fontSize: '.72rem', fontWeight: 600,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
              {t('help.onlineStatus')}
            </div>
          </div>

          {/* Breadcrumb */}
          {breadcrumb.length > 0 && (
            <div style={{
              padding: '.5rem 1.5rem', background: '#fdfafa',
              borderBottom: '1px solid #fde8e8', display: 'flex',
              flexWrap: 'wrap', gap: '.3rem', fontSize: '.72rem',
              color: '#7f1d1d', opacity: .75,
            }}>
              {breadcrumb.map((key, idx) => (
                <span key={key + idx} style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                  {idx > 0 && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                  {t(nodeLabels[key] || key)}
                </span>
              ))}
            </div>
          )}

          {/* Área de mensagens */}
          <div
            className="chat-scroll"
            style={{
              minHeight: 440, maxHeight: 500, overflowY: 'auto',
              padding: '1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '.75rem',
              background: '#fafaf8',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', fontSize: '.68rem', color: '#9b1919', opacity: .45 }}>
              <div style={{ flex: 1, height: 1, background: '#e0c0c0' }} />
              {t('help.today')}
              <div style={{ flex: 1, height: 1, background: '#e0c0c0' }} />
            </div>

            {messages.map(msg => (
              <div key={msg.id} style={{ animation: 'msgIn .2s ease' }}>
                <div style={{
                  display: 'flex',
                  flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-end', gap: '.5rem',
                }}>
                  {msg.sender === 'bot' && (
                    <div style={{
                      width: 28, height: 28, borderRadius: 2,
                      background: 'linear-gradient(135deg, #b91c1c, #7f1d1d)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff',
                    }}>
                      <IconBot />
                    </div>
                  )}
                  <div style={{
                    maxWidth: msg.sender === 'user' ? '75%' : '72%',
                    display: 'flex', flexDirection: 'column',
                    alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    gap: 2,
                  }}>
                    <div style={{
                      padding: '.6rem .9rem',
                      borderRadius: msg.sender === 'user' ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
                      background: msg.sender === 'user'
                        ? 'linear-gradient(135deg, #e01c1c, #b91c1c)'
                        : '#f6f3f1',
                      color: msg.sender === 'user' ? '#fff' : '#1a0505',
                      fontSize: '.88rem', lineHeight: 1.65, whiteSpace: 'pre-line',
                      border: msg.sender === 'bot' ? '1px solid #ead5d5' : 'none',
                      boxShadow: msg.sender === 'user'
                        ? '0 3px 14px rgba(224,28,28,.3)'
                        : '0 1px 2px rgba(0,0,0,.04)',
                    }}>
                      {msg.textKey ? t(msg.textKey) : msg.text}
                    </div>
                    <div style={{
                      fontSize: '.65rem', color: '#9b1919', opacity: .4,
                      paddingInline: 3, display: 'flex', alignItems: 'center', gap: '.25rem',
                    }}>
                      {msg.time}
                      {msg.sender === 'user' && (
                        <span style={{ opacity: .7, display: 'flex', gap: 1 }}>
                          <IconCheck /><IconCheck />
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Opções */}
                {msg.sender === 'bot' && msg.options && !msg.optionsUsed && (
                  <div style={{ marginTop: '.75rem', marginLeft: 36, display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
                    {msg.options.map((opt, i) => (
                      <div key={opt.next + i} className="opt-row">
                        <button
                          className="opt-btn"
                          onClick={() => choose(opt, msg.id)}
                          style={{
                            display: 'flex', alignItems: 'center',
                            gap: '.65rem', justifyContent: 'space-between',
                            width: '100%', padding: '.55rem .8rem',
                            background: opt.href ? '#f0f7ff' : '#ffffff',
                            border: opt.href ? '1px solid #b8d4f0' : '1px solid #e8d0d0',
                            borderRadius: 2,
                            color: opt.href ? '#0b4f6c' : '#7f1d1d',
                            fontSize: '.83rem', fontWeight: 500,
                            cursor: 'pointer', textAlign: 'left',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                            {opt.icon && (
                              <span className="opt-icon" style={{ color: opt.href ? '#1e6f9f' : '#c84a4a', flexShrink: 0 }}>
                                {opt.icon}
                              </span>
                            )}
                            {opt.labelKey ? t(opt.labelKey) : opt.label}
                          </span>
                          {opt.href ? (
                            <span className="opt-external" style={{ color: '#1e6f9f', flexShrink: 0 }}>
                              <IconExternal />
                            </span>
                          ) : (
                            <span className="opt-arrow" style={{ color: '#c84a4a', flexShrink: 0 }}>
                              <IconArrow />
                            </span>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {botTyping && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '.5rem', animation: 'msgIn .2s ease' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 2,
                  background: 'linear-gradient(135deg, #b91c1c, #7f1d1d)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                }}>
                  <IconBot />
                </div>
                <div style={{
                  padding: '.55rem .8rem', background: '#f6f3f1',
                  border: '1px solid #ead5d5', borderRadius: '8px 8px 8px 2px',
                  display: 'flex', gap: 5,
                }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: '#b91c1c',
                      animation: `dot 1.1s ${i * .18}s infinite ease-in-out`,
                    }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Rodapé */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '.5rem', padding: '.875rem 1.5rem',
            borderTop: '1px solid #fde8e8', background: '#ffffff',
          }}>
            <span style={{ fontSize: '.72rem', color: '#9b1919', opacity: .55 }}>
              {t('help.liveChatFooter')}
            </span>
            <button
              className="restart-btn"
              onClick={restart}
              style={{
                display: 'flex', alignItems: 'center', gap: '.4rem',
                padding: '5px 13px', borderRadius: 2,
                border: '1px solid #f0d4d4', background: 'transparent',
                color: '#9b1919', fontSize: '.73rem', fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <IconRefresh /> {t('help.restartChat')}
            </button>
          </div>
        </div>

        <p style={{
          textAlign: 'center', maxWidth: 400, margin: '1.5rem auto 0',
          fontSize: '.74rem', color: '#9b1919', opacity: .6,
          lineHeight: 1.6, fontWeight: 300,
        }}>
          {t('help.noAnswerQuestion')}{' '}
          <strong style={{ fontWeight: 600 }}>{t('help.supportEmail')}</strong>
          {' '}{t('help.supportHours')}
        </p>
      </div>
    </AppLayout>
  );
}