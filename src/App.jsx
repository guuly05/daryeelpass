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
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    const focusableSelector = 'button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
    const focusable = () => [...(dialog?.querySelectorAll(focusableSelector) ?? [])].filter((element) => element.getClientRects().length > 0);
    const firstField = dialog?.querySelector('input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled)');
    (firstField ?? focusable()[0])?.focus();
    function handleKeyDown(event) {
      if (event.key === 'Escape') onCloseRef.current?.();
      if (event.key !== 'Tab' || !dialog) return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1);
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
  }, []);
  return dialogRef;
}

function App() {
  const [language, setLanguage] = useState(() => window.localStorage.getItem('daryeel-language') || 'so');
  const [clinics, setClinics] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState(false);
  const [clinicSearch, setClinicSearch] = useState('');
  const [showLogin, setShowLogin] = useState(() => Boolean(new URL(window.location.href).searchParams.get('staff_invite')));
  const [bookingClinic, setBookingClinic] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [systemSetupAvailable, setSystemSetupAvailable] = useState(false);
  const [systemOverview, setSystemOverview] = useState(null);
  const [systemOverviewLoading, setSystemOverviewLoading] = useState(false);
  const [systemOverviewError, setSystemOverviewError] = useState(false);
  const [bookingRequests, setBookingRequests] = useState([]);
  const [staffRequests, setStaffRequests] = useState([]);
  const [staffRequestsLoading, setStaffRequestsLoading] = useState(false);
  const [staffRequestsError, setStaffRequestsError] = useState(false);
  const [staffInviteToken, setStaffInviteToken] = useState(() => new URL(window.location.href).searchParams.get('staff_invite') || '');
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
    fetch(`${API_BASE}/auth/session`, { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((session) => setAuthUser(session?.authenticated ? session.user : null))
      .catch(() => setAuthUser(null));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/system/setup-status`)
      .then((response) => response.ok ? response.json() : { setupAvailable: false })
      .then((result) => setSystemSetupAvailable(Boolean(result.setupAvailable)))
      .catch(() => setSystemSetupAvailable(false));
  }, []);

  useEffect(() => {
    if (authUser?.role !== 'SYSTEM_ADMIN') { setSystemOverview(null); setSystemOverviewError(false); return; }
    let active = true;
    setSystemOverviewLoading(true);
    fetch(`${API_BASE}/system/overview`, { credentials: 'include' })
      .then((response) => { if (!response.ok) throw new Error('overview'); return response.json(); })
      .then((result) => { if (active) { setSystemOverview(result.data ?? null); setSystemOverviewError(false); } })
      .catch(() => { if (active) setSystemOverviewError(true); })
      .finally(() => { if (active) setSystemOverviewLoading(false); });
    return () => { active = false; };
  }, [authUser]);

  useEffect(() => {
    if (!authUser) { setBookingRequests([]); setStaffRequests([]); setStaffRequestsError(false); return; }
    let active = true;
    const endpoint = authUser.role === 'PATIENT' ? '/booking-requests' : '/staff/booking-requests';
    if (authUser.role !== 'PATIENT') setStaffRequestsLoading(true);
    fetch(`${API_BASE}${endpoint}`, { credentials: 'include' })
      .then((response) => { if (!response.ok) throw new Error('requests'); return response.json(); })
      .then((result) => {
        if (!active) return;
        if (authUser.role === 'PATIENT') setBookingRequests(result.data ?? []);
        else { setStaffRequests(result.data ?? []); setStaffRequestsError(false); }
      })
      .catch(() => { if (active && authUser.role !== 'PATIENT') setStaffRequestsError(true); })
      .finally(() => { if (active && authUser.role !== 'PATIENT') setStaffRequestsLoading(false); });
    return () => { active = false; };
  }, [authUser]);

  async function refreshSystemOverview() {
    setSystemOverviewLoading(true);
    try {
      const response = await fetch(`${API_BASE}/system/overview`, { credentials: 'include' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || t.updateFailed);
      setSystemOverview(result.data ?? null);
      setSystemOverviewError(false);
    } catch (error) {
      setSystemOverviewError(true);
      throw error;
    } finally { setSystemOverviewLoading(false); }
  }

  async function refreshStaffRequests() {
    setStaffRequestsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/staff/booking-requests`, { credentials: 'include' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || t.updateFailed);
      setStaffRequests(result.data ?? []);
      setStaffRequestsError(false);
    } catch (error) {
      setStaffRequestsError(true);
      throw error;
    } finally { setStaffRequestsLoading(false); }
  }

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
        <ClinicDirectory t={t} language={language} clinics={clinics} loading={directoryLoading} error={directoryError} search={clinicSearch} onSearch={setClinicSearch} onBook={(clinic) => authUser ? setBookingClinic(clinic) : setShowLogin(true)} />
        {authUser?.role === 'PATIENT' && <PatientRequests t={t} requests={bookingRequests} onCancel={async (id) => {
          try {
            const response = await fetch(`${API_BASE}/booking-requests/${id}/cancel`, { method: 'PATCH', credentials: 'include' });
            if (!response.ok) throw new Error('cancel');
            setBookingRequests((items) => items.map((item) => item.id === id ? { ...item, status: 'CANCELLED' } : item));
          } catch { setToast(t.updateFailed); }
        }} />}
        {authUser?.role === 'SYSTEM_ADMIN' && <SystemAdminDashboard t={t} clinics={clinics} overview={systemOverview} loading={systemOverviewLoading} error={systemOverviewError} onRefresh={refreshSystemOverview} onError={(message) => setToast(message)} />}
        {['STAFF', 'CLINIC_ADMIN', 'SYSTEM_ADMIN'].includes(authUser?.role) && <StaffDashboard t={t} requests={staffRequests} clinics={clinics} authUser={authUser} loading={staffRequestsLoading} error={staffRequestsError} onRefresh={refreshStaffRequests} onError={(message) => setToast(message)} />}
      </main>

      <footer className="app-footer">
        <span>{t.directoryFooter}</span>
        <span className="footer-mark"><ShieldCheck size={15} strokeWidth={1.8} /> {t.sourceLabel}</span>
      </footer>

      {systemSetupAvailable && <SystemSetupDialog t={t} onCreated={(user) => { setSystemSetupAvailable(false); setAuthUser(user); }} />}
      {showLogin && !systemSetupAvailable && <LoginDialog t={t} onClose={() => setShowLogin(false)} inviteToken={staffInviteToken} onAuthenticated={(user) => {
        const url = new URL(window.location.href);
        url.searchParams.delete('staff_invite');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        setAuthUser(user); setShowLogin(false); setStaffInviteToken('');
      }} />}
      {bookingClinic && <BookingDialog t={t} clinic={bookingClinic} onClose={() => setBookingClinic(null)} onSubmitted={(request) => { setBookingRequests((items) => [...items, request]); setBookingClinic(null); setToast(t.requestSubmitted); }} />}
      {toast && <div className="toast" role="status"><Check size={17} strokeWidth={2.2} />{toast}</div>}
    </div>
  );
}

