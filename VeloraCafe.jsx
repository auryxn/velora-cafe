import React, { useState, useEffect, useRef } from 'react';
import {
  Coffee, Clock, UtensilsCrossed, Sparkles, MapPin, Phone, Mail,
  Star, Menu, X, ArrowRight, Camera,
} from 'lucide-react';

import heroBreakfast from './assets/hero-breakfast.png';
import interiorMorning from './assets/interior-morning.png';
import menuDessert from './assets/menu-dessert.png';
import eveningTable from './assets/evening-table.png';

/* ---------------------------------------------------------
   Design tokens (from the BALTIC BREW design spec)
--------------------------------------------------------- */
const COLORS = {
  cream: '#FAF6EF',
  beige: '#ECE0CC',
  creamWhite: '#FFFDF9',
  espresso: '#2B1B12',
  mocha: '#5B4636',
  graphite: '#312C28',
  caramel: '#C8893B',
  gold: '#E3B873',
};

const fontDisplay = "'Fraunces', serif";
const fontBody = "'Manrope', sans-serif";

const IMAGES = {
  heroBreakfast,
  interiorMorning,
  menuDessert,
  eveningTable,
};

// Local-asset key map: DB stores image as 'local:<key>' or an uploaded path
// starting with '/uploads/'. Local keys resolve to the statically-imported asset.
const LOCAL_IMAGE_ALIASES = {
  hero: 'heroBreakfast',
  interior: 'interiorMorning',
  interiorMorning: 'interiorMorning',
  dessert: 'menuDessert',
  menuDessert: 'menuDessert',
  evening: 'eveningTable',
  eveningTable: 'eveningTable',
  heroBreakfast: 'heroBreakfast',
};

// Given a DB image value, return a URL/src usable in <img>. Returns '' for none.
function resolveImage(val) {
  if (!val) return '';
  const v = String(val);
  if (v.startsWith('/uploads/') || v.startsWith('http://') || v.startsWith('https://')) {
    // ensure same origin availability in dev (proxy) + prod (same origin)
    return v;
  }
  if (v.startsWith('local:')) {
    const key = v.slice(6);
    const mapped = LOCAL_IMAGE_ALIASES[key];
    if (mapped && IMAGES[mapped]) return IMAGES[mapped];
    return '';
  }
  const direct = LOCAL_IMAGE_ALIASES[v];
  if (direct && IMAGES[direct]) return IMAGES[direct];
  return v || '';
}

// Base URL for API calls. Same-origin in production; in dev when served from
// vite you may set VITE_API to the backend e.g. /api (proxied) or full URL.
const API_BASE = (import.meta.env && import.meta.env.VITE_API)
  ? import.meta.env.VITE_API.replace(/\/$/, '')
  : '';

// Tiny message-agnostic fetch helper with graceful fallback.
async function apiFetch(path, options) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Load data once on mount; render SEED defaults until the API responds so the
// page always shows something even if the backend is offline.
function useApi(path, seedDefault) {
  const [data, setData] = useState(seedDefault);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    apiFetch(path)
      .then((d) => {
        if (alive && d) setData(d);
      })
      .catch(() => {
        /* keep seed defaults */
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  return [data, setData, loaded];
}

// ---------------------------------------------------------------------------
// Site settings (brand / contact / socials / hero copy) — DB-backed via
// /api/settings, with the exact current defaults as graceful fallbacks.
// ---------------------------------------------------------------------------
const SEED_SETTINGS = {
  brand_name: 'BALTIC BREW',
  tagline: 'Specialty coffee & all-day breakfast, made slow.',
  address: 'Užupio g. 12, Vilnius, Lithuania',
  hours: 'Mon–Fri: 08:00–20:00 · Sat–Sun: 09:00–21:00',
  phone: '+370 600 12345',
  email: 'hello@balticbrew.com',
  instagram: '',
  facebook: '',
  tiktok: '',
  location_eyebrow: 'Vilnius · Specialty Coffee',
  hero_title: 'Specialty Coffee & All-Day Breakfast in Vilnius',
  hero_subtitle:
    'A warm modern café for slow mornings, good conversations, and handcrafted desserts.',
  about_title: 'A café built around slow mornings',
  about_body:
    'BALTIC BREW is a specialty coffee spot in the heart of Užupis, where every cup is brewed with care and every plate is made fresh. We roast thoughtfully, source seasonally, and keep the room calm enough for deep work, first dates, and long catch-ups with friends.',
  gallery_eyebrow: 'Inside BALTIC BREW',
  gallery_quote: '“Designed for slow mornings and warm evenings.”',
  footer_tagline: 'Specialty coffee & all-day breakfast, made slow.',
  footer_year: '2025',
};

// React context so Header / Hero / Footer / Contact can read settings without
// heavy prop drilling. Defaults equal the original hardcoded content.
const SettingsContext = React.createContext(SEED_SETTINGS);
function useSettings() {
  return React.useContext(SettingsContext) || {};
}

// Social links are ignored when landing on '#'. Return configured url or '#'.
function socialUrl(value) {
  return value && value.trim() && value.trim() !== '#' ? value.trim() : '#';
}

const eyebrowStyle = {
  fontFamily: fontBody, fontWeight: 700, fontSize: 13,
  letterSpacing: '0.12em', color: COLORS.caramel, textTransform: 'uppercase',
};
const h2Style = {
  fontFamily: fontDisplay, fontWeight: 500, color: COLORS.espresso,
  fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 1.15,
};
const bodyStyle = {
  fontFamily: fontBody, color: COLORS.mocha, fontSize: 18, lineHeight: 1.6,
};

/* ---------------------------------------------------------
   Small reusable pieces
--------------------------------------------------------- */

// Hand-drawn "steam curl" — the one signature motif, used sparingly.
function SteamCurl({ size = 16, color = COLORS.espresso, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5 21c0-3 4-3 4-6s-3-3-3-6 4-4 4-7" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}


function InstagramIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M14.2 8.2V6.7c0-.7.5-.9 1-.9h2V2.5h-2.8c-3 0-4.6 1.8-4.6 4.2v1.5H7v3.5h2.8v9.8h4.4v-9.8h2.9l.5-3.5h-3.4z" />
    </svg>
  );
}

function TikTokIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.5 3c.4 2 1.8 3.6 3.8 4v3c-1.5 0-2.9-.4-4-1.2v6.4c0 3.2-2.6 5.8-5.8 5.8S4.7 17.4 4.7 14.2c0-3 2.3-5.5 5.3-5.8v3.1a2.8 2.8 0 1 0 2 2.7V3h4.5z" />
    </svg>
  );
}

