/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Inbox as InboxIcon, 
  Info, 
  ShieldCheck, 
  Bolt, 
  Mail,
  Copy, 
  RefreshCcw, 
  QrCode, 
  Power, 
  Ghost, 
  X,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'react-qr-code';

// --- Types & Constants ---
type Tab = 'inbox' | 'about' | 'privacy';

interface Message {
  id: string;
  from: { name: string; address: string };
  subject: string;
  intro: string;
  createdAt: string;
}

const API_MAIN = 'https://api.mail.gw';
const API_BACKUP = 'https://api.mail.tm';
const AD_LINK = 'https://www.profitablecpmratenetwork.com/c21iydgt?key=197f56f25f1502ddea8c54dddb022108';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [email, setEmail] = useState<string | null>(localStorage.getItem('jm_email'));
  const [token, setToken] = useState<string | null>(localStorage.getItem('jm_token'));
  const [api, setApi] = useState<string>(localStorage.getItem('jm_api') || API_MAIN);
  const [messages, setMessages] = useState<Message[]>([]);
  const [syncTimer, setSyncTimer] = useState(3);
  const [isReading, setIsReading] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [messageContent, setMessageContent] = useState<{ html: string; otp: string | null } | null>(null);

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- Ad Trigger ---
  const triggerAd = () => {
    window.open(AD_LINK, '_blank');
  };

  // --- API Handlers ---
  const checkServer = async () => {
    try {
      const res = await fetch(`${API_MAIN}/domains`);
      return res.ok ? API_MAIN : API_BACKUP;
    } catch {
      return API_BACKUP;
    }
  };

  const createNewIdentity = useCallback(async () => {
    setIsInitializing(true);
    try {
      const server = await checkServer();
      setApi(server);
      localStorage.setItem('jm_api', server);

      const domainRes = await fetch(`${server}/domains`);
      const domainData = await domainRes.json();
      const domain = domainData['hydra:member'] ? domainData['hydra:member'][0].domain : domainData[0].domain;

      const randomStr = Math.random().toString(36).substring(2, 10);
      const address = `${randomStr}@${domain}`;
      const password = `pwd${randomStr}`;

      // Create Account
      await fetch(`${server}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password })
      });

      // Get Token
      const tokenRes = await fetch(`${server}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password })
      });
      const tokenData = await tokenRes.json();

      setToken(tokenData.token);
      setEmail(address);
      localStorage.setItem('jm_token', tokenData.token);
      localStorage.setItem('jm_email', address);
      setMessages([]);
    } catch (err) {
      console.error('Failed to create identity:', err);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const refreshInbox = useCallback(async () => {
    if (!token || !api) return;
    try {
      const res = await fetch(`${api}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 401) {
        createNewIdentity();
        return;
      }

      const data = await res.json();
      const freshMsgs = data['hydra:member'] || data;
      
      // Basic deep comparison simplified
      if (JSON.stringify(freshMsgs) !== JSON.stringify(messages)) {
        setMessages(freshMsgs);
        if (freshMsgs.length > messages.length && navigator.vibrate) {
          navigator.vibrate(100);
        }
      }
    } catch (err) {
      console.error('Refresh failed:', err);
    }
  }, [api, token, messages, createNewIdentity]);

  const readMessage = async (id: string) => {
    setSelectedMessageId(id);
    setIsReading(true);
    setMessageContent(null);
    try {
      const res = await fetch(`${api}/messages/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const html = (data.html && data.html[0]) ? data.html[0] : (data.text || "");
      
      // OTP Extractor
      const plain = html.replace(/<[^>]*>?/gm, ' ');
      const otpMatch = plain.match(/\b\d{4,8}\b/);
      
      setMessageContent({
        html,
        otp: otpMatch ? otpMatch[0] : null
      });
    } catch (err) {
      console.error('Failed to read message:', err);
    }
  };

  // --- Initial Mount & Timers ---
  useEffect(() => {
    if (!email || !token) {
      createNewIdentity();
    } else {
      refreshInbox();
    }
  }, []);

  useEffect(() => {
    if (isReading || isInitializing || activeTab !== 'inbox') {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      return;
    }

    syncIntervalRef.current = setInterval(() => {
      setSyncTimer((prev) => {
        if (prev <= 1) {
          refreshInbox();
          return 3;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [isReading, isInitializing, activeTab, refreshInbox]);

  // --- Helper Actions ---
  const copyEmail = () => {
    if (email) {
      navigator.clipboard.writeText(email);
      // Optional: Custom toast
    }
  };

  const handleChangeAddress = () => {
    triggerAd();
    localStorage.removeItem('jm_token');
    localStorage.removeItem('jm_email');
    setToken(null);
    setEmail(null);
    createNewIdentity();
  };

  return (
    <div className="flex flex-col min-h-screen font-sans">
      {/* Header */}
      <header className="p-5 flex items-center justify-center relative">
        <div className="flex items-center gap-2 text-xl font-extrabold uppercase tracking-widest">
          <Mail className="text-accent-cyan w-5 h-5" />
          <span>Jugaad Mail</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[500px] mx-auto px-5 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'inbox' && (
            <motion.section
              key="inbox"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {/* Identity Card */}
              <div className="glass-card p-6 relative overflow-hidden group">
                <div className="absolute top-0 left-1/4 w-1/2 h-[2px] bg-gradient-to-r from-transparent via-accent-cyan to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
                
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[10px] font-extrabold tracking-widest text-white/50 uppercase">Secured Identity</span>
                  <div className="flex items-center gap-2 text-[10px] font-extrabold text-accent-cyan bg-accent-cyan/10 px-3 py-1 rounded-full border border-accent-cyan/20">
                    <div className="w-1.5 h-1.5 bg-accent-cyan rounded-full blink" />
                    {isInitializing ? 'CREATING...' : 'ACTIVE'}
                  </div>
                </div>

                <div className="bg-black border border-white/10 rounded-xl p-5 text-center mb-6">
                  <span className="font-mono text-lg font-bold break-all leading-tight">
                    {email || 'Initializing...'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <ActionButton onClick={copyEmail} icon={<Copy className="w-4 h-4" />} label="Copy" />
                  <ActionButton onClick={refreshInbox} icon={<RefreshCcw className="w-4 h-4" />} label="Sync" />
                  <ActionButton onClick={() => setShowQR(true)} icon={<QrCode className="w-4 h-4" />} label="Scan" />
                </div>

                <button 
                  onClick={handleChangeAddress}
                  className="w-full bg-accent-red/5 border border-dashed border-accent-red/30 text-accent-red py-4 rounded-xl font-extrabold text-sm tracking-widest uppercase flex justify-center items-center gap-2 active:scale-[0.98] transition-all hover:bg-accent-red/10"
                >
                  <Power className="w-4 h-4 text-accent-red" />
                  Change Address
                </button>
              </div>

              {/* Inbox List Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-extrabold tracking-widest uppercase">Inbox</h3>
                  <span className="text-xs font-semibold text-white/40">
                    Syncing in <span className="text-accent-cyan">{syncTimer}</span>s
                  </span>
                </div>

                <div className="space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-white/5 rounded-2xl">
                      <Ghost className="w-8 h-8 text-white/20 mx-auto mb-3" />
                      <p className="text-xs font-semibold text-white/30">Waiting for incoming signals...</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => readMessage(msg.id)}
                        className="bg-surface-dark border border-white/5 p-4 rounded-2xl flex gap-4 items-center cursor-pointer hover:border-accent-cyan/30 active:scale-[0.98] transition-all"
                      >
                        <div className="w-11 h-11 bg-white text-black rounded-xl flex items-center justify-center font-extrabold text-lg flex-shrink-0">
                          {(msg.from.name || msg.from.address).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <div className="font-bold text-sm truncate">{msg.from.name || msg.from.address.split('@')[0]}</div>
                          <div className="text-xs text-white/40 truncate">{msg.subject || 'No Subject'}</div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.section>
          )}

          {activeTab === 'about' && (
            <motion.section
              key="about"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              <InfoCard title="About Jugaad Mail">
                <p>Welcome to the most aggressive and secure disposable email platform. Built to bypass verifications and keep your real inbox clean.</p>
                <ul className="mt-4 space-y-2">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-accent-cyan" />
                    <span>100% Anonymous & Secure</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-accent-cyan" />
                    <span>Auto-deletes emails instantly</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-accent-cyan" />
                    <span>Instant Smart OTP Detection</span>
                  </li>
                </ul>
              </InfoCard>
              <div className="text-center pt-8 text-[10px] font-bold tracking-[0.2em] text-white/20 uppercase">
                Owner: Sumit Yadav
              </div>
            </motion.section>
          )}

          {activeTab === 'privacy' && (
            <motion.section
              key="privacy"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              <InfoCard title="Privacy Policy">
                <p>We do not track you. We do not store your IP address. Everything processed here is temporary.</p>
                <div className="mt-4 p-4 bg-accent-cyan/5 border border-accent-cyan/10 rounded-xl">
                  <p className="text-xs italic text-accent-cyan/70">
                    Once you hit the "Change Address" button, all associated emails are permanently wiped from the servers instantly.
                  </p>
                </div>
              </InfoCard>
              <div className="text-center pt-8 text-[10px] font-bold tracking-[0.2em] text-white/20 uppercase">
                Owner: Sumit Yadav
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface-dark/90 backdrop-blur-2xl border border-white/10 p-1.5 rounded-full flex gap-1 shadow-2xl z-50">
        <NavPill
          active={activeTab === 'inbox'}
          onClick={() => setActiveTab('inbox')}
          icon={<InboxIcon className="w-4 h-4" />}
          label="Inbox"
        />
        <NavPill
          active={activeTab === 'about'}
          onClick={() => setActiveTab('about')}
          icon={<Info className="w-4 h-4" />}
          label="About"
        />
        <NavPill
          active={activeTab === 'privacy'}
          onClick={() => setActiveTab('privacy')}
          icon={<ShieldCheck className="w-4 h-4" />}
          label="Privacy"
        />
      </nav>

      {/* Message Reader Modal (Bottom Sheet Style) */}
      <AnimatePresence>
        {isReading && (
          <div className="fixed inset-0 bg-black/90 z-[100] flex items-end">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full h-[85vh] bg-surface-dark border-t border-white/10 rounded-t-[32px] flex flex-col overflow-hidden"
            >
              <div className="p-5 flex justify-between items-center border-b border-white/5">
                <span className="font-extrabold text-xs tracking-widest uppercase">Message Reader</span>
                <button 
                  onClick={() => setIsReading(false)}
                  className="w-9 h-9 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 active:scale-90 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* OTP Banner */}
              {messageContent?.otp && (
                <div className="m-5 p-6 bg-white rounded-2xl text-center space-y-1">
                  <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Security Code</p>
                  <h1 className="text-4xl font-mono font-black text-black tracking-[0.2em]">{messageContent.otp}</h1>
                </div>
              )}

              <div className="flex-1 bg-white overflow-y-auto">
                {messageContent ? (
                  <iframe 
                    title="message-content"
                    className="w-full h-full border-none"
                    srcDoc={`
                      <style>
                        body { font-family: sans-serif; padding: 24px; color: #111; line-height: 1.6; }
                        img { max-width: 100%; height: auto; border-radius: 8px; }
                        a { color: #00f0ff; text-decoration: none; }
                        * { cursor: default; }
                      </style>
                      ${messageContent.html}
                    `}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-black font-semibold text-sm">
                    Connecting to secure vault...
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQR && (
          <div 
            className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-6"
            onClick={() => setShowQR(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-10 text-center max-w-xs w-full"
            >
              <h4 className="text-xs font-black uppercase tracking-widest mb-6">Scan to Transfer</h4>
              <div className="bg-white p-4 rounded-2xl inline-block mb-6 shadow-2xl">
                {email && <QRCode value={email} size={180} />}
              </div>
              <button 
                onClick={() => setShowQR(false)}
                className="w-full bg-white text-black py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-opacity-90 active:scale-95 transition-all"
              >
                Close Portal
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function ActionButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className="bg-surface-dark border border-white/5 py-4 rounded-xl flex flex-col items-center gap-2 group hover:border-accent-cyan/30 active:scale-95 transition-all"
    >
      <div className="text-white/40 group-hover:text-accent-cyan transition-colors">{icon}</div>
      <span className="text-[10px] font-bold text-white uppercase tracking-wider">{label}</span>
    </button>
  );
}

function NavPill({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-300
        ${active 
          ? 'bg-white text-black font-bold scale-105 px-8' 
          : 'text-white/40 font-semibold hover:text-white/60'
        }
      `}
    >
      {icon}
      <span className={`text-xs ${!active && 'hidden'}`}>{label}</span>
    </button>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-dark border border-white/10 p-8 rounded-3xl space-y-4">
      <h2 className="text-xl font-black tracking-tight">{title}</h2>
      <div className="text-sm font-medium text-white/50 leading-relaxed">
        {children}
      </div>
    </div>
  );
}