function ClinicDirectory({ t, language, clinics, loading, error, search, onSearch, onBook }) {
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
              {clinic.services.some((service) => service.slug !== 'emergency') && <button className="primary-button clinic-book" type="button" onClick={() => onBook(clinic)}>{t.requestTime}<ArrowRight size={15} /></button>}
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

function SystemSetupDialog({ t, onCreated }) {
  const dialogRef = useDialogKeys();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusy(true); setError('');
    try {
      const response = await fetch(`${API_BASE}/system/setup`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || t.setupFailed);
      onCreated(result.user);
    } catch (setupError) { setError(setupError.message); }
    finally { setBusy(false); }
  }
  return <div className="dialog-backdrop system-setup-backdrop" role="presentation">
    <section className="dialog login-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="system-setup-title">
      <span className="dialog-icon"><ShieldCheck size={22} strokeWidth={1.8} /></span>
      <p className="preview-label">{t.firstRun}</p>
      <h2 id="system-setup-title">{t.setupSystemTitle}</h2>
      <p>{t.setupSystemText}</p>
      <form className="auth-form" onSubmit={submit} aria-busy={busy}>
        <label>{t.setupKey}<input name="setupKey" type="password" autoComplete="off" required minLength={32} /></label>
        <label>{t.name}<input name="displayName" autoComplete="name" required minLength={2} maxLength={120} /></label>
        <label>{t.email}<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label>{t.password}<input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button full-button" type="submit" disabled={busy}>{busy ? t.pleaseWait : t.createSystemAdmin}<ArrowRight size={17} /></button>
      </form>
    </section>
  </div>;
}

