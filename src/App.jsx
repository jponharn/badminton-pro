// ============================================================
//  BADMINTON PRO — Multi-Tenant Badminton Tournament Manager
//  Stack: React + Firebase Firestore + Firebase Auth (Google)
//  Style: Tailwind CSS + Noto Sans Thai · Luxury Dark Sport
// ============================================================
import { useState, useEffect, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
    getFirestore, collection, doc, getDoc, setDoc,
    addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy, getDocs
} from "firebase/firestore";
import {
    getAuth, signInWithPopup, GoogleAuthProvider,
    onAuthStateChanged, signOut
} from "firebase/auth";

// ─── Firebase Config ──────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCfoYwC6jWGquo3EuYQf_r-PTmmWRHrS38",
    authDomain: "badminton-pro-b4a55.firebaseapp.com",
    projectId: "badminton-pro-b4a55",
    storageBucket: "badminton-pro-b4a55.firebasestorage.app",
    messagingSenderId: "567879594779",
    appId: "1:567879594779:web:8cd977b2b9c715f6fd99be",
    measurementId: "G-1SWTYMWF8G"
};

let app, db, auth;
let firebaseReady = false;
try {
    app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    db = getFirestore(app);
    auth = getAuth(app);
    if (FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY") firebaseReady = true;
} catch (e) { console.warn("Firebase init failed", e); }

// ─── Utilities ────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const getInitials = n => n.trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
const AVATAR_COLORS = ["#c9a84c", "#6c8ebf", "#5ba08a", "#c47a4a", "#8a6bbf", "#5a9e6f", "#bf6c6c", "#6c9ebf"];
const avatarColor = n => AVATAR_COLORS[n.charCodeAt(0) % AVATAR_COLORS.length];
const fmtDate = ts => ts ? new Date(typeof ts === "number" ? ts : ts.toDate?.() ?? ts)
    .toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }) : "";

function generateRoundRobin(teams) {
    if (teams.length < 2) return [];
    const list = [...teams];
    if (list.length % 2) list.push(null);
    const half = list.length / 2, rounds = [];
    for (let r = 0; r < list.length - 1; r++) {
        const round = [];
        for (let i = 0; i < half; i++) {
            const a = list[i], b = list[list.length - 1 - i];
            if (a && b) round.push([a, b]);
        }
        rounds.push(round);
        list.splice(1, 0, list.pop());
    }
    return rounds.flatMap(r => r);
}

// ─── DB helpers ───────────────────────────────────────────────────────────
const _doc = path => doc(db, ...path.split("/"));
const _col = path => collection(db, ...path.split("/"));

class MemStore {
    constructor() { this._data = {}; this._listeners = {}; }
    _set(p, v) { this._data[p] = v; (this._listeners[p] || []).forEach(cb => cb(v)); }
    async getDoc(p) { return { exists: () => !!this._data[p], data: () => this._data[p] }; }
    async setDoc(p, v) { this._set(p, v); }
    async updateDoc(p, v) { this._set(p, { ...(this._data[p] || {}), ...v }); }
    async addDoc(p, v) {
        const id = uid(), full = p + "/" + id, withId = { ...v, id };
        this._set(full, withId);
        this._set(p, { ...(this._data[p] || {}), [id]: withId });
        return { id };
    }
    async getDocs(p) { return Object.values(this._data[p] || {}).map(v => ({ id: v.id, data: () => v })); }
    onSnapshot(p, cb) {
        if (!this._listeners[p]) this._listeners[p] = [];
        this._listeners[p].push(d => cb({ docs: Object.values(d || {}).map(v => ({ id: v.id, data: () => v })) }));
        cb({ docs: Object.values(this._data[p] || {}).map(v => ({ id: v.id, data: () => v })) });
        return () => { };
    }
}
const mem = new MemStore();

async function dbGetDoc(path) { return firebaseReady ? getDoc(_doc(path)) : mem.getDoc(path); }
async function dbSetDoc(path, v) { return firebaseReady ? setDoc(_doc(path), v, { merge: true }) : mem.setDoc(path, v); }
async function dbUpdateDoc(p, v) { return firebaseReady ? updateDoc(_doc(p), v) : mem.updateDoc(p, v); }
async function dbAddDoc(p, v) { return firebaseReady ? addDoc(_col(p), { ...v, createdAt: serverTimestamp() }) : mem.addDoc(p, v); }
async function dbGetDocs(p) {
    if (!firebaseReady) return mem.getDocs(p);
    const snap = await getDocs(query(_col(p), orderBy("createdAt", "asc")));
    return snap.docs;
}
function dbOnSnapshot(p, cb) {
    if (!firebaseReady) return mem.onSnapshot(p, cb);
    return onSnapshot(_col(p), cb);
}
async function dbDeleteDoc(p) {
    if (!firebaseReady) { delete mem._data[p]; return; }
    return deleteDoc(_doc(p));
}

// ─── Design tokens ────────────────────────────────────────────────────────
// Used inline for complex dynamic styles
const C = {
    bg: "#06090f",
    surf: "#0c1119",
    surf2: "#111827",
    gold: "#c9a84c",
    goldDim: "#8a6e30",
    accent: "#4a9eff",
    accentDim: "#2563a8",
    green: "#3dba7e",
    red: "#e05555",
    indigo: "#7c6fcd",
    pink: "#c45fa0",
    border: "rgba(255,255,255,.08)",
    muted: "#4a5c73",
    dim: "#8899aa",
    text: "#dde3ed",
};

// ─── Avatar ───────────────────────────────────────────────────────────────
function Av({ athlete, size = "md" }) {
    if (!athlete) return null;
    const dim = {
        xs: "w-6 h-6 text-[8px]",
        sm: "w-8 h-8 text-[9px]",
        md: "w-10 h-10 text-[11px]",
        lg: "w-13 h-13 text-sm",
    }[size] || "w-10 h-10 text-[11px]";
    return athlete.img
        ? <img src={athlete.img} alt={athlete.name} className={`${dim} rounded-full object-cover flex-shrink-0 ring-1 ring-white/10`} />
        : <div className={`${dim} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ring-1 ring-white/10`}
            style={{ background: `linear-gradient(135deg,${avatarColor(athlete.name)}cc,${avatarColor(athlete.name)}66)` }}>
            {getInitials(athlete.name)}
        </div>;
}

// ─── Shuttle SVG (refined) ────────────────────────────────────────────────
const ShuttleIcon = ({ size = 24, glow = false }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        style={glow ? { filter: `drop-shadow(0 0 8px ${C.gold}80)` } : {}}>
        <ellipse cx="12" cy="18.5" rx="4.5" ry="2.5" stroke={C.gold} strokeWidth="1.4" />
        <path d="M7.5 18.5 L12 3.5 L16.5 18.5" stroke={C.gold} strokeWidth="1.4" />
        <path d="M9.5 14 L14.5 14" stroke={C.gold} strokeWidth="1.1" strokeLinecap="round" />
        <path d="M8.5 16.5 L15.5 16.5" stroke={C.gold} strokeWidth="1.1" strokeLinecap="round" />
        <circle cx="12" cy="3.5" r="1" fill={C.gold} />
    </svg>
);

// ─── UI Primitives ────────────────────────────────────────────────────────

const Badge = ({ children, variant = "default" }) => {
    const variants = {
        default: "bg-white/5 text-slate-400 border border-white/8",
        gold: "text-amber-300 border border-amber-400/30",
        green: "text-emerald-400 border border-emerald-400/30",
        red: "text-red-400 border border-red-400/25",
        blue: "text-blue-400 border border-blue-400/25",
        indigo: "text-indigo-400 border border-indigo-400/25",
        pink: "text-pink-400 border border-pink-400/25",
    };
    const bg = { gold: "bg-amber-400/8", green: "bg-emerald-400/8", red: "bg-red-400/8", blue: "bg-blue-400/8", indigo: "bg-indigo-400/8", pink: "bg-pink-400/8" };
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${variants[variant]} ${bg[variant] || ""}`}>
            {children}
        </span>
    );
};

const Input = ({ className = "", ...props }) => (
    <input
        className={`w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-200 outline-none transition-all
      placeholder:text-slate-600 ${className}`}
        style={{
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.08)",
        }}
        onFocus={e => { e.target.style.border = `1px solid ${C.gold}66`; e.target.style.background = "rgba(255,255,255,.06)" }}
        onBlur={e => { e.target.style.border = "1px solid rgba(255,255,255,.08)"; e.target.style.background = "rgba(255,255,255,.04)" }}
        {...props}
    />
);

const Label = ({ children }) => (
    <p className="text-[10px] font-bold uppercase tracking-[1.2px] mb-2" style={{ color: C.muted }}>{children}</p>
);

// Buttons
const Btn = ({ children, variant = "primary", size = "md", className = "", ...p }) => {
    const base = "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 active:scale-[.97] disabled:opacity-35 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer";
    const sizes = { sm: "text-xs px-3 py-1.5 rounded-lg", md: "text-sm px-4 py-2.5 rounded-xl", lg: "text-sm px-6 py-3 rounded-xl" };
    const vars = {
        primary: `text-[#06090f] font-bold`,
        ghost: `border text-slate-400 hover:text-slate-200`,
        danger: `border text-red-400 hover:text-red-300`,
        success: `border text-emerald-400 hover:text-emerald-300`,
        gold: `border text-amber-300 hover:text-amber-200`,
    };
    const styles = {
        primary: { background: `linear-gradient(135deg,${C.gold},${C.goldDim})`, boxShadow: `0 4px 20px ${C.gold}30` },
        ghost: { background: "rgba(255,255,255,.04)", borderColor: "rgba(255,255,255,.1)" },
        danger: { background: "rgba(224,85,85,.06)", borderColor: "rgba(224,85,85,.2)" },
        success: { background: "rgba(61,186,126,.06)", borderColor: "rgba(61,186,126,.2)" },
        gold: { background: "rgba(201,168,76,.06)", borderColor: "rgba(201,168,76,.25)" },
    };
    return (
        <button className={`${base} ${sizes[size]} ${vars[variant]} ${className}`} style={styles[variant]} {...p}>
            {children}
        </button>
    );
};

// Cards
const Card = ({ children, className = "", glow = false }) => (
    <div className={`rounded-2xl p-5 glass ${className}`}
        style={glow ? { boxShadow: `0 0 40px ${C.gold}12`, borderColor: `${C.gold}22` } : {}}>
        {children}
    </div>
);
const CardSm = ({ children, className = "" }) => (
    <div className={`rounded-xl p-3.5 glass ${className}`}>{children}</div>
);
const CardXs = ({ children, className = "" }) => (
    <div className={`rounded-lg p-2.5 ${className}`} style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
        {children}
    </div>
);

