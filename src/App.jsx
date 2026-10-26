import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  HeartPulse,
  MapPin,
  Plus,
  ShieldCheck,
  Smartphone,
  X
} from 'lucide-react';
import { copy } from './copy.js';

const visitSeed = {
  id: 'demo-visit-01',
  day: '27',
  date: 'tomorrow',
  time: '09:30',
  service: 'generalConsult',
  token: 'DARYEEL-DEMO-VISIT-27-OCT'
};

const dayOptions = [
  { key: 'tue', weekday: 'weekdayTue', date: 'dateTue' },
  { key: 'wed', weekday: 'weekdayWed', date: 'dateWed' },
  { key: 'thu', weekday: 'weekdayThu', date: 'dateThu' }
];

const slots = ['09:30', '10:15', '11:00', '14:00'];

function makeToken() {
  return `DARYEEL-${crypto.randomUUID()}`;
}

function useDialogKeys(onClose) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    const first = dialog?.querySelector('button');
    first?.focus();
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const firstItem = focusable[0];
      const lastItem = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
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
  const [screen, setScreen] = useState('home');
  const [appointments, setAppointments] = useState([visitSeed]);
  const [selectedDate, setSelectedDate] = useState('tue');
  const [selectedTime, setSelectedTime] = useState('09:30');
  const [selectedService, setSelectedService] = useState('generalConsult');
  const [passAppointment, setPassAppointment] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [toast, setToast] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const t = copy[language];

  useEffect(() => {
    window.localStorage.setItem('daryeel-language', language);
    document.documentElement.lang = language;
  }, [language]);

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

  function startBooking() {
    setScreen('booking');
    setSelectedDate('tue');
    setSelectedTime('09:30');
  }

  function confirmBooking(event) {
    event.preventDefault();
    const day = dayOptions.find((option) => option.key === selectedDate) ?? dayOptions[0];
    const appointment = {
      id: makeToken(),
      day: day.key === 'tue' ? '27' : day.key === 'wed' ? '28' : '29',
      date: day.key,
      time: selectedTime,
      service: selectedService,
      token: makeToken()
    };
    setAppointments((current) => [appointment, ...current]);
    setPassAppointment(appointment);
    setScreen('appointments');
    setToast(t.bookingDone);
  }

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  const openPass = (appointment) => setPassAppointment(appointment);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">{language === 'so' ? 'U gudub nuxurka' : 'Skip to content'}</a>
      <header className="topbar">
        <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); setScreen('home'); }} aria-label={`${t.brand}, ${t.overview}`}>
          <span className="brand-mark" aria-hidden="true"><HeartPulse size={21} strokeWidth={1.9} /></span>
          <span>{t.brand}</span>
        </a>
        <nav className="desktop-nav" aria-label={language === 'so' ? 'Qaybaha abka' : 'App navigation'}>
          <button className={`nav-link ${screen === 'home' ? 'is-current' : ''}`} type="button" onClick={() => setScreen('home')}>{t.overview}</button>
          <button className={`nav-link ${screen === 'appointments' ? 'is-current' : ''}`} type="button" onClick={() => setScreen('appointments')}>{t.appointments}</button>
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
          <button className="profile-button" type="button" onClick={() => setShowLogin(true)} aria-label={t.signIn}>
            <span className="profile-avatar">A</span>
            <span className="profile-label">{t.profile}</span>
            <ChevronDown size={16} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <main id="main" className="main-content">
        {screen === 'home' && <HomeScreen t={t} appointments={appointments} onBook={startBooking} onPass={openPass} onSignIn={() => setShowLogin(true)} />}
        {screen === 'booking' && (
          <BookingScreen
            t={t}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            selectedService={selectedService}
            onDate={setSelectedDate}
            onTime={setSelectedTime}
            onService={setSelectedService}
            onConfirm={confirmBooking}
            onBack={() => setScreen('home')}
          />
        )}
        {screen === 'appointments' && <AppointmentsScreen t={t} appointments={appointments} onBook={startBooking} onPass={openPass} />}
      </main>

      <footer className="app-footer">
        <span>{t.noBackend}</span>
        <span className="footer-mark"><ShieldCheck size={15} strokeWidth={1.8} /> {t.preview}</span>
      </footer>

      <nav className="mobile-nav" aria-label={language === 'so' ? 'Qaybaha abka' : 'App navigation'}>
        <button type="button" className={screen === 'home' ? 'is-current' : ''} onClick={() => setScreen('home')}>
          <HeartPulse size={20} strokeWidth={1.8} /><span>{t.overview}</span>
        </button>
        <button type="button" className={screen === 'appointments' ? 'is-current' : ''} onClick={() => setScreen('appointments')}>
          <CalendarDays size={20} strokeWidth={1.8} /><span>{t.appointments}</span>
        </button>
        <button type="button" className={screen === 'booking' ? 'is-current' : ''} onClick={startBooking}>
          <Plus size={20} strokeWidth={1.8} /><span>{t.book}</span>
        </button>
      </nav>

      {showLogin && <LoginDialog t={t} onClose={() => setShowLogin(false)} onContinue={() => { setShowLogin(false); setToast(t.noBackend); }} />}
      {passAppointment && <PassDialog t={t} appointment={passAppointment} onClose={() => setPassAppointment(null)} />}
      {toast && <div className="toast" role="status"><Check size={17} strokeWidth={2.2} />{toast}</div>}
    </div>
  );
}

