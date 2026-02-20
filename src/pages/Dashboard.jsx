import React, { useEffect, useMemo, useState } from 'react';
import { List } from 'react-window';
import StockChart from '../StockChart';
import PortfolioReturnChart from '../PortfolioReturnChart';
import '../index.css';
import { BarChart2, ThumbsUp, Activity } from 'lucide-react';


// Dummy fallback data. If the call to VITE_STOCKS_JSON_SAS_URL fails, the
// application will fall back to this list. Each entry must include the same
// fields as the remote JSON: ticker, company, recommendation (Buy/Hold/Sell),
// confidence, sentiment, technical, forecast1m, analysts_forecast.
const dummyData = [
  { ticker: 'AAPL', Security: 'Apple Inc.', recommendation: 'Buy', Tickwise: 92, sentiment: 0.85, technical: 0.78, forecast1m: 5.3, analysts_forecast: 28 },
  { ticker: 'TSLA', Security: 'Tesla Inc.', recommendation: 'Hold', Tickwise: 75, sentiment: 0.4, technical: 0.5, forecast1m: -0.2, analysts_forecast: 12 },
  { ticker: 'AMZN', Security: 'Amazon.com Inc.', recommendation: 'Sell', Tickwise: 68, sentiment: -0.2, technical: 0.3, forecast1m: -3.1, analysts_forecast: 8 },
  { ticker: 'MSFT', Security: 'Microsoft Corp.', recommendation: 'Buy', Tickwise: 88, sentiment: 0.7, technical: 0.9, forecast1m: 4.7, analysts_forecast: 25 },
  { ticker: 'NFLX', Security: 'Netflix Inc.', recommendation: 'Sell', Tickwise: 70, sentiment: -0.1, technical: 0.4, forecast1m: -2.5, analysts_forecast: 10 }
];

// Helper to generate forecast lines for the chart. Takes the last close price and applies
// a percentage change.
function generateForecastLine(priceData, percentChange, days) {
  if (!priceData || priceData.length === 0) return [];
  const lastTime = priceData[priceData.length - 1].time;
  const lastClose = priceData[priceData.length - 1].close;
  const forecastValue = lastClose * (1 + percentChange / 100);
  return [
    { time: lastTime, value: lastClose },
    { time: addDays(lastTime, days), value: forecastValue },
  ];
}

// Simple date math helper used for forecasts.
function addDays(dateLike, days) {
  const iso = normalizeToISODate(dateLike);
  if (!iso) return dateLike;

  const d = new Date(iso); // iso is YYYY-MM-DD
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}


function normalizeToISODate(value) {
  if (value == null) return "";

  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const s = String(value).trim();

  // Numeric? (unix seconds or ms)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);

    // Better heuristic:
    // - seconds are ~1e9 today
    // - milliseconds are ~1e12 today, but were <1e12 before Sep 2001
    // - anything >= 1e11 is almost certainly ms (covers all ms since 1973)
    const ms = n >= 1e11 ? n : n * 1000;

    const d = new Date(ms);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }

  // ISO-ish string
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function sortRows(rows, sortConfig) {
  if (!sortConfig.key) return rows;

  const { key, direction } = sortConfig;
  const multiplier = direction === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    const va = Number(a[key]);
    const vb = Number(b[key]);

    if (isNaN(va) || isNaN(vb)) return 0;
    return (va - vb) * multiplier;
  });
}

function toNumber(value) {
  const n = Number(value);
  return isNaN(n) ? null : n;
}

function buildScoreRanges(rows) {
  const ranges = {
    tickwise_score: { min: null, max: null },
    technical: { min: null, max: null },
    fundamental_score: { min: null, max: null },
    ai1m_lower_pct: { min: null, max: null },
    ai1m_upper_pct: { min: null, max: null },
    analyst_1y_pct: { min: null, max: null },
  };

  rows.forEach(row => {
    Object.keys(ranges).forEach(key => {
      const val = toNumber(row[key]);
      if (val == null) return;
      if (ranges[key].min == null || val < ranges[key].min) ranges[key].min = val;
      if (ranges[key].max == null || val > ranges[key].max) ranges[key].max = val;
    });
  });

  return ranges;
}

function withinRange(value, range) {
  if (range.min != null && value < range.min) return false;
  if (range.max != null && value > range.max) return false;
  return true;
}

function getHistoryPointsForTicker(histData, ticker) {
  if (!histData) return [];
  const points = [];

  const pushPoint = (dateValue, forecastValue) => {
    const time = addDays(dateValue, 30);
    const value = Number(forecastValue);
    if (!time || isNaN(value)) return;
    points.push({ time, value });
  };

  const scanEntry = (entry, parentDate) => {
    if (!entry || typeof entry !== 'object') return;
    const entryDate =
      parentDate ??
      entry.Date_y ??
      entry.Date_x ??
      entry.date ??
      entry.Date ??
      entry.run_date ??
      entry.as_of ??
      entry.generated_at ??
      entry.time;

    if (Array.isArray(entry.recommendations)) {
      entry.recommendations.forEach(row => {
        if (row?.ticker !== ticker) return;
        pushPoint(row.date ?? entryDate, row.forecast1m ?? row.forecast_1m ?? row.ml_forecast_1m ?? row.prediction_1m);
      });
      return;
    }

    if (Array.isArray(entry.stocks)) {
      entry.stocks.forEach(row => {
        if (row?.ticker !== ticker) return;
        pushPoint(row.date ?? entryDate, row.forecast1m ?? row.forecast_1m ?? row.ml_forecast_1m ?? row.prediction_1m);
      });
      return;
    }

    if (entry.ticker === ticker) {
      pushPoint(
        entryDate,
        entry.forecast1m ??
          entry.forecast_1m ??
          entry.ml_forecast_1m ??
          entry.prediction_1m
      );
    }
  };

  if (Array.isArray(histData)) {
    histData.forEach(entry => scanEntry(entry, null));
  } else if (typeof histData === 'object') {
    if (Array.isArray(histData[ticker])) {
      histData[ticker].forEach(entry => scanEntry(entry, entry.date ?? entry.Date ?? entry.run_date ?? entry.as_of));
    } else {
      Object.keys(histData).forEach(key => {
        const entry = histData[key];
        scanEntry(entry, key);
      });
    }
  }

  return points.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}

function getScoreHistoryForTicker(histData, ticker) {
  if (!histData) return { tickwise: [], technical: [], fundamental: [] };
  const out = { tickwise: [], technical: [], fundamental: [] };

  const push = (series, dateValue, value) => {
    const time = normalizeToISODate(dateValue);
    const v = Number(value);
    if (!time || isNaN(v)) return;
    out[series].push({ time, value: v });
  };

  const scanEntry = (entry, parentDate) => {
    if (!entry || typeof entry !== 'object') return;
    const entryDate =
      parentDate ??
      entry.Date_y ??
      entry.Date_x ??
      entry.analysis_date ??
      entry.date ??
      entry.Date ??
      entry.run_date ??
      entry.as_of ??
      entry.generated_at ??
      entry.time;

    if (entry.ticker === ticker) {
      push('tickwise', entryDate, entry.tickwise_score);
      push('technical', entryDate, entry.technical);
      push('fundamental', entryDate, entry.fundamental_score);
    }
  };

  if (Array.isArray(histData)) {
    histData.forEach(entry => scanEntry(entry, null));
  } else if (typeof histData === 'object') {
    if (Array.isArray(histData[ticker])) {
      histData[ticker].forEach(entry =>
        scanEntry(entry, entry.date ?? entry.Date ?? entry.Date_y ?? entry.Date_x)
      );
    } else {
      Object.keys(histData).forEach(key => {
        const entry = histData[key];
        scanEntry(entry, key);
      });
    }
  }

  Object.keys(out).forEach(key => {
    out[key].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  });

  return out;
}

function SortableTH({ label, sortKey, sortConfig, setSortConfig }) {
  const isActive = sortConfig.key === sortKey;

  return (
    <th
      className="px-3 py-2 cursor-pointer select-none hover:bg-gray-200"
      onClick={() =>
        setSortConfig(prev => ({
          key: sortKey,
          direction:
            prev.key === sortKey && prev.direction === 'desc' ? 'asc' : 'desc',
        }))
      }
    >
      {label}
      {isActive && (
        <span className="ml-1 text-xs">
          {sortConfig.direction === 'asc' ? '▲' : '▼'}
        </span>
      )}
    </th>
  );
}

function SortableHeader({ label, sortKey, sortConfig, setSortConfig }) {
  const isActive = sortConfig.key === sortKey;

  return (
    <div
      className="px-3 py-2 cursor-pointer select-none hover:bg-gray-200 flex items-center"
      onClick={() =>
        setSortConfig(prev => ({
          key: sortKey,
          direction:
            prev.key === sortKey && prev.direction === 'desc' ? 'asc' : 'desc',
        }))
      }
      role="button"
      tabIndex={0}
    >
      <span>{label}</span>
      {isActive && (
        <span className="ml-1 text-xs">
          {sortConfig.direction === 'asc' ? '^' : 'v'}
        </span>
      )}
    </div>
  );
}

