import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ExternalLink,
  HeartPulse,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Stethoscope,
  Smartphone,
  X
} from 'lucide-react';
import { copy } from './copy.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';

function useDialogKeys(onClose) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    dialog?.querySelector('button')?.focus();
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previous?.focus?.();
    };
  }, [onClose]);
  return dialogRef;
}

function App() {
  const [language, setLanguage] = useState(() => window.localStorage.getItem('daryeel-language') || 'so');
  const [clinics, setClinics] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState(false);
  const [clinicSearch, setClinicSearch] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [toast, setToast] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const t = copy[language];

  useEffect(() => {
    window.localStorage.setItem('daryeel-language', language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/clinics`)
      .then((response) => {
        if (!response.ok) throw new Error('Directory request failed');
        return response.json();
      })
      .then((result) => { if (active) setClinics(result.data ?? []); })
      .catch(() => { if (active) setDirectoryError(true); })
      .finally(() => { if (active) setDirectoryLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const authError = currentUrl.searchParams.get('auth_error');
    if (currentUrl.searchParams.has('auth') || authError) {
      currentUrl.searchParams.delete('auth');
      currentUrl.searchParams.delete('auth_error');
      window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
      if (authError) setToast(t.signInFailed);
      else setToast(t.signedIn);
    }
    fetch(`${API_BASE}/auth/session`, { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((session) => setAuthUser(session?.authenticated && session.role === 'patient' ? session.user : null))
      .catch(() => setAuthUser(null));
  }, [language, t.signInFailed, t.signedIn]);

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  const signIn = () => window.location.assign(`${API_BASE}/auth/esignet`);
  async function signOut() {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setAuthUser(null);
    setToast(t.signedOut);
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">{language === 'so' ? 'U gudub nuxurka' : 'Skip to content'}</a>
      <header className="topbar">
        <a className="brand" href="#main" aria-label={`${t.brand}, ${t.clinics}`}>
          <span className="brand-mark" aria-hidden="true"><HeartPulse size={21} strokeWidth={1.9} /></span>
          <span>{t.brand}</span>
        </a>
        <nav className="desktop-nav" aria-label={language === 'so' ? 'Qaybaha abka' : 'App navigation'}>
          <a className="nav-link is-current" href="#main">{t.clinics}</a>
        </nav>
        <div className="topbar-actions">
          {installPrompt && !isInstalled && (
            <button className="install-button" type="button" onClick={installApp}>
              <Smartphone size={17} strokeWidth={1.8} />
              <span>{t.install}</span>
            </button>
          )}
          <div className="language-switch" role="group" aria-label={language === 'so' ? 'Dooro luqadda' : 'Choose language'}>
            <button type="button" className={language === 'so' ? 'is-active' : ''} onClick={() => setLanguage('so')} aria-pressed={language === 'so'}>SO</button>
            <button type="button" className={language === 'en' ? 'is-active' : ''} onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>EN</button>
          </div>
          <button className="profile-button" type="button" onClick={authUser ? signOut : () => setShowLogin(true)} aria-label={authUser ? t.signOut : t.signIn}>
            <span className="profile-avatar">{authUser?.displayName?.charAt(0)?.toUpperCase() || 'A'}</span>
            <span className="profile-label">{authUser?.displayName || t.signIn}</span>
            <ChevronDown size={16} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <main id="main" className="main-content">
        <ClinicDirectory t={t} language={language} clinics={clinics} loading={directoryLoading} error={directoryError} search={clinicSearch} onSearch={setClinicSearch} />
      </main>

      <footer className="app-footer">
        <span>{t.directoryFooter}</span>
        <span className="footer-mark"><ShieldCheck size={15} strokeWidth={1.8} /> {t.sourceLabel}</span>
      </footer>

      {showLogin && <LoginDialog t={t} onClose={() => setShowLogin(false)} onContinue={signIn} />}
      {toast && <div className="toast" role="status"><Check size={17} strokeWidth={2.2} />{toast}</div>}
    </div>
  );
}

function ClinicDirectory({ t, language, clinics, loading, error, search, onSearch }) {
  const query = search.trim().toLocaleLowerCase();
  const filteredClinics = clinics.filter((clinic) => {
    const searchable = [
      clinic.name,
      clinic.address,
      ...clinic.services.map((service) => t[service.nameKey] ?? service.nameKey),
      ...clinic.providers.flatMap((provider) => [provider.displayName, t[provider.specialty] ?? provider.specialty])
    ].join(' ').toLocaleLowerCase();
    return searchable.includes(query);
  });

  return (
    <section className="directory-screen" aria-labelledby="directory-title">
      <div className="directory-intro">
        <div>
          <p className="preview-label"><span className="preview-label-icon"><MapPin size={13} strokeWidth={2.4} /></span>{t.directoryCity}</p>
          <h1 id="directory-title">{t.directoryTitle}</h1>
          <p className="welcome-copy">{t.directoryIntro}</p>
        </div>
        <label className="directory-search">
          <Search size={18} aria-hidden="true" />
          <span className="visually-hidden">{t.searchClinics}</span>
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={t.searchClinics} />
        </label>
      </div>

      <div className="directory-notice"><ShieldCheck size={18} /><p>{t.directoryNotice}</p></div>

      {loading && <p className="directory-state" role="status">{t.loadingClinics}</p>}
      {error && <div className="directory-state" role="alert"><p>{t.directoryError}</p><button className="text-button" type="button" onClick={() => window.location.reload()}>{t.tryAgain}<ArrowRight size={16} /></button></div>}
      {!loading && !error && filteredClinics.length === 0 && <p className="directory-state">{t.noClinics}</p>}

      {!loading && !error && filteredClinics.length > 0 && (
        <div className="clinic-grid">
          {filteredClinics.map((clinic) => (
            <article className="clinic-card" key={clinic.id}>
              <div className="clinic-card-heading">
                <span className="clinic-card-icon"><Building2 size={20} strokeWidth={1.8} /></span>
                <div><h2>{clinic.name}</h2><p><MapPin size={14} />{clinic.address ?? t.addressNotListed}</p></div>
              </div>
              {clinic.services.length > 0 && (
                <div className="clinic-specialties">
                  <h3>{t.departments}</h3>
                  <div className="specialty-list">{clinic.services.map((service) => <span key={service.id}>{t[service.nameKey] ?? service.nameKey}</span>)}</div>
                </div>
              )}
              {clinic.providers.length > 0 && (
                <div className="clinic-providers">
                  <h3><Stethoscope size={15} />{t.publiclyListedDoctors}</h3>
                  <ul>{clinic.providers.map((provider) => (
                    <li key={provider.id}>
                      <span><strong>{provider.displayName}</strong><small>{t[provider.specialty] ?? provider.specialty}</small></span>
                      <a href={provider.profileUrl || provider.sourceUrl} target="_blank" rel="noreferrer" aria-label={`${t.viewSource}: ${provider.displayName}`}><ExternalLink size={14} /></a>
                    </li>
                  ))}</ul>
                </div>
              )}
              <div className="clinic-contact">
                {clinic.phone && <a className="clinic-action clinic-call" href={`tel:${clinic.phone.replace(/[^+\\d]/g, '')}`}><Phone size={16} />{clinic.phone}</a>}
                {clinic.email && <a className="clinic-action" href={`mailto:${clinic.email}`}><Mail size={16} />{clinic.email}</a>}
                {clinic.address && <a className="clinic-action" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${clinic.name}, ${clinic.address}`)}`} target="_blank" rel="noreferrer"><MapPin size={16} />{t.directions}</a>}
                {clinic.appointmentUrl && <a className="primary-button clinic-book" href={clinic.appointmentUrl} target="_blank" rel="noreferrer">{t.visitBookingPage}<ExternalLink size={15} /></a>}
                {clinic.websiteUrl && <a className="clinic-source" href={clinic.websiteUrl} target="_blank" rel="noreferrer">{t.officialWebsite}<ExternalLink size={14} /></a>}
              </div>
              <div className="clinic-source-note">
                <span>{t.detailsChecked} {clinic.verifiedAt ? new Intl.DateTimeFormat(language === 'so' ? 'so-SO' : 'en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(clinic.verifiedAt)) : t.dateUnknown}</span>
                {clinic.sourceUrl && <a href={clinic.sourceUrl} target="_blank" rel="noreferrer">{t.sourceLabel}<ExternalLink size={12} /></a>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function LoginDialog({ t, onClose, onContinue }) {
  const dialogRef = useDialogKeys(onClose);
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="dialog login-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="login-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label={t.close}><X size={19} /></button>
        <span className="dialog-icon"><ShieldCheck size={22} strokeWidth={1.8} /></span>
        <h2 id="login-title">{t.signInTitle}</h2>
        <p>{t.signInText}</p>
        <button className="primary-button full-button" type="button" onClick={onContinue}>{t.previewContinue}<ArrowRight size={17} /></button>
        <button className="dialog-secondary" type="button" onClick={onClose}>{t.cancel}</button>
      </section>
    </div>
  );
}

export default App;