// Divider
const Divider = () => <div className="w-full h-px my-5" style={{ background: "rgba(255,255,255,.06)" }} />;

// Section heading with gold left-border accent
const PageTitle = ({ children, sub }) => (
    <div className="mb-6">
        <div className="flex items-center gap-3">
            <div className="w-0.5 h-6 rounded-full" style={{ background: `linear-gradient(to bottom,${C.gold},transparent)` }} />
            <h1 className="text-lg font-bold text-slate-100 tracking-wide">{children}</h1>
        </div>
        {sub && <p className="text-xs mt-1.5 ml-3.5" style={{ color: C.muted }}>{sub}</p>}
    </div>
);

// Radio pills
function RadioGroup({ name, options, value, onChange }) {
    return (
        <div className="flex gap-2 flex-wrap">
            {options.map(o => (
                <label key={o.v} className="flex-1 min-w-[90px]">
                    <input type="radio" name={name} value={o.v} checked={value === o.v} onChange={() => onChange(o.v)} className="sr-only" />
                    <div className={`text-center py-2 px-3 rounded-xl text-sm font-medium cursor-pointer transition-all`}
                        style={value === o.v
                            ? { background: `${C.gold}15`, border: `1px solid ${C.gold}55`, color: C.gold }
                            : { background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", color: C.dim }}>
                        {o.l}
                    </div>
                </label>
            ))}
        </div>
    );
}

// Segment control (tabs)
function SegmentControl({ tabs, active, onChange }) {
    return (
        <div className="flex p-1 rounded-xl mb-5" style={{ background: "rgba(0,0,0,.3)" }}>
            {tabs.map(t => (
                <button key={t.k} onClick={() => onChange(t.k)}
                    className="flex-1 py-2 text-xs font-semibold rounded-lg transition-all"
                    style={active === t.k
                        ? { background: "rgba(255,255,255,.08)", color: C.text, boxShadow: "0 1px 8px rgba(0,0,0,.4)" }
                        : { color: C.muted }}>
                    {t.l}
                </button>
            ))}
        </div>
    );
}

// Live indicator
const LivePill = () => (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider"
        style={{ background: `${C.green}15`, border: `1px solid ${C.green}35`, color: C.green }}>
        <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: C.green }} />
        LIVE
    </span>
);

// Copy field
function CopyField({ value }) {
    const [ok, setOk] = useState(false);
    const copy = () => { navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 2000); };
    return (
        <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5" style={{ background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.07)" }}>
            <span className="flex-1 text-xs font-mono truncate" style={{ color: C.dim }}>{value}</span>
            <button onClick={copy} className="text-xs font-semibold transition-colors flex-shrink-0 px-2 py-0.5 rounded-md"
                style={ok ? { color: C.green, background: `${C.green}15` } : { color: C.muted, background: "rgba(255,255,255,.04)" }}>
                {ok ? "✓" : "copy"}
            </button>
        </div>
    );
}

// ─── Root App ─────────────────────────────────────────────────────────────
export default function App() {
    const tenantSlug = window.location.pathname.replace(/^\//, "").split("/")[0].toLowerCase().trim();
    const [user, setUser] = useState(null);
    const [authReady, setAuthReady] = useState(!firebaseReady);
    const [tenant, setTenant] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [page, setPage] = useState("home");

    useEffect(() => {
        if (!firebaseReady) { setAuthReady(true); return; }
        return onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); });
    }, []);

    useEffect(() => {
        if (!tenantSlug) return;
        dbGetDoc(`tenants/${tenantSlug}`).then(snap => {
            if (snap.exists()) setTenant({ id: tenantSlug, ...snap.data() });
        });
    }, [tenantSlug, user]);

    useEffect(() => {
        if (!tenant || !user) { setIsAdmin(false); return; }
        setIsAdmin((tenant.adminUids || []).includes(user.uid));
    }, [tenant, user]);

    if (!authReady) return <LoadingScreen />;
    if (!tenantSlug) return <LandingPage user={user} setUser={setUser} />;
    if (tenant) return (
        <div className="min-h-screen flex flex-col" style={{ background: C.bg }}>
            <TenantNav tenant={tenant} isAdmin={isAdmin} user={user} setUser={setUser} page={page} setPage={setPage} />
            <div className="flex-1 flex flex-col relative z-10">
                {page === "home" && <TenantHome tenant={tenant} isAdmin={isAdmin} />}
                {page === "admin" && isAdmin && <AdminPanel tenant={tenant} user={user} />}
                {page === "history" && <HistoryPage tenantId={tenant.id} />}
            </div>
        </div>
    );
    return (
        <div className="min-h-screen" style={{ background: C.bg }}>
            <TenantNotFound slug={tenantSlug} user={user} setUser={setUser} setTenant={setTenant} />
        </div>
    );
}

// ─── Loading Screen ───────────────────────────────────────────────────────
function LoadingScreen() {
    return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
            <div className="text-center fadeslide">
                <ShuttleIcon size={44} glow />
                <p className="mt-5 text-xs font-bold tracking-[4px]" style={{ color: C.gold }}>กำลังโหลด…</p>
            </div>
        </div>
    );
}