const StockDetailChart = React.memo(function StockDetailChart({
  stock,
  priceHistory,
  mlHistory,
  scoreHistory,
  scoreSeriesSelection
}) {
  const priceData = priceHistory[stock.ticker] || [];
  const mlForecast = useMemo(() => {
    return generateForecastLine(
      priceData,
      (stock.forecast1m - stock.Close) * 100 / stock.Close,
      30
    );
  }, [priceData, stock.forecast1m, stock.Close]);
  const mlForecastP5 = useMemo(() => {
    return generateForecastLine(
      priceData,
      (stock.forecast1m_p5 - stock.Close) * 100 / stock.Close,
      30
    );
  }, [priceData, stock.forecast1m_p5, stock.Close]);
  const mlForecastP95 = useMemo(() => {
    return generateForecastLine(
      priceData,
      (stock.forecast1m_p95 - stock.Close) * 100 / stock.Close,
      30
    );
  }, [priceData, stock.forecast1m_p95, stock.Close]);

  const analystForecast = useMemo(() => {
    return generateForecastLine(priceData, stock.analysts_forecast, 365);
  }, [priceData, stock.analysts_forecast]);

  const scoreSeries = useMemo(() => {
    const series = [];
    if (scoreSeriesSelection?.tickwise) {
      series.push({
        name: 'TickWise Score',
        color: '#0ea5e9',
        data: (scoreHistory?.tickwise || []).map((p) => [p.time, p.value]),
      });
    }
    if (scoreSeriesSelection?.technical) {
      series.push({
        name: 'Technical Score',
        color: '#f59e0b',
        data: (scoreHistory?.technical || []).map((p) => [p.time, p.value]),
      });
    }
    if (scoreSeriesSelection?.fundamental) {
      series.push({
        name: 'Fundamental Score',
        color: '#8b5cf6',
        data: (scoreHistory?.fundamental || []).map((p) => [p.time, p.value]),
      });
    }
    return series;
  }, [scoreHistory, scoreSeriesSelection]);

  return (
    <StockChart
      ticker={stock.ticker}
      priceData={priceData}
      mlForecast={mlForecast}
      mlForecastP5={mlForecastP5}
      mlForecastP95={mlForecastP95}
      mlHistory={mlHistory}
      scoreSeries={scoreSeries}
      analystForecast={analystForecast}
    />
  );
});