function LoginDialog({ t, onClose, inviteToken, onAuthenticated }) {
  const dialogRef = useDialogKeys(onClose);
  const [mode, setMode] = useState(inviteToken ? 'invite' : 'login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    setBusy(true); setError('');
    try {
      const endpoint = mode === 'invite' ? '/auth/accept-staff-invite' : `/auth/${mode === 'register' ? 'register' : 'login'}`;
      const payload = mode === 'invite' ? { token: inviteToken, displayName: values.displayName, password: values.password } : values;
      const response = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Unable to sign in.');
      onAuthenticated(result.user);
    } catch (submitError) { setError(submitError.message); }
    finally { setBusy(false); }
  }
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="dialog login-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="login-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label={t.close}><X size={19} /></button>
        <span className="dialog-icon"><ShieldCheck size={22} strokeWidth={1.8} /></span>
        <h2 id="login-title">{mode === 'invite' ? t.staffInviteTitle : mode === 'register' ? t.createAccount : t.signInTitle}</h2>
        <p>{mode === 'invite' ? t.staffInviteText : t.accountNote}</p>
        <form className="auth-form" onSubmit={submit} aria-busy={busy}>
          {(mode === 'register' || mode === 'invite') && <label>{t.name}<input name="displayName" autoComplete="name" required minLength={2} maxLength={120} /></label>}
          {mode !== 'invite' && <label>{t.email}<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>}
          {mode === 'invite' && <p className="field-hint">{t.inviteEmailNote}</p>}
          <label>{t.password}<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? 1 : 10} maxLength={128} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button full-button" type="submit" disabled={busy}>{busy ? t.pleaseWait : mode === 'invite' ? t.acceptInvite : mode === 'register' ? t.createAccount : t.signIn}<ArrowRight size={17} /></button>
        </form>
        {!inviteToken && <button className="dialog-secondary" type="button" onClick={() => { setError(''); setMode(mode === 'login' ? 'register' : 'login'); }}>{mode === 'login' ? t.needAccount : t.haveAccount}</button>}
        <button className="dialog-secondary" type="button" onClick={onClose}>{t.cancel}</button>
      </section>
    </div>
  );
}

