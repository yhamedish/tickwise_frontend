// Landing.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PieChart } from 'lucide-react';
import StockChart from '../StockChart';
import {
  loadAiStockAnalysisPage,
  loadDashboardPage,
  loadStockAnalysisToolsPage,
} from '../routeLoaders';
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

const LANDING_BACKTEST_LOOKBACK_DAYS = 120;
const LANDING_BACKTEST_TOP_COUNT = 15;
const LANDING_BACKTEST_ENTRY_THRESHOLD = 70;
const LANDING_BACKTEST_TECH_THRESHOLD = 70;
const LANDING_BACKTEST_TAKE_PROFIT_PCT = 20;

export default function Landing() {
  const preloadDashboard = () => {
    loadDashboardPage();
  };

  const preloadAiStockAnalysis = () => {
    loadAiStockAnalysisPage();
  };

  const preloadStockAnalysisTools = () => {
    loadStockAnalysisToolsPage();
  };

  const [stocksData, setStocksData] = useState([]);
  const [loadingStocks, setLoadingStocks] = useState(true);

  const base = import.meta.env.VITE_GCS_PUBLIC_BASE;
  const scoresUrl = base ? `${base}/today_recommendations.json` : '';
  const histUrl = base ? `${base}/hist_recommendations.json` : '';


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

  useEffect(() => {
    let cancelled = false;
    const preload = () => {
      if (cancelled) return;
      preloadDashboard();
    };

    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(preload, { timeout: 1500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }

    const timeoutId = window.setTimeout(preload, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

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
    const rows = [];
    const n = Math.max(topBuys.length, topSells.length);
    for (let i = 0; i < n; i++) {
      if (topBuys[i]) rows.push(topBuys[i]);
      if (topSells[i]) rows.push(topSells[i]);
    }
    return rows.slice(0, 10);
  }, [topBuys, topSells]);

  const normalizeToISODate = (value) => {
    if (value == null) return "";
    if (value instanceof Date && !isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }
    const s = String(value).trim();
    if (/^\d+(\.\d+)?$/.test(s)) {
      const n = Number(s);
      const ms = n >= 1e11 ? n : n * 1000;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  };

  const addDays = (dateLike, days) => {
    const iso = normalizeToISODate(dateLike);
    if (!iso) return dateLike;
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const getHistDate = (row) =>
    normalizeToISODate(
      row?.Date_y ?? row?.Date_x ?? row?.analysis_date ?? row?.date ?? row?.Date ?? row?.time
    );
  const buyCount = useMemo(
    () => stocksData.filter((s) => s.recommendation?.toLowerCase() === 'buy').length,
    [stocksData]
  );
  const holdCount = useMemo(
    () => stocksData.filter((s) => s.recommendation?.toLowerCase() === 'hold').length,
    [stocksData]
  );
  const sellCount = useMemo(
    () => stocksData.filter((s) => s.recommendation?.toLowerCase() === 'sell').length,
    [stocksData]
  );
  const previewAsOf = useMemo(() => {
    const dates = stocksData
      .map((row) => getHistDate(row))
      .filter(Boolean)
      .sort();
    return dates.length ? dates[dates.length - 1] : '';
  }, [stocksData]);
  const stats = useMemo(
    () => [
      {
        label: 'Coverage',
        value: 'S&P 500',
      },
      {
        label: 'Signals today',
        value: `${buyCount} Buy / ${holdCount} Hold / ${sellCount} Sell`,
      },
      {
        label: 'Data updated',
        value: previewAsOf || 'After market close',
      },
    ],
    [stocksData.length, buyCount, holdCount, sellCount, previewAsOf]
  );
  const fmtPct = (x) => {
    const n = Number(x);
    if (!Number.isFinite(n)) return '-';
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
    return topBuys?.[0] || topSells?.[0] || null;
  }, [topBuys, topSells]);

  const [histData, setHistData] = useState([]);
  const [backtestPick, setBacktestPick] = useState(null);
  const [backtestPrice, setBacktestPrice] = useState([]);
  const [backtestPriceTicker, setBacktestPriceTicker] = useState('');
  const [backtestScoreSeries, setBacktestScoreSeries] = useState([]);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestSummary, setBacktestSummary] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!base) {
        setHistData([]);
        return;
      }
      try {
        const res = await fetch(histUrl);
        if (!res.ok) throw new Error(`Failed to fetch ${histUrl}: ${res.status} ${res.statusText}`);
        const json = await res.json();
        setHistData(Array.isArray(json) ? json : []);
      } catch (e) {
        console.error('Landing history failed to load:', e);
        setHistData([]);
      }
    };
    fetchHistory();
  }, [base, histUrl]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!Array.isArray(histData) || histData.length === 0 || !base) {
        setBacktestPick(null);
        setBacktestPrice([]);
        setBacktestPriceTicker('');
        setBacktestSummary(null);
        setBacktestScoreSeries([]);
        return;
      }

      const buys = histData
        .map((row) => ({ row, date: getHistDate(row) }))
        .filter(
          (x) =>
            x.date &&
            x.row?.recommendation?.toLowerCase() === 'buy' &&
            Number(x.row?.tickwise_score) > LANDING_BACKTEST_ENTRY_THRESHOLD
        );

      const dates = Array.from(new Set(buys.map((b) => b.date))).sort();
      if (!dates.length) {
          setBacktestPick(null);
          setBacktestPrice([]);
          setBacktestPriceTicker('');
          setBacktestSummary(null);
          setBacktestScoreSeries([]);
          return;
        }

      const targetAnchor = addDays(new Date(), -LANDING_BACKTEST_LOOKBACK_DAYS);
      let targetDate = dates[0];
      for (let i = 0; i < dates.length; i += 1) {
        if (dates[i] <= targetAnchor) targetDate = dates[i];
      }

      const dayRows = buys.filter((b) => b.date === targetDate).map((b) => b.row);
      dayRows.sort((a, b) => (Number(b.tickwise_score) || 0) - (Number(a.tickwise_score) || 0));
      const unique = new Map();
      dayRows.forEach((r) => {
        const t = r?.ticker;
        if (!t) return;
        if (!unique.has(t)) unique.set(t, r);
      });
      const candidates = Array.from(unique.values()).slice(0, LANDING_BACKTEST_TOP_COUNT);
      if (!candidates.length) {
        setBacktestPick(null);
        setBacktestPrice([]);
        setBacktestPriceTicker('');
        setBacktestSummary(null);
        setBacktestScoreSeries([]);
        return;
      }

      const buildHistoryMap = (rows) => {
        const byDate = new Map();
        const openByDate = new Map();
        rows.forEach((r) => {
          const t = normalizeToISODate(r?.date ?? r?.Date ?? r?.time ?? r?.Time);
          const c = Number(r?.Close ?? r?.close);
          const o = Number(r?.Open ?? r?.open);
          if (!t) return;
          if (Number.isFinite(c)) byDate.set(t, c);
          if (Number.isFinite(o)) openByDate.set(t, o);
        });
        const datesArr = Array.from(byDate.keys()).sort();
        const openDates = Array.from(openByDate.keys()).sort();
        return { byDate, dates: datesArr, openByDate, openDates };
      };

      const buildTechnicalMap = (ticker) => {
        const techByDate = new Map();
        histData.forEach((r) => {
          if (r?.ticker !== ticker) return;
          const t = getHistDate(r);
          const v = Number(r?.technical);
          if (!t || !Number.isFinite(v)) return;
          techByDate.set(t, v);
        });
        const datesArr = Array.from(techByDate.keys()).sort();
        return { techByDate, dates: datesArr };
      };

      const findOpenAfter = (datesArr, openByDate, target) => {
        if (!datesArr.length) return null;
        let lo = 0;
        let hi = datesArr.length - 1;
        let startIdx = datesArr.length;
        while (lo <= hi) {
          const mid = Math.floor((lo + hi) / 2);
          const d = datesArr[mid];
          if (d > target) {
            startIdx = mid;
            hi = mid - 1;
          } else {
            lo = mid + 1;
          }
        }
        for (let i = startIdx; i < datesArr.length; i += 1) {
          const d = datesArr[i];
          const o = openByDate.get(d);
          if (Number.isFinite(o)) {
            return { date: d, price: o };
          }
        }
        return null;
      };

      const findFirstTechDrop = (techDates, techByDate, startDate, threshold) => {
        for (let i = 0; i < techDates.length; i += 1) {
          const d = techDates[i];
          if (d < startDate) continue;
          const v = techByDate.get(d);
          if (Number.isFinite(v) && v < threshold) return d;
        }
        return null;
      };

      const findFirstReturnAbove = (datesArr, byDate, startDate, entryPrice, thresholdPct) => {
        if (!datesArr.length || !Number.isFinite(entryPrice)) return null;
        for (let i = 0; i < datesArr.length; i += 1) {
          const d = datesArr[i];
          if (d < startDate) continue;
          const price = byDate.get(d);
          if (!Number.isFinite(price)) continue;
          const retPct = ((price - entryPrice) * 100) / entryPrice;
          if (retPct > thresholdPct) return d;
        }
        return null;
      };

      const findCloseAtOrBefore = (datesArr, byDate, target) => {
        if (!datesArr.length) return null;
        let lo = 0;
        let hi = datesArr.length - 1;
        let best = null;
        while (lo <= hi) {
          const mid = Math.floor((lo + hi) / 2);
          const d = datesArr[mid];
          if (d <= target) {
            best = d;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        return best ? byDate.get(best) : null;
      };

      setBacktestLoading(true);
      try {
        const picks = candidates.map((row) => ({ date: targetDate, row }));
        const tickers = Array.from(new Set(picks.map((p) => p.row?.ticker).filter(Boolean)));
        const historyCache = new Map();
        const technicalCache = new Map();

        const getHistoryForTicker = async (ticker) => {
          if (!ticker) return null;
          if (historyCache.has(ticker)) return historyCache.get(ticker);
          try {
            const historyUrl = `${base}/data/${ticker}.json`;
            const res = await fetch(historyUrl);
            if (!res.ok) throw new Error(`Failed to fetch ${historyUrl}`);
            const json = await res.json();
            const formatted = Array.isArray(json)
              ? json
                  .map((item) => ({
                    time: normalizeToISODate(item.date ?? item.Date ?? item.time ?? item.Time),
                    open: Number(item.Open),
                    high: Number(item.High),
                    low: Number(item.Low),
                    close: Number(item.Close),
                    volume: Number(item.Volume) || 0,
                  }))
                  .filter((r) => r.time)
              : [];
            const map = buildHistoryMap(formatted);
            const payload = { ...map, formatted };
            historyCache.set(ticker, payload);
            return payload;
          } catch (e) {
            console.error('Backtest candidate load failed:', ticker, e);
            historyCache.set(ticker, null);
            return null;
          }
        };

        const getTechnicalForTicker = (ticker) => {
          if (!ticker) return null;
          if (technicalCache.has(ticker)) return technicalCache.get(ticker);
          const techMap = buildTechnicalMap(ticker);
          technicalCache.set(ticker, techMap);
          return techMap;
        };

        await Promise.all(
          tickers.map(async (ticker) => {
            await getHistoryForTicker(ticker);
            getTechnicalForTicker(ticker);
          })
        );

        const getTopPickOnOrAfter = (startDate, excludeTickers = new Set()) => {
          if (!startDate || !dates.length) return null;
          let lo = 0;
          let hi = dates.length - 1;
          let startIdx = dates.length;
          while (lo <= hi) {
            const mid = Math.floor((lo + hi) / 2);
            const d = dates[mid];
            if (d >= startDate) {
              startIdx = mid;
              hi = mid - 1;
            } else {
              lo = mid + 1;
            }
          }
          for (let i = startIdx; i < dates.length; i += 1) {
            const d = dates[i];
            const rowsForDate = buys
              .filter((b) => b.date === d)
              .map((b) => b.row)
              .sort((a, b) => (Number(b.tickwise_score) || 0) - (Number(a.tickwise_score) || 0));
            for (let j = 0; j < rowsForDate.length; j += 1) {
              const row = rowsForDate[j];
              const ticker = row?.ticker;
              if (!ticker || excludeTickers.has(ticker)) continue;
              return { date: d, row };
            }
          }
          return null;
        };

        const returns = [];
        const detailRows = [];
        const chainSummaries = [];
        const initialPortfolio = new Set(picks.map((p) => p.row?.ticker).filter(Boolean));
        const globalUsed = new Set(initialPortfolio);

        for (const pick of picks) {
          const { date, row } = pick;
          const ticker = row?.ticker;
          if (!ticker) continue;

          let currentDate = date;
          let currentRow = row;
          let cumulative = 1;
          let lastExitPrice = null;
          let firstLegBuyDate = null;
          let tradeCount = 0;

          while (currentRow && tradeCount < 20) {
            const currentTicker = currentRow?.ticker;
            if (!currentTicker) break;

            let hist = historyCache.get(currentTicker);
            if (hist === undefined) {
              hist = await getHistoryForTicker(currentTicker);
            }
            if (!hist) break;

            const buyOpen = findOpenAfter(hist.openDates || [], hist.openByDate, currentDate);
            if (!buyOpen || !Number.isFinite(buyOpen.price)) break;
            const buyDate = buyOpen.date;
            const entryPrice = buyOpen.price;
            if (firstLegBuyDate == null) firstLegBuyDate = buyDate;

            const latestDate = hist.dates[hist.dates.length - 1];
            const latestClose = latestDate ? hist.byDate.get(latestDate) : null;
            if (!Number.isFinite(latestClose)) break;

            let exitDate = latestDate;
            let exitPrice = latestClose;
            const exits = [];

            const tech = getTechnicalForTicker(currentTicker);
            if (tech?.dates?.length) {
              const sellSignalDate = findFirstTechDrop(
                tech.dates,
                tech.techByDate,
                buyDate,
                LANDING_BACKTEST_TECH_THRESHOLD
              );
              if (sellSignalDate) {
                const sellOpen = findOpenAfter(hist.openDates || [], hist.openByDate, sellSignalDate);
                if (sellOpen && Number.isFinite(sellOpen.price)) {
                  exits.push({ triggerDate: sellSignalDate, date: sellOpen.date, price: sellOpen.price });
                }
              }
            }

            const takeProfitSignalDate = findFirstReturnAbove(
              hist.dates,
              hist.byDate,
              buyDate,
              entryPrice,
              LANDING_BACKTEST_TAKE_PROFIT_PCT
            );
            if (takeProfitSignalDate) {
              const sellOpen = findOpenAfter(hist.openDates || [], hist.openByDate, takeProfitSignalDate);
              if (sellOpen && Number.isFinite(sellOpen.price)) {
                exits.push({ triggerDate: takeProfitSignalDate, date: sellOpen.date, price: sellOpen.price });
              }
            }

            if (exits.length) {
              exits.sort((a, b) => {
                if (a.triggerDate < b.triggerDate) return -1;
                if (a.triggerDate > b.triggerDate) return 1;
                if (a.date < b.date) return -1;
                if (a.date > b.date) return 1;
                return 0;
              });
              exitDate = exits[0].date;
              exitPrice = exits[0].price;
            }

            cumulative *= exitPrice / entryPrice;
            lastExitPrice = exitPrice;
            detailRows.push({
              ticker: currentTicker,
              currentReturn: ((exitPrice - entryPrice) * 100) / entryPrice,
              buyDate,
              exitDate,
            });

            if (!exits.length || !exitDate || exitDate >= latestDate) break;

            const nextPick = getTopPickOnOrAfter(exitDate, globalUsed);
            if (!nextPick) break;

            currentDate = nextPick.date;
            currentRow = nextPick.row;
            if (currentRow?.ticker) globalUsed.add(currentRow.ticker);
            tradeCount += 1;
          }

          if (lastExitPrice == null) {
            continue;
          }

          const chainReturn = (cumulative - 1) * 100;
          returns.push(chainReturn);
          chainSummaries.push({
            startRow: row,
            startDate: date,
            buyDate: firstLegBuyDate,
            returnPct: chainReturn,
          });
        }

        if (!returns.length) {
          setBacktestPick(null);
          setBacktestPrice([]);
          setBacktestPriceTicker('');
          setBacktestScoreSeries([]);
          setBacktestSummary(null);
          return;
        }

        const avg = returns.reduce((s, v) => s + v, 0) / returns.length;
        const sorted = [...returns].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        const tradedReturns = detailRows
          .map((row) => Number(row?.currentReturn))
          .filter((r) => Number.isFinite(r));
        const winRateBase = tradedReturns.length ? tradedReturns : returns;
        const wins = winRateBase.filter((r) => r > 0).length;
        setBacktestSummary({
          avg,
          median,
          winRate: (wins / winRateBase.length) * 100,
          sample: winRateBase.length,
          date: targetDate,
        });

        chainSummaries.sort((a, b) => b.returnPct - a.returnPct);
        const best = chainSummaries[0];
        if (cancelled) return;

        setBacktestPick({ date: best.buyDate || best.startDate, row: best.startRow });
        setBacktestPrice([]);
        setBacktestPriceTicker('');

        const scoreSeries = histData
          .filter((r) => r?.ticker === best.startRow?.ticker)
          .map((r) => ({
            time: getHistDate(r),
            value: Number(r.tickwise_score),
          }))
          .filter((p) => p.time && Number.isFinite(p.value))
          .sort((a, b) => (a.time < b.time ? -1 : 1));

        setBacktestScoreSeries(scoreSeries);
      } finally {
        if (!cancelled) setBacktestLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [histData, base]);

  useEffect(() => {
    const run = async () => {
      if (!base || !backtestPick?.row?.ticker) {
        setBacktestPrice([]);
        return;
      }
      if (backtestPriceTicker === backtestPick.row.ticker && backtestPrice.length) {
        return;
      }
      setBacktestLoading(true);
      try {
        const historyUrl = `${base}/data/${backtestPick.row.ticker}.json`;
        const res = await fetch(historyUrl);
        if (!res.ok) throw new Error(`Failed to fetch ${historyUrl}: ${res.status} ${res.statusText}`);
        const json = await res.json();
        const formatted = Array.isArray(json)
          ? json
              .map((item) => {
                const rawTime = item.date ?? item.Date ?? item.time ?? item.Time;
                const dateStr = normalizeToISODate(rawTime);
                return {
                  time: dateStr,
                  open: Number(item.Open),
                  high: Number(item.High),
                  low: Number(item.Low),
                  close: Number(item.Close),
                  volume: Number(item.Volume) || 0,
                };
              })
              .filter((r) => r.time)
          : [];

        setBacktestPrice(formatted);
        setBacktestPriceTicker(backtestPick.row.ticker);
      } catch (e) {
        console.error('Backtest preview history load failed:', e);
        setBacktestPrice([]);
      } finally {
        setBacktestLoading(false);
      }
    };

    run();
  }, [base, backtestPick, backtestPrice, backtestPriceTicker]);  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white text-slate-900 relative overflow-hidden">
      {/* Background blobs */}
      <div className="pointer-events-none absolute -top-28 -left-28 h-[420px] w-[420px] rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute top-32 -right-28 h-[420px] w-[420px] rounded-full bg-indigo-200/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-[520px] w-[520px] rounded-full bg-sky-100/50 blur-3xl" />

      {/* Top Nav */}
      <header className="max-w-6xl mx-auto px-6 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              <img
                src="/tickwise_logo.png"
                alt="TickWise logo"
                className="h-full w-full object-cover"
              />
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
            <Link
              to="/ai-stock-analysis/"
              onMouseEnter={preloadAiStockAnalysis}
              onFocus={preloadAiStockAnalysis}
              className="hover:text-slate-900 transition"
            >
              AI Stock Analysis
            </Link>
            <Link
              to="/stock-analysis-tools/"
              onMouseEnter={preloadStockAnalysisTools}
              onFocus={preloadStockAnalysisTools}
              className="hover:text-slate-900 transition"
            >
              Stock Analysis Tools
            </Link>
            <a href="mailto:support@tickwisetech.com?subject=TickWise%20Feedback"
            className="hover:text-slate-900">
            Contact
            </a>

            <a className="hover:text-slate-900 transition" href="#faq">
              FAQ
            </a>

            <Link
              to="/picks/"
              onMouseEnter={preloadDashboard}
              onFocus={preloadDashboard}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
            >
              View Today's Picks
            </Link>
          </div>

          {/* Mobile CTA */}
          <Link
            to="/picks/"
            onMouseEnter={preloadDashboard}
            onFocus={preloadDashboard}
            className="md:hidden bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
          >
            Picks
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white/70 text-sm text-slate-600 shadow-sm backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Daily AI signals - Updated after market close
          <span className="inline-flex items-center gap-1 text-slate-500">
            <Sparkles size={14} />
          </span>
        </div>

        <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
          Smarter Stock Picks, Powered by AI
        </h1>

        <p className="mt-4 text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
          TickWise analyzes fundamental data, technical signals, and AI forecasts
          to deliver clear Buy / Hold / Sell insights - daily.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/picks/"
            onMouseEnter={preloadDashboard}
            onFocus={preloadDashboard}
            className="w-full sm:w-auto bg-blue-600 text-white px-8 py-3 rounded-xl text-lg font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 inline-flex items-center justify-center gap-2"
          >
            Open Dashboard <ArrowRight size={18} />
          </Link>

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

      {/* Backtest summary */}
      <section className="max-w-6xl mx-auto px-6 pb-10">
        <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Backtest Snapshot</div>
              <div className="text-lg font-semibold">Top 15 buys from 120 days ago</div>
            </div>
            <div className="text-xs text-slate-500">
              {backtestSummary?.date ? `As of ${backtestSummary.date}` : 'Loading history'}
            </div>
          </div>
          {backtestLoading && (
            <div className="text-sm text-slate-600">Calculating recent performance...</div>
          )}
          {!backtestLoading && backtestSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <div className="text-xs text-emerald-700">Avg Return</div>
                <div className="mt-1 text-2xl font-semibold text-emerald-900">
                  {fmtPct(backtestSummary.avg)}
                </div>
              </div>
              <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-4">
                <div className="text-xs text-cyan-700">Median Return</div>
                <div className="mt-1 text-2xl font-semibold text-cyan-900">
                  {fmtPct(backtestSummary.median)}
                </div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="text-xs text-amber-700">Win Rate</div>
                <div className="mt-1 text-2xl font-semibold text-amber-900">
                  {fmtPct(backtestSummary.winRate)}
                </div>
                <div className="text-xs text-amber-700 mt-1">
                  Sample size: {backtestSummary.sample}
                </div>
              </div>
            </div>
          )}
          {!backtestLoading && !backtestSummary && (
            <div className="text-sm text-slate-600">Not enough data for a backtest snapshot.</div>
          )}
        </div>
      </section>

      {/* Product preview */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="rounded-3xl border border-slate-200 bg-white/70 backdrop-blur shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LineChart className="text-blue-600" size={20} />
              <div className="font-semibold">Today's Signal Snapshot</div>
              <span className="text-xs text-slate-500 hidden sm:inline">
                {previewAsOf ? `As of ${previewAsOf}` : 'Preview'}
              </span>
            </div>
            <div className="text-xs text-slate-500">Click "View Today's Picks" for live data</div>
          </div>

          <div className="grid lg:grid-cols-5 gap-0">
            {/* Left: mini table */}
            <div className="lg:col-span-3 p-6">
              <div className="grid grid-cols-12 text-xs text-slate-500 pb-3 border-b border-slate-200">
                <div className="col-span-2">Ticker</div>
                <div className="col-span-4">Security</div>
                <div className="col-span-2">Signal</div>
                <div className="col-span-2 text-right">TickWise Score</div>
                <div className="col-span-2 text-right">1M AI</div>
              </div>

              {loadingStocks && (
                <div className="py-6 text-sm text-slate-500">Loading live preview...</div>
                )}

                {!loadingStocks && previewRows.length === 0 && (
                <div className="py-6 text-sm text-slate-500">
                    Live preview unavailable. Click "View Today's Picks" to see the dashboard.
                </div>
                )}

                {!loadingStocks && previewRows.map((stock) => {
                const ticker = stock.ticker;
                const security = stock.Security || stock.company || '-';
                const sig = stock.recommendation || '-';
                const score = Number(stock.tickwise_score);
                const aiPct = get1mAiPct(stock);
                const aiPctText = aiPct == null ? '-' : fmtPct(aiPct);
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
                        {Number.isFinite(score) ? score.toFixed(0) : '-'}
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
                  <div className="text-xs text-slate-500">Backtest top pick</div>
                  <div className="text-lg font-semibold">{backtestPick?.row?.ticker || "-"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 text-xs text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-orange-400" />
                    Buy trigger
                  </span>
                  <span className="inline-flex items-center gap-2 text-xs text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    TickWise score
                  </span>
                </div>
              </div>

                            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs text-slate-500 mb-2">
                  {backtestPick
                    ? `Backtest top pick: ${backtestPick.row.ticker} (buy on ${backtestPick.date})`
                    : 'Backtest preview'}
                </div>

                {backtestLoading ? (
                  <div className="h-[180px] rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white animate-pulse" />
                ) : backtestPick && backtestPrice.length ? (
                  <StockChart
                    ticker={backtestPick.row.ticker}
                    priceData={backtestPrice}
                    mlForecast={[]}
                    mlForecastP5={[]}
                    mlForecastP95={[]}
                    analystForecast={[]}
                    mlHistory={[]}
                    scoreSeries={[
                      {
                        name: 'TickWise Score',
                        color: '#0ea5e9',
                        data: backtestScoreSeries.map((p) => [p.time, p.value]),
                      },
                    ]}
                    eventMarkers={[{ time: backtestPick.date, label: 'Buy', color: '#f97316' }]}
                    height={240}
                  />
                ) : (
                  <div className="h-[180px] rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white grid place-items-center text-xs text-slate-500">
                    Backtest preview unavailable
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <Metric
                    label="TickWise"
                    value={
                      Number.isFinite(Number(backtestPick?.row?.tickwise_score))
                        ? `${Number(backtestPick.row.tickwise_score).toFixed(0)}`
                        : '-'
                    }
                    tone="good"
                  />
                  <Metric
                    label="Technical"
                    value={
                      Number.isFinite(Number(backtestPick?.row?.technical))
                        ? `${Number(backtestPick.row.technical).toFixed(1)}%`
                        : '-'
                    }
                    tone="good"
                  />
                  <Metric
                    label="Fundamental"
                    value={
                      Number.isFinite(Number(backtestPick?.row?.fundamental_score))
                        ? `${Number(backtestPick.row.fundamental_score).toFixed(1)}%`
                        : '-'
                    }
                    tone="good"
                  />
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-500 leading-relaxed">
                Preview only. Your dashboard shows full history, zoomable charts, and forecast lines.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEO bridge */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur p-8 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">AI Stock Analysis</div>
            <h3 className="mt-2 text-2xl font-semibold">Understand signals, not just prices</h3>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              TickWise is an AI stock analysis platform that blends ML forecasts with technical
              and fundamental signals. See why a ticker is rated Buy, Hold, or Sell.
            </p>
            <Link
              to="/ai-stock-analysis/"
              onMouseEnter={preloadAiStockAnalysis}
              onFocus={preloadAiStockAnalysis}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-800"
            >
              Learn about AI Stock Analysis <ArrowRight size={16} />
            </Link>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur p-8 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">Stock Analysis Tools</div>
            <h3 className="mt-2 text-2xl font-semibold">Tools built for signal clarity</h3>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Compare forecast ranges, technical momentum, and fundamental health in one place.
              Filter, sort, and drill into the tools that matter most.
            </p>
            <Link
              to="/stock-analysis-tools/"
              onMouseEnter={preloadStockAnalysisTools}
              onFocus={preloadStockAnalysisTools}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-800"
            >
              Explore Stock Analysis Tools <ArrowRight size={16} />
            </Link>
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
                title="Analysts Forecast"
                text="Consensus analyst price targets provide a long‑horizon reality check, letting you compare ML signals against Wall Street expectations."
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

          <div className="mt-8 text-sm text-slate-600">
            The goal is clarity: fewer noisy indicators, more decision-ready signals.
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
                No setup - Instant insights
              </div>
              <h3 className="mt-3 text-2xl md:text-3xl font-bold tracking-tight">
                Ready to see today's signals?
              </h3>
              <p className="mt-2 text-white/80 max-w-xl">
                Open the dashboard to view top Buy and Sell picks and inspect charts with forecast overlays.
              </p>
            </div>

            <Link
              to="/picks/"
              onMouseEnter={preloadDashboard}
              onFocus={preloadDashboard}
              className="bg-white text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-slate-100 transition inline-flex items-center gap-2"
            >
              View Today's Picks <ArrowRight size={18} />
            </Link>
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
            q="What's inside the TickWise score?"
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
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/ai-stock-analysis/"
            onMouseEnter={preloadAiStockAnalysis}
            onFocus={preloadAiStockAnalysis}
            className="hover:text-slate-700"
          >
            AI Stock Analysis
          </Link>
          <span className="hidden sm:inline">|</span>
          <Link
            to="/stock-analysis-tools/"
            onMouseEnter={preloadStockAnalysisTools}
            onFocus={preloadStockAnalysisTools}
            className="hover:text-slate-700"
          >
            Stock Analysis Tools
          </Link>
        </div>
        <div className="mt-2">Copyright {new Date().getFullYear()} TickWise - AI-Powered Market Intelligence</div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, text }) {  return (
    <div className="bg-white/80 backdrop-blur rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition">
      <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 grid place-items-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-slate-600 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function Step({ n, title, text }) {  return (
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

function FaqItem({ q, a }) {  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-6 shadow-sm">
      <div className="font-semibold">{q}</div>
      <div className="mt-2 text-sm text-slate-600 leading-relaxed">{a}</div>
    </div>
  );
}


function Sparkline({ values, height = 140, padding = 8 }) {
  if (!values || values.length < 2) {  return (
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