export default function Dashboard() {
  const [selectedTicker, setSelectedTicker] = useState(null);
  // Holds fetched historical price data for each ticker. When a user expands a row
  // we fetch the corresponding JSON from Azure Blob Storage using the container SAS URL.
  const [priceHistory, setPriceHistory] = useState({});

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'desc', // 'asc' | 'desc'
    });


  // Holds the list of stocks loaded from the top stocks JSON. This replaces
  // the hard-coded dummyData when successfully loaded.
  const [stocksData, setStocksData] = useState([]);
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [stocksError, setStocksError] = useState(null);
  const [histData, setHistData] = useState([]);
  const [loadingHist, setLoadingHist] = useState(true);
  const [backtestStats, setBacktestStats] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestLookbackDays, setBacktestLookbackDays] = useState(30);
  const [backtestTopCount, setBacktestTopCount] = useState(5);
  const [backtestUseTechStop, setBacktestUseTechStop] = useState(false);
  const [backtestTechThreshold, setBacktestTechThreshold] = useState(70);
  const [backtestUseTrailingStop, setBacktestUseTrailingStop] = useState(false);
  const [backtestTrailingStopPct, setBacktestTrailingStopPct] = useState(8);
  const [backtestUseTakeProfit, setBacktestUseTakeProfit] = useState(false);
  const [backtestTakeProfitPct, setBacktestTakeProfitPct] = useState(20);
  const [backtestRequireRisingAbove70, setBacktestRequireRisingAbove70] = useState(false);
  const [backtestResultTab, setBacktestResultTab] = useState('summary');
  const [backtestSeries, setBacktestSeries] = useState([]);
  const [predictionAccuracy, setPredictionAccuracy] = useState({
    correct: 0,
    total: 0,
    loading: false,
  });
  // Environment variable for the container SAS URL. Should look like
  // "https://<account>.blob.core.windows.net/<container>?<sas>".
  // const containerSasUrl = import.meta.env.VITE_CONTAINER_SAS_URL;
  // // Environment variable for the top stocks JSON SAS URL. Should point directly
  // // at the JSON blob.
  // const stocksSasUrl = import.meta.env.VITE_STOCKS_JSON_SAS_URL;

  const base = import.meta.env.VITE_GCS_PUBLIC_BASE;
  const scoresUrl = `${base}/today_recommendations.json`;
  const histUrl = `${base}/hist_recommendations.json`;
  // Load top stocks once on mount. If not available or fails, fall back to dummy data.
  useEffect(() => {
    const fetchStocks = async () => {
      if (!scoresUrl) {
        console.warn('VITE_STOCKS_JSON_SAS_URL is not set. Falling back to dummy data.');
        setStocksData(dummyData);
        setLoadingStocks(false);
        return;
      }
      try {
        const response = await fetch(scoresUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch stocks data: ${response.status} ${response.statusText}`);
        }
        const json = await response.json();
        if (Array.isArray(json)) {
          setStocksData(json);
        } else {
          console.warn('Stocks JSON did not return an array. Falling back to dummy data.');
          setStocksData(dummyData);
        }
      } catch (err) {
        console.error('Error fetching stocks JSON:', err);
        setStocksError(err);
        setStocksData(dummyData);
      } finally {
        setLoadingStocks(false);
      }
    };
    fetchStocks();
  }, [scoresUrl]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!histUrl) {
        setHistData([]);
        setLoadingHist(false);
        return;
      }
      try {
        const response = await fetch(histUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch history data: ${response.status} ${response.statusText}`);
        }
        const json = await response.json();
        setHistData(Array.isArray(json) ? json : json ?? []);
      } catch (err) {
        console.error('Error fetching history JSON:', err);
        setHistData([]);
      } finally {
        setLoadingHist(false);
      }
    };
    fetchHistory();
  }, [histUrl]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!base || !Array.isArray(histData) || histData.length === 0) {
        setPredictionAccuracy({ correct: 0, total: 0, loading: false });
        return;
      }

      const getHistDate = (row) =>
        normalizeToISODate(row?.Date_y ?? row?.Date_x ?? row?.analysis_date ?? row?.date ?? row?.Date);

      const buildCloseMap = (rows) => {
        const byDate = new Map();
        rows.forEach((r) => {
          const d = normalizeToISODate(r?.date ?? r?.Date ?? r?.time ?? r?.Time);
          const c = Number(r?.Close ?? r?.close);
          if (!d || !Number.isFinite(c)) return;
          byDate.set(d, c);
        });
        const dates = Array.from(byDate.keys()).sort();
        return { dates, byDate };
      };

      const findCloseAtOrAfter = (dates, byDate, target) => {
        if (!dates.length) return null;
        let lo = 0;
        let hi = dates.length - 1;
        let idx = dates.length;
        while (lo <= hi) {
          const mid = Math.floor((lo + hi) / 2);
          if (dates[mid] >= target) {
            idx = mid;
            hi = mid - 1;
          } else {
            lo = mid + 1;
          }
        }
        for (let i = idx; i < dates.length; i += 1) {
          const d = dates[i];
          const close = byDate.get(d);
          if (Number.isFinite(close)) return close;
        }
        return null;
      };

      setPredictionAccuracy((prev) => ({ ...prev, loading: true }));

      try {
        const today = normalizeToISODate(new Date());
        const dedup = new Map();
        histData.forEach((row) => {
          const ticker = row?.ticker;
          const signalDate = getHistDate(row);
          const prediction = Number(
            row?.forecast1m ?? row?.forecast_1m ?? row?.ml_forecast_1m ?? row?.prediction_1m
          );
          if (!ticker || !signalDate || !Number.isFinite(prediction)) return;
          const targetDate = addDays(signalDate, 30);
          if (!targetDate || targetDate > today) return;
          const key = `${ticker}|${signalDate}`;
          if (!dedup.has(key)) {
            dedup.set(key, { ticker, signalDate, targetDate, prediction });
          }
        });

        const predictions = Array.from(dedup.values());
        if (!predictions.length) {
          if (!cancelled) setPredictionAccuracy({ correct: 0, total: 0, loading: false });
          return;
        }

        const historyCache = new Map();
        const uniqueTickers = Array.from(new Set(predictions.map((p) => p.ticker)));

        await Promise.all(
          uniqueTickers.map(async (ticker) => {
            try {
              const historyUrl = `${base}/data/${ticker}.json`;
              const res = await fetch(historyUrl);
              if (!res.ok) throw new Error(`Failed ${historyUrl}`);
              const json = await res.json();
              historyCache.set(ticker, buildCloseMap(Array.isArray(json) ? json : []));
            } catch (e) {
              console.error('Prediction accuracy history load failed:', ticker, e);
              historyCache.set(ticker, null);
            }
          })
        );

        let correct = 0;
        let total = 0;
        predictions.forEach((p) => {
          const hist = historyCache.get(p.ticker);
          if (!hist?.dates?.length) return;
          const actual = findCloseAtOrAfter(hist.dates, hist.byDate, p.targetDate);
          if (!Number.isFinite(actual)) return;
          total += 1;
          const tolerance = Math.abs(p.prediction) * 0.1;
          if (Math.abs(actual - p.prediction) <= tolerance) correct += 1;
        });

        if (!cancelled) setPredictionAccuracy({ correct, total, loading: false });
      } catch (e) {
        console.error('Prediction accuracy calculation failed:', e);
        if (!cancelled) setPredictionAccuracy({ correct: 0, total: 0, loading: false });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [base, histData]);

  useEffect(() => {
    if (!base || !Array.isArray(histData) || histData.length === 0) return;
    const BUY_THRESHOLD = 70;

    const getHistDate = (row) =>
      normalizeToISODate(row?.Date_y ?? row?.Date_x ?? row?.analysis_date ?? row?.date ?? row?.Date);
    const buildTickerScoreHistory = (rows) => {
      const byTicker = new Map();
      rows.forEach((r) => {
        const ticker = r?.ticker;
        const date = getHistDate(r);
        const score = Number(r?.tickwise_score);
        if (!ticker || !date || !Number.isFinite(score)) return;
        if (!byTicker.has(ticker)) byTicker.set(ticker, new Map());
        byTicker.get(ticker).set(date, score);
      });
      const normalized = new Map();
      byTicker.forEach((scoreByDate, ticker) => {
        const points = Array.from(scoreByDate.entries())
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .map(([date, score]) => ({ date, score }));
        normalized.set(ticker, points);
      });
      return normalized;
    };
    const scoreHistoryByTicker = buildTickerScoreHistory(histData);
    const isRisingThreeDaysAboveThreshold = (ticker, signalDate) => {
      if (!ticker || !signalDate) return false;
      const points = scoreHistoryByTicker.get(ticker);
      if (!Array.isArray(points) || points.length < 4) return false;
      const idx = points.findIndex((p) => p.date === signalDate);
      if (idx < 3) return false;
      const s0 = points[idx - 3]?.score;
      const s1 = points[idx - 2]?.score;
      const s2 = points[idx - 1]?.score;
      const s3 = points[idx]?.score;
      if (![s0, s1, s2, s3].every((v) => Number.isFinite(v))) return false;
      return s3 > BUY_THRESHOLD && s0 < s1 && s1 < s2 && s2 < s3;
    };

    const buildHistoryMap = (rows) => {
      const byDate = new Map();
      const openByDate = new Map();
      const closeDateSet = new Set();
      const openDateSet = new Set();
      rows.forEach((r) => {
        const t = normalizeToISODate(r?.date ?? r?.Date ?? r?.time);
        if (!t) return;
        const c = Number(r?.Close ?? r?.close);
        const o = Number(r?.Open ?? r?.open);
        if (Number.isFinite(c)) {
          byDate.set(t, c);
          closeDateSet.add(t);
        }
        if (Number.isFinite(o)) {
          openByDate.set(t, o);
          openDateSet.add(t);
        }
      });
      const closeDates = Array.from(closeDateSet.keys()).sort();
      const openDates = Array.from(openDateSet.keys()).sort();
      return { byDate, openByDate, dates: closeDates, openDates };
    };
        const buildTechnicalMap = (rows, ticker) => {
          const techByDate = new Map();
          rows.forEach((r) => {
            if (r?.ticker !== ticker) return;
            const t = normalizeToISODate(r?.Date_y ?? r?.Date_x ?? r?.analysis_date ?? r?.date ?? r?.Date);
            const v = Number(r?.technical);
            if (!t || !Number.isFinite(v)) return;
            techByDate.set(t, v);
          });
          const dates = Array.from(techByDate.keys()).sort();
          return { techByDate, dates };
        };

        const findFirstTechDrop = (techDates, techByDate, startDate, threshold) => {
          for (let i = 0; i < techDates.length; i += 1) {
            const d = techDates[i];
            if (d < startDate) continue;
            const v = techByDate.get(d);
            if (v != null && v < threshold) return d;
          }
          return null;
        };
        const findTrailingStopExit = (dates, byDate, startDate, pct) => {
          if (!dates.length) return null;
          let maxPrice = null;
          for (let i = 0; i < dates.length; i += 1) {
            const d = dates[i];
            if (d < startDate) continue;
            const price = byDate.get(d);
            if (!Number.isFinite(price)) continue;
            if (maxPrice == null || price > maxPrice) {
              maxPrice = price;
              continue;
            }
            const stopPrice = maxPrice * (1 - pct / 100);
            if (price <= stopPrice) return d;
          }
          return null;
        };
        const findFirstReturnAbove = (dates, byDate, startDate, entryPrice, thresholdPct) => {
          if (!dates.length || !Number.isFinite(entryPrice)) return null;
          for (let i = 0; i < dates.length; i += 1) {
            const d = dates[i];
            if (d < startDate) continue;
            const price = byDate.get(d);
            if (!Number.isFinite(price)) continue;
            const retPct = ((price - entryPrice) * 100) / entryPrice;
            if (retPct > thresholdPct) return d;
          }
          return null;
        };

    const findCloseAtOrBefore = (dates, byDate, target) => {
      if (!dates.length) return null;
      let lo = 0;
      let hi = dates.length - 1;
      let best = null;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const d = dates[mid];
        if (d <= target) {
          best = d;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      return best ? byDate.get(best) : null;
    };
    const findOpenAfter = (dates, openByDate, target) => {
      if (!dates.length) return null;
      let lo = 0;
      let hi = dates.length - 1;
      let startIdx = dates.length;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const d = dates[mid];
        if (d > target) {
          startIdx = mid;
          hi = mid - 1;
        } else {
          lo = mid + 1;
        }
      }
      for (let i = startIdx; i < dates.length; i += 1) {
        const d = dates[i];
        const o = openByDate.get(d);
        if (Number.isFinite(o)) {
          return { date: d, price: o };
        }
      }
      return null;
    };

    const run = async () => {
      setBacktestLoading(true);
      try {
        const rows = histData
          .map((row) => ({
            row,
            date: getHistDate(row),
          }))
          .filter(
            (x) =>
              x.date &&
              x.row?.recommendation?.toLowerCase() === 'buy' &&
              Number(x.row?.tickwise_score) > BUY_THRESHOLD &&
              (!backtestRequireRisingAbove70 ||
                isRisingThreeDaysAboveThreshold(x.row?.ticker, x.date))
          );

        const byDate = new Map();
        rows.forEach(({ row, date }) => {
          if (!byDate.has(date)) byDate.set(date, []);
          byDate.get(date).push(row);
        });

        const dates = Array.from(byDate.keys()).sort();
        const targetAnchor = addDays(new Date(), -backtestLookbackDays);
        const targetDate = (() => {
          if (!dates.length) return null;
          let lo = 0;
          let hi = dates.length - 1;
          let best = dates[0];
          while (lo <= hi) {
            const mid = Math.floor((lo + hi) / 2);
            const d = dates[mid];
            if (d <= targetAnchor) {
              best = d;
              lo = mid + 1;
            } else {
              hi = mid - 1;
            }
          }
          return best;
        })();
        const dayRows = targetDate ? byDate.get(targetDate) || [] : [];
        dayRows.sort((a, b) => (Number(b.tickwise_score) || 0) - (Number(a.tickwise_score) || 0));
        const unique = new Map();
        dayRows.forEach((r) => {
          const ticker = r?.ticker;
          if (!ticker) return;
          if (!unique.has(ticker)) unique.set(ticker, r);
        });
        const picks = Array.from(unique.values()).slice(0, backtestTopCount).map((r) => ({ date: targetDate, row: r }));

        const tickers = Array.from(new Set(picks.map((p) => p.row?.ticker).filter(Boolean)));
        const historyCache = new Map();
        const technicalCache = new Map();
        const getHistoryForTicker = async (ticker) => {
          if (!ticker) return null;
          if (historyCache.has(ticker)) return historyCache.get(ticker);
          try {
            const historyUrl = `${base}/data/${ticker}.json`;
            const res = await fetch(historyUrl);
            if (!res.ok) throw new Error(`Failed ${historyUrl}`);
            const json = await res.json();
            const map = buildHistoryMap(Array.isArray(json) ? json : []);
            historyCache.set(ticker, map);
            return map;
          } catch (e) {
            console.error('Backtest history load failed:', ticker, e);
            historyCache.set(ticker, null);
            return null;
          }
        };
        const getTechnicalForTicker = (ticker) => {
          if (!ticker) return null;
          if (technicalCache.has(ticker)) return technicalCache.get(ticker);
          const techMap = buildTechnicalMap(histData, ticker);
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
            const rowsForDate = byDate.get(d) || [];
            const sorted = rowsForDate
              .slice()
              .sort((a, b) => (Number(b.tickwise_score) || 0) - (Number(a.tickwise_score) || 0));
            for (let j = 0; j < sorted.length; j += 1) {
              const row = sorted[j];
              const ticker = row?.ticker;
              if (!ticker || excludeTickers.has(ticker)) continue;
              return { date: d, row };
            }
          }
          return null;
        };

        const returns = [];
        const detailRows = [];
        const chains = [];
        let pickIndex = 0;
        const initialPortfolio = new Set(picks.map((p) => p.row?.ticker).filter(Boolean));
        const globalUsed = new Set(initialPortfolio);
        for (const pick of picks) {
          const { date, row } = pick;
          const ticker = row?.ticker;
          if (!ticker) continue;
          const maxTrades = 20;
          let tradeCount = 0;
          const chainId = pickIndex + 1;
          const chainUsed = new Set([ticker]);
          const legs = [];

          let currentDate = date;
          let currentRow = row;
          let entryPrice = null;
          let cumulative = 1;
          let lastExitDate = null;
          let lastExitPrice = null;
          let leg = 1;

          while (currentRow && tradeCount < maxTrades) {
            const currentTicker = currentRow?.ticker;
            if (!currentTicker) break;
            let hist = historyCache.get(currentTicker);
            if (hist === undefined) {
              hist = await getHistoryForTicker(currentTicker);
            }
            if (!hist) break;

            const buyOpen = findOpenAfter(hist.openDates || [], hist.openByDate, currentDate);
            if (!buyOpen) break;
            const buyDate = buyOpen.date;
            const resolvedEntryPrice = buyOpen.price;
            if (!Number.isFinite(resolvedEntryPrice)) break;
            if (entryPrice == null) entryPrice = resolvedEntryPrice;

            const latestDate = hist.dates[hist.dates.length - 1];
            const latestClose = latestDate ? hist.byDate.get(latestDate) : null;
            if (!Number.isFinite(latestClose)) break;

            let exitPrice = latestClose;
            let exitDate = latestDate;
            const exits = [];

            if (backtestUseTechStop) {
              const tech = getTechnicalForTicker(currentTicker);
              if (tech?.dates?.length) {
                const sellSignalDate = findFirstTechDrop(tech.dates, tech.techByDate, buyDate, backtestTechThreshold);
                if (sellSignalDate) {
                  const sellOpen = findOpenAfter(hist.openDates || [], hist.openByDate, sellSignalDate);
                  if (sellOpen && Number.isFinite(sellOpen.price)) {
                    exits.push({ triggerDate: sellSignalDate, date: sellOpen.date, price: sellOpen.price });
                  }
                }
              }
            }

            if (backtestUseTrailingStop) {
              const sellSignalDate = findTrailingStopExit(hist.dates, hist.byDate, buyDate, backtestTrailingStopPct);
              if (sellSignalDate) {
                const sellOpen = findOpenAfter(hist.openDates || [], hist.openByDate, sellSignalDate);
                if (sellOpen && Number.isFinite(sellOpen.price)) {
                  exits.push({ triggerDate: sellSignalDate, date: sellOpen.date, price: sellOpen.price });
                }
              }
            }
            if (backtestUseTakeProfit) {
              const sellSignalDate = findFirstReturnAbove(
                hist.dates,
                hist.byDate,
                buyDate,
                resolvedEntryPrice,
                backtestTakeProfitPct
              );
              if (sellSignalDate) {
                const sellOpen = findOpenAfter(hist.openDates || [], hist.openByDate, sellSignalDate);
                if (sellOpen && Number.isFinite(sellOpen.price)) {
                  exits.push({ triggerDate: sellSignalDate, date: sellOpen.date, price: sellOpen.price });
                }
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

            const entryValue = cumulative;
            const exitValue = entryValue * (exitPrice / resolvedEntryPrice);
            cumulative = exitValue;
            lastExitDate = exitDate;
            lastExitPrice = exitPrice;

            const legReturn = ((exitPrice - resolvedEntryPrice) * 100) / resolvedEntryPrice;
            detailRows.push({
              chainId,
              leg,
              date: buyDate,
              ticker: currentTicker,
              entryPrice: resolvedEntryPrice,
              latestClose: exitPrice,
              currentReturn: legReturn,
              exitDate,
            });
            legs.push({
              ticker: currentTicker,
              buyDate,
              buyPrice: resolvedEntryPrice,
              sellDate: exitDate,
              sellPrice: exitPrice,
              entryValue,
              exitValue,
            });

            if (!exits.length) break;
            if (!exitDate || exitDate >= latestDate) break;

            const nextSeed = exitDate;
            const exclude = new Set(globalUsed);
            const nextPick = getTopPickOnOrAfter(nextSeed, exclude);
            if (!nextPick) break;

            currentDate = nextPick.date;
            currentRow = nextPick.row;
            tradeCount += 1;
            leg += 1;
            if (currentRow?.ticker) {
              chainUsed.add(currentRow.ticker);
              globalUsed.add(currentRow.ticker);
            }

            if (!historyCache.has(currentRow?.ticker)) {
              // Lazy-load history for re-entry tickers.
              const loaded = await getHistoryForTicker(currentRow?.ticker);
              if (!loaded) break;
            }
          }

          if (entryPrice == null || lastExitPrice == null) {
            pickIndex += 1;
            continue;
          }

          const r = (cumulative - 1) * 100;
          returns.push(r);
          if (legs.length) chains.push({ chainId, legs });
          pickIndex += 1;
        }

        const getChainSnapshot = (chain, date) => {
          let currentValue = 1;
          for (let i = 0; i < chain.legs.length; i += 1) {
            const leg = chain.legs[i];
            if (date < leg.buyDate) {
              return { value: currentValue, holding: null };
            }
            if (date <= leg.sellDate) {
              const hist = historyCache.get(leg.ticker);
              const close =
                hist && hist.dates?.length
                  ? findCloseAtOrBefore(hist.dates, hist.byDate, date)
                  : null;
              const resolvedClose = Number.isFinite(close) ? close : leg.buyPrice;
              const value = leg.entryValue * (resolvedClose / leg.buyPrice);
              const returnPct = ((resolvedClose - leg.buyPrice) * 100) / leg.buyPrice;
              return { value, holding: { ticker: leg.ticker, returnPct } };
            }
            currentValue = leg.exitValue;
          }
          return { value: currentValue, holding: null };
        };

        const buildPortfolioSeries = () => {
          if (!chains.length) return [];
          const dateSet = new Set();
          chains.forEach((chain) => {
            chain.legs.forEach((leg) => {
              const hist = historyCache.get(leg.ticker);
              if (!hist?.dates?.length) return;
              hist.dates.forEach((d) => {
                if (!targetDate || d >= targetDate) dateSet.add(d);
              });
            });
          });
          const timeline = Array.from(dateSet.keys()).sort();
          return timeline.map((d) => {
            let totalValue = 0;
            const holdings = [];
            chains.forEach((chain) => {
              const snap = getChainSnapshot(chain, d);
              totalValue += snap.value;
              if (snap.holding) holdings.push(snap.holding);
            });
            const avgValue = totalValue / chains.length;
            holdings.sort((a, b) => (b.returnPct ?? 0) - (a.returnPct ?? 0));
            return { time: d, value: (avgValue - 1) * 100, holdings };
          });
        };

        const portfolioSeries = buildPortfolioSeries();

        if (returns.length === 0) {
          setBacktestStats({ sample: 0 });
          setBacktestSeries([]);
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
        const winTrades = tradedReturns.filter((r) => r > 0);
        const lossTrades = tradedReturns.filter((r) => r < 0);
        const meanWinReturn = winTrades.length
          ? winTrades.reduce((sum, r) => sum + r, 0) / winTrades.length
          : null;
        const meanLossReturn = lossTrades.length
          ? lossTrades.reduce((sum, r) => sum + r, 0) / lossTrades.length
          : null;
        const maxWinReturn = winTrades.length ? Math.max(...winTrades) : null;
        const maxLossRate = lossTrades.length ? Math.min(...lossTrades) : null;
        setBacktestStats({
          sample: winRateBase.length,
          avg,
          median,
          winRate: (wins / winRateBase.length) * 100,
          tradesCount: tradedReturns.length,
          winsCount: winTrades.length,
          lossesCount: lossTrades.length,
          meanWinReturn,
          meanLossReturn,
          maxWinReturn,
          maxLossRate,
          windowDays: backtestLookbackDays,
          picksPerDay: backtestTopCount,
          targetDate,
          detailRows,
        });
        setBacktestSeries(portfolioSeries);
      } finally {
        setBacktestLoading(false);
      }
    };

    run();
  }, [histData, base, backtestLookbackDays, backtestTopCount, backtestUseTechStop, backtestTechThreshold, backtestUseTrailingStop, backtestTrailingStopPct, backtestUseTakeProfit, backtestTakeProfitPct, backtestRequireRisingAbove70]);

  // Fetch price history on demand whenever the expanded ticker changes.
  useEffect(() => {
    if (!selectedTicker) return;
    if (priceHistory[selectedTicker]) return;
    if (!base) {
      console.warn('VITE_CONTAINER_SAS_URL is not set. Cannot fetch price history.');
      return;
    }
    const fetchHistory = async () => {
      try {
        // Split containerSasUrl into base and SAS parameters. Append the blob path
        // before the SAS to form the correct URL. This avoids placing the path
        // after the query string, which would result in authentication errors.
        // const [baseUrl, sasParams] = containerSasUrl.split('?');
        // const blobPath = `stocks/${selectedTicker}.json`;
        // const blobUrl = sasParams
        //   ? `${baseUrl.replace(/\/$/, '')}/${blobPath}?${sasParams}`
        //   : `${baseUrl.replace(/\/$/, '')}/${blobPath}`;
        // const response = await fetch(blobUrl);
        const historyUrl = `${base}/data/${selectedTicker}.json`;
        const response = await fetch(historyUrl);

        if (!response.ok) {
          throw new Error(`Failed to fetch ${blobUrl}: ${response.status} ${response.statusText}`);
        }
        const json = await response.json();
        console.log('initial')
        console.log(json)
        const formatted = Array.isArray(json)
          ? json.map(item => {
              const rawTime = item.date ?? item.Date ?? item.time ?? item.Time;
              console.log(rawTime)
              const dateStr = normalizeToISODate(rawTime);
              console.log(dateStr)

              return {
                time: dateStr,
                open: Number(item.Open),
                high: Number(item.High),
                low: Number(item.Low),
                close: Number(item.Close),
                volume: Number(item.Volume) || 0,
              };
            }).filter(r => r.time) // drop rows that didn't parse
          : [];

        setPriceHistory(prev => ({ ...prev, [selectedTicker]: formatted }));
        
      } catch (err) {
        console.error('Error loading price history:', err);
      }
    };
    fetchHistory();
  }, [selectedTicker, base, priceHistory]);
  // Compute statistics for the summary cards.
  const totalAnalyzed = stocksData.length;
  const buyCount = stocksData.filter(s => s.recommendation?.toLowerCase() === 'buy').length;
  const sellCount = stocksData.filter(s => s.recommendation?.toLowerCase() === 'sell').length;
  const holdCount = stocksData.filter(s => s.recommendation?.toLowerCase() === 'hold').length;

  const avgBuyConfidence = buyCount > 0
    ? (
        stocksData
          .filter(s => s.recommendation?.toLowerCase() === 'buy')
          .reduce((sum, s) => sum + (Number(s.tickwise_score) || 0), 0) / buyCount
      ).toFixed(1)
    : '0.0';
  const predictionAccuracyFraction = predictionAccuracy.loading
    ? 'Calculating...'
    : `${predictionAccuracy.correct}/${predictionAccuracy.total}`;
  const predictionAccuracyPct = predictionAccuracy.total
    ? ((predictionAccuracy.correct * 100) / predictionAccuracy.total).toFixed(1)
    : null;
  const backtestEntryRulesSummary = backtestRequireRisingAbove70
    ? 'TickWise > 70 + rising over previous 3 days'
    : 'TickWise > 70';
  const backtestExitRules = [];
  if (backtestUseTechStop) backtestExitRules.push(`Technical < ${backtestTechThreshold}`);
  if (backtestUseTrailingStop) backtestExitRules.push(`Trailing stop ${backtestTrailingStopPct}%`);
  if (backtestUseTakeProfit) backtestExitRules.push(`Take profit ${backtestTakeProfitPct}%`);
  const backtestExitRulesSummary = backtestExitRules.length
    ? backtestExitRules.join(' | ')
    : 'Hold to latest close';
  const sortedBacktestDetailRows = useMemo(() => {
    const rows = Array.isArray(backtestStats?.detailRows) ? backtestStats.detailRows : [];
    return [...rows].sort((a, b) => {
      const chainDiff = (a.chainId ?? 0) - (b.chainId ?? 0);
      if (chainDiff !== 0) return chainDiff;
      return (a.leg ?? 0) - (b.leg ?? 0);
    });
  }, [backtestStats]);


  // Search and filter state.
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [detailTab, setDetailTab] = useState('recommendation');
  const [scoreSeriesSelection, setScoreSeriesSelection] = useState({
    tickwise: false,
    technical: false,
    fundamental: false,
  });
  const [scoreFilters, setScoreFilters] = useState({
    tickwise_score: { min: '', max: '' },
    technical: { min: '', max: '' },
    fundamental_score: { min: '', max: '' },
    ai1m_lower_pct: { min: '', max: '' },
    ai1m_upper_pct: { min: '', max: '' },
    analyst_1y_pct: { min: '', max: '' },
  });

  const rows = stocksData.map(stock => {
    const close = Number(stock.Close) || 0;
    const ai1mLowerPct = close ? ((Number(stock.forecast1m_p5) - close) * 100) / close : 0;
    const ai1mUpperPct = close ? ((Number(stock.forecast1m_p95) - close) * 100) / close : 0;
    const analyst1yPct = close ? ((Number(stock.analysts_forecast) - close) * 100) / close : 0;

    return {
      ...stock,
      tickwise_score: Number(stock.tickwise_score),
      technical: Number(stock.technical),
      fundamental_score: Number(stock.fundamental_score),
      ai1m_lower_pct: ai1mLowerPct,
      ai1m_upper_pct: ai1mUpperPct,
      analyst_1y_pct: analyst1yPct,
    };
  });

  const scoreRanges = buildScoreRanges(rows);

  const filteredRows = sortRows(
    rows
      .filter(stock => {
        if (!filterType) return true;
        return stock.recommendation?.toLowerCase() === filterType;
      })
      .filter(stock => {
        const term = searchTerm.toLowerCase();
        return (
          stock.ticker?.toLowerCase().includes(term) ||
          stock.Security?.toLowerCase().includes(term)
        );
      })
      .filter(stock => {
        const checks = Object.keys(scoreFilters).map(key => {
          const val = toNumber(stock[key]);
          if (val == null) return true;
          const min = scoreFilters[key].min === '' ? null : Number(scoreFilters[key].min);
          const max = scoreFilters[key].max === '' ? null : Number(scoreFilters[key].max);
          return withinRange(val, { min, max });
        });
        return checks.every(Boolean);
      }),
    sortConfig
  );

  const selectedStock = rows.find(row => row.ticker === selectedTicker);
  const historicalMlPoints = useMemo(() => {
    if (!selectedTicker) return [];
    return getHistoryPointsForTicker(histData, selectedTicker);
  }, [histData, selectedTicker]);
  const scoreHistory = useMemo(() => {
    if (!selectedTicker) return { tickwise: [], technical: [], fundamental: [] };
    return getScoreHistoryForTicker(histData, selectedTicker);
  }, [histData, selectedTicker]);
  const formatPct = (value) => {
    const n = Number(value);
    if (isNaN(n)) return '-';
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toFixed(1)}%`;
  };
  const formatNum = (value, digits = 2) => {
    const n = Number(value);
    if (isNaN(n)) return '-';
    return n.toFixed(digits);
  };
  const formatPrice = (value) => {
    const n = Number(value);
    if (isNaN(n)) return '-';
    return `$${n.toFixed(2)}`;
  };
  const signalBadgeClass = (value) => {
    const v = String(value || '').toLowerCase();
    if (v === 'buy') return 'bg-emerald-500 text-white border-emerald-600 shadow-sm';
    if (v === 'sell') return 'bg-rose-500 text-white border-rose-600 shadow-sm';
    if (v === 'hold') return 'bg-amber-500 text-white border-amber-600 shadow-sm';
    return 'bg-slate-400 text-white border-slate-500 shadow-sm';
  };
  const rowHeight = 40;
  const listHeight = 240;
  const gridTemplate = '90px 220px repeat(6, minmax(110px, 1fr))';

  const Row = ({ index, style }) => {
    const stock = filteredRows[index];
    if (!stock) return null;
    const isSelected = stock.ticker === selectedTicker;
    const isStriped = index % 2 === 1;

    return (
      <div
        style={{ ...style, display: 'grid', gridTemplateColumns: gridTemplate }}
        className={`border-b border-slate-200 items-center text-sm cursor-pointer hover:bg-slate-50 ${isSelected ? 'bg-cyan-50 border-l-4 border-cyan-400' : isStriped ? 'bg-slate-50/60' : 'bg-white'}`}
        onClick={() => setSelectedTicker(stock.ticker)}
        role="button"
        tabIndex={0}
      >
        <div className="px-3 py-2 font-medium">{stock.ticker}</div>
        <div className="px-3 py-2">{stock.Security}</div>
        <div className="px-3 py-2">{Number(stock.tickwise_score).toFixed(1)}%</div>
        <div className="px-3 py-2">{Number(stock.technical).toFixed(1)}%</div>
        <div className="px-3 py-2">{Number(stock.fundamental_score).toFixed(1)}%</div>
        <div className="px-3 py-2">{Number(stock.ai1m_upper_pct).toFixed(1)}</div>
        <div className="px-3 py-2">{Number(stock.ai1m_lower_pct).toFixed(1)}</div>
        <div className="px-3 py-2">{Number(stock.analyst_1y_pct).toFixed(1)}</div>
      </div>
    );
  };

  const onFilterChange = (key, bound, value) => {
    setScoreFilters(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [bound]: value,
      },
    }));
  };

  const resetScoreFilters = () => {
    setScoreFilters({
      tickwise_score: { min: '', max: '' },
      technical: { min: '', max: '' },
      fundamental_score: { min: '', max: '' },
      ai1m_lower_pct: { min: '', max: '' },
      ai1m_upper_pct: { min: '', max: '' },
      analyst_1y_pct: { min: '', max: '' },
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-cyan-50 text-slate-900 p-6">
      <header className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <div className="h-16 w-16 rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              <img
                src="/tickwise_logo.png"
                alt="TickWise logo"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight text-slate-900">TickWise</div>
              <div className="text-xs text-slate-500">AI Powered Market Intelligence</div>
            </div>
          </a>
          <a href="/" className="text-sm text-slate-600 hover:text-slate-900">Home</a>
        </div>
      </header>
      {loadingStocks && (
        <p className="text-center text-gray-600 mb-4">Loading stock recommendations...</p>
      )}
      <section className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">
          AI-Powered Stock Picks and Buy/Sell Signals
        </h1>
        <p className="text-slate-600 max-w-3xl">
          TickWise is an AI-powered stock analysis platform that helps investors identify
          high-confidence buy and sell opportunities. It combines technical indicators,
          fundamental analysis, and machine-learning forecasts to rank stocks daily.
        </p>
      </section>

      

      {/* Statistic cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/90 border border-slate-200 border-l-4 border-cyan-500 rounded-2xl p-5 shadow-sm hover:shadow-md transition duration-300 backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="text-cyan-600">
              <BarChart2 size={28} />
            </div>
            <div>
              <div className="text-sm text-slate-600">Stocks Analyzed</div>
              <div className="text-2xl font-semibold text-slate-900">{totalAnalyzed}</div>
            </div>
          </div>
        </div>
        <div className="bg-white/90 border border-slate-200 border-l-4 border-emerald-500 rounded-2xl p-5 shadow-sm hover:shadow-md transition duration-300 backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="text-emerald-600">
              <ThumbsUp size={28} />
            </div>
            <div>
              <div className="text-sm text-slate-600">Avg Buy TickWise Score</div>
              <div className="text-2xl font-semibold text-slate-900">{avgBuyConfidence}%</div>
            </div>
          </div>
        </div>
        <div className="bg-white/90 border border-slate-200 border-l-4 border-rose-500 rounded-2xl p-5 shadow-sm hover:shadow-md transition duration-300 backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="text-rose-600">
              <Activity size={28} />
            </div>
            <div>
              <div className="text-sm text-slate-600">Buy / Hold / Sell</div>
              <div className="text-2xl font-semibold text-slate-900">{buyCount} / {holdCount} / {sellCount}</div>
            </div>
          </div>
        </div>
        <div className="bg-white/90 border border-slate-200 border-l-4 border-indigo-500 rounded-2xl p-5 shadow-sm hover:shadow-md transition duration-300 backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="text-indigo-600">
              <Activity size={28} />
            </div>
            <div>
              <div className="text-sm text-slate-600">30D Prediction Accuracy</div>
              <div className="text-2xl font-semibold text-slate-900">{predictionAccuracyFraction}</div>
              <div className="text-xs text-slate-500">
                {predictionAccuracyPct == null ? 'within +/-10% of prediction' : `${predictionAccuracyPct}% within +/-10%`}
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="mb-6 grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-4 bg-white/90 border border-slate-200 rounded-2xl p-5 shadow-sm backdrop-blur">
          <div className="mb-4">
            <div className="text-sm text-slate-500">Backtest Setup</div>
            <div className="text-lg font-semibold text-slate-900">Configure Entry and Exit Rules</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Lookback</label>
              <select
                value={backtestLookbackDays}
                onChange={(e) => setBacktestLookbackDays(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 bg-white"
              >
                {[5, 6, 7, 8, 9, 10, 12, 14, 16, 19, 21, 30, 45, 60, 90, 120].map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Top Picks</label>
              <select
                value={backtestTopCount}
                onChange={(e) => setBacktestTopCount(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 bg-white"
              >
                {[3, 5, 7, 10, 15].map((n) => (
                  <option key={n} value={n}>
                    {n} stocks
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3 mb-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Entry Rules</div>
            <div className="text-xs text-slate-600 mb-2">Base filter: TickWise score must be above 70.</div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={backtestRequireRisingAbove70}
                onChange={(e) => setBacktestRequireRisingAbove70(e.target.checked)}
              />
              Require score to rise over previous 3 days
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 p-3 mb-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Exit Rules</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={backtestUseTechStop}
                    onChange={(e) => setBacktestUseTechStop(e.target.checked)}
                  />
                  Sell on technical threshold
                </label>
                {backtestUseTechStop && (
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={backtestTechThreshold}
                    onChange={(e) => setBacktestTechThreshold(Number(e.target.value))}
                    className="w-20 border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-700 bg-white"
                    aria-label="Technical threshold"
                  />
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={backtestUseTrailingStop}
                    onChange={(e) => setBacktestUseTrailingStop(e.target.checked)}
                  />
                  Trailing stop
                </label>
                {backtestUseTrailingStop && (
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={backtestTrailingStopPct}
                    onChange={(e) => setBacktestTrailingStopPct(Number(e.target.value))}
                    className="w-20 border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-700 bg-white"
                    aria-label="Trailing stop percent"
                  />
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={backtestUseTakeProfit}
                    onChange={(e) => setBacktestUseTakeProfit(e.target.checked)}
                  />
                  Take profit
                </label>
                {backtestUseTakeProfit && (
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={backtestTakeProfitPct}
                    onChange={(e) => setBacktestTakeProfitPct(Number(e.target.value))}
                    className="w-20 border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-700 bg-white"
                    aria-label="Take profit percent"
                  />
                )}
              </div>
            </div>
          </div>

          <details className="rounded-xl border border-slate-200 p-3">
            <summary className="cursor-pointer text-xs uppercase tracking-wide text-slate-500">Advanced</summary>
            <div className="mt-2 text-xs text-slate-600">
              Orders execute at the next trading day open after buy/sell signals.
            </div>
          </details>

          <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50/60 p-3">
            <div className="text-xs uppercase tracking-wide text-cyan-700 mb-1">Active Rules</div>
            <div className="text-xs text-cyan-900">
              Entry: {backtestEntryRulesSummary}
            </div>
            <div className="text-xs text-cyan-900">
              Exit: {backtestExitRulesSummary}
            </div>
          </div>
        </div>

        <div className="xl:col-span-8 bg-white/90 border border-slate-200 rounded-2xl p-5 shadow-sm backdrop-blur">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <div className="text-sm text-slate-500">Backtest Results</div>
              <div className="text-lg font-semibold text-slate-900">
                Top Buys: {backtestLookbackDays}-Day Return to Today
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Picks from {backtestStats?.targetDate || `${backtestLookbackDays} days ago`} - Top {backtestTopCount} picks
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setBacktestResultTab('summary')}
              className={`px-3 py-1.5 text-xs rounded-md border ${backtestResultTab === 'summary' ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-slate-700 border-slate-300'}`}
            >
              Summary
            </button>
            <button
              type="button"
              onClick={() => setBacktestResultTab('equity')}
              className={`px-3 py-1.5 text-xs rounded-md border ${backtestResultTab === 'equity' ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-slate-700 border-slate-300'}`}
            >
              Equity Curve
            </button>
            <button
              type="button"
              onClick={() => setBacktestResultTab('trades')}
              className={`px-3 py-1.5 text-xs rounded-md border ${backtestResultTab === 'trades' ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-slate-700 border-slate-300'}`}
            >
              Trades
            </button>
          </div>

          {backtestLoading && (
            <div className="text-sm text-slate-600">Calculating recent performance...</div>
          )}
          {!backtestLoading && backtestStats?.sample === 0 && (
            <div className="text-sm text-slate-600">Not enough data to compute recent performance.</div>
          )}

          {!backtestLoading && backtestStats?.sample > 0 && backtestResultTab === 'summary' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <div className="text-xs text-emerald-700">Avg Return</div>
                  <div className="mt-1 text-2xl font-semibold text-emerald-900">{formatPct(backtestStats.avg)}</div>
                </div>
                <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-4">
                  <div className="text-xs text-cyan-700">Median Return</div>
                  <div className="mt-1 text-2xl font-semibold text-cyan-900">{formatPct(backtestStats.median)}</div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                  <div className="text-xs text-amber-700">Win Rate</div>
                  <div className="mt-1 text-2xl font-semibold text-amber-900">{formatPct(backtestStats.winRate)}</div>
                  <div className="text-xs text-amber-700 mt-1">Sample size: {backtestStats.sample}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="text-xs text-slate-600">Number of Trades</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{backtestStats.tradesCount ?? 0}</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                  <div className="text-xs text-emerald-700">Wins</div>
                  <div className="mt-1 text-lg font-semibold text-emerald-900">{backtestStats.winsCount ?? 0}</div>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                  <div className="text-xs text-rose-700">Losses</div>
                  <div className="mt-1 text-lg font-semibold text-rose-900">{backtestStats.lossesCount ?? 0}</div>
                </div>
                <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-3">
                  <div className="text-xs text-cyan-700">Mean Win Return</div>
                  <div className="mt-1 text-lg font-semibold text-cyan-900">{formatPct(backtestStats.meanWinReturn)}</div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <div className="text-xs text-amber-700">Mean Loss Return</div>
                  <div className="mt-1 text-lg font-semibold text-amber-900">{formatPct(backtestStats.meanLossReturn)}</div>
                </div>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
                  <div className="text-xs text-indigo-700">Max Win Return</div>
                  <div className="mt-1 text-lg font-semibold text-indigo-900">{formatPct(backtestStats.maxWinReturn)}</div>
                </div>
                <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/60 p-3">
                  <div className="text-xs text-fuchsia-700">Max Loss Rate</div>
                  <div className="mt-1 text-lg font-semibold text-fuchsia-900">{formatPct(backtestStats.maxLossRate)}</div>
                </div>
              </div>
            </div>
          )}

          {!backtestLoading && backtestResultTab === 'equity' && (
            backtestSeries?.length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="px-4 pt-4">
                  <PortfolioReturnChart data={backtestSeries} height={260} />
                </div>
                <div className="px-4 pb-4 text-xs text-slate-500">
                  Hover a date to see portfolio holdings and returns for that day.
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-600">Equity curve unavailable for current settings.</div>
            )
          )}

          {!backtestLoading && backtestResultTab === 'trades' && (
            sortedBacktestDetailRows.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <div className="text-xs text-slate-600">Number of Trades</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{backtestStats?.tradesCount ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                    <div className="text-xs text-emerald-700">Wins</div>
                    <div className="mt-1 text-lg font-semibold text-emerald-900">{backtestStats?.winsCount ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                    <div className="text-xs text-rose-700">Losses</div>
                    <div className="mt-1 text-lg font-semibold text-rose-900">{backtestStats?.lossesCount ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/60 p-3">
                    <div className="text-xs text-fuchsia-700">Max Loss Rate</div>
                    <div className="mt-1 text-lg font-semibold text-fuchsia-900">{formatPct(backtestStats?.maxLossRate)}</div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="min-w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="px-3 py-2">Seq</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Ticker</th>
                        <th className="px-3 py-2">Entry</th>
                        <th className="px-3 py-2">Exit Date</th>
                        <th className="px-3 py-2">Exit Price</th>
                        <th className="px-3 py-2">Leg Return %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedBacktestDetailRows.map((row, idx) => {
                        const isPos = row.currentReturn != null && row.currentReturn >= 0;
                        return (
                          <tr key={`${row.date}-${row.ticker}-${idx}`} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-500">
                              {row.chainId != null && row.leg != null ? `${row.chainId}.${row.leg}` : '-'}
                            </td>
                            <td className="px-3 py-2">{row.date}</td>
                            <td className="px-3 py-2 font-medium">{row.ticker}</td>
                            <td className="px-3 py-2">{formatPrice(row.entryPrice)}</td>
                            <td className="px-3 py-2">{row.exitDate || '-'}</td>
                            <td className="px-3 py-2">{formatPrice(row.latestClose)}</td>
                            <td className={`px-3 py-2 font-semibold ${isPos ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {row.currentReturn == null ? '-' : formatPct(row.currentReturn)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-600">No trade rows available for current settings.</div>
            )
          )}
        </div>
      </section>

      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-slate-600">
          Filters {showFilters ? 'visible' : 'hidden'}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(prev => !prev)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          {showFilters ? 'Hide filters' : 'Show filters'}
        </button>
      </div>

      {/* Search and filter controls */}
      {showFilters && (
        <div className="bg-white/90 border border-slate-200 rounded shadow-sm p-4 mb-6 backdrop-blur">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <input
            type="text"
            placeholder="Search ticker or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-slate-300 rounded-lg px-4 py-2 w-full lg:w-1/3 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-slate-300 rounded-lg px-4 py-2 w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              <option value="">All Ratings</option>
              <option value="buy">Buy</option>
              <option value="hold">Hold</option>
              <option value="sell">Sell</option>
            </select>
            <button
              type="button"
              onClick={resetScoreFilters}
              className="border border-slate-300 rounded-lg px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Reset score filters
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {[
            { key: 'tickwise_score', label: 'TickWise Score' },
            { key: 'technical', label: 'Technical' },
            { key: 'fundamental_score', label: 'Fundamental' },
            { key: 'ai1m_lower_pct', label: 'AI 1M Lower %' },
            { key: 'ai1m_upper_pct', label: 'AI 1M Upper %' },
            { key: 'analyst_1y_pct', label: 'Analysts 1Y %' },
          ].map(item => (
            <div key={item.key} className="border border-slate-200 rounded-lg p-3 bg-white">
              <div className="text-xs text-slate-500 mb-2">{item.label}</div>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder={scoreRanges[item.key].min == null ? 'Min' : `Min ${scoreRanges[item.key].min.toFixed(1)}`}
                  value={scoreFilters[item.key].min}
                  onChange={(e) => onFilterChange(item.key, 'min', e.target.value)}
                  className="border border-slate-300 rounded-md px-2 py-1 w-1/2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
                <input
                  type="number"
                  placeholder={scoreRanges[item.key].max == null ? 'Max' : `Max ${scoreRanges[item.key].max.toFixed(1)}`}
                  value={scoreFilters[item.key].max}
                  onChange={(e) => onFilterChange(item.key, 'max', e.target.value)}
                  className="border border-slate-300 rounded-md px-2 py-1 w-1/2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>
            </div>
          ))}
          <div className="flex items-center text-sm text-slate-600">
            Showing {filteredRows.length} of {rows.length}
          </div>
        </div>
      </div>
      )}

      {/* Render all stocks */}
      <div className="mb-10">
        <h2 className="text-xl font-semibold mb-4">All Stocks</h2>
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          <div
            className="bg-gradient-to-r from-slate-100 via-cyan-100 to-emerald-100 border-b border-slate-200 text-sm text-slate-700"
            style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
          >
            <div className="px-3 py-2 font-medium">Ticker</div>
            <div className="px-3 py-2 font-medium">Security</div>
            <SortableHeader
              label="TickWise Score"
              sortKey="tickwise_score"
              sortConfig={sortConfig}
              setSortConfig={setSortConfig}
            />
            <SortableHeader
              label="Technical"
              sortKey="technical"
              sortConfig={sortConfig}
              setSortConfig={setSortConfig}
            />
            <SortableHeader
              label="Fundamental"
              sortKey="fundamental_score"
              sortConfig={sortConfig}
              setSortConfig={setSortConfig}
            />
            <SortableHeader
              label="AI 1M Upper %"
              sortKey="ai1m_upper_pct"
              sortConfig={sortConfig}
              setSortConfig={setSortConfig}
            />
            <SortableHeader
              label="AI 1M Lower %"
              sortKey="ai1m_lower_pct"
              sortConfig={sortConfig}
              setSortConfig={setSortConfig}
            />
            <SortableHeader
              label="Analysts 1Y %"
              sortKey="analyst_1y_pct"
              sortConfig={sortConfig}
              setSortConfig={setSortConfig}
            />
          </div>

          <div className="overflow-auto">
            {filteredRows.length === 0 ? (
              <div className="p-6 text-sm text-slate-600">No stocks match the current filters.</div>
            ) : (
              <List
                rowCount={filteredRows.length}
                rowHeight={rowHeight}
                rowComponent={Row}
                rowProps={{}}
                style={{ height: listHeight, width: '100%' }}
              />
            )}
          </div>
        </div>
      </div>
      {selectedStock && (
        <div className="mb-10 bg-white/95 rounded shadow-sm border border-slate-200 p-4 backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <div className="text-lg font-semibold">
              {selectedStock.ticker} Forecast Detail
            </div>
            <button
              type="button"
              className="text-sm text-slate-600 hover:text-slate-900"
              onClick={() => setSelectedTicker(null)}
            >
              Clear
            </button>
          </div>
          <div className="mb-3 flex gap-4 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 inline-block rounded-full"></span>
              ML Forecast
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-cyan-500 inline-block rounded-full"></span>
              ML 1M History
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-orange-400 inline-block rounded-full"></span>
              Analyst Forecast
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
            <div>
              <StockDetailChart
                stock={selectedStock}
                priceHistory={priceHistory}
                mlHistory={historicalMlPoints}
                scoreHistory={scoreHistory}
                scoreSeriesSelection={scoreSeriesSelection}
              />
            </div>

            <div className="bg-gradient-to-br from-cyan-50 via-slate-50 to-emerald-50 border border-cyan-200 rounded-lg p-3 shadow-sm">
              <div className="grid grid-cols-2 gap-2 mb-3 bg-white/90 border border-cyan-200 rounded-md p-2 shadow-sm">
                {[
                  { key: 'recommendation', label: 'Recommendation' },
                  { key: 'tickwise', label: 'TickWise' },
                  { key: 'technical', label: 'Technical' },
                  { key: 'fundamental', label: 'Fundamental' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setDetailTab(tab.key)}
                    className={`w-full px-2.5 py-1.5 text-xs rounded-md border font-medium ${
                      detailTab === tab.key
                        ? 'bg-cyan-100 border-cyan-500 text-cyan-800 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {detailTab === 'recommendation' && (
                <div className="grid grid-cols-2 gap-2 text-sm bg-white border border-cyan-200 rounded-md p-3 shadow-sm">
                  <div className="text-slate-500">Recommendation</div>
                  <div className="font-medium text-slate-900">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded border ${signalBadgeClass(selectedStock.recommendation)}`}>
                      {selectedStock.recommendation || '-'}
                    </span>
                  </div>
                  <div className="text-slate-500">TickWise Score</div>
                  <div className="font-medium text-slate-900">{formatPct(selectedStock.tickwise_score)}</div>
                  <div className="text-slate-500">ML Score</div>
                  <div className="font-medium text-slate-900">{formatPct(selectedStock.ml_score)}</div>
                  <div className="text-slate-500">Analyst Score</div>
                  <div className="font-medium text-slate-900">{formatPct(selectedStock.analyst_score)}</div>
                  <div className="text-slate-500">Last Close</div>
                  <div className="font-medium text-slate-900">{formatPrice(selectedStock.Close)}</div>
                </div>
              )}

              {detailTab === 'tickwise' && (
                <div className="grid grid-cols-2 gap-2 text-sm bg-white border border-cyan-200 rounded-md p-3 shadow-sm">
                  <div className="text-slate-500">TickWise Score</div>
                  <div className="font-medium text-slate-900">{formatPct(selectedStock.tickwise_score)}</div>
                  <div className="text-slate-500">ML 1M Forecast</div>
                  <div className="font-medium text-slate-900">
                    {formatPct(((selectedStock.forecast1m - selectedStock.Close) * 100) / selectedStock.Close)}
                  </div>
                  <div className="text-slate-500">ML 1M Range</div>
                  <div className="font-medium text-slate-900">
                    {formatPct(((selectedStock.forecast1m_p5 - selectedStock.Close) * 100) / selectedStock.Close)} / {formatPct(((selectedStock.forecast1m_p95 - selectedStock.Close) * 100) / selectedStock.Close)}
                  </div>
                  <div className="text-slate-500">Analyst 1Y %</div>
                  <div className="font-medium text-slate-900">
                    {formatPct(((selectedStock.analysts_forecast - selectedStock.Close) * 100) / selectedStock.Close)}
                  </div>
                </div>
              )}

              {detailTab === 'technical' && (
                <div className="text-sm space-y-3">
                  <div className="grid grid-cols-2 gap-2 bg-white border border-cyan-200 rounded-md p-3 shadow-sm">
                    <div className="text-slate-500">Technical Score</div>
                    <div className="font-medium text-slate-900">{formatPct(selectedStock.technical)}</div>
                  </div>

                  <div className="text-xs uppercase tracking-wide text-cyan-700">Momentum</div>
                  <div className="grid grid-cols-2 gap-2 bg-white border border-emerald-200 rounded-md p-3 shadow-sm">
                    <div className="text-slate-500">RSI (14)</div>
                    <div className="font-medium text-slate-900">{formatNum(selectedStock.rsi_14)}</div>
                    <div className="text-slate-500">MACD (12,26,9)</div>
                    <div className="font-medium text-slate-900">{formatNum(selectedStock.MACD_12_26_9)}</div>
                    <div className="text-slate-500">ADX (14)</div>
                    <div className="font-medium text-slate-900">{formatNum(selectedStock.ADX_14)}</div>
                    <div className="text-slate-500">Momentum (10)</div>
                    <div className="font-medium text-slate-900">{formatNum(selectedStock.momentum_10)}</div>
                    <div className="text-slate-500">CCI</div>
                    <div className="font-medium text-slate-900">{formatNum(selectedStock['CCI_14_0.015'])}</div>
                    <div className="text-slate-500">StochRSI K / D</div>
                    <div className="font-medium text-slate-900">
                      {formatNum(selectedStock.STOCHRSIk_14_14_3_3)} / {formatNum(selectedStock.STOCHRSId_14_14_3_3)}
                    </div>
                    <div className="text-slate-500">AO</div>
                    <div className="font-medium text-slate-900">{formatNum(selectedStock.ao)}</div>
                    <div className="text-slate-500">Momentum Signal</div>
                    <div className="font-medium text-slate-900">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded border ${signalBadgeClass(selectedStock.signal_momentum)}`}>
                        {selectedStock.signal_momentum ?? '-'}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs uppercase tracking-wide text-cyan-700">Moving Averages</div>
                  <div className="grid grid-cols-2 gap-2 bg-white border border-amber-200 rounded-md p-3 shadow-sm">
                    <div className="text-slate-500">SMA 10 / 20</div>
                    <div className="font-medium text-slate-900">
                      {formatNum(selectedStock.sma_10)} / {formatNum(selectedStock.sma_20)}
                    </div>
                    <div className="text-slate-500">SMA 50 / 200</div>
                    <div className="font-medium text-slate-900">
                      {formatNum(selectedStock.sma_50)} / {formatNum(selectedStock.sma_200)}
                    </div>
                    <div className="text-slate-500">EMA 10 / 20</div>
                    <div className="font-medium text-slate-900">
                      {formatNum(selectedStock.ema_10)} / {formatNum(selectedStock.ema_20)}
                    </div>
                    <div className="text-slate-500">EMA 50 / 200</div>
                    <div className="font-medium text-slate-900">
                      {formatNum(selectedStock.ema_50)} / {formatNum(selectedStock.ema_200)}
                    </div>
                    <div className="text-slate-500">MA Signals</div>
                    <div className="font-medium text-slate-900 flex gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded border ${signalBadgeClass(selectedStock.signal_sma_10)}`}>
                        {selectedStock.signal_sma_10 ?? '-'}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded border ${signalBadgeClass(selectedStock.signal_ema_10)}`}>
                        {selectedStock.signal_ema_10 ?? '-'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'fundamental' && (
                <div className="grid grid-cols-2 gap-2 text-sm bg-white border border-cyan-200 rounded-md p-3 shadow-sm">
                  <div className="text-slate-500">Fundamental Score</div>
                  <div className="font-medium text-slate-900">{formatPct(selectedStock.fundamental_score)}</div>
                  <div className="text-slate-500">Profitability</div>
                  <div className="font-medium text-slate-900">{formatPct(selectedStock.profitability * 100)}</div>
                  <div className="text-slate-500">Valuation</div>
                  <div className="font-medium text-slate-900">{formatPct(selectedStock.valuation * 100)}</div>
                  <div className="text-slate-500">Stability</div>
                  <div className="font-medium text-slate-900">{formatPct(selectedStock.stability * 100)}</div>
                  <div className="text-slate-500">Yield</div>
                  <div className="font-medium text-slate-900">{formatPct(selectedStock.yield * 100)}</div>
                </div>
              )}
            </div>

            <div className="mt-3 bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Overlay Scores</div>
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-cyan-700">
                  Select score lines
                </summary>
                <div className="mt-3 space-y-2 text-sm">
                  {[
                    { key: 'tickwise', label: 'TickWise Score' },
                    { key: 'technical', label: 'Technical Score' },
                    { key: 'fundamental', label: 'Fundamental Score' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={scoreSeriesSelection[item.key]}
                        onChange={(e) =>
                          setScoreSeriesSelection((prev) => ({
                            ...prev,
                            [item.key]: e.target.checked,
                          }))
                        }
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </div>
      )}
      <div className="mb-6 bg-white rounded shadow-sm border border-slate-200 p-4">
        <details>
          <summary className="cursor-pointer text-lg font-semibold text-cyan-700 mb-2">
            How These Stock Recommendations Are Generated
          </summary>
          <div className="mt-2 text-sm text-slate-700 space-y-2">
            <p>
              These stock picks are generated using a combination of:
            </p>
            <ul className="list-disc pl-6">
              <li><strong>News Sentiment Analysis:</strong> We analyze recent financial news using a transformer-based NLP model (FinBERT) to assess the tone around each stock.</li>
              <li><strong>Technical Indicators:</strong> Price patterns and trends are quantified using technical signals like momentum, RSI, and moving averages.</li>
              <li><strong>Machine Learning Forecasts:</strong> A trained regression model predicts near-term and long-term performance based on historical data.</li>
            </ul>
            <h2>How These Stock Picks Are Generated</h2>
            <p>
              Tickwise scores are calculated by weighting the alignment of news sentiment, technical strength, and model forecast.
            </p>
          </div>
        </details>
      </div>
      <footer className="text-center text-sm text-slate-500 mt-10">Copyright {new Date().getFullYear()} AI Stock Picks</footer>
    </main>
  );
}



























