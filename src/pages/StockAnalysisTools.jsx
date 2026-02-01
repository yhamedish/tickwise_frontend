import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Wrench } from 'lucide-react';

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

export default function StockAnalysisTools() {
  const navigate = useNavigate();

  usePageMeta({
    title: 'Stock Analysis Tools | TickWise',
    description:
      'TickWise provides AI stock analysis tools: forecast ranges, technical indicators, fundamental scores, and a unified ranking to surface opportunities.',
    canonical: 'https://tickwisetech.com/stock-analysis-tools/'
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white text-slate-900">
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-white text-xs text-slate-600">
          <Wrench size={14} /> Stock analysis tools for modern investors
        </div>
        <h1 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight">
          Stock Analysis Tools Built for Signal Clarity
        </h1>
        <p className="mt-4 text-lg text-slate-600 max-w-3xl">
          TickWise gives you the stock analysis tools needed to separate signal from noise. Use
          forecast ranges, technical momentum, and fundamental strength to evaluate tickers in one
          place - no spreadsheet stitching required.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/picks/')}
            className="bg-cyan-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-cyan-700 transition shadow-lg shadow-cyan-600/20 inline-flex items-center gap-2"
          >
            See the tools in action <ArrowRight size={18} />
          </button>
          <button
            onClick={() => navigate('/ai-stock-analysis/')}
            className="border border-slate-200 bg-white px-6 py-3 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Learn about AI Stock Analysis
          </button>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-2 gap-6">
          <ToolCard
            title="Forecast range tools"
            items={[
              'ML 1-month mean forecast',
              'P5 / P95 range for risk context',
              'Analyst 1-year comparison'
            ]}
          />
          <ToolCard
            title="Technical indicator tools"
            items={[
              'Momentum metrics like RSI, MACD, ADX',
              'Moving average signals (SMA/EMA)',
              'Volatility and oscillator signals'
            ]}
          />
          <ToolCard
            title="Fundamental analysis tools"
            items={[
              'Profitability, valuation, stability scores',
              'Yield and balance sheet factors',
              'Fundamental score rollup'
            ]}
          />
          <ToolCard
            title="Ranking and scoring tools"
            items={[
              'TickWise Score for comparability',
              'Buy / Hold / Sell recommendations',
              'Daily refreshed ranking'
            ]}
          />
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
          <h2 className="text-2xl md:text-3xl font-semibold">What to look for in stock analysis tools</h2>
          <div className="mt-5 grid md:grid-cols-2 gap-6 text-sm text-slate-600">
            <div>
              <div className="font-semibold text-slate-900">1. Signal coverage</div>
              <p className="mt-2">
                The best stock analysis tools include technical, fundamental, and forecast-based
                signals. A single-source view prevents missing key drivers.
              </p>
            </div>
            <div>
              <div className="font-semibold text-slate-900">2. Transparency</div>
              <p className="mt-2">
                Tools should explain how scores are produced and surface the underlying metrics so
                you can validate the signal.
              </p>
            </div>
            <div>
              <div className="font-semibold text-slate-900">3. Contextual ranges</div>
              <p className="mt-2">
                Forecast ranges (P5/P95) add risk context beyond a single point estimate.
              </p>
            </div>
            <div>
              <div className="font-semibold text-slate-900">4. Daily refresh</div>
              <p className="mt-2">
                Markets move fast. Daily updates ensure your analysis reflects recent price and
                sentiment changes.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-2 gap-6">
          <Faq
            q="Are these stock analysis tools free?"
            a="TickWise currently provides a free dashboard with daily signals and forecasts."
          />
          <Faq
            q="Do I need to install anything?"
            a="No. The tools are web-based and available through your browser."
          />
          <Faq
            q="Can I compare multiple tickers quickly?"
            a="Yes. The table view lets you sort and filter by any score to compare tickers."
          />
          <Faq
            q="How are recommendations generated?"
            a="Recommendations blend technical, fundamental, and ML forecast signals into a single score."
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
                Try the TickWise stock analysis tools
              </h3>
              <p className="mt-2 text-white/80 max-w-xl">
                Use the dashboard to scan the market, evaluate signals, and drill into any ticker.
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
        Copyright {new Date().getFullYear()} TickWise · Stock Analysis Tools
      </footer>
    </main>
  );
}

function ToolCard({ title, items }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="text-sm text-slate-500">Toolset</div>
      <div className="mt-2 text-lg font-semibold">{title}</div>
      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
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