function HomeScreen({ t, appointments, onBook, onPass, onSignIn }) {
  const upcoming = appointments[0];
  return (
    <>
      <section className="welcome-block">
        <div>
          <p className="preview-label"><span className="preview-label-icon"><Check size={13} strokeWidth={2.4} /></span>{t.preview}</p>
          <h1>{t.greeting}</h1>
          <p className="welcome-copy">{t.welcomeLine}</p>
        </div>
        <button className="quiet-button esignet-button" type="button" onClick={onSignIn}>
          <ShieldCheck size={17} strokeWidth={1.8} /> {t.signIn}
        </button>
      </section>

      <div className="dashboard-grid">
        <section className="upcoming-section" aria-labelledby="next-visit-title">
          <div className="section-heading">
            <h2 id="next-visit-title">{t.nextVisit}</h2>
            <button className="text-button" type="button" onClick={() => onPass(upcoming)}>{t.viewPass}<ArrowRight size={16} /></button>
          </div>
          {upcoming ? <VisitTicket t={t} appointment={upcoming} onPass={() => onPass(upcoming)} /> : <EmptyAppointments t={t} onBook={onBook} />}
          <section className="arrival-guide" aria-labelledby="arrival-title">
            <h2 id="arrival-title">{t.stepsTitle}</h2>
            <ol className="arrival-steps">
              <li><span className="step-number">1</span><span>{t.stepOne}</span></li>
              <li><span className="step-number">2</span><span>{t.stepTwo}</span></li>
              <li><span className="step-number">3</span><span>{t.stepThree}</span></li>
            </ol>
          </section>
        </section>

        <aside className="booking-aside">
          <div className="booking-aside-head">
            <span className="aside-icon"><CalendarDays size={19} strokeWidth={1.8} /></span>
            <span className="aside-index">{t.book}</span>
          </div>
          <h2>{t.newAppointment}</h2>
          <p>{t.bookingHint}</p>
          <div className="service-preview">
            <span>{t.service}</span>
            <strong>{t.generalConsult}</strong>
            <span className="service-meta"><Clock3 size={15} strokeWidth={1.8} /> {t.minutes}</span>
          </div>
          <button className="primary-button full-button" type="button" onClick={onBook}>{t.findTime}<ArrowRight size={17} /></button>
          <p className="privacy-note"><ShieldCheck size={16} strokeWidth={1.8} />{t.noBackend}</p>
        </aside>
      </div>
      <SupportStrip t={t} />
    </>
  );
}

function VisitTicket({ t, appointment, onPass }) {
  const dayKey = appointment.date === 'wed' ? 'weekdayWed' : appointment.date === 'thu' ? 'weekdayThu' : 'weekdayTue';
  const dateKey = appointment.date === 'wed' ? 'dateWed' : appointment.date === 'thu' ? 'dateThu' : 'dateTue';
  return (
    <article className="visit-ticket">
      <div className="ticket-date plastic" aria-label={`${t[dayKey]}, ${t[dateKey]}`}>
        <span>{t[dayKey]}</span>
        <strong>{appointment.day}</strong>
        <small>{t[dateKey].split(' ').slice(-1)[0]}</small>
      </div>
      <div className="ticket-details">
        <div className="ticket-time"><Clock3 size={16} strokeWidth={1.8} /><span>{appointment.time}</span><span className="time-separator" aria-hidden="true" /><span>{t.minutes}</span></div>
        <h3>{t[appointment.service]}</h3>
        <p className="clinic-name">{t.clinic}</p>
        <p className="clinic-location"><MapPin size={15} strokeWidth={1.8} />{t.clinicArea}</p>
        <button className="ticket-action" type="button" onClick={onPass}>{t.viewPass}<ArrowRight size={16} /></button>
      </div>
      <div className="ticket-stamp" aria-hidden="true"><Check size={19} strokeWidth={2.1} /></div>
    </article>
  );
}

