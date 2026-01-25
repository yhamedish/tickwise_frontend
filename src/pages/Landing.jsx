// Landing.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart } from 'lucide-react';
import {
  BarChart2,
  Brain,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  LineChart,
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  const [stocksData, setStocksData] = useState([]);
    const [loadingStocks, setLoadingStocks] = useState(true);

    const base = import.meta.env.VITE_GCS_PUBLIC_BASE;
    const scoresUrl = base ? `${base}/today_recommendations.json` : '';

    useEffect(() => {
    const fetchStocks = async () => {
        if (!base) {
        console.warn('VITE_GCS_PUBLIC_BASE is not set. Landing preview will be empty.');
        setStocksData([]);
        setLoadingStocks(false);
        return;
        }
        try {
        const res = await fetch(scoresUrl);
        if (!res.ok) throw new Error(`Failed to fetch ${scoresUrl}: ${res.status} ${res.statusText}`);
        const json = await res.json();
        setStocksData(Array.isArray(json) ? json : []);
        } catch (e) {
        console.error('Landing preview failed to load recommendations:', e);
        setStocksData([]);
        } finally {
        setLoadingStocks(false);
        }
    };
    fetchStocks();
    }, [base, scoresUrl]);

    const topBuys = useMemo(() => {
    return stocksData
        .filter(s => s.recommendation?.toLowerCase() === 'buy')
        .sort((a, b) => (Number(b.tickwise_score) || 0) - (Number(a.tickwise_score) || 0))
        .slice(0, 4);
    }, [stocksData]);

    const topSells = useMemo(() => {
    return stocksData
        .filter(s => s.recommendation?.toLowerCase() === 'sell')
        .sort((a, b) => (Number(b.tickwise_score) || 0) - (Number(a.tickwise_score) || 0))
        .slice(0, 4);
    }, [stocksData]);

    const previewRows = useMemo(() => {
    // Interleave buys then sells so the preview feels balanced
    const rows = [];
    const n = Math.max(topBuys.length, topSells.length);
    for (let i = 0; i < n; i++) {
        if (topBuys[i]) rows.push(topBuys[i]);
        if (topSells[i]) rows.push(topSells[i]);
    }
    return rows.slice(0, 10); // up to 10 rows total
    }, [topBuys, topSells]);

    const fmtPct = (x) => {
    const n = Number(x);
    if (!Number.isFinite(n)) return '—';
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toFixed(1)}%`;
    };

    const get1mAiPct = (stock) => {
    const close = Number(stock.Close);
    const p95 = Number(stock.forecast1m_p95);
    if (!Number.isFinite(close) || close === 0 || !Number.isFinite(p95)) return null;
    return ((p95 - close) * 100) / close;
    };

    const previewStock = useMemo(() => {
    // Prefer the top buy; fall back to top sell; else null
    return topBuys?.[0] || topSells?.[0] || null;
    }, [topBuys, topSells]);

    const previewTicker = previewStock?.ticker || null;

    const [previewHistory, setPreviewHistory] = useState([]);
    const [previewLoading, setPreviewLoading] = useState(false);

    useEffect(() => {
    const run = async () => {
        if (!base || !previewTicker) {
        setPreviewHistory([]);
        return;
        }

        setPreviewLoading(true);
        try {
        const historyUrl = `${base}/data/${previewTicker}.json`;
        const res = await fetch(historyUrl);
        if (!res.ok) throw new Error(`Failed to fetch ${historyUrl}: ${res.status} ${res.statusText}`);
        const json = await res.json();

        // Convert to closes array
        const closes = Array.isArray(json)
            ? json
                .map((row) => Number(row.Close ?? row.close))
                .filter((v) => Number.isFinite(v))
                .slice(-60) // last ~60 points
            : [];

        setPreviewHistory(closes);
        } catch (e) {
        console.error('Preview history load failed:', e);
        setPreviewHistory([]);
        } finally {
        setPreviewLoading(false);
        }
    };

    run();
    }, [base, previewTicker]);



  const stats = useMemo(
    () => [
      { label: 'Signals combined', value: 'Fundamental + Technical + Sentiment + AI' },
      { label: 'Refresh', value: 'Daily after market close' },
      { label: 'Output', value: 'Buy / Hold / Sell clarity' },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white text-slate-900 relative overflow-hidden">
      {/* Background blobs */}
      <div className="pointer-events-none absolute -top-28 -left-28 h-[420px] w-[420px] rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute top-32 -right-28 h-[420px] w-[420px] rounded-full bg-indigo-200/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-[520px] w-[520px] rounded-full bg-sky-100/50 blur-3xl" />

      {/* Top Nav */}
      <header className="max-w-6xl mx-auto px-6 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white grid place-items-center font-bold shadow-sm">
              T
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">TickWise</div>
              <div className="text-xs text-slate-500">AI Powered Market Intelligence</div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm text-slate-600">
            <a className="hover:text-slate-900 transition" href="#features">
              Features
            </a>
            <a className="hover:text-slate-900 transition" href="#how">
              How it works
            </a>
            <a href="mailto:support@tickwisetech.com?subject=TickWise%20Feedback"
            className="hover:text-slate-900">
            Contact
            </a>

            <a className="hover:text-slate-900 transition" href="#faq">
              FAQ
            </a>

            <button
              onClick={() => navigate('/picks/')}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
            >
              View Today’s Picks
            </button>
          </div>

          {/* Mobile CTA */}
          <button
            onClick={() => navigate('/picks/')}
            className="md:hidden bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
          >
            Picks
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white/70 text-sm text-slate-600 shadow-sm backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Daily AI signals • Updated after market close
          <span className="inline-flex items-center gap-1 text-slate-500">
            <Sparkles size={14} />
          </span>
        </div>

        <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
          Smarter Stock Picks, Powered by AI
        </h1>

        <p className="mt-4 text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
          TickWise analyzes market sentiment, fundamental data, technical signals, and AI forecasts
          to deliver clear Buy / Hold / Sell insights — daily.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => navigate('/picks/')}
            className="w-full sm:w-auto bg-blue-600 text-white px-8 py-3 rounded-xl text-lg font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 inline-flex items-center justify-center gap-2"
          >
            View Today’s Picks <ArrowRight size={18} />
          </button>

          <a
            href="#how"
            className="w-full sm:w-auto px-8 py-3 rounded-xl text-lg font-semibold border border-slate-200 bg-white/70 hover:bg-white transition backdrop-blur"
          >
            How it works
          </a>
        </div>

        {/* Stats strip */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-5 text-left shadow-sm"
            >
              <div className="text-xs text-slate-500">{s.label}</div>
              <div className="mt-1 font-semibold text-slate-900">{s.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Product preview */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="rounded-3xl border border-slate-200 bg-white/70 backdrop-blur shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LineChart className="text-blue-600" size={20} />
              <div className="font-semibold">Today’s Signal Snapshot</div>
              <span className="text-xs text-slate-500 hidden sm:inline">
                (preview)
              </span>
            </div>
            <div className="text-xs text-slate-500">Click “View Today’s Picks” for live data</div>
          </div>

          <div className="grid lg:grid-cols-5 gap-0">
            {/* Left: mini table */}
            <div className="lg:col-span-3 p-6">
              <div className="grid grid-cols-12 text-xs text-slate-500 pb-3 border-b border-slate-200">
                <div className="col-span-2">Ticker</div>
                <div className="col-span-4">Security</div>
                <div className="col-span-2">Signal</div>
                <div className="col-span-2 text-right">Tickwise Score</div>
                <div className="col-span-2 text-right">1M AI</div>
              </div>

              {loadingStocks && (
                <div className="py-6 text-sm text-slate-500">Loading live preview…</div>
                )}

                {!loadingStocks && previewRows.length === 0 && (
                <div className="py-6 text-sm text-slate-500">
                    Live preview unavailable. Click “View Today’s Picks” to see the dashboard.
                </div>
                )}

                {!loadingStocks && previewRows.map((stock) => {
                const ticker = stock.ticker;
                const security = stock.Security || stock.company || '—';
                const sig = stock.recommendation || '—';
                const score = Number(stock.tickwise_score);
                const aiPct = get1mAiPct(stock);
                const aiPctText = aiPct == null ? '—' : fmtPct(aiPct);
                const isPos = aiPct != null && aiPct >= 0;

                return (
                    <div
                    key={`${ticker}-${sig}`}
                    className="grid grid-cols-12 items-center py-4 border-b border-slate-100 last:border-b-0"
                    >
                    <div className="col-span-2 font-semibold">{ticker}</div>
                    <div className="col-span-4 text-slate-600 truncate">{security}</div>
                    <div className="col-span-2">
                        <SignalChip value={sig} />
                    </div>
                    <div className="col-span-2 text-right font-semibold">
                        {Number.isFinite(score) ? score.toFixed(0) : '—'}
                    </div>
                    <div className="col-span-2 text-right">
                        <span className={`font-semibold ${isPos ? 'text-green-600' : 'text-red-600'}`}>
                        {aiPctText}
                        </span>
                    </div>
                    </div>
                );
                })}

              
            </div>

            {/* Right: mock chart panel */}
            <div className="lg:col-span-2 p-6 border-t lg:border-t-0 lg:border-l border-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-500">Example ticker</div>
                  <div className="text-lg font-semibold">{previewTicker}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 text-xs text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    ML
                  </span>
                  <span className="inline-flex items-center gap-2 text-xs text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-orange-400" />
                    Analyst
                  </span>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {/* Faux chart */}
                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs text-slate-500 mb-2">
                    {previewTicker ? `Preview: ${previewTicker} (last 60 closes)` : 'Preview'}
                </div>

                {previewLoading ? (
                    <div className="h-[140px] rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white animate-pulse" />
                ) : (
                    <Sparkline values={previewHistory} />
                )}

                {/* Optional: show current signal metrics from the previewStock */}
                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                    <Metric
                    label="Sentiment"
                    value={
                        Number.isFinite(Number(previewStock?.sentiment))
                        ? `${Number(previewStock.sentiment).toFixed(1)}%`
                        : '—'
                    }
                    tone="good"
                    />
                    <Metric
                    label="Technical"
                    value={
                        Number.isFinite(Number(previewStock?.technical))
                        ? `${Number(previewStock.technical).toFixed(1)}%`
                        : '—'
                    }
                    tone="good"
                    />
                    <Metric
                    label="TickWise"
                    value={
                        Number.isFinite(Number(previewStock?.tickwise_score))
                        ? `${Number(previewStock.tickwise_score).toFixed(0)}`
                        : '—'
                    }
                    tone="good"
                    />
                </div>
                </div>


                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <Metric label="Sentiment" value="Bullish" tone="good" />
                  <Metric label="Technical" value="Strong" tone="good" />
                  <Metric label="Forecast" value="Uptrend" tone="good" />
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-500 leading-relaxed">
                Preview only. Your dashboard shows full history, zoomable charts, and forecast lines.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 pb-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">What TickWise does</h2>
          <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
            Leverage all available data and calculate a single, interpretable score: The Tickwise Score
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
            <FeatureCard
                icon={<Brain size={22} />}
                title="AI-Driven Forecasts"
                text="Machine-learning models predict near-term price ranges using historical behavior."
            />
            <FeatureCard
                icon={<TrendingUp size={22} />}
                title="Technical Strength"
                text="Momentum, trend, and volatility signals distilled into clear scores."
            />
            <FeatureCard
                icon={<BarChart2 size={22} />}
                title="News Sentiment"
                text="FinBERT analyzes market news to quantify bullish and bearish sentiment."
            />
            <FeatureCard
                icon={<PieChart size={22} />}
                title="Fundamental Analysis"
                text="Valuation and financial health signals distilled into a clear fundamental score."
            />
        </div>

      </section>

      {/* How it works */}
      <section id="how" className="max-w-6xl mx-auto px-6 pb-16">
        <div className="rounded-3xl border border-slate-200 bg-white/70 backdrop-blur p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-slate-900" size={22} />
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">How Tickwise works</h2>
          </div>

          <div className="mt-6 grid md:grid-cols-3 gap-6">
            <Step
              n="01"
              title="Collect"
              text="Pull recent news and price history for covered tickers."
            />
            <Step
              n="02"
              title="Score"
              text="Compute sentiment, fundamental scores, technical signals, and AI forecasts."
            />
            <Step
              n="03"
              title="Rank"
              text="Combine signals into a TickWise score and surface top picks."
            />
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-slate-600">
              The goal is clarity: fewer noisy indicators, more decision-ready signals.
            </div>
            <button
              onClick={() => navigate('/picks/')}
              className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-800 transition inline-flex items-center gap-2"
            >
              Explore the dashboard <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="rounded-3xl bg-slate-900 text-white p-8 md:p-10 shadow-lg shadow-slate-900/20 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute bottom-0 left-10 h-40 w-40 rounded-full bg-blue-500/20 blur-2xl" />

          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 text-sm text-white/80">
                <CheckCircle2 size={16} />
                No setup • Instant insights
              </div>
              <h3 className="mt-3 text-2xl md:text-3xl font-bold tracking-tight">
                Ready to see today’s signals?
              </h3>
              <p className="mt-2 text-white/80 max-w-xl">
                Open the dashboard to view top Buy and Sell picks and inspect charts with forecast overlays.
              </p>
            </div>

            <button
              onClick={() => navigate('/picks/')}
              className="bg-white text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-slate-100 transition inline-flex items-center gap-2"
            >
              View Today’s Picks <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-6xl mx-auto px-6 pb-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">FAQ</h2>
          <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
            Quick answers to common questions.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <FaqItem
            q="Is this financial advice?"
            a="No. TickWise provides informational signals and analytics to support research. Always do your own due diligence."
          />
          <FaqItem
            q="How often is it updated?"
            a="Typically once per day after market close (depending on your data pipeline schedule)."
          />
          <FaqItem
            q="What’s inside the TickWise score?"
            a="A weighted blend of sentiment, fundamental score, technical indicators, and AI forecasts designed for interpretability."
          />
          <FaqItem
            q="Can I drill into a ticker?"
            a="Yes. The dashboard lets you expand a ticker row and view a price chart with forecast overlays."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-sm text-slate-500 py-10">
        © {new Date().getFullYear()} TickWise · AI-Powered Market Intelligence
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, text }) {
  return (
    <div className="bg-white/80 backdrop-blur rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition">
      <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 grid place-items-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-slate-600 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function Step({ n, title, text }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-xs font-semibold text-slate-500">{n}</div>
      <div className="mt-2 text-lg font-semibold">{title}</div>
      <div className="mt-2 text-sm text-slate-600 leading-relaxed">{text}</div>
    </div>
  );
}

function SignalChip({ value }) {
  const v = String(value || '').toLowerCase();
  const cls =
    v === 'buy'
      ? 'bg-green-50 text-green-700 border-green-200'
      : v === 'sell'
      ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-slate-50 text-slate-700 border-slate-200';

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      {value}
    </span>
  );
}

function Metric({ label, value, tone }) {
  const toneCls =
    tone === 'good'
      ? 'bg-green-50 text-green-700 border-green-200'
      : tone === 'warn'
      ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
      : 'bg-slate-50 text-slate-700 border-slate-200';

  return (
    <div className={`rounded-xl border ${toneCls} px-3 py-2`}>
      <div className="text-[11px] opacity-80">{label}</div>
      <div className="text-xs font-semibold">{value}</div>
    </div>
  );
}

function FaqItem({ q, a }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-6 shadow-sm">
      <div className="font-semibold">{q}</div>
      <div className="mt-2 text-sm text-slate-600 leading-relaxed">{a}</div>
    </div>
  );
}


function Sparkline({ values, height = 140, padding = 8 }) {
  if (!values || values.length < 2) {
    return (
      <div className="h-[140px] rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white" />
    );
  }

  const w = 320; // virtual width for SVG scaling
  const h = height;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1e-9, max - min);

  const pts = values.map((v, i) => {
    const x = padding + (i * (w - 2 * padding)) / (values.length - 1);
    const y = padding + ((max - v) * (h - 2 * padding)) / range;
    return [x, y];
  });

  const lineD = `M ${pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')}`;
  const areaD = `${lineD} L ${pts[pts.length - 1][0].toFixed(2)} ${(h - padding).toFixed(2)} L ${pts[0][0].toFixed(2)} ${(h - padding).toFixed(2)} Z`;

  const last = values[values.length - 1];
  const first = values[0];
  const up = last >= first;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[140px] rounded-xl border border-slate-100 bg-white">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          {/* no explicit colors requested; keeping subtle defaults */}
          <stop offset="0%" stopColor={up ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)'} />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>

      {/* grid */}
      <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
      <line x1="0" y1={h / 4} x2={w} y2={h / 4} stroke="rgba(148,163,184,0.18)" strokeWidth="1" />
      <line x1="0" y1={(3 * h) / 4} x2={w} y2={(3 * h) / 4} stroke="rgba(148,163,184,0.18)" strokeWidth="1" />

      {/* fill + line */}
      <path d={areaD} fill="url(#sparkFill)" />
      <path d={lineD} fill="none" stroke={up ? 'rgb(34,197,94)' : 'rgb(239,68,68)'} strokeWidth="2.5" />
    </svg>
  );
}