// Thin wavy divider line — appears only twice in the whole page (restraint).
function WaveDivider({ color = COLORS.caramel, opacity = 0.25 }) {
  return (
    <svg viewBox="0 0 1200 40" className="w-full h-6 md:h-10" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 20 C 100 5, 200 35, 300 20 S 500 5, 600 20 S 800 35, 900 20 S 1100 5, 1200 20"
        fill="none" stroke={color} strokeOpacity={opacity} strokeWidth="1.5"
      />
    </svg>
  );
}

// Elegant placeholder for real photography — warm gradient + icon + label,
// ready to be swapped for an <img> tag once real photos exist.
function PhotoPlaceholder({ label, icon: Icon = Camera, aspect, rounded = '24px', className = '', src }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`relative overflow-hidden flex items-center justify-center ${className}`}
      style={{
        borderRadius: rounded,
        ...(aspect ? { aspectRatio: aspect } : {}),
        background: `linear-gradient(135deg, ${COLORS.beige} 0%, ${COLORS.cream} 45%, ${COLORS.beige} 100%)`,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={label}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(circle at 25% 20%, rgba(255,255,255,0.5), transparent 55%)' }}
          />
          <div className="relative flex flex-col items-center gap-2 px-4 text-center">
            <Icon size={26} strokeWidth={1.4} style={{ color: COLORS.caramel }} />
            <span style={{ fontFamily: fontBody, color: COLORS.mocha, fontSize: 11, letterSpacing: '0.04em' }}>
              {label}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// Simple scroll-reveal wrapper (IntersectionObserver), fade-up once per section.
function Reveal({ children, className = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
      }`}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------
   Header
--------------------------------------------------------- */
function Header({ scrolled, menuOpen, setMenuOpen }) {
  const s = useSettings();
  const brandName = s.brand_name || SEED_SETTINGS.brand_name;
  const navItems = ['Home', 'Menu', 'About', 'Gallery', 'Contact'];
  const textColor = scrolled ? COLORS.espresso : '#FFFDF9';

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'shadow-md' : ''}`}
      style={{ backgroundColor: scrolled ? COLORS.cream : 'transparent' }}
    >
      <div className="max-w-6xl mx-auto px-6 md:px-12 h-20 flex items-center justify-between">
        <a
          href="#home"
          className="flex items-center gap-1"
          style={{ fontFamily: fontDisplay, fontStyle: 'italic', fontWeight: 500, fontSize: 24, color: textColor }}
        >
          {brandName}
          <SteamCurl size={14} color={COLORS.caramel} />
        </a>

        <nav className="hidden md:flex items-center gap-10">
          {navItems.map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="group relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              style={{ fontFamily: fontBody, fontWeight: 600, fontSize: 15, color: textColor }}
            >
              {item}
              <span
                className="absolute left-0 -bottom-1 h-px w-0 group-hover:w-full transition-all duration-300"
                style={{ backgroundColor: COLORS.caramel }}
              />
            </a>
          ))}
        </nav>

        <a
          href="#contact"
          className="btn-primary hidden md:inline-flex items-center gap-2 px-6 py-3 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          style={{ fontFamily: fontBody, fontWeight: 600, fontSize: 15 }}
        >
          Book a Table
        </a>

        <button
          className="md:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          onClick={() => setMenuOpen(true)}
          style={{ color: textColor }}
          aria-label="Open menu"
        >
          <Menu size={26} />
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-50 flex flex-col transition-opacity duration-300 ${
          menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ backgroundColor: COLORS.espresso }}
      >
        <div className="flex justify-end p-6">
          <button
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            style={{ color: COLORS.cream }}
          >
            <X size={28} />
          </button>
        </div>
        <nav className="flex flex-col items-center gap-8 mt-6">
          {navItems.map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              onClick={() => setMenuOpen(false)}
              style={{ fontFamily: fontDisplay, fontSize: 30, color: COLORS.cream }}
            >
              {item}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setMenuOpen(false)}
            className="btn-primary px-8 py-4 rounded-full mt-4"
            style={{ fontFamily: fontBody, fontWeight: 600 }}
          >
            Book a Table
          </a>
        </nav>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------
   Hero