// ─── Landing Page ─────────────────────────────────────────────────────────
function LandingPage({ user, setUser }) {
    const [slug, setSlug] = useState("");
    const [name, setName] = useState("");
    const [logo, setLogo] = useState(null);
    const [creating, setCreating] = useState(false);
    const [err, setErr] = useState("");

    const googleLogin = async () => {
        if (!firebaseReady) { alert("กรุณาตั้งค่า Firebase ก่อนใช้งาน"); return; }
        try { const r = await signInWithPopup(auth, new GoogleAuthProvider()); setUser(r.user); }
        catch (e) { alert("Login ไม่สำเร็จ: " + e.message); }
    };

    const handleLogo = e => {
        const file = e.target.files[0]; if (!file) return;
        const r = new FileReader(); r.onload = ev => setLogo(ev.target.result); r.readAsDataURL(file);
    };

    const createTenant = async () => {
        const s = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
        if (!s) { setErr("กรุณาใส่ชื่อก๊วน (a-z, 0-9, -)"); return; }
        if (!name.trim()) { setErr("กรุณาใส่ชื่อแสดงผล"); return; }
        setCreating(true); setErr("");
        const snap = await dbGetDoc(`tenants/${s}`);
        if (snap.exists()) { setErr("ชื่อก๊วนนี้ถูกใช้แล้ว"); setCreating(false); return; }
        await dbSetDoc(`tenants/${s}`, { name: name.trim(), slug: s, logo: logo || null, adminUids: user ? [user.uid] : [], createdAt: Date.now() });
        window.location.href = `/${s}`;
    };

    return (
        <div className="min-h-screen relative flex flex-col items-center justify-center p-6 overflow-hidden" style={{ background: C.bg }}>
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none" style={{
                background: `radial-gradient(ellipse 70% 50% at 50% -5%,${C.gold}12,transparent 60%),
                    radial-gradient(ellipse 40% 40% at 80% 80%,${C.accent}08,transparent)`
            }} />

            {!firebaseReady && (
                <div className="relative z-10 w-full max-w-sm mb-8 fadeslide" style={{
                    background: `${C.gold}08`, border: `1px solid ${C.gold}25`, borderRadius: 12, padding: "10px 14px"
                }}>
                    <p className="text-xs text-center" style={{ color: `${C.gold}cc` }}>⚠️ Demo Mode — ข้อมูลจะหายเมื่อ reload</p>
                </div>
            )}

            {/* Logo */}
            <div className="relative z-10 flex flex-col items-center mb-10 fadeslide">
                <ShuttleIcon size={56} glow />
                <h1 className="mt-4 text-4xl lg:text-5xl font-extrabold tracking-[5px]"
                    style={{ color: C.gold, textShadow: `0 0 60px ${C.gold}50,0 0 20px ${C.gold}30` }}>
                    BADMINTON
                </h1>
                <h2 className="text-lg font-light tracking-[8px]" style={{ color: `${C.gold}70`, letterSpacing: "8px" }}>PRO</h2>
                <p className="mt-2 text-[10px] tracking-[3px] font-medium" style={{ color: C.muted }}>TOURNAMENT MANAGER</p>
            </div>

            {/* Forms */}
            <div className="relative z-10 w-full max-w-md fadeslide">
                {!user ? (
                    <div className="flex flex-col gap-3">
                        {/* <Btn variant="gold" size="lg" className="w-full" onClick={googleLogin}>
                            🔐 Sign in with Google เพื่อสร้างก๊วน
                        </Btn> */}
                        <div className="flex items-center gap-3 my-1">
                            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,.06)" }} />
                            <span className="text-xs" style={{ color: C.muted }}>เข้าก๊วนที่มีอยู่แล้ว</span>
                            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,.06)" }} />
                        </div>
                        <div className="flex gap-2">
                            <Input placeholder="ชื่อก๊วน (slug)" value={slug} onChange={e => setSlug(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && window.location.assign(`/${slug.trim()}`)} />
                            <Btn variant="primary" onClick={() => window.location.assign(`/${slug.trim()}`)}>เข้า</Btn>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <p className="text-center text-sm" style={{ color: C.dim }}>
                            สวัสดี <strong style={{ color: C.text }}>{user.displayName}</strong> 👋
                        </p>
                        <Card glow className="flex flex-col gap-4">
                            <p className="text-sm font-bold" style={{ color: C.gold }}>สร้างก๊วนใหม่</p>
                            <div>
                                <Label>ชื่อก๊วน (slug)</Label>
                                <Input placeholder="เช่น my-badminton-club" value={slug}
                                    onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
                                <p className="text-[10px] mt-1.5" style={{ color: C.muted }}>{window.location.origin}/{slug || "ชื่อก๊วน"}</p>
                            </div>
                            <div>
                                <Label>ชื่อแสดงผล</Label>
                                <Input placeholder="เช่น ก๊วนแบดมินตันสุขสันต์" value={name} onChange={e => setName(e.target.value)} />
                            </div>
                            <div>
                                <Label>Logo ก๊วน (ไม่บังคับ)</Label>
                                <div className="flex items-center gap-3">
                                    {logo && <img src={logo} alt="logo" className="w-12 h-12 rounded-xl object-cover flex-shrink-0 ring-1 ring-white/15" />}
                                    <label className="flex-1 cursor-pointer">
                                        <div className="rounded-xl px-3 py-2.5 text-xs text-center transition-all"
                                            style={{ background: "rgba(255,255,255,.04)", border: "1px dashed rgba(255,255,255,.12)", color: C.muted }}>
                                            {logo ? "เปลี่ยนรูป Logo" : "📷 อัพโหลด Logo"}
                                        </div>
                                        <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                                    </label>
                                </div>
                            </div>
                            {err && <p className="text-xs px-3 py-2 rounded-lg" style={{ color: "#e0a040", background: `${C.gold}08`, border: `1px solid ${C.gold}20` }}>{err}</p>}
                            <Btn variant="primary" size="lg" className="w-full" onClick={createTenant} disabled={creating}>
                                {creating ? "กำลังสร้าง…" : "สร้างก๊วน 🏸"}
                            </Btn>
                        </Card>
                        <div>
                            <Label>เข้าก๊วนที่มีอยู่</Label>
                            <div className="flex gap-2">
                                <Input placeholder="ชื่อก๊วน (slug)" value={slug} onChange={e => setSlug(e.target.value)} />
                                <Btn variant="ghost" onClick={() => window.location.assign(`/${slug.trim()}`)}>เข้า</Btn>
                            </div>
                        </div>
                        <button onClick={() => { signOut(auth); setUser(null); }}
                            className="text-xs self-start transition-colors" style={{ color: C.muted }}>ออกจากระบบ</button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Tenant Not Found ─────────────────────────────────────────────────────
function TenantNotFound({ slug, user, setUser }) {
    const login = async () => {
        if (!firebaseReady) return;
        const r = await signInWithPopup(auth, new GoogleAuthProvider()); setUser(r.user);
    };
    const create = async () => {
        if (!user) { await login(); return; }
        await dbSetDoc(`tenants/${slug}`, { name: slug, slug, adminUids: [user.uid], createdAt: Date.now() });
        window.location.reload();
    };
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative">
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 60% 40% at 50% 20%,${C.red}08,transparent)` }} />
            <ShuttleIcon size={40} />
            <p className="mt-6 text-2xl font-bold" style={{ color: C.red }}>ไม่พบก๊วน</p>
            <p className="mt-2 text-sm mb-7" style={{ color: C.muted }}>
                ไม่พบก๊วน "<span style={{ color: C.text }}>{slug}</span>"
            </p>
            {user && <Btn variant="primary" onClick={create}>สร้างก๊วนนี้</Btn>}
            {!user && <Btn variant="gold" onClick={login}>Login เพื่อสร้างก๊วนนี้</Btn>}
            <a href="/" className="mt-4 text-xs transition-colors hover:underline" style={{ color: C.muted }}>← กลับหน้าหลัก</a>
        </div>
    );
}

// ─── Tenant Nav ───────────────────────────────────────────────────────────
function TenantNav({ tenant, isAdmin, user, setUser, page, setPage }) {
    const link = `${window.location.origin}/${tenant.id}`;
    const [ok, setOk] = useState(false);
    const copy = () => { navigator.clipboard.writeText(link); setOk(true); setTimeout(() => setOk(false), 2000); };
    const login = async () => {
        if (!firebaseReady) { alert("Demo Mode"); return; }
        const r = await signInWithPopup(auth, new GoogleAuthProvider()); setUser(r.user);
    };

    return (
        <header className="sticky top-0 z-50"
            style={{ background: "rgba(6,9,15,.85)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            <div className="w-full px-4 lg:px-6 h-14 flex items-center gap-3">
                {/* Badminton-Pro brand */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <ShuttleIcon size={18} />
                    <span className="font-extrabold text-xs tracking-[3px] uppercase hidden sm:block" style={{ color: C.gold }}>
                        Badminton-Pro
                    </span>
                </div>

                {/* Separator */}
                <div className="w-px h-4 flex-shrink-0" style={{ background: "rgba(255,255,255,.12)" }} />

                {/* Nav */}
                <nav className="flex gap-0.5">
                    {[
                        { k: "home", icon: "🏸", l: "แข่งขัน" },
                        { k: "history", icon: "📋", l: "ประวัติ" },
                        ...(isAdmin ? [{ k: "admin", icon: "⚙️", l: "Admin" }] : []),
                    ].map(t => (
                        <button key={t.k} onClick={() => setPage(t.k)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
                            style={page === t.k
                                ? t.k === "admin"
                                    ? { background: `${C.gold}12`, color: C.gold, border: `1px solid ${C.gold}30` }
                                    : { background: `${C.accent}10`, color: C.accent, border: `1px solid ${C.accent}25` }
                                : { color: C.muted, border: "1px solid transparent" }}>
                            <span>{t.icon}</span>
                            <span className="hidden sm:inline">{t.l}</span>
                        </button>
                    ))}
                </nav>

                <div className="flex-1" />

                {/* Share */}
                <button onClick={copy} className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={ok
                        ? { color: C.green, background: `${C.green}10`, border: `1px solid ${C.green}25` }
                        : { color: C.muted, background: "transparent", border: "1px solid rgba(255,255,255,.06)" }}>
                    {ok ? "✓" : "🔗"} {ok ? "copied!" : "share"}
                </button>

                {/* Auth */}
                {!user && (
                    <button onClick={login} title="Admin Login"
                        className="p-2 rounded-lg transition-all text-base"
                        style={{ color: C.muted, border: "1px solid rgba(255,255,255,.06)" }}>🔐</button>
                )}
                {user && isAdmin && (
                    <div className="flex items-center gap-2">
                        <span className="hidden sm:inline text-[11px] font-bold px-2.5 py-1 rounded-full"
                            style={{ color: C.gold, background: `${C.gold}10`, border: `1px solid ${C.gold}25` }}>
                            ⭐ Admin
                        </span>
                        <button onClick={() => signOut(auth).then(() => setUser(null))}
                            className="text-xs px-2.5 py-1.5 rounded-lg transition-all"
                            style={{ color: C.muted, border: "1px solid rgba(255,255,255,.06)" }}>
                            ออก
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}

// ─── Tenant Home ──────────────────────────────────────────────────────────
function TenantHome({ tenant, isAdmin }) {
    const [tournaments, setTournaments] = useState([]);
    useEffect(() => {
        const unsub = dbOnSnapshot(`tenants/${tenant.id}/tournaments`, snap => {
            setTournaments((snap.docs || []).map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
        });
        return () => unsub && unsub();
    }, [tenant.id]);
    const active = tournaments.find(t => t.status === "active");

    return (
        <div className="flex-1 w-full">
            {/* Hero */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse 80% 100% at 50% -20%,${C.gold}0e,transparent 70%)` }} />
                <div className="relative px-6 lg:px-12 py-12 lg:py-16 max-w-screen-2xl mx-auto">
                    <div className="flex items-end justify-between gap-6 flex-wrap">
                        <div>
                            {/* Badminton-Pro brand with logo */}
                            <div className="flex items-center gap-2.5 mb-3">
                                {tenant.logo
                                    ? <img src={tenant.logo} alt="logo" className="w-12 h-12 flex-shrink-0" />
                                    : <ShuttleIcon size={32} glow />
                                }
                                <h1 className="text-3xl lg:text-5xl font-extrabold tracking-wide leading-tight" style={{ color: C.text }}>
                                    {tenant.name}
                                </h1>
                            </div>

                        </div>
                        {active && <LivePill />}
                    </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${C.gold}25,transparent)` }} />
            </div>

            <div className="px-6 lg:px-12 pb-14 max-w-screen-2xl mx-auto mt-8">
                {!active ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center fadeslide">
                        <ShuttleIcon size={56} />
                        <p className="mt-5 text-base font-medium" style={{ color: C.muted }}>ยังไม่มีการแข่งขันที่กำลังดำเนินอยู่</p>
                        {isAdmin && <p className="text-xs mt-1.5" style={{ color: `${C.muted}88` }}>ไปที่ ⚙️ Admin เพื่อสร้างการแข่งขัน</p>}
                    </div>
                ) : (
                    <ActiveTournament tenantId={tenant.id} tournament={active} />
                )}
            </div>
        </div>
    );
}

// ─── Active Tournament ────────────────────────────────────────────────────
function ActiveTournament({ tenantId, tournament }) {
    const [matches, setMatches] = useState([]);
    const [athleteMap, setAthleteMap] = useState({});  // id → athlete (with img)
    const [tab, setTab] = useState("matches");
    const [activeGroup, setActiveGroup] = useState(0);
    const config = tournament.config || {};

    // Load athlete photos once
    useEffect(() => {
        dbGetDocs(`tenants/${tenantId}/athletes`).then(docs => {
            const map = {};
            docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() }; });
            setAthleteMap(map);
        });
    }, [tenantId]);

    useEffect(() => {
        const unsub = dbOnSnapshot(`tenants/${tenantId}/tournaments/${tournament.id}/matches`, snap => {
            setMatches((snap.docs || []).map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.order - b.order));
        });
        return () => unsub && unsub();
    }, [tenantId, tournament.id]);

    // Merge live athlete data (with img) into team players
    const mergeImg = (team) => {
        if (!team) return team;
        return { ...team, players: (team.players || []).map(p => ({ ...p, ...(athleteMap[p.id] || {}) })) };
    };

    const updateScore = async (matchId, setIdx, side, val) => {
        const m = matches.find(x => x.id === matchId); if (!m) return;
        const newSets = m.sets.map((s, i) => i === setIdx ? { ...s, [side]: val } : s);

        // Best-of-N: count set wins; if either side reaches ceil(N/2) wins → done
        const totalSets = config.sets || 1;
        const needed = Math.ceil(totalSets / 2);
        let aw = 0, bw = 0;
        newSets.forEach(s => {
            const sa = parseInt(s.a) || 0, sb = parseInt(s.b) || 0;
            if (s.a !== "" && s.a !== null && s.b !== "" && s.b !== null) {
                if (sa > sb) aw++; else if (sb > sa) bw++;
            }
        });
        const done = aw >= needed || bw >= needed;
        await dbUpdateDoc(`tenants/${tenantId}/tournaments/${tournament.id}/matches/${matchId}`, { sets: newSets, done });
    };

    const teamName = t => t?.players?.map(p => p.name.split(" ")[0]).join(" / ") || "-";
    const allDone = matches.length > 0 && matches.every(m => m.done);

    // Enrich match with merged athlete photos
    const enrichMatch = m => ({
        ...m,
        teamA: mergeImg(m.teamA),
        teamB: mergeImg(m.teamB),
    });

    const leaderboard = (g) => {
        const teams = (tournament.groupTeams?.[g] || []).map(t => mergeImg(t));
        const gm = matches.filter(m => m.group === g && m.done);
        return teams.map(team => {
            const mp = gm.filter(m => m.teamA?.id === team.id || m.teamB?.id === team.id);
            let wins = 0, pFor = 0, pAg = 0;
            mp.forEach(m => {
                const isA = m.teamA?.id === team.id; let aw = 0, bw = 0;
                (m.sets || []).forEach(s => {
                    const sa = parseInt(s.a) || 0, sb = parseInt(s.b) || 0;
                    if (isA) { pFor += sa; pAg += sb; if (sa > sb) aw++; else bw++; }
                    else { pFor += sb; pAg += sa; if (sb > sa) aw++; else bw++; }
                });
                if (aw > bw) wins++;
            });
            return { team, played: mp.length, wins, pFor, pAg, diff: pFor - pAg };
        }).sort((a, b) => b.wins - a.wins || b.diff - a.diff);
    };

    const gColors = [{ text: C.indigo, bg: `${C.indigo}12`, border: `${C.indigo}30` }, { text: C.pink, bg: `${C.pink}12`, border: `${C.pink}30` }];

    return (
        <div className="fadeslide">
            {/* Tournament header */}
            <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
                <div>
                    <h2 className="text-xl font-bold" style={{ color: C.text }}>{tournament.name}</h2>
                    <p className="text-sm mt-1" style={{ color: C.muted }}>
                        {config.type === "singles" ? "ประเภทเดี่ยว" : "ประเภทคู่"} · {config.groups} กลุ่ม · {config.sets} เซต/แมตช์
                    </p>
                </div>
                {allDone && <Badge variant="gold">🏆 จบการแข่งขัน</Badge>}
            </div>

            {/* Group selector */}
            {config.groups > 1 && (
                <div className="flex gap-2 mb-5">
                    {Array.from({ length: config.groups }).map((_, g) => (
                        <button key={g} onClick={() => setActiveGroup(g)}
                            className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                            style={activeGroup === g
                                ? { background: gColors[g].bg, border: `1px solid ${gColors[g].border}`, color: gColors[g].text }
                                : { background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", color: C.muted }}>
                            กลุ่ม {g === 0 ? "A" : "B"}
                        </button>
                    ))}
                </div>
            )}

            {/* Desktop: 2 columns */}
            <div className="hidden lg:grid lg:grid-cols-2 lg:gap-12">
                <div>
                    <p className="text-xs font-bold tracking-[2px] mb-5 uppercase" style={{ color: C.muted }}>โปรแกรมการแข่งขัน</p>
                    <MatchList matches={matches.filter(m => m.group === activeGroup).map(enrichMatch)} config={config} onUpdate={updateScore} teamName={teamName} />
                </div>
                <div>
                    <p className="text-xs font-bold tracking-[2px] mb-5 uppercase" style={{ color: C.muted }}>ตารางคะแนน</p>
                    <Leaderboard rows={leaderboard(activeGroup)} teamName={teamName} />
                </div>
            </div>

            {/* Mobile: tabs */}
            <div className="lg:hidden">
                <SegmentControl tabs={[{ k: "matches", l: "โปรแกรมแข่งขัน" }, { k: "lb", l: "ตารางคะแนน" }]} active={tab} onChange={setTab} />
                {tab === "matches" && <MatchList matches={matches.filter(m => m.group === activeGroup).map(enrichMatch)} config={config} onUpdate={updateScore} teamName={teamName} />}
                {tab === "lb" && <Leaderboard rows={leaderboard(activeGroup)} teamName={teamName} />}
            </div>
        </div>
    );
}

function MatchList({ matches, config, onUpdate, teamName }) {
    if (!matches.length) return <p className="text-sm py-16 text-center" style={{ color: C.muted }}>ไม่มีโปรแกรมการแข่งขัน</p>;
    return <div className="flex flex-col gap-4">{matches.map((m, i) => <MatchCard key={m.id} match={m} idx={i} config={config} onUpdate={onUpdate} teamName={teamName} />)}</div>;
}

// ─── Match Card ───────────────────────────────────────────────────────────
// ─── Set Row — one row per set, spans all 3 grid columns ─────────────────
function SetRow({ matchId, si, totalSets, initialA, initialB, active, done, winnerSide, onBlur }) {
    const [valA, setValA] = useState(initialA ?? "");
    const [valB, setValB] = useState(initialB ?? "");

    const focusedRef = useRef(false);
    useEffect(() => {
        if (!focusedRef.current) {
            setValA(initialA ?? "");
            setValB(initialB ?? "");
        }
    }, [initialA, initialB]);

    const hasBoth = valA !== "" && valB !== "";
    const isWinA = hasBoth && parseInt(valA || 0) > parseInt(valB || 0);
    const isWinB = hasBoth && parseInt(valB || 0) > parseInt(valA || 0);

    const inputSt = (side, val) => {
        const winning = (side === "a" && isWinA) || (side === "b" && isWinB);
        return {
            width: "48px", height: "48px",
            background: !active ? "rgba(0,0,0,.12)" : winning && done ? `${C.gold}14` : "rgba(0,0,0,.4)",
            border: `1px solid ${!active ? "rgba(255,255,255,.04)" : winning && done ? C.gold + "66" : val !== "" ? C.gold + "33" : "rgba(255,255,255,.1)"}`,
            color: !active ? "rgba(255,255,255,.12)" : winning && done ? C.gold : C.text,
            fontVariantNumeric: "tabular-nums", fontSize: "20px", fontWeight: 700,
            textAlign: "center", outline: "none", borderRadius: "10px",
            opacity: !active ? 0.3 : 1, cursor: !active ? "not-allowed" : "text", transition: "all .15s",
        };
    };

    const handleChange = (side, raw) => {
        const clean = raw.replace(/[^0-9]/g, "").slice(0, 2);
        if (side === "a") setValA(clean); else setValB(clean);
    };
    const handleFocus = e => {
        focusedRef.current = true;
        if (active) { e.target.style.border = `1px solid ${C.gold}99`; e.target.style.boxShadow = `0 0 12px ${C.gold}25`; }
    };
    const handleBlurInput = (e, side) => {
        focusedRef.current = false;
        e.target.style.boxShadow = "none";
        onBlur(matchId, si, side, side === "a" ? valA : valB);
    };

    return (
        <>
            {/* Score A — left column, right-aligned */}
            <div className="flex justify-end pt-2">
                <input type="text" inputMode="numeric" pattern="[0-9]*"
                    disabled={!active} className="score-input"
                    style={inputSt("a", valA)}
                    value={valA}
                    onChange={e => active && handleChange("a", e.target.value)}
                    onFocus={handleFocus}
                    onBlur={e => handleBlurInput(e, "a")}
                />
            </div>

            {/* Set label — center column */}
            <div className="flex flex-col items-center gap-0.5 pt-2">
                {totalSets > 1 && (
                    <span className="text-[9px] font-bold tracking-wider whitespace-nowrap"
                        style={{ color: active ? C.gold + "99" : "rgba(255,255,255,.15)" }}>
                        Set {si + 1}
                    </span>
                )}
                <span style={{ color: "rgba(255,255,255,.12)", fontSize: "16px", fontWeight: 300, lineHeight: 1 }}>—</span>
            </div>

            {/* Score B — right column, left-aligned */}
            <div className="flex justify-start pt-2">
                <input type="text" inputMode="numeric" pattern="[0-9]*"
                    disabled={!active} className="score-input"
                    style={inputSt("b", valB)}
                    value={valB}
                    onChange={e => active && handleChange("b", e.target.value)}
                    onFocus={handleFocus}
                    onBlur={e => handleBlurInput(e, "b")}
                />
            </div>
        </>
    );
}

function MatchCard({ match, idx, config, onUpdate }) {
    const totalSets = config.sets || 1;
    const needed = Math.ceil(totalSets / 2);

    const sets = match.sets || [];
    let aw = 0, bw = 0;
    sets.forEach(s => {
        const sa = parseInt(s.a) || 0, sb = parseInt(s.b) || 0;
        if (s.a !== "" && s.a !== null && s.b !== "" && s.b !== null) { if (sa > sb) aw++; else if (sb > sa) bw++; }
    });
    const done = match.done;
    const winnerSide = done ? (aw >= bw ? "a" : "b") : null;

    const setActive = si => {
        if (totalSets === 1) return true;
        let aW = 0, bW = 0;
        for (let i = 0; i < si; i++) {
            const s = sets[i];
            const sa = parseInt(s.a) || 0, sb = parseInt(s.b) || 0;
            if (s.a !== "" && s.a !== null && s.b !== "" && s.b !== null) { if (sa > sb) aW++; else if (sb > sa) bW++; }
        }
        return aW < needed && bW < needed;
    };

    const borderStyle = done
        ? { border: `1px solid ${C.green}22`, background: `${C.green}04` }
        : { border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.025)" };

    return (
        <div className="rounded-2xl p-4 lg:p-5 transition-all" style={borderStyle}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold tracking-[2px] uppercase" style={{ color: C.muted }}>แมตช์ {idx + 1}</span>
                {done && <Badge variant="green">✓ จบแล้ว</Badge>}
            </div>

            {/* Layout: grid with team-A col | sets col | team-B col */}
            <div className="grid items-center gap-x-3 gap-y-0"
                style={{ gridTemplateColumns: "1fr auto 1fr" }}>

                {/* Team A header */}
                <TeamDisp team={match.teamA} winner={winnerSide === "a"} align="left" />
                {/* Center spacer for header row */}
                <div className="flex flex-col gap-1 items-center">
                    {totalSets > 1
                        ? <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: "rgba(255,255,255,.1)" }}>VS</span>
                        : <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: "rgba(255,255,255,.1)" }}>VS</span>
                    }
                </div>
                {/* Team B header */}
                <TeamDisp team={match.teamB} winner={winnerSide === "b"} align="right" />

                {/* Set rows — one row per set */}
                {sets.map((s, si) => {
                    const active = setActive(si);
                    return (
                        <SetRow
                            key={`${match.id}-${si}`}
                            matchId={match.id} si={si} totalSets={totalSets}
                            initialA={s.a ?? ""} initialB={s.b ?? ""}
                            active={active} done={done} winnerSide={winnerSide}
                            onBlur={onUpdate}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function TeamDisp({ team, winner, align = "left" }) {
    if (!team) return <div className="flex-1 min-w-0" />;
    const isR = align === "right";
    return (
        <div className={`flex-1 flex flex-col gap-2 min-w-0 ${isR ? "items-end" : "items-start"}`}>
            {(team.players || []).map(p => (
                <div key={p.id} className={`flex items-center gap-1.5 min-w-0 max-w-full ${isR ? "flex-row-reverse" : ""}`}>
                    <Av athlete={p} size="sm" className="flex-shrink-0" />
                    <span className={`text-sm font-semibold truncate min-w-0 ${isR ? "text-right" : "text-left"}`}
                        style={{ color: winner ? C.gold : C.text, fontWeight: winner ? 700 : 500 }}>
                        {p.name}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ─── Leaderboard ─────────────────────────────────────────────────────────
function Leaderboard({ rows, teamName }) {
    return (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,.07)" }}>
            {/* Header */}
            <div className="flex items-center px-3 lg:px-5 py-3 text-[10px] font-bold uppercase tracking-[1.5px]"
                style={{ background: "rgba(0,0,0,.35)", color: C.muted, borderBottom: "1px solid rgba(255,255,255,.07)" }}>
                <span className="w-7 flex-shrink-0">#</span>
                <span className="flex-1">ทีม</span>
                <span className="w-14 text-right">ชนะ/แข่ง</span>
                <span className="w-14 text-right">ได้/เสีย</span>
                <span className="w-10 text-right">+/-</span>
            </div>

            {rows.length === 0 && (
                <p className="text-sm py-12 text-center" style={{ color: C.muted }}>ยังไม่มีผล</p>
            )}

            {rows.map((r, i) => {
                const players = r.team.players || [];
                const isFirst = i === 0;
                return (
                    <div key={r.team.id}
                        className="flex items-center px-3 lg:px-5 py-2.5 lg:py-4 transition-colors"
                        style={{
                            background: isFirst ? "rgba(201,168,76,.05)" : i % 2 === 1 ? "rgba(255,255,255,.018)" : "transparent",
                            borderBottom: "1px solid rgba(255,255,255,.04)",
                        }}>

                        {/* Rank */}
                        <div className="w-7 flex-shrink-0 flex items-center justify-center">
                            {isFirst
                                ? <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold"
                                    style={{ background: `linear-gradient(135deg,${C.gold},${C.goldDim})`, color: "#1a1200" }}>1</span>
                                : <span className="text-xs font-bold" style={{ color: C.muted }}>{i + 1}</span>
                            }
                        </div>

                        {/* Team: photos + name */}
                        <div className="flex-1 flex items-center gap-1.5 min-w-0">
                            <div className="flex items-center flex-shrink-0"
                                style={{ marginRight: players.length > 1 ? "2px" : "0" }}>
                                {players.map((p, pi) => (
                                    <div key={p.id} style={{ marginLeft: pi > 0 ? "-6px" : "0", zIndex: players.length - pi, position: "relative" }}>
                                        <Av athlete={p} size="xs" />
                                    </div>
                                ))}
                            </div>
                            <span className="truncate font-semibold text-xs"
                                style={{ color: isFirst ? C.gold : C.text }}>
                                {teamName(r.team)}
                            </span>
                        </div>

                        {/* Stats — same on all screen sizes */}
                        <span className="w-14 text-right text-base tabular-nums font-mono flex-shrink-0">
                            <span style={{ color: C.green, fontWeight: 700 }}>{r.wins}</span>
                            <span style={{ color: C.muted }}>/{r.played}</span>
                        </span>
                        <span className="w-14 text-right text-xs tabular-nums font-mono flex-shrink-0" style={{ color: C.dim }}>
                            {r.pFor}/{r.pAg}
                        </span>
                        <span className="w-10 text-right text-base tabular-nums font-bold font-mono flex-shrink-0"
                            style={{ color: r.diff > 0 ? C.green : r.diff < 0 ? C.red : C.muted }}>
                            {r.diff > 0 ? "+" : ""}{r.diff}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// ─── History Page ─────────────────────────────────────────────────────────
function HistoryPage({ tenantId }) {
    const [tournaments, setTournaments] = useState([]);
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        const unsub = dbOnSnapshot(`tenants/${tenantId}/tournaments`, snap => {
            setTournaments((snap.docs || []).map(d => ({ id: d.id, ...d.data() }))
                .filter(t => t.status === "finished").sort((a, b) => (b.matchDate  || 0) - (a.matchDate  || 0)));
        });
        return () => unsub && unsub();
    }, [tenantId]);

    if (selected) return <HistoryDetail tenantId={tenantId} tournament={selected} onBack={() => setSelected(null)} />;

    return (
        <div className="w-full max-w-screen-2xl mx-auto px-4 lg:px-10 py-8 fadeslide">
            <PageTitle sub={`${tournaments.length} รายการที่ผ่านมา`}>ประวัติการแข่งขัน</PageTitle>

            {!tournaments.length && (
                <div className="flex flex-col items-center py-24" style={{ color: C.muted }}>
                    <ShuttleIcon size={44} />
                    <p className="mt-4 text-sm">ยังไม่มีประวัติการแข่งขัน</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {tournaments.map(t => (
                    <button key={t.id} onClick={() => setSelected(t)} className="text-left group">
                        <div className="rounded-2xl p-5 transition-all duration-200 glass hover:border-white/15 group-hover:-translate-y-0.5"
                            style={{ boxShadow: "0 4px 24px rgba(0,0,0,.3)" }}>
                            <div className="flex items-start justify-between gap-2 mb-4">
                                <span className="font-bold text-sm" style={{ color: C.text }}>{t.name}</span>
                                <span className="text-[10px] flex-shrink-0 mt-0.5" style={{ color: C.muted }}>{fmtDate(t.matchDate )}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                <Badge variant="default">{t.config?.type === "singles" ? "เดี่ยว" : "คู่"}</Badge>
                                <Badge variant="default">{t.config?.groups} กลุ่ม</Badge>
                                <Badge variant="default">{t.config?.sets} เซต</Badge>
                            </div>
                            <div className="mt-4 flex items-center gap-1 text-xs font-medium transition-all"
                                style={{ color: C.muted }}>
                                <span>ดูผล</span>
                                <span className="group-hover:translate-x-1 transition-transform">→</span>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

function HistoryDetail({ tenantId, tournament, onBack }) {
    const [matches, setMatches] = useState([]);
    const [athleteMap, setAthleteMap] = useState({});
    const [activeGroup, setActiveGroup] = useState(0);
    const config = tournament.config || {};

    useEffect(() => {
        dbGetDocs(`tenants/${tenantId}/athletes`).then(docs => {
            const map = {}; docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() }; }); setAthleteMap(map);
        });
        dbGetDocs(`tenants/${tenantId}/tournaments/${tournament.id}/matches`).then(docs => {
            setMatches(docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.order - b.order));
        });
    }, [tenantId, tournament.id]);

    const mergeImg = team => {
        if (!team) return team;
        return { ...team, players: (team.players || []).map(p => ({ ...p, ...(athleteMap[p.id] || {}) })) };
    };
    const teamName = t => t?.players?.map(p => p.name.split(" ")[0]).join(" / ") || "-";

    const leaderboard = g => {
        const teams = (tournament.groupTeams?.[g] || []).map(t => mergeImg(t));
        const gm = matches.filter(m => m.group === g && m.done);
        return teams.map(team => {
            const mp = gm.filter(m => m.teamA?.id === team.id || m.teamB?.id === team.id);
            let wins = 0, pFor = 0, pAg = 0;
            mp.forEach(m => {
                const isA = m.teamA?.id === team.id; let aw = 0, bw = 0;
                (m.sets || []).forEach(s => {
                    const sa = parseInt(s.a) || 0, sb = parseInt(s.b) || 0;
                    if (isA) { pFor += sa; pAg += sb; if (sa > sb) aw++; else bw++; }
                    else { pFor += sb; pAg += sa; if (sb > sa) aw++; else bw++; }
                });
                if (aw > bw) wins++;
            });
            return { team, played: mp.length, wins, pFor, pAg, diff: pFor - pAg };
        }).sort((a, b) => b.wins - a.wins || b.diff - a.diff);
    };

    return (
        <div className="w-full max-w-screen-2xl mx-auto px-4 lg:px-10 py-8 fadeslide">
            <div className="flex items-center gap-3 mb-6">
                <Btn variant="ghost" size="sm" onClick={onBack}>← กลับ</Btn>
                <div>
                    <h1 className="text-lg font-bold" style={{ color: C.gold }}>{tournament.name}</h1>
                    <p className="text-xs" style={{ color: C.muted }}>
                        {fmtDate(tournament.matchDate )} · {config.type === "singles" ? "เดี่ยว" : "คู่"} · {config.groups} กลุ่ม · {config.sets} เซต
                    </p>
                </div>
            </div>

            {config.groups > 1 && (
                <SegmentControl tabs={[{ k: 0, l: "กลุ่ม A" }, { k: 1, l: "กลุ่ม B" }]} active={activeGroup} onChange={v => setActiveGroup(Number(v))} />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <p className="text-[10px] font-bold tracking-[2px] uppercase mb-4" style={{ color: C.muted }}>ตารางคะแนน</p>
                    <Leaderboard rows={leaderboard(activeGroup)} teamName={teamName} />
                </div>
                <div>
                    <p className="text-[10px] font-bold tracking-[2px] uppercase mb-4" style={{ color: C.muted }}>ผลการแข่งขัน</p>
                    <div className="flex flex-col gap-2">
                        {matches.filter(m => m.group === activeGroup).map((m, i) => {
                            const mA = mergeImg(m.teamA);
                            const mB = mergeImg(m.teamB);
                            let aw = 0, bw = 0;
                            (m.sets || []).forEach(s => { const sa = parseInt(s.a) || 0, sb = parseInt(s.b) || 0; if (sa > sb) aw++; else bw++; });
                            const wA = aw > bw, wB = bw > aw;
                            return (
                                <div key={m.id} className="rounded-2xl px-4 py-3"
                                    style={{ background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.06)" }}>
                                    <div className="flex items-center gap-3">
                                        {/* Match number */}
                                        <span className="text-xs tabular-nums font-mono w-5 text-center flex-shrink-0" style={{ color: C.muted }}>{i + 1}</span>

                                        {/* Team A */}
                                        <div className="flex-1 flex items-center gap-2 min-w-0">
                                            <div className="flex flex-shrink-0">
                                                {(mA?.players || []).map((p, pi) => (
                                                    <div key={p.id} style={{ marginLeft: pi > 0 ? "-6px" : "0", position: "relative", zIndex: (mA.players.length - pi) }}>
                                                        <Av athlete={p} size="xs" />
                                                    </div>
                                                ))}
                                            </div>
                                            <span className="text-xs font-semibold truncate" style={{ color: wA ? C.gold : C.text }}>{teamName(mA)}</span>
                                        </div>

                                        {/* Score */}
                                        <div className="flex-shrink-0 flex gap-1.5 items-center">
                                            {(m.sets || []).filter((_, si) => {
                                                // only show sets that were actually played
                                                const s = m.sets[si]; return s.a !== "" && s.b !== "";
                                            }).map((s, si) => (
                                                <span key={si} className="text-xs font-bold font-mono tabular-nums px-2 py-1 rounded-lg"
                                                    style={{ color: C.gold, background: `${C.gold}08`, border: `1px solid ${C.gold}18` }}>
                                                    {s.a || 0}–{s.b || 0}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Team B */}
                                        <div className="flex-1 flex items-center gap-2 min-w-0 justify-end">
                                            <span className="text-xs font-semibold truncate text-right" style={{ color: wB ? C.gold : C.text }}>{teamName(mB)}</span>
                                            <div className="flex flex-shrink-0">
                                                {(mB?.players || []).map((p, pi) => (
                                                    <div key={p.id} style={{ marginLeft: pi > 0 ? "-6px" : "0", position: "relative", zIndex: (mB.players.length - pi) }}>
                                                        <Av athlete={p} size="xs" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────
function AdminPanel({ tenant, user }) {
    const [section, setSection] = useState("dashboard");
    const menuItems = [
        { k: "dashboard", icon: "📊", label: "Dashboard" },
        { k: "athletes", icon: "👤", label: "นักกีฬา" },
        { k: "manage", icon: "🏸", label: "รายการแข่งขัน" },
        { k: "settings", icon: "🔧", label: "ตั้งค่า" },
    ];

    return (
        <div className="flex flex-1 min-h-0">
            {/* Sidebar */}
            <aside className="hidden md:flex w-56 flex-shrink-0 flex-col gap-1 p-3"
                style={{ background: "rgba(0,0,0,.25)", borderRight: "1px solid rgba(255,255,255,.06)" }}>
                <p className="text-[9px] font-extrabold tracking-[3px] px-3 py-3" style={{ color: C.goldDim }}>ADMIN PANEL</p>
                {menuItems.map(m => (
                    <button key={m.k} onClick={() => setSection(m.k)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full text-left"
                        style={section === m.k
                            ? { background: `${C.gold}10`, color: C.gold, border: `1px solid ${C.gold}22` }
                            : { color: C.muted, border: "1px solid transparent" }}>
                        <span className="text-base">{m.icon}</span>
                        <span>{m.label}</span>
                    </button>
                ))}
                <div className="flex-1" />
                <div className="px-3 py-3 rounded-xl mt-2" style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
                    <p className="text-xs font-semibold truncate" style={{ color: C.dim }}>{user?.displayName}</p>
                    <p className="text-[10px] truncate mt-0.5" style={{ color: C.muted }}>{user?.email}</p>
                </div>
            </aside>

            {/* Mobile bottom tabs */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
                style={{ background: "rgba(6,9,15,.95)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,.07)" }}>
                {menuItems.map(m => (
                    <button key={m.k} onClick={() => setSection(m.k)}
                        className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors"
                        style={{ color: section === m.k ? C.gold : C.muted }}>
                        <span className="text-lg leading-none">{m.icon}</span>
                        <span className="text-[9px] font-semibold">{m.label}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
                <div className="max-w-screen-xl mx-auto p-5 lg:p-8 fadeslide">
                    {section === "dashboard" && <AdminDashboard tenantId={tenant.id} tenant={tenant} />}
                    {section === "athletes" && <AdminAthletes tenantId={tenant.id} />}
                    {section === "manage" && <AdminManageTournaments tenantId={tenant.id} />}
                    {section === "settings" && <AdminSettings tenant={tenant} user={user} />}
                </div>
            </main>
        </div>
    );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────
function AdminDashboard({ tenantId, tenant }) {
    const [athletes, setAthletes] = useState([]);
    const [tournaments, setTournaments] = useState([]);

    useEffect(() => {
        dbGetDocs(`tenants/${tenantId}/athletes`).then(d => setAthletes(d.map(x => ({ id: x.id, ...x.data() }))));
        const unsub = dbOnSnapshot(`tenants/${tenantId}/tournaments`, snap => {
            setTournaments((snap.docs || []).map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub && unsub();
    }, [tenantId]);

    const visible = tournaments.filter(t => t.status !== "archived");
    const stats = [
        { label: "นักกีฬา", value: athletes.length, icon: "👤", color: C.accent },
        { label: "กำลังแข่ง", value: visible.filter(t => t.status === "active").length, icon: "🏸", color: C.green },
        { label: "จบแล้ว", value: visible.filter(t => t.status === "finished").length, icon: "🏆", color: C.gold },
        { label: "ทั้งหมด", value: visible.length, icon: "📋", color: C.indigo },
    ];

    return (
        <div>
            <PageTitle>Dashboard</PageTitle>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {stats.map(s => (
                    <div key={s.label} className="rounded-2xl p-4 glass" style={{ position: "relative", overflow: "hidden" }}>
                        <div className="absolute top-0 right-0 w-16 h-16 rounded-full -translate-y-1/2 translate-x-1/2"
                            style={{ background: `${s.color}15`, filter: "blur(12px)" }} />
                        <p className="text-3xl mb-1" style={{ lineHeight: 1 }}>{s.icon}</p>
                        <p className="text-3xl font-extrabold mt-2" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-xs mt-1" style={{ color: C.muted }}>{s.label}</p>
                    </div>
                ))}
            </div>
            <Card className="mb-4">
                <p className="text-xs font-bold mb-3" style={{ color: C.dim }}>🔗 ลิงก์สำหรับสมาชิก</p>
                <CopyField value={`${window.location.origin}/${tenantId}`} />
                <p className="text-xs mt-2" style={{ color: C.muted }}>แชร์ให้สมาชิกเพื่อดูผลและบันทึกคะแนน</p>
            </Card>
            {!firebaseReady && (
                <div className="rounded-2xl p-4" style={{ background: `${C.gold}08`, border: `1px solid ${C.gold}20` }}>
                    <p className="text-sm" style={{ color: C.gold }}>⚠️ Demo Mode — กรุณาตั้งค่า Firebase Config ก่อน deploy</p>
                </div>
            )}
        </div>
    );
}

// ─── Admin Athletes ───────────────────────────────────────────────────────
function AdminAthletes({ tenantId }) {
    const [athletes, setAthletes] = useState([]);
    const [name, setName] = useState("");
    const [imgSrc, setImgSrc] = useState(null);
    const [editId, setEditId] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const unsub = dbOnSnapshot(`tenants/${tenantId}/athletes`, snap => {
            setAthletes((snap.docs || []).map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub && unsub();
    }, [tenantId]);

    const handleImg = e => {
        const file = e.target.files[0]; if (!file) return;
        const r = new FileReader(); r.onload = ev => setImgSrc(ev.target.result); r.readAsDataURL(file);
    };

    const save = async () => {
        if (!name.trim()) return; setLoading(true);
        if (editId) { await dbUpdateDoc(`tenants/${tenantId}/athletes/${editId}`, { name: name.trim(), img: imgSrc || null }); setEditId(null); }
        else { await dbAddDoc(`tenants/${tenantId}/athletes`, { name: name.trim(), img: imgSrc || null }); }
        setName(""); setImgSrc(null); setLoading(false);
    };
    const remove = async id => { if (!confirm("ลบนักกีฬา?")) return; await dbDeleteDoc(`tenants/${tenantId}/athletes/${id}`); };
    const startEdit = a => { setEditId(a.id); setName(a.name); setImgSrc(a.img); };

    return (
        <div>
            <PageTitle sub={`${athletes.length} คน`}>นักกีฬา</PageTitle>

            <Card className="mb-6" glow={!!editId}>
                <p className="text-sm font-bold mb-4" style={{ color: C.gold }}>{editId ? "✏️ แก้ไขข้อมูล" : "➕ เพิ่มนักกีฬา"}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <Label>ชื่อนักกีฬา</Label>
                        <Input placeholder="ชื่อ-นามสกุล" value={name}
                            onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} />
                    </div>
                    <div>
                        <Label>รูปภาพ (ไม่บังคับ)</Label>
                        <input type="file" accept="image/*" onChange={handleImg}
                            className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:cursor-pointer transition-all"
                            style={{ "--tw-file-text": C.dim, file: { background: "rgba(255,255,255,.06)", color: C.dim } }} />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Btn variant="primary" onClick={save} disabled={!name.trim() || loading}>{editId ? "บันทึก" : "เพิ่มนักกีฬา"}</Btn>
                    {editId && <Btn variant="ghost" onClick={() => { setEditId(null); setName(""); setImgSrc(null); }}>ยกเลิก</Btn>}
                </div>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {athletes.map(a => (
                    <CardSm key={a.id} className="flex items-center gap-3 group">
                        <Av athlete={a} />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{a.name}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(a)}
                                className="p-1.5 rounded-lg transition-all text-sm"
                                style={{ color: C.muted }}
                                onMouseEnter={e => { e.target.style.color = C.accent; e.target.style.background = `${C.accent}10` }}
                                onMouseLeave={e => { e.target.style.color = C.muted; e.target.style.background = "transparent" }}>✏️</button>
                            <button onClick={() => remove(a.id)}
                                className="p-1.5 rounded-lg transition-all text-sm"
                                style={{ color: C.muted }}
                                onMouseEnter={e => { e.target.style.color = C.red; e.target.style.background = `${C.red}10` }}
                                onMouseLeave={e => { e.target.style.color = C.muted; e.target.style.background = "transparent" }}>🗑️</button>
                        </div>
                    </CardSm>
                ))}
            </div>
        </div>
    );
}

// ─── Admin Create Tournament ──────────────────────────────────────────────
function AdminCreateTournament({ tenantId, onDone, inline }) {
    const [step, setStep] = useState("setup");
    const [config, setConfig] = useState({ type: "singles", groups: 1, sets: 1 });
    const [tname, setTname] = useState("");
    const [matchDate, setMatchDate] = useState("");
    const [groupTeams, setGroupTeams] = useState({ 0: [], 1: [] });
    const [athletes, setAthletes] = useState([]);
    const [saving, setSaving] = useState(false);
    const setC = (k, v) => setConfig(p => ({ ...p, [k]: v }));

    useEffect(() => {
        dbGetDocs(`tenants/${tenantId}/athletes`).then(docs => setAthletes(docs.map(d => ({ id: d.id, ...d.data() }))));
    }, [tenantId]);

    const buildAndSave = async () => {
        setSaving(true);

        // Strip img from players before saving — images are loaded live from athletes collection
        const stripImg = (teams) => Object.fromEntries(
            Object.entries(teams).map(([g, tList]) => [
                g,
                (tList || []).map(team => ({
                    ...team,
                    players: (team.players || []).map(({ img, ...rest }) => rest)
                }))
            ])
        );
        const cleanGroupTeams = stripImg(groupTeams);

        const tourData = {
            name: tname.trim(), config, groupTeams: cleanGroupTeams,
            status: "active", createdAt: Date.now(),
            matchDate: matchDate ? new Date(matchDate).getTime() : null,
        };
        const tourDoc = await dbAddDoc(`tenants/${tenantId}/tournaments`, tourData);
        const tid = tourDoc.id;
        for (let g = 0; g < config.groups; g++) {
            const teams = cleanGroupTeams[g] || []; if (teams.length < 2) continue;
            const pairs = generateRoundRobin(teams);
            for (let idx = 0; idx < pairs.length; idx++) {
                const sets = Array.from({ length: config.sets }, () => ({ a: "", b: "" }));
                // Also strip img from teamA/teamB in each match
                const teamA = { ...pairs[idx][0], players: (pairs[idx][0].players || []).map(({ img, ...r }) => r) };
                const teamB = { ...pairs[idx][1], players: (pairs[idx][1].players || []).map(({ img, ...r }) => r) };
                await dbAddDoc(`tenants/${tenantId}/tournaments/${tid}/matches`, { group: g, teamA, teamB, sets, done: false, order: idx });
            }
        }
        setSaving(false); setStep("done");
        setTimeout(() => {
            setStep("setup"); setConfig({ type: "singles", groups: 1, sets: 1 });
            setTname(""); setMatchDate(""); setGroupTeams({ 0: [], 1: [] });
            onDone?.();
        }, 2000);
    };

    if (step === "done") return (
        <div className="flex flex-col items-center justify-center py-12 fadeslide">
            <p className="text-5xl mb-4">🎉</p>
            <p className="text-lg font-bold" style={{ color: C.green }}>สร้างการแข่งขันสำเร็จ!</p>
        </div>
    );

    if (step === "teams") return (
        <AdminTeamsSetup athletes={athletes} config={config} groupTeams={groupTeams}
            setGroupTeams={setGroupTeams} onBack={() => setStep("setup")} onSave={buildAndSave} saving={saving} />
    );

    return (
        <div className={inline ? "p-4" : ""}>
            {!inline && <PageTitle>สร้างการแข่งขันใหม่</PageTitle>}
            {inline && <p className="text-sm font-bold mb-4" style={{ color: C.gold }}>➕ สร้างรายการใหม่</p>}
            <div className={`flex flex-col gap-4 ${inline ? "" : "max-w-lg"}`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <Label>ชื่อรายการ</Label>
                        <Input placeholder="เช่น รายการประจำเดือน" value={tname} onChange={e => setTname(e.target.value)} />
                    </div>
                    <div>
                        <Label>วันที่แข่งขัน</Label>
                        <input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)}
                            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
                            style={{
                                background: "rgba(255,255,255,.05)", border: `1px solid rgba(255,255,255,.12)`,
                                color: C.text, colorScheme: "dark"
                            }} />
                    </div>
                </div>
                <div>
                    <Label>ประเภทการแข่งขัน</Label>
                    <RadioGroup name="type" value={config.type} onChange={v => setC("type", v)}
                        options={[{ v: "singles", l: "ประเภทเดี่ยว" }, { v: "doubles", l: "ประเภทคู่" }]} />
                </div>
                <div>
                    <Label>จำนวนกลุ่ม</Label>
                    <RadioGroup name="groups" value={String(config.groups)} onChange={v => setC("groups", Number(v))}
                        options={[{ v: "1", l: "1 กลุ่ม" }, { v: "2", l: "2 กลุ่ม" }]} />
                </div>
                <div>
                    <Label>จำนวนเซต</Label>
                    <RadioGroup name="sets" value={String(config.sets)} onChange={v => setC("sets", Number(v))}
                        options={[{ v: "1", l: "1 เซต" }, { v: "3", l: "3 เซต" }]} />
                </div>
                {athletes.length < 2 && (
                    <p className="text-xs rounded-xl px-4 py-3" style={{ color: `${C.gold}cc`, background: `${C.gold}08`, border: `1px solid ${C.gold}20` }}>
                        ⚠️ กรุณาเพิ่มนักกีฬาอย่างน้อย 2 คนก่อน
                    </p>
                )}
                <Btn variant="primary" size="lg" className="w-full"
                    onClick={() => { if (!tname.trim()) { alert("ใส่ชื่อรายการก่อน"); return; } setStep("teams"); }}
                    disabled={athletes.length < 2}>
                    ถัดไป: จัดทีม →
                </Btn>
            </div>
        </div>
    );
}

function AdminTeamsSetup({ athletes, config, groupTeams, setGroupTeams, onBack, onSave, saving }) {
    const [activeGroup, setActiveGroup] = useState(0);
    const maxTeams = 6, teamSize = config.type === "doubles" ? 2 : 1;
    const gCfg = [{ color: C.indigo, bg: `${C.indigo}12`, border: `${C.indigo}25` }, { color: C.pink, bg: `${C.pink}12`, border: `${C.pink}25` }];

    const usedIds = new Set();
    for (let g = 0; g < config.groups; g++) (groupTeams[g] || []).forEach(t => t.players.forEach(p => usedIds.add(p.id)));

    const addAthlete = id => {
        const athlete = athletes.find(a => a.id === id); if (!athlete) return;
        setGroupTeams(prev => {
            const cur = prev[activeGroup] || [];
            if (teamSize === 1) {
                if (cur.length >= maxTeams) return prev;
                return { ...prev, [activeGroup]: [...cur, { id: uid(), players: [athlete] }] };
            } else {
                const pending = cur.find(t => t.players.length < 2);
                if (pending) return { ...prev, [activeGroup]: cur.map(t => t.id === pending.id ? { ...t, players: [...t.players, athlete] } : t) };
                if (cur.length >= maxTeams) return prev;
                return { ...prev, [activeGroup]: [...cur, { id: uid(), players: [athlete] }] };
            }
        });
    };
    const removeTeam = tid => setGroupTeams(prev => ({ ...prev, [activeGroup]: (prev[activeGroup] || []).filter(t => t.id !== tid) }));
    const canSave = () => {
        for (let g = 0; g < config.groups; g++) {
            const t = groupTeams[g] || [];
            if (t.length < 2 || teamSize === 2 && t.some(x => x.players.length < 2)) return false;
        }
        return true;
    };

    return (
        <div>
            <div className="flex items-center gap-3 mb-6">
                <Btn variant="ghost" size="sm" onClick={onBack}>← กลับ</Btn>
                <PageTitle>จัดทีม</PageTitle>
            </div>

            {config.groups > 1 && (
                <div className="flex gap-2 mb-5">
                    {Array.from({ length: config.groups }).map((_, g) => (
                        <button key={g} onClick={() => setActiveGroup(g)}
                            className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                            style={activeGroup === g
                                ? { background: gCfg[g].bg, border: `1px solid ${gCfg[g].border}`, color: gCfg[g].color }
                                : { background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", color: C.muted }}>
                            กลุ่ม {g === 0 ? "A" : "B"} ({(groupTeams[g] || []).length}/{maxTeams})
                        </button>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Teams */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-4 rounded-full" style={{ background: gCfg[activeGroup].color }} />
                        <p className="text-xs font-bold" style={{ color: gCfg[activeGroup].color }}>
                            กลุ่ม {activeGroup === 0 ? "A" : "B"}
                        </p>
                        <p className="text-xs" style={{ color: C.muted }}>
                            {teamSize === 2 ? "คลิกเลือก 2 คน = 1 คู่" : "คลิกเลือก 1 คน = 1 ทีม"}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 min-h-20">
                        {!(groupTeams[activeGroup] || []).length && <p className="text-xs py-4" style={{ color: C.muted }}>ยังไม่มีทีม</p>}
                        {(groupTeams[activeGroup] || []).map((team, i) => (
                            <CardXs key={team.id} className="flex items-center gap-2">
                                <span className="text-xs tabular-nums w-5 text-center" style={{ color: C.muted }}>{i + 1}</span>
                                <div className="flex-1 flex gap-2 items-center flex-wrap">
                                    {team.players.map(p => (
                                        <div key={p.id} className="flex items-center gap-1.5">
                                            <Av athlete={p} size="sm" />
                                            <span className="text-xs font-medium" style={{ color: C.text }}>{p.name}</span>
                                        </div>
                                    ))}
                                    {teamSize === 2 && team.players.length < 2 && <span className="text-xs" style={{ color: C.muted }}>+ คนที่ 2</span>}
                                </div>
                                <button onClick={() => removeTeam(team.id)}
                                    className="text-xs px-2 py-1 rounded-lg transition-all"
                                    style={{ color: C.red, background: `${C.red}08`, border: `1px solid ${C.red}20` }}>✕</button>
                            </CardXs>
                        ))}
                    </div>
                </div>

                {/* Athletes picker */}
                <div>
                    <Label>เลือกนักกีฬา</Label>
                    <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
                        {athletes.map(a => (
                            <button key={a.id} onClick={() => !usedIds.has(a.id) && addAthlete(a.id)}
                                disabled={usedIds.has(a.id)}
                                className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-sm text-left transition-all"
                                style={usedIds.has(a.id)
                                    ? { opacity: .3, cursor: "not-allowed", background: "transparent", border: "1px solid transparent" }
                                    : { background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", color: C.text }}>
                                <Av athlete={a} size="sm" />
                                <span className="flex-1 text-sm font-medium">{a.name}</span>
                                {usedIds.has(a.id) && <span className="text-[10px]" style={{ color: C.muted }}>ใช้แล้ว</span>}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <Divider />
            <div className="flex items-center justify-end gap-3">
                {!canSave() && <p className="text-xs" style={{ color: C.muted }}>แต่ละกลุ่มต้องมีอย่างน้อย 2 ทีม</p>}
                <Btn variant="primary" size="lg" onClick={onSave} disabled={!canSave() || saving}>
                    {saving ? "กำลังสร้าง…" : "🏸 เริ่มการแข่งขัน"}
                </Btn>
            </div>
        </div>
    );
}

// ─── Admin Manage Tournaments ─────────────────────────────────────────────
function AdminManageTournaments({ tenantId }) {
    const [tournaments, setTournaments] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    // inline edit state
    const [editId, setEditId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editDate, setEditDate] = useState("");
    const [editSaving, setEditSaving] = useState(false);

    useEffect(() => {
        const unsub = dbOnSnapshot(`tenants/${tenantId}/tournaments`, snap => {
            setTournaments((snap.docs || []).map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
        });
        return () => unsub && unsub();
    }, [tenantId]);

    const activeTournament = tournaments.find(t => t.status === "active");

    const finish = async t => { if (!confirm(`จบรายการ "${t.name}"?`)) return; await dbUpdateDoc(`tenants/${tenantId}/tournaments/${t.id}`, { status: "finished", matchDate : Date.now() }); };
    const archive = async t => { if (!confirm(`ลบรายการ "${t.name}"?`)) return; await dbUpdateDoc(`tenants/${tenantId}/tournaments/${t.id}`, { status: "archived" }); };

    const startEdit = t => {
        setEditId(t.id);
        setEditName(t.name || "");
        // convert stored timestamp or ISO string to YYYY-MM-DD for date input
        const d = t.matchDate ? new Date(t.matchDate) : null;
        setEditDate(d ? d.toISOString().slice(0, 10) : "");
    };
    const saveEdit = async () => {
        if (!editName.trim()) return;
        setEditSaving(true);
        const update = { name: editName.trim() };
        if (editDate) update.matchDate = new Date(editDate).getTime();
        else update.matchDate = null;
        await dbUpdateDoc(`tenants/${tenantId}/tournaments/${editId}`, update);
        setEditId(null); setEditSaving(false);
    };

    const visible = tournaments.filter(t => t.status !== "archived");

    return (
        <div>
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                <PageTitle>รายการแข่งขัน</PageTitle>
                {!activeTournament && (
                    <Btn variant="primary" onClick={() => setShowCreate(v => !v)}>
                        {showCreate ? "✕ ยกเลิก" : "➕ สร้างรายการใหม่"}
                    </Btn>
                )}
            </div>

            {/* Create form — inline when no active tournament */}
            {showCreate && !activeTournament && (
                <div className="mb-6 rounded-2xl p-1" style={{ border: `1px solid ${C.gold}25`, background: `${C.gold}05` }}>
                    <AdminCreateTournament tenantId={tenantId} onDone={() => setShowCreate(false)} inline />
                </div>
            )}

            {/* Locked notice */}
            {activeTournament && (
                <div className="mb-5 rounded-2xl px-4 py-3 flex items-center gap-3"
                    style={{ background: `${C.gold}06`, border: `1px solid ${C.gold}20` }}>
                    <span style={{ color: C.gold }}>🔒</span>
                    <p className="text-xs" style={{ color: C.muted }}>
                        มีรายการที่กำลังแข่งขันอยู่ — จบรายการปัจจุบันก่อนสร้างรายการใหม่
                    </p>
                </div>
            )}

            {!visible.length && (
                <p className="text-center py-16 text-sm" style={{ color: C.muted }}>ยังไม่มีรายการ</p>
            )}

            <div className="flex flex-col gap-3">
                {visible.map(t => (
                    <Card key={t.id}>
                        {editId === t.id ? (
                            /* Inline edit form */
                            <div className="flex flex-col gap-3">
                                <p className="text-xs font-bold" style={{ color: C.gold }}>✏️ แก้ไขรายการ</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <Label>ชื่อรายการ</Label>
                                        <Input value={editName} onChange={e => setEditName(e.target.value)} />
                                    </div>
                                    <div>
                                        <Label>วันที่แข่งขัน</Label>
                                        <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                                            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
                                            style={{
                                                background: "rgba(255,255,255,.05)", border: `1px solid rgba(255,255,255,.12)`,
                                                color: C.text, colorScheme: "dark"
                                            }} />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Btn variant="primary" size="sm" onClick={saveEdit} disabled={!editName.trim() || editSaving}>
                                        {editSaving ? "บันทึก…" : "บันทึก"}
                                    </Btn>
                                    <Btn variant="ghost" size="sm" onClick={() => setEditId(null)}>ยกเลิก</Btn>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="min-w-0">
                                    <p className="font-bold text-sm mb-2" style={{ color: C.text }}>{t.name}</p>
                                    <div className="flex flex-wrap gap-2 items-center">
                                        {t.status === "active" && <Badge variant="green">🟢 กำลังแข่งขัน</Badge>}
                                        {t.status === "finished" && <Badge variant="gold">🏆 จบแล้ว</Badge>}
                                        <Badge variant="default">{t.config?.type === "singles" ? "เดี่ยว" : "คู่"}</Badge>
                                        {t.matchDate
                                            ? <span className="text-xs" style={{ color: C.dim }}>📅 {fmtDate(t.matchDate)}</span>
                                            : <span className="text-xs" style={{ color: C.muted }}>สร้าง {fmtDate(t.createdAt)}</span>
                                        }
                                    </div>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                    <Btn variant="ghost" size="sm" onClick={() => startEdit(t)}>✏️</Btn>
                                    {t.status === "active" && <Btn variant="success" size="sm" onClick={() => finish(t)}>🏆 จบรายการ</Btn>}
                                    <Btn variant="danger" size="sm" onClick={() => archive(t)}>🗑️</Btn>
                                </div>
                            </div>
                        )}
                    </Card>
                ))}
            </div>
        </div>
    );
}

// ─── Admin Settings ───────────────────────────────────────────────────────
function AdminSettings({ tenant, user }) {
    const [admins, setAdmins] = useState(tenant.adminUids || []);
    const [newUid, setNewUid] = useState("");
    const [saving, setSaving] = useState(false);
    // Club info editing
    const [clubName, setClubName] = useState(tenant.name || "");
    const [clubLogo, setClubLogo] = useState(tenant.logo || null);
    const [savingInfo, setSavingInfo] = useState(false);
    const [infoOk, setInfoOk] = useState(false);

    const handleLogo = e => {
        const file = e.target.files[0]; if (!file) return;
        const r = new FileReader(); r.onload = ev => setClubLogo(ev.target.result); r.readAsDataURL(file);
    };
    const saveInfo = async () => {
        if (!clubName.trim()) return;
        setSavingInfo(true);
        await dbUpdateDoc(`tenants/${tenant.id}`, { name: clubName.trim(), logo: clubLogo || null });
        setSavingInfo(false); setInfoOk(true); setTimeout(() => setInfoOk(false), 2000);
        // Update page title immediately
        tenant.name = clubName.trim(); tenant.logo = clubLogo;
    };

    const addAdmin = async () => {
        if (!newUid.trim()) return;
        const updated = [...new Set([...admins, newUid.trim()])];
        setSaving(true);
        await dbUpdateDoc(`tenants/${tenant.id}`, { adminUids: updated });
        setAdmins(updated); setNewUid(""); setSaving(false);
    };
    const removeAdmin = async u => {
        if (u === user.uid) { alert("ไม่สามารถลบตัวเองออกจาก Admin"); return; }
        const updated = admins.filter(x => x !== u);
        await dbUpdateDoc(`tenants/${tenant.id}`, { adminUids: updated });
        setAdmins(updated);
    };

    return (
        <div className="max-w-2xl">
            <PageTitle>ตั้งค่า</PageTitle>

            {/* Club info */}
            <Card className="mb-4">
                <p className="text-xs font-bold mb-4" style={{ color: C.gold }}>🏸 ข้อมูลก๊วน</p>
                <div className="flex items-start gap-4 mb-4">
                    {/* Logo preview + upload */}
                    <div className="flex flex-col items-center gap-2 flex-shrink-0">
                        {clubLogo
                            ? <img src={clubLogo} alt="logo" className="w-20 h-20 rounded-2xl object-cover ring-1 ring-white/15" />
                            : <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                                style={{ background: "rgba(255,255,255,.04)", border: "1px dashed rgba(255,255,255,.12)" }}>
                                <ShuttleIcon size={28} />
                            </div>
                        }
                        <label className="cursor-pointer">
                            <span className="text-[10px] font-semibold px-2 py-1 rounded-lg transition-all"
                                style={{ color: C.muted, border: "1px solid rgba(255,255,255,.1)" }}>
                                เปลี่ยน Logo
                            </span>
                            <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                        </label>
                        {clubLogo && (
                            <button onClick={() => setClubLogo(null)} className="text-[10px]" style={{ color: C.red }}>ลบรูป</button>
                        )}
                    </div>
                    {/* Name */}
                    <div className="flex-1">
                        <Label>ชื่อก๊วน</Label>
                        <Input value={clubName} onChange={e => setClubName(e.target.value)} placeholder="ชื่อก๊วน" />
                    </div>
                </div>
                <Btn variant={infoOk ? "success" : "primary"} onClick={saveInfo} disabled={!clubName.trim() || savingInfo}>
                    {savingInfo ? "กำลังบันทึก…" : infoOk ? "✓ บันทึกแล้ว" : "บันทึกข้อมูลก๊วน"}
                </Btn>
            </Card>

            {/* Public link */}
            <Card className="mb-4">
                <p className="text-xs font-bold mb-3" style={{ color: C.dim }}>🔗 ลิงก์สาธารณะ</p>
                <CopyField value={`${window.location.origin}/${tenant.id}`} />
                <p className="text-xs mt-2.5" style={{ color: C.muted }}>
                    ผู้ที่เข้า link นี้สามารถดูการแข่งขันและบันทึกคะแนนได้ แต่ไม่สามารถสร้าง/จัดการได้
                </p>
            </Card>

            {/* Admin users */}
            <Card>
                <p className="text-xs font-bold mb-1.5" style={{ color: C.dim }}>👑 Admin Users</p>
                <p className="text-xs mb-4" style={{ color: C.muted }}>Admin สามารถสร้างรายการ จัดการนักกีฬา และตั้งค่าได้</p>
                <div className="flex flex-col gap-2 mb-4">
                    {admins.map(u => (
                        <CardXs key={u} className="flex items-center gap-3">
                            <span className="flex-1 font-mono text-xs truncate" style={{ color: C.muted }}>{u}</span>
                            {u === user?.uid && <Badge variant="gold">คุณ</Badge>}
                            <button onClick={() => removeAdmin(u)}
                                className="text-xs px-2.5 py-1 rounded-lg transition-all flex-shrink-0"
                                style={{ color: C.red, background: `${C.red}08`, border: `1px solid ${C.red}18` }}>ลบ</button>
                        </CardXs>
                    ))}
                </div>
                <div className="flex gap-2">
                    <Input placeholder="Firebase UID ของ Admin คนใหม่" value={newUid} onChange={e => setNewUid(e.target.value)} />
                    <Btn variant="primary" onClick={addAdmin} disabled={!newUid.trim() || saving}>เพิ่ม</Btn>
                </div>
                <p className="text-xs mt-3" style={{ color: `${C.muted}80` }}>
                    💡 Firebase Console → Authentication → Users → คัดลอก UID
                </p>
            </Card>
        </div>
    );
}