function BookingScreen({ t, selectedDate, selectedTime, selectedService, onDate, onTime, onService, onConfirm, onBack }) {
  return (
    <section className="booking-screen">
      <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={17} />{t.back}</button>
      <div className="booking-layout">
        <form className="booking-form" onSubmit={onConfirm}>
          <p className="preview-label"><span className="preview-label-icon"><Check size={13} strokeWidth={2.4} /></span>{t.preview}</p>
          <h1>{t.bookingTitle}</h1>
          <p className="booking-intro">{t.bookingSubtitle}</p>

          <fieldset className="form-section">
            <legend>{t.chooseService}</legend>
            <div className="service-options">
              {['generalConsult', 'nutritionConsult'].map((service) => (
                <label className={`service-option ${selectedService === service ? 'is-selected' : ''}`} key={service}>
                  <input type="radio" name="service" value={service} checked={selectedService === service} onChange={() => onService(service)} />
                  <span className="service-radio" aria-hidden="true">{selectedService === service && <span />}</span>
                  <span className="service-option-copy"><strong>{t[service]}</strong><small>{t.clinic}</small></span>
                  <span className="service-duration">{t.minutes}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>{t.chooseDate}</legend>
            <div className="date-options">
              {dayOptions.map((day) => (
                <button className={`date-option ${selectedDate === day.key ? 'is-selected' : ''}`} type="button" key={day.key} onClick={() => onDate(day.key)} aria-pressed={selectedDate === day.key}>
                  <span>{t[day.weekday]}</span>
                  <strong>{t[day.date]}</strong>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>{t.chooseTime}</legend>
            <div className="time-options">
              {slots.map((slot) => (
                <button className={`time-option ${selectedTime === slot ? 'is-selected' : ''}`} type="button" key={slot} onClick={() => onTime(slot)} aria-pressed={selectedTime === slot}>{slot}</button>
              ))}
            </div>
          </fieldset>
          <button className="primary-button confirm-button" type="submit">{t.confirmBooking}<ArrowRight size={17} /></button>
          <p className="form-disclaimer"><ShieldCheck size={16} strokeWidth={1.8} />{t.bookingPending}</p>
        </form>

        <aside className="booking-summary">
          <div className="summary-rule" />
          <p className="summary-label">{t.selected}</p>
          <h2>{t[selectedService]}</h2>
          <p className="summary-clinic"><MapPin size={16} strokeWidth={1.8} />{t.clinic}</p>
          <p className="summary-clinic"><CalendarDays size={16} strokeWidth={1.8} />{t[dayOptions.find((day) => day.key === selectedDate)?.weekday ?? 'weekdayTue']}, {t[dayOptions.find((day) => day.key === selectedDate)?.date ?? 'dateTue']}</p>
          <p className="summary-clinic"><Clock3 size={16} strokeWidth={1.8} />{selectedTime} · {t.minutes}</p>
          <div className="summary-note"><ShieldCheck size={17} strokeWidth={1.8} /><span>{t.noBackend}</span></div>
        </aside>
      </div>
    </section>
  );
}

function AppointmentsScreen({ t, appointments, onBook, onPass }) {
  return (
    <section className="appointments-screen">
      <div className="screen-title-row">
        <div>
          <p className="preview-label"><span className="preview-label-icon"><Check size={13} strokeWidth={2.4} /></span>{t.preview}</p>
          <h1>{t.myAppointmentsTitle}</h1>
          <p className="welcome-copy">{t.appointmentsSubtitle}</p>
        </div>
        <button className="primary-button" type="button" onClick={onBook}><Plus size={18} />{t.book}</button>
      </div>
      {appointments.length ? (
        <div className="appointment-list">
          {appointments.map((appointment) => (
            <article className="appointment-row" key={appointment.id}>
              <VisitTicket t={t} appointment={appointment} onPass={() => onPass(appointment)} />
              <span className="appointment-state"><span className="state-check"><Check size={12} strokeWidth={2.4} /></span>{t.statusUpcoming}</span>
            </article>
          ))}
        </div>
      ) : <EmptyAppointments t={t} onBook={onBook} />}
      <p className="screen-disclaimer">{t.noBackend}</p>
    </section>
  );
}

function EmptyAppointments({ t, onBook }) {
  return (
    <div className="empty-state">
      <CalendarDays size={28} strokeWidth={1.6} />
      <p>{t.noAppointments}</p>
      <button className="text-button" type="button" onClick={onBook}>{t.bookFirst}<ArrowRight size={16} /></button>
    </div>
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

function PassDialog({ t, appointment, onClose }) {
  const dialogRef = useDialogKeys(onClose);
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="dialog pass-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="pass-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label={t.close}><X size={19} /></button>
        <p className="preview-label"><span className="preview-label-icon"><Check size={13} strokeWidth={2.4} /></span>{t.preview}</p>
        <h2 id="pass-title">{t.passTitle}</h2>
        <p className="pass-description">{t.passText}</p>
        <div className="qr-paper"><QRCodeSVG value={appointment.token} size={184} level="M" includeMargin /></div>
        <p className="pass-service">{t[appointment.service]}<span>{appointment.time}</span></p>
        <p className="pass-expiry">{t.passExpiry}</p>
        <button className="quiet-button full-button" type="button" onClick={onClose}>{t.close}</button>
      </section>
    </div>
  );
}

function SupportStrip({ t }) {
  return (
    <aside className="support-strip">
      <span className="support-icon"><HeartPulse size={19} strokeWidth={1.8} /></span>
      <div><strong>{t.support}</strong><p>{t.supportText}</p></div>
    </aside>
  );
}

export default App;