function BookingDialog({ t, clinic, onClose, onSubmitted }) {
  const dialogRef = useDialogKeys(onClose);
  const timesRequest = useRef(0);
  const requestableServices = clinic.services.filter((service) => service.slug !== 'emergency');
  const [serviceId, setServiceId] = useState(requestableServices[0]?.id ?? '');
  const [times, setTimes] = useState([]);
  const [timesLoading, setTimesLoading] = useState(false);
  const [timesError, setTimesError] = useState(false);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function loadTimes() {
    if (!serviceId) return;
    const requestId = ++timesRequest.current;
    setTimesLoading(true); setTimesError(false);
    setTimes([]);
    try {
      const response = await fetch(`${API_BASE}/availability?clinicId=${encodeURIComponent(clinic.id)}&serviceId=${encodeURIComponent(serviceId)}`);
      const result = await response.json();
      if (!response.ok) throw new Error('availability');
      if (requestId === timesRequest.current) setTimes(result.data ?? []);
    } catch { if (requestId === timesRequest.current) setTimesError(true); }
    finally { if (requestId === timesRequest.current) setTimesLoading(false); }
  }
  useEffect(() => { loadTimes(); }, [clinic.id, serviceId]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    const phone = new FormData(event.currentTarget).get('phone');
    try {
      const response = await fetch(`${API_BASE}/booking-requests`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ serviceId, startsAt: selected, phone }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Unable to send request.');
      onSubmitted(result.data);
    } catch (submitError) { setError(submitError.message); }
    finally { setBusy(false); }
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="dialog booking-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="booking-title">
      <button className="dialog-close" type="button" onClick={onClose} aria-label={t.close}><X size={19} /></button>
      <span className="dialog-icon"><Building2 size={22} /></span>
      <h2 id="booking-title">{t.requestTime}</h2><p>{clinic.name} · {t.unconfirmedIntro}</p>
      <form className="auth-form" onSubmit={submit} aria-busy={busy}>
        <label>{t.service}<select value={serviceId} onChange={(event) => { setServiceId(event.target.value); setSelected(''); }} required>{requestableServices.map((service) => <option key={service.id} value={service.id}>{t[service.nameKey] ?? service.nameKey}</option>)}</select></label>
        <p className="field-hint">{t.suggestedTimesLabel}</p>
        <div className="time-options" role="group" aria-label={t.suggestedTimesLabel} aria-busy={timesLoading}>
          {timesLoading && <p role="status">{t.pleaseWait}</p>}
          {timesError && <p className="form-error" role="alert">{t.directoryError} <button className="text-button" type="button" onClick={loadTimes}>{t.tryAgain}</button></p>}
          {times.map((slot) => <button key={`${slot.startsAt}-${slot.source}`} type="button" aria-pressed={selected === slot.startsAt} className={selected === slot.startsAt ? 'time-option is-selected' : 'time-option'} onClick={() => setSelected(slot.startsAt)}>{new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Mogadishu' }).format(new Date(slot.startsAt))}{slot.source === 'suggested' && <small>{t.suggestedUnconfirmed}</small>}{slot.source === 'staff' && <small>{t.enteredByClinic}</small>}</button>)}
        </div>
        <label>{t.phone}<input name="phone" type="tel" autoComplete="tel" placeholder="+252 …" required minLength={7} maxLength={24} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button full-button" type="submit" disabled={busy || !selected}>{busy ? t.pleaseWait : t.sendRequest}<ArrowRight size={17} /></button>
      </form>
      <button className="dialog-secondary" type="button" onClick={onClose}>{t.cancel}</button>
    </section>
  </div>;
}

function PatientRequests({ t, requests, onCancel }) {
  const [cancellingRequest, setCancellingRequest] = useState('');
  if (!requests.length) return null;
  async function cancel(id) {
    setCancellingRequest(id);
    try { await onCancel(id); }
    finally { setCancellingRequest(''); }
  }
  return <section className="requests-panel" aria-busy={Boolean(cancellingRequest)}><h2>{t.myRequests}</h2><ul>{requests.map((request) => <li key={request.id}><div><strong>{request.clinic.publicName ?? request.clinic.nameKey}</strong><span>{t[request.service.nameKey] ?? request.service.nameKey} · {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Mogadishu' }).format(new Date(request.startsAt))}</span><small>{request.source === 'suggested' ? t.suggestedUnconfirmed : t.enteredByClinic} · {t.statusLabels[request.status]}</small></div>{request.status === 'PENDING' && <button type="button" className="text-button" disabled={Boolean(cancellingRequest)} onClick={() => cancel(request.id)}>{cancellingRequest === request.id ? t.pleaseWait : t.cancelRequest}</button>}</li>)}</ul></section>;
}

function StaffDashboard({ t, requests, clinics, authUser, loading, error, onRefresh, onError }) {
  const [inviteResult, setInviteResult] = useState('');
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [updatingRequest, setUpdatingRequest] = useState('');
  async function update(id, status) {
    setUpdatingRequest(id);
    try {
      const response = await fetch(`${API_BASE}/staff/booking-requests/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || t.updateFailed);
      await onRefresh();
    } catch (actionError) { onError(actionError.message || t.updateFailed); }
    finally { setUpdatingRequest(''); }
  }
  async function invite(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setInviteBusy(true);
    try {
      const response = await fetch(`${API_BASE}/clinic-admin/staff-invites`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || t.updateFailed);
      setInviteResult(result.data.inviteUrl);
    } catch (actionError) { onError(actionError.message || t.updateFailed); }
    finally { setInviteBusy(false); }
  }
  async function addAvailability(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setAvailabilityBusy(true);
    try {
      const startsAt = new Date(`${values.startsAt}:00+03:00`).toISOString();
      const response = await fetch(`${API_BASE}/staff/availability`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ serviceId: values.serviceId, startsAt, capacity: Number(values.capacity) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || t.updateFailed);
      setAvailabilityMessage(t.availabilityAdded);
      form.reset();
    } catch (actionError) { onError(actionError.message || t.updateFailed); }
    finally { setAvailabilityBusy(false); }
  }
  const availableClinics = authUser.role === 'SYSTEM_ADMIN' ? clinics : clinics.filter((clinic) => clinic.id === authUser.clinicId);
  return <section className="requests-panel staff-panel" aria-busy={loading}><h2>{t.staffRequests}</h2>
    {error && <p className="form-error" role="alert">{t.updateFailed} <button className="text-button" type="button" onClick={() => onRefresh().catch(() => onError(t.updateFailed))}>{t.tryAgain}</button></p>}
    {loading && <p role="status">{t.pleaseWait}</p>}
    {authUser.role === 'CLINIC_ADMIN' && <form className="invite-form" onSubmit={invite} aria-busy={inviteBusy}><h3>{t.inviteClinicStaff}</h3><label>{t.email}<input name="email" type="email" required /></label><button className="primary-button" type="submit" disabled={inviteBusy}>{inviteBusy ? t.pleaseWait : t.createInvite}</button>{inviteResult && <p className="field-hint" role="status">{t.inviteLink} <a href={inviteResult}>{inviteResult}</a></p>}</form>}
    <form className="invite-form" onSubmit={addAvailability} aria-busy={availabilityBusy}><h3>{t.addAvailability}</h3><label>{t.service}<select name="serviceId" required>{availableClinics.flatMap((clinic) => clinic.services.map((service) => <option key={service.id} value={service.id}>{clinic.name} · {t[service.nameKey] ?? service.nameKey}</option>))}</select></label><label>{t.startTime} ({t.hargeisaTime})<input name="startsAt" type="datetime-local" required /></label><label>{t.capacity}<input name="capacity" type="number" min="1" max="100" defaultValue="1" required /></label><button className="primary-button" type="submit" disabled={availabilityBusy}>{availabilityBusy ? t.pleaseWait : t.addTime}</button>{availabilityMessage && <p className="field-hint" role="status">{availabilityMessage}</p>}</form>
    {!loading && !error && !requests.length && <p>{t.noRequests}</p>}<ul>{requests.map((request) => <li key={request.id}><div><strong>{request.clinic.publicName ?? request.clinic.nameKey} · {request.user.displayName}</strong><span>{t[request.service.nameKey] ?? request.service.nameKey} · {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Mogadishu' }).format(new Date(request.startsAt))}</span><small>{request.user.email} · {request.phone} · {t.statusLabels[request.status]}</small></div>{request.status === 'PENDING' && <div className="request-actions"><button type="button" className="text-button" disabled={Boolean(updatingRequest)} onClick={() => update(request.id, 'CONFIRMED')}>{updatingRequest === request.id ? t.pleaseWait : t.confirm}</button><button type="button" className="text-button" disabled={Boolean(updatingRequest)} onClick={() => update(request.id, 'DECLINED')}>{t.decline}</button></div>}</li>)}</ul>
  </section>;
}

function SystemAdminDashboard({ t, clinics, overview, loading, error, onRefresh, onError }) {
  const [inviteResult, setInviteResult] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [pendingAdmin, setPendingAdmin] = useState('');
  async function inviteClinicAdmin(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setInviteBusy(true);
    try {
      const response = await fetch(`${API_BASE}/system/clinic-admin-invites`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || t.updateFailed);
      setInviteResult(result.data.inviteUrl);
    } catch (actionError) { onError(actionError.message || t.updateFailed); }
    finally { setInviteBusy(false); }
  }
  async function setClinicAdminActive(id, active) {
    setPendingAdmin(id);
    try {
      const response = await fetch(`${API_BASE}/system/clinic-admins/${id}/status`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ active }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || t.updateFailed);
      await onRefresh();
    } catch (actionError) { onError(actionError.message || t.updateFailed); }
    finally { setPendingAdmin(''); }
  }
  const total = (items) => (items ?? []).reduce((sum, item) => sum + item._count._all, 0);
  const countRole = (role) => overview?.users.find((item) => item.role === role)?._count._all ?? 0;
  return <section className="requests-panel system-panel" aria-busy={loading}>
    <h2>{t.systemOverview}</h2>
    {error && <p className="form-error" role="alert">{t.updateFailed} <button className="text-button" type="button" onClick={() => onRefresh().catch(() => onError(t.updateFailed))}>{t.tryAgain}</button></p>}
    {loading && <p role="status">{t.loadingOverview}</p>}
    {overview && <><div className="system-stats"><article><strong>{overview.clinics.length}</strong><span>{t.clinics}</span></article><article><strong>{countRole('PATIENT')}</strong><span>{t.patients}</span></article><article><strong>{countRole('CLINIC_ADMIN')}</strong><span>{t.clinicAdmins}</span></article><article><strong>{total(overview.requests)}</strong><span>{t.totalRequests}</span></article></div>
      <h3>{t.systemClinics}</h3><ul className="system-clinic-list">{overview.clinics.map((clinic) => <li key={clinic.id}><strong>{clinic.publicName ?? clinic.nameKey}</strong><span>{clinic._count.users} {t.accounts} · {clinic._count.bookingRequests} {t.requestsLabel}</span></li>)}</ul>
      <h3>{t.manageClinicAdmins}</h3><ul className="system-clinic-list">{overview.clinicAdmins.map((admin) => <li key={admin.id}><div><strong>{admin.displayName}</strong><span>{admin.email} · {admin.clinic?.publicName ?? admin.clinic?.nameKey ?? ''} · {admin.active ? t.active : t.disabled}</span></div><button type="button" className="text-button" disabled={Boolean(pendingAdmin)} onClick={() => setClinicAdminActive(admin.id, !admin.active)}>{pendingAdmin === admin.id ? t.pleaseWait : admin.active ? t.disableAccount : t.enableAccount}</button></li>)}</ul>
      <p className="field-hint">{t.requestStatuses}: {overview.requests.map((item) => `${t.statusLabels[item.status]} ${item._count._all}`).join(' · ')}</p></>}
    <form className="invite-form" onSubmit={inviteClinicAdmin} aria-busy={inviteBusy}><h3>{t.createClinicAdmin}</h3><label>{t.email}<input name="email" type="email" required /></label><label>{t.clinic}<select name="clinicId" required>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></label><button className="primary-button" type="submit" disabled={inviteBusy}>{inviteBusy ? t.pleaseWait : t.createInvite}</button>{inviteResult && <p className="field-hint" role="status">{t.inviteLink} <a href={inviteResult}>{inviteResult}</a></p>}</form>
  </section>;
}

export default App;
