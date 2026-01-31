import React, { useEffect, useState } from 'react';
import { List } from 'react-window';
import StockChart from '../StockChart';
import '../index.css';
import { BarChart2, ThumbsUp, MessageCircle, Activity } from 'lucide-react';


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
    sentiment: { min: null, max: null },
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
      entry.analysis_date ??
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

  const avgSentiment = totalAnalyzed > 0
    ? (
        stocksData.reduce((sum, s) => sum + (Number(s.sentiment) || 0), 0) / totalAnalyzed
      ).toFixed(2)
    : '0.00';

  // Search and filter state.
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [scoreFilters, setScoreFilters] = useState({
    tickwise_score: { min: '', max: '' },
    sentiment: { min: '', max: '' },
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
      sentiment: Number(stock.sentiment),
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
  const historicalMlPoints = selectedTicker
    ? getHistoryPointsForTicker(histData, selectedTicker)
    : [];
  const rowHeight = 40;
  const listHeight = 240;
  const gridTemplate = '90px 220px repeat(7, minmax(110px, 1fr))';

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
        <div className="px-3 py-2">{Number(stock.sentiment).toFixed(1)}%</div>
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
      sentiment: { min: '', max: '' },
      technical: { min: '', max: '' },
      fundamental_score: { min: '', max: '' },
      ai1m_lower_pct: { min: '', max: '' },
      ai1m_upper_pct: { min: '', max: '' },
      analyst_1y_pct: { min: '', max: '' },
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-cyan-50 text-slate-900 p-6">
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
        <div className="bg-white/90 border border-slate-200 border-l-4 border-amber-500 rounded-2xl p-5 shadow-sm hover:shadow-md transition duration-300 backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="text-amber-600">
              <MessageCircle size={28} />
            </div>
            <div>
              <div className="text-sm text-slate-600">Net Sentiment</div>
              <div className="text-2xl font-semibold text-slate-900">{avgSentiment > 0 ? '+' : ''}{avgSentiment}</div>
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
      </div>

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
            { key: 'sentiment', label: 'Sentiment' },
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
        <div className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden">
          <div
            className="bg-slate-100 border-b border-slate-200 text-sm text-slate-700"
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
              label="Sentiment"
              sortKey="sentiment"
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
          <div className="mb-2 flex gap-4 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 inline-block rounded-full"></span>
              ML Forecast
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-orange-400 inline-block rounded-full"></span>
              Analyst Forecast
            </div>
          </div>
          
          <StockChart
            ticker={selectedStock.ticker}
            priceData={priceHistory[selectedStock.ticker] || []}
            mlForecast={generateForecastLine(
              priceHistory[selectedStock.ticker] || [],
              (selectedStock.forecast1m - selectedStock.Close) * 100 / selectedStock.Close,
              30
            )}
            mlHistory={historicalMlPoints}
            analystForecast={generateForecastLine(
              priceHistory[selectedStock.ticker] || [],
              selectedStock.analysts_forecast,
              365
            )}
          />
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
