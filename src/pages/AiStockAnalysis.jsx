import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

function usePageMeta({ title, description, canonical }) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description);
    }
    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', canonical);
    }
  }, [title, description, canonical]);
}

export default function AiStockAnalysis() {
  const navigate = useNavigate();

  usePageMeta({
    title: 'AI Stock Analysis Platform | TickWise',
    description:
      'TickWise is an AI stock analysis platform that combines technical indicators, fundamentals, and ML forecasts to surface clear Buy/Hold/Sell signals.',
    canonical: 'https://tickwisetech.com/ai-stock-analysis/'
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white text-slate-900">
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-white text-xs text-slate-600">
          AI stock analysis for research-driven decisions
        </div>
        <h1 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight">
          AI Stock Analysis That Explains the Signal
        </h1>
        <p className="mt-4 text-lg text-slate-600 max-w-3xl">
          TickWise is an AI stock analysis platform built for clarity. We blend machine-learning
          forecasts with technical and fundamental signals, then rank each ticker with a single
          interpretable score. The result is a daily view of Buy, Hold, and Sell opportunities
          across the market.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/picks/')}
            className="bg-cyan-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-cyan-700 transition shadow-lg shadow-cyan-600/20 inline-flex items-center gap-2"
          >
            View Today&apos;s Picks <ArrowRight size={18} />
          </button>
          <button
            onClick={() => navigate('/stock-analysis-tools/')}
            className="border border-slate-200 bg-white px-6 py-3 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Explore Stock Analysis Tools
          </button>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: 'Multi-signal scoring',
              text: 'Combine technical momentum, fundamental health, and ML forecasts into one score you can compare across tickers.'
            },
            {
              title: 'Forecast range, not just a point',
              text: 'See projected 1-month ranges (P5 / P95) alongside the mean forecast to understand risk.'
            },
            {
              title: 'Explainable at-a-glance',
              text: 'Tabs break down recommendation, technical signals, and fundamentals so you can understand why.'
            }
          ].map((card) => (
            <div key={card.title} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="text-sm text-slate-500">Feature</div>
              <div className="mt-2 text-lg font-semibold">{card.title}</div>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{card.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
          <h2 className="text-2xl md:text-3xl font-semibold">How TickWise does AI stock analysis</h2>
          <div className="mt-6 grid md:grid-cols-3 gap-6">
            <Step n="01" title="Collect data" text="We pull price history, indicator signals, and fundamental factors for covered stocks." />
            <Step n="02" title="Model & score" text="ML models forecast the next 1-month range while technical and fundamental signals generate scores." />
            <Step n="03" title="Rank & explain" text="TickWise blends signals into a single score and exposes the drivers in a clean UI." />
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-2 gap-6">
          <Faq
            q="What makes TickWise different from basic stock screeners?"
            a="TickWise combines ML forecasts with technical and fundamental signals and summarizes them into a single score, while still exposing the underlying metrics."
          />
          <Faq
            q="Is TickWise financial advice?"
            a="No. TickWise provides informational signals to support your research. You should do your own due diligence."
          />
          <Faq
            q="How often is the analysis updated?"
            a="Daily after market close, depending on the data pipeline schedule."
          />
          <Faq
            q="Can I see details for a specific ticker?"
            a="Yes. Click a ticker to see its chart, forecast lines, and technical/fundamental details."
          />
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="rounded-3xl bg-slate-900 text-white p-8 md:p-10 shadow-lg shadow-slate-900/20 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute bottom-0 left-10 h-40 w-40 rounded-full bg-cyan-500/20 blur-2xl" />

          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 text-sm text-white/80">
                <CheckCircle2 size={16} />
                No setup - Instant insights
              </div>
              <h3 className="mt-3 text-2xl md:text-3xl font-bold tracking-tight">
                Ready to explore AI stock analysis?
              </h3>
              <p className="mt-2 text-white/80 max-w-xl">
                Open the dashboard to view Buy and Sell picks, forecasts, and the metrics behind each score.
              </p>
            </div>

            <button
              onClick={() => navigate('/picks/')}
              className="bg-white text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-slate-100 transition inline-flex items-center gap-2"
            >
              View Today&apos;s Picks <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      <footer className="text-center text-sm text-slate-500 py-10">
        Copyright {new Date().getFullYear()} TickWise · AI Stock Analysis
      </footer>
    </main>
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

function Faq({ q, a }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-6 shadow-sm">
      <div className="font-semibold">{q}</div>
      <div className="mt-2 text-sm text-slate-600 leading-relaxed">{a}</div>
    </div>
  );
}