--------------------------------------------------------- */
function Hero() {
  const s = useSettings();
  const heroTitle = s.hero_title || SEED_SETTINGS.hero_title;
  const heroSub = s.hero_subtitle || SEED_SETTINGS.hero_subtitle;
  const loc = s.location_eyebrow || SEED_SETTINGS.location_eyebrow;
  return (
    <section id="home" className="relative pt-32 pb-20 md:pt-40 md:pb-32" style={{ backgroundColor: COLORS.cream }}>
      <div className="max-w-6xl mx-auto px-6 md:px-12 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="mb-4 animate-fade-up" style={{ ...eyebrowStyle, animationDelay: '0ms' }}>
            {loc}
          </p>
          <h1
            className="mb-6 animate-fade-up"
            style={{
              fontFamily: fontDisplay, fontWeight: 500, color: COLORS.espresso,
              fontSize: 'clamp(2.25rem, 5vw, 4rem)', lineHeight: 1.05, letterSpacing: '-0.01em',
              animationDelay: '80ms',
            }}
          >
            {heroTitle}
          </h1>
          <p className="mb-8 max-w-md animate-fade-up" style={{ ...bodyStyle, animationDelay: '160ms' }}>
            {heroSub}
          </p>
          <div className="flex flex-wrap gap-4 animate-fade-up" style={{ animationDelay: '240ms' }}>
            <a
              href="#menu"
              className="btn-secondary inline-flex items-center gap-2 px-8 py-4 rounded-full border-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              style={{ fontFamily: fontBody, fontWeight: 600, fontSize: 16, color: COLORS.espresso, borderColor: COLORS.espresso }}
            >
              View Menu
            </a>
            <a
              href="#contact"
              className="group btn-primary inline-flex items-center gap-2 px-8 py-4 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              style={{ fontFamily: fontBody, fontWeight: 600, fontSize: 16 }}
            >
              Book a Table
              <SteamCurl
                size={14}
                color={COLORS.espresso}
                className="opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300"
              />
            </a>
          </div>
        </div>
        <PhotoPlaceholder
          label="Hero — flat white & breakfast spread"
          src={IMAGES.heroBreakfast}
          icon={Coffee}
          aspect="4/5"
          rounded="32px"
          className="w-full animate-fade-up"
        />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   About
--------------------------------------------------------- */
function About() {
  const s = useSettings();
  const features = [
    { icon: Coffee, title: 'Freshly Roasted Coffee' },
    { icon: Clock, title: 'All-Day Breakfast' },
    { icon: Sparkles, title: 'Handmade Desserts' },
  ];
  return (
    <section id="about" className="py-20 md:py-32" style={{ backgroundColor: COLORS.cream }}>
      <div className="max-w-6xl mx-auto px-6 md:px-12 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="mb-3" style={eyebrowStyle}>Our Story</p>
          <h2 className="mb-6" style={h2Style}>{s.about_title || SEED_SETTINGS.about_title}</h2>
          <p className="mb-10 max-w-lg" style={bodyStyle}>
            {s.about_body || SEED_SETTINGS.about_body}
          </p>
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
            {features.map((f) => (
              <div key={f.title} className="flex items-center gap-3">
                <f.icon size={26} strokeWidth={1.5} style={{ color: COLORS.caramel }} />
                <span style={{ fontFamily: fontBody, fontWeight: 600, fontSize: 15, color: COLORS.espresso }}>
                  {f.title}
                </span>
              </div>
            ))}
          </div>
        </div>
        <PhotoPlaceholder label="Interior — morning light" src={IMAGES.interiorMorning} icon={Camera} aspect="4/5" rounded="24px" />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Featured Menu
--------------------------------------------------------- */
// Seed fallback shown until the API responds (keeps the exact same look).
const SEED_MENU_ITEMS = [
  { name: 'Flat White', price: '€3.80', desc: 'Smooth espresso, velvety steamed milk', category: 'coffee', icon: Coffee, image: 'local:hero' },
  { name: 'Vanilla Latte', price: '€4.20', desc: 'Espresso with house-made vanilla syrup', category: 'coffee', icon: Coffee, image: 'local:dessert' },
  { name: 'Avocado Toast', price: '€8.50', desc: 'Sourdough, smashed avocado, chili oil', category: 'food', icon: UtensilsCrossed, image: 'local:hero' },
  { name: 'Croissant Benedict', price: '€9.90', desc: 'Butter croissant, poached eggs, hollandaise', category: 'food', icon: UtensilsCrossed, image: 'local:hero' },
  { name: 'Pistachio Cheesecake', price: '€5.50', desc: 'Creamy cheesecake, roasted pistachio crumb', category: 'dessert', icon: Sparkles, image: 'local:dessert' },
  { name: 'Berry Pancakes', price: '€8.90', desc: 'Fluffy pancakes, seasonal berries, maple syrup', category: 'dessert', icon: Sparkles, image: 'local:hero' },
];

// Map a DB 'category' text field to a lucide icon component (fallback Coffee).
function categoryIcon(cat) {
  const c = String(cat || '').toLowerCase();
  if (c.includes('food')) return UtensilsCrossed;
  if (c.includes('dessert')) return Sparkles;
  return Coffee;
}

// Normalize a DB menu row into the shape MenuCard expects (icon + resolved image).
function normalizeMenuItem(raw, index) {
  return {
    ...raw,
    icon: categoryIcon(raw && raw.category) || Coffee,
    image: resolveImage(raw && raw.image) || IMAGES.heroBreakfast,
    key: (raw && raw.id) || `seed-${index}`,
  };
}

function MenuCard({ item }) {
  return (
    <div
      className="group flex-shrink-0 w-4/5 md:w-full md:flex-shrink snap-start rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
      style={{ backgroundColor: COLORS.creamWhite }}
    >
      <div className="overflow-hidden">
        <PhotoPlaceholder
          label={item.name}
          src={item.image}
          icon={item.icon}
          aspect="4/3"
          rounded="0px"
          className="transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-6">
        <h3 className="mb-2" style={{ fontFamily: fontDisplay, fontWeight: 500, fontSize: 22, color: COLORS.espresso }}>
          {item.name}
        </h3>
        <p className="mb-4" style={{ fontFamily: fontBody, fontSize: 14, color: COLORS.mocha }}>
          {item.desc}
        </p>
        <span className="relative inline-block" style={{ fontFamily: fontBody, fontWeight: 700, fontSize: 18, color: COLORS.caramel }}>
          {item.price}
          <span
            className="absolute left-0 -bottom-1 h-px w-0 group-hover:w-full transition-all duration-300"
            style={{ backgroundColor: COLORS.caramel }}
          />
        </span>
      </div>
    </div>
  );
}

function MenuSection() {
  const [rawItems] = useApi('/api/menu', SEED_MENU_ITEMS);
  const items = (Array.isArray(rawItems) ? rawItems : SEED_MENU_ITEMS)
    .filter((m) => m.available !== false)
    .map(normalizeMenuItem);
  return (
    <section id="menu" className="py-20 md:py-32" style={{ backgroundColor: COLORS.beige }}>
      <div className="max-w-6xl mx-auto px-6 md:px-12">
        <p className="mb-3" style={eyebrowStyle}>From The Menu</p>
        <h2 className="mb-10 md:mb-14" style={h2Style}>What we&apos;re brewing today</h2>

        <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 overflow-x-auto md:overflow-visible snap-x snap-mandatory scroll-hide -mx-6 px-6 md:mx-0 md:px-0 pb-4 md:pb-0">
          {items.map((item) => (
            <MenuCard key={item.key || item.name} item={item} />
          ))}
        </div>

        <div className="mt-10 text-center md:hidden">
          <a
            href="#menu"
            className="inline-flex items-center gap-1"
            style={{ fontFamily: fontBody, fontWeight: 600, color: COLORS.espresso }}
          >
            View Full Menu <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Gallery
--------------------------------------------------------- */
const SEED_GALLERY_ITEMS = [
  { label: 'Morning espresso pull', span: 'col-span-2', aspect: 'aspect-video', caption: 'Morning light', image: 'local:hero' },
  { label: 'Pastry case close-up', span: 'col-span-1', aspect: 'aspect-square', caption: 'Fresh daily', image: 'local:dessert' },
  { label: 'Window seat, midday', span: 'col-span-1', aspect: 'aspect-square', caption: 'Midday calm', image: 'local:interior' },
  { label: 'Friends at the table', span: 'col-span-2', aspect: 'aspect-video', caption: 'Catching up', image: 'local:interior' },
  { label: 'Evening glow, last guests', span: 'col-span-2', aspect: 'aspect-video', caption: 'Warm evening', image: 'local:evening' },
];

// Layout is per-index/totals on the seed set; we keep it simple and reuse the
// same span/aspect scheme for whatever rows the API returns (cycling patterns).
const GALLERY_SPANS = ['col-span-2', 'col-span-1', 'col-span-1', 'col-span-2', 'col-span-2'];
const GALLERY_ASPECTS = ['aspect-video', 'aspect-square', 'aspect-square', 'aspect-video', 'aspect-video'];
function galleryLayout(index) {
  return {
    span: GALLERY_SPANS[index % GALLERY_SPANS.length],
    aspect: GALLERY_ASPECTS[index % GALLERY_ASPECTS.length],
  };
}

function Gallery() {
  const s = useSettings();
  const [rawGallery] = useApi('/api/gallery', SEED_GALLERY_ITEMS);
  const gallery = (Array.isArray(rawGallery) ? rawGallery : SEED_GALLERY_ITEMS).map((raw, i) => {
    const layout = galleryLayout(i);
    return {
      ...raw,
      ...layout,
      label: raw.label || 'Gallery photo',
      caption: raw.caption || raw.label || '',
      image: resolveImage(raw.image),
      key: (raw && raw.id) || `g-${i}`,
    };
  });
  return (
    <section id="gallery" className="py-20 md:py-32" style={{ backgroundColor: COLORS.cream }}>
      <div className="max-w-6xl mx-auto px-6 md:px-12">
        <p className="mb-3" style={eyebrowStyle}>{s.gallery_eyebrow || SEED_SETTINGS.gallery_eyebrow}</p>
        <h2 className="mb-10 md:mb-14" style={h2Style}>
          A space for mornings, meetings, and slow evenings
        </h2>

        {/* Mobile: swipeable filmstrip */}
        <div className="flex md:hidden gap-4 overflow-x-auto snap-x snap-mandatory scroll-hide -mx-6 px-6 pb-2">
          {gallery.map((g, i) => (
            <PhotoPlaceholder
              key={i}
              label={g.label}
              src={g.image}
              icon={Camera}
              aspect="4/5"
              rounded="16px"
              className="flex-shrink-0 w-4/5 snap-start"
            />
          ))}
        </div>

        {/* Desktop bento grid */}
        <div className="hidden md:grid grid-cols-4 gap-4">
          {gallery.map((g, i) => (
            <div key={i} className={`group relative overflow-hidden rounded-2xl ${g.span} ${g.aspect}`}>
              <PhotoPlaceholder
                label={g.label}
                src={g.image}
                icon={Camera}
                rounded="0px"
                className="w-full h-full transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
              <span
                className="absolute bottom-4 left-4 text-white opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300"
                style={{ fontFamily: fontBody, fontWeight: 600, fontSize: 14 }}
              >
                {g.caption}
              </span>
            </div>
          ))}
        </div>

        <p
          className="text-center mt-10"
          style={{ fontFamily: fontDisplay, fontStyle: 'italic', color: COLORS.mocha, fontSize: 18 }}
        >
          {s.gallery_quote || SEED_SETTINGS.gallery_quote}
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Reviews
--------------------------------------------------------- */
const SEED_REVIEWS = [
  { name: 'Marta', role: 'Remote worker', quote: 'My unofficial office. Great wifi, better coffee, nobody rushes you.', rating: 5 },
  { name: 'Tomas & Eglė', role: 'Date night', quote: 'We came for coffee and stayed for the conversation. So cozy.', rating: 5 },
  { name: 'Weekend friends', role: 'Brunch regulars', quote: 'Pancakes are unreal and our table was ready right on time.', rating: 5 },
];

function ReviewCard({ r, i }) {
  const bgs = [COLORS.caramel, COLORS.beige, COLORS.gold];
  const stars = Math.max(1, Math.min(5, Number(r.rating) || 5));
  return (
    <div className="rounded-3xl p-8 shadow-lg" style={{ backgroundColor: COLORS.creamWhite }}>
      <div className="flex gap-1 mb-4">
        {Array.from({ length: stars }).map((_, idx) => (
          <Star key={idx} size={16} fill={COLORS.caramel} stroke={COLORS.caramel} />
        ))}
      </div>
      <p
        className="mb-6"
        style={{ fontFamily: fontDisplay, fontStyle: 'italic', fontSize: 18, color: COLORS.espresso, lineHeight: 1.5 }}
      >
        “{r.quote}”
      </p>
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-full"
          style={{ backgroundColor: bgs[i % bgs.length], fontFamily: fontDisplay, color: COLORS.espresso, fontWeight: 600 }}
        >
          {r.name.charAt(0)}
        </div>
        <div>
          <p style={{ fontFamily: fontBody, fontWeight: 600, fontSize: 14, color: COLORS.espresso }}>{r.name}</p>
          <p style={{ fontFamily: fontBody, fontSize: 12, color: COLORS.mocha }}>{r.role}</p>
        </div>
      </div>
    </div>
  );
}

function Reviews() {
  const [reviews] = useApi('/api/reviews', SEED_REVIEWS);
  const list = Array.isArray(reviews) && reviews.length ? reviews : SEED_REVIEWS;
  return (
    <section className="py-20 md:py-32" style={{ backgroundColor: COLORS.beige }}>
      <div className="max-w-6xl mx-auto px-6 md:px-12">
        <p className="mb-3" style={eyebrowStyle}>What Guests Say</p>
        <h2 className="mb-10 md:mb-14" style={h2Style}>Loved by regulars and first-time visitors</h2>

        <div className="flex md:grid md:grid-cols-3 gap-6 overflow-x-auto md:overflow-visible snap-x snap-mandatory scroll-hide -mx-6 px-6 md:mx-0 md:px-0 pb-2">
          {list.map((r, i) => (
            <div key={r.id || r.name} className="flex-shrink-0 w-4/5 md:w-full snap-start">
              <ReviewCard r={r} i={i} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Reservation CTA
--------------------------------------------------------- */
function ReservationCTA() {
  return (
    <section id="reserve" className="relative py-28 md:py-40 overflow-hidden">
      <PhotoPlaceholder
        label="Evening interior at BALTIC BREW"
        src={IMAGES.eveningTable}
        icon={Camera}
        rounded="0px"
        className="absolute inset-0 w-full h-full"
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(43,27,18,0) 0%, rgba(43,27,18,0.85) 100%)' }}
      />
      <div className="relative max-w-2xl mx-auto px-6 text-center">
        <h2
          className="mb-4"
          style={{ fontFamily: fontDisplay, fontWeight: 500, color: COLORS.cream, fontSize: 'clamp(1.875rem, 4vw, 2.5rem)' }}
        >
          Reserve your table today
        </h2>
        <p className="mb-8" style={{ fontFamily: fontBody, color: 'rgba(250,246,239,0.85)', fontSize: 17 }}>
          Whether it&apos;s breakfast, brunch, or an evening coffee — we&apos;ll save you a cozy spot.
        </p>
        <a
          href="#contact"
          className="group btn-primary inline-flex items-center justify-center gap-2 px-9 py-4 rounded-full w-full sm:w-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          style={{ fontFamily: fontBody, fontWeight: 600, fontSize: 16 }}
        >
          Book Now
          <SteamCurl
            size={14}
            color={COLORS.espresso}
            className="opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300"
          />
        </a>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Contact
--------------------------------------------------------- */
function Contact() {
  const s = useSettings();
  const address = s.address || SEED_SETTINGS.address;
  const hours = s.hours || SEED_SETTINGS.hours;
  const phone = s.phone || SEED_SETTINGS.phone;
  const email = s.email || SEED_SETTINGS.email;
  const items = [
    { icon: MapPin, text: address },
    { icon: Clock, text: hours },
    { icon: Phone, text: phone },
    { icon: Mail, text: email },
  ];

  // Reservation form state
  const emptyForm = { name: '', phone: '', date: '', time: '', guests: '2 guests' };
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState(null); // {kind:'success'|'error', text}
  const [sending, setSending] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const guestsNum = parseInt(String(form.guests).replace(/\D/g, ''), 10) || 2;
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      date: form.date,
      time: form.time,
      guests: guestsNum,
    };
    if (!payload.name || !payload.phone || !payload.date || !payload.time) {
      setStatus({ kind: 'error', text: 'Please fill in your name, phone, date and time.' });
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      await apiFetch('/api/reservations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setForm(emptyForm);
      setStatus({ kind: 'success', text: 'Thank you! Your reservation request has been sent — we will confirm shortly.' });
    } catch (err) {
      setStatus({ kind: 'error', text: err.message || 'Something went wrong. Please try again or call us.' });
    } finally {
      setSending(false);
    }
  };

  const mapQuery = encodeURIComponent(address);

  return (
    <section id="contact" className="py-20 md:py-32" style={{ backgroundColor: COLORS.cream }}>
      <div className="max-w-6xl mx-auto px-6 md:px-12 grid md:grid-cols-2 gap-12 items-start">
        <div>
          <p className="mb-3" style={eyebrowStyle}>Visit Us</p>
          <h2 className="mb-8" style={h2Style}>Find us in Užupis</h2>
          <div className="flex flex-col gap-5">
            {items.map((it, i) => (
              <div key={i} className="flex items-start gap-4">
                <it.icon size={20} style={{ color: COLORS.caramel, marginTop: 2 }} />
                <span style={{ fontFamily: fontBody, fontSize: 16, color: COLORS.mocha }}>{it.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <form
            className="rounded-3xl p-6 md:p-8 shadow-lg"
            style={{ backgroundColor: COLORS.creamWhite }}
            onSubmit={onSubmit}
          >
            <h3 className="mb-2" style={{ fontFamily: fontDisplay, fontSize: 26, color: COLORS.espresso }}>
              Book a table
            </h3>
            <p className="mb-6" style={{ fontFamily: fontBody, fontSize: 14, color: COLORS.mocha }}>
              Leave your details and we&apos;ll confirm your reservation shortly.
            </p>

            {status && (
              <div
                className="mb-5 rounded-2xl px-4 py-3 text-sm"
                style={{
                  fontFamily: fontBody,
                  backgroundColor: status.kind === 'success' ? '#EAF4E6' : '#FBEAEA',
                  color: status.kind === 'success' ? '#2E6B34' : '#8F1D1D',
                  border: `1px solid ${status.kind === 'success' ? '#BFDCC2' : '#EAC0C0'}`,
                }}
              >
                {status.text}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-2" style={{ fontFamily: fontBody, color: COLORS.espresso, fontWeight: 600, fontSize: 13 }}>
                Name
                <input
                  type="text"
                  placeholder="Your name"
                  value={form.name}
                  onChange={set('name')}
                  className="rounded-2xl px-4 py-3 border outline-none focus:ring-2"
                  style={{ borderColor: COLORS.beige, backgroundColor: COLORS.cream, color: COLORS.espresso, '--tw-ring-color': COLORS.caramel }}
                />
              </label>
              <label className="flex flex-col gap-2" style={{ fontFamily: fontBody, color: COLORS.espresso, fontWeight: 600, fontSize: 13 }}>
                Phone
                <input
                  type="tel"
                  placeholder="+370 600 12345"
                  value={form.phone}
                  onChange={set('phone')}
                  className="rounded-2xl px-4 py-3 border outline-none focus:ring-2"
                  style={{ borderColor: COLORS.beige, backgroundColor: COLORS.cream, color: COLORS.espresso, '--tw-ring-color': COLORS.caramel }}
                />
              </label>
              <label className="flex flex-col gap-2" style={{ fontFamily: fontBody, color: COLORS.espresso, fontWeight: 600, fontSize: 13 }}>
                Date
                <input
                  type="date"
                  value={form.date}
                  onChange={set('date')}
                  className="rounded-2xl px-4 py-3 border outline-none focus:ring-2"
                  style={{ borderColor: COLORS.beige, backgroundColor: COLORS.cream, color: COLORS.espresso, '--tw-ring-color': COLORS.caramel }}
                />
              </label>
              <label className="flex flex-col gap-2" style={{ fontFamily: fontBody, color: COLORS.espresso, fontWeight: 600, fontSize: 13 }}>
                Time
                <input
                  type="time"
                  value={form.time}
                  onChange={set('time')}
                  className="rounded-2xl px-4 py-3 border outline-none focus:ring-2"
                  style={{ borderColor: COLORS.beige, backgroundColor: COLORS.cream, color: COLORS.espresso, '--tw-ring-color': COLORS.caramel }}
                />
              </label>
              <label className="sm:col-span-2 flex flex-col gap-2" style={{ fontFamily: fontBody, color: COLORS.espresso, fontWeight: 600, fontSize: 13 }}>
                Guests
                <select
                  value={form.guests}
                  onChange={set('guests')}
                  className="rounded-2xl px-4 py-3 border outline-none focus:ring-2"
                  style={{ borderColor: COLORS.beige, backgroundColor: COLORS.cream, color: COLORS.espresso, '--tw-ring-color': COLORS.caramel }}
                >
                  <option>1 guest</option>
                  <option>2 guests</option>
                  <option>3 guests</option>
                  <option>4 guests</option>
                  <option>5+ guests</option>
                </select>
              </label>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="btn-primary mt-6 w-full rounded-full py-3.5 disabled:opacity-60"
              style={{ fontFamily: fontBody, fontWeight: 700 }}
            >
              {sending ? 'Sending…' : 'Send reservation request'}
            </button>
          </form>

          <div
            className="relative rounded-3xl overflow-hidden h-64 md:h-72"
            style={{ backgroundColor: COLORS.beige }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <MapPin size={36} style={{ color: COLORS.caramel }} />
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary absolute bottom-4 left-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm border-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              style={{ fontFamily: fontBody, fontWeight: 600, backgroundColor: COLORS.creamWhite, borderColor: COLORS.espresso, color: COLORS.espresso }}
            >
              Get Directions
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   Footer
--------------------------------------------------------- */
function Footer() {
  const s = useSettings();
  const links = ['Home', 'Menu', 'About', 'Gallery', 'Contact'];
  const brand = s.brand_name || SEED_SETTINGS.brand_name;
  const tagline = s.footer_tagline || s.tagline || SEED_SETTINGS.tagline;
  const year = s.footer_year || SEED_SETTINGS.footer_year;
  return (
    <footer className="pt-16 pb-8" style={{ backgroundColor: COLORS.graphite }}>
      <div className="max-w-6xl mx-auto px-6 md:px-12">
        <div className="flex flex-col md:flex-row md:justify-between gap-10 text-center md:text-left items-center md:items-start">
          <div className="flex flex-col items-center md:items-start gap-3">
            <span className="flex items-center gap-1" style={{ fontFamily: fontDisplay, fontStyle: 'italic', fontSize: 24, color: COLORS.cream }}>
              {brand} <SteamCurl size={14} color={COLORS.gold} />
            </span>
            <p style={{ fontFamily: fontBody, fontSize: 13, color: 'rgba(250,246,239,0.6)' }}>
              {tagline}
            </p>
          </div>

          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {links.map((l) => (
              <a
                key={l}
                href={`#${l.toLowerCase()}`}
                className="hover:text-white transition-colors duration-200"
                style={{ fontFamily: fontBody, fontSize: 14, color: 'rgba(250,246,239,0.8)' }}
              >
                {l}
              </a>
            ))}
          </nav>

          <div className="flex gap-3">
            <a href={socialUrl(s.instagram)} aria-label="Instagram" target="_blank" rel="noreferrer" className="social-icon w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5">
              <InstagramIcon size={18} />
            </a>
            <a href={socialUrl(s.facebook)} aria-label="Facebook" target="_blank" rel="noreferrer" className="social-icon w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5">
              <FacebookIcon size={18} />
            </a>
            <a href={socialUrl(s.tiktok)} aria-label="TikTok" target="_blank" rel="noreferrer" className="social-icon w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5">
              <TikTokIcon size={16} />
            </a>
          </div>
        </div>

        <div className="mt-12 pt-6 text-center" style={{ borderTop: '1px solid rgba(250,246,239,0.1)' }}>
          <p style={{ fontFamily: fontBody, fontSize: 12, color: 'rgba(250,246,239,0.5)' }}>
            © {year} {brand}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ---------------------------------------------------------
   Sticky mobile "Book a Table" bar
--------------------------------------------------------- */
function MobileStickyCTA({ visible }) {
  if (!visible) return null;
  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-4 py-3"
      style={{ backgroundColor: 'rgba(250,246,239,0.97)', boxShadow: '0 -4px 16px rgba(43,27,18,0.12)' }}
    >
      <a
        href="#contact"
        className="btn-primary w-full flex items-center justify-center py-3 rounded-full"
        style={{ fontFamily: fontBody, fontWeight: 600, fontSize: 15 }}
      >
        Book a Table
      </a>
    </div>
  );
}

/* ---------------------------------------------------------
   App
--------------------------------------------------------- */
export default function BalticBrew() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settings, setSettings] = useState(SEED_SETTINGS);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Load editable settings (brand / contact / socials) from the API.
  useEffect(() => {
    let alive = true;
    apiFetch('/api/settings')
      .then((d) => {
        if (alive && d && typeof d === 'object')
          setSettings({ ...SEED_SETTINGS, ...d });
      })
      .catch(() => {
        /* keep seed defaults */
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SettingsContext.Provider value={settings}>
    <div className="w-full min-h-screen pb-16 md:pb-0" style={{ backgroundColor: COLORS.cream }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=Manrope:wght@400;500;600;700&display=swap');

        html { scroll-behavior: smooth; scroll-padding-top: 96px; }

        .btn-primary { background-color: ${COLORS.caramel}; color: ${COLORS.espresso}; transition: background-color .25s ease, transform .25s ease; }
        .btn-primary:hover { background-color: #B5732A; }

        .btn-secondary { background-color: transparent; transition: background-color .25s ease; }
        .btn-secondary:hover { background-color: rgba(236,224,204,0.7); }

        .social-icon { background-color: rgba(250,246,239,0.08); color: ${COLORS.cream}; }
        .social-icon:hover { background-color: ${COLORS.gold}; color: ${COLORS.graphite}; }

        .scroll-hide::-webkit-scrollbar { display: none; }
        .scroll-hide { -ms-overflow-style: none; scrollbar-width: none; }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .animate-fade-up { animation: fadeUp 0.8s ease-out both; }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <Header scrolled={scrolled} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      <main>
        <Hero />
        <WaveDivider color={COLORS.caramel} opacity={0.25} />

        <Reveal><About /></Reveal>
        <Reveal><MenuSection /></Reveal>
        <Reveal><Gallery /></Reveal>
        <Reveal><Reviews /></Reveal>

        <WaveDivider color={COLORS.gold} opacity={0.3} />
        <ReservationCTA />

        <Reveal><Contact /></Reveal>
      </main>

      <Footer />

      <MobileStickyCTA visible={scrolled} />
        </div>
    </SettingsContext.Provider>
  );
}
