import React, { useEffect, useState } from 'react';
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



export default function Dashboard() {
  const [expandedTicker, setExpandedTicker] = useState(null);
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

  // Environment variable for the container SAS URL. Should look like
  // "https://<account>.blob.core.windows.net/<container>?<sas>".
  // const containerSasUrl = import.meta.env.VITE_CONTAINER_SAS_URL;
  // // Environment variable for the top stocks JSON SAS URL. Should point directly
  // // at the JSON blob.
  // const stocksSasUrl = import.meta.env.VITE_STOCKS_JSON_SAS_URL;

  const base = import.meta.env.VITE_GCS_PUBLIC_BASE;
  const scoresUrl = `${base}/today_recommendations.json`;
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

  // Fetch price history on demand whenever the expanded ticker changes.
  useEffect(() => {
    if (!expandedTicker) return;
    if (priceHistory[expandedTicker]) return;
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
        // const blobPath = `stocks/${expandedTicker}.json`;
        // const blobUrl = sasParams
        //   ? `${baseUrl.replace(/\/$/, '')}/${blobPath}?${sasParams}`
        //   : `${baseUrl.replace(/\/$/, '')}/${blobPath}`;
        // const response = await fetch(blobUrl);
        const historyUrl = `${base}/data/${expandedTicker}.json`;
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

        setPriceHistory(prev => ({ ...prev, [expandedTicker]: formatted }));
        
      } catch (err) {
        console.error('Error loading price history:', err);
      }
    };
    fetchHistory();
  }, [expandedTicker, base, priceHistory]);
  // Partition the stocks into buys and sells based on the fetched list.
  const topBuys = stocksData.filter(stock => stock.recommendation?.toLowerCase() === 'buy');
  const topSells = stocksData.filter(stock => stock.recommendation?.toLowerCase() === 'sell');
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

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 p-6">
      {loadingStocks && (
        <p className="text-center text-gray-600 mb-4">Loading stock recommendations...</p>
      )}
      <h1 className="text-2xl font-bold mb-6">AI Stock Recommendations</h1>

      {/* Statistic cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border-l-4 border-blue-400 rounded-2xl p-5 shadow-sm hover:shadow-md transition duration-300">
          <div className="flex items-center gap-4">
            <div className="text-blue-600">
              <BarChart2 size={28} />
            </div>
            <div>
              <div className="text-sm text-blue-700">Stocks Analyzed</div>
              <div className="text-2xl font-bold text-blue-900">{totalAnalyzed}</div>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border-l-4 border-green-400 rounded-2xl p-5 shadow-sm hover:shadow-md transition duration-300">
          <div className="flex items-center gap-4">
            <div className="text-green-600">
              <ThumbsUp size={28} />
            </div>
            <div>
              <div className="text-sm text-green-700">Avg Buy TickWise Score</div>
              <div className="text-2xl font-bold text-green-900">{avgBuyConfidence}%</div>
            </div>
          </div>
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-2xl p-5 shadow-sm hover:shadow-md transition duration-300">
          <div className="flex items-center gap-4">
            <div className="text-yellow-600">
              <MessageCircle size={28} />
            </div>
            <div>
              <div className="text-sm text-yellow-700">Net Sentiment</div>
              <div className="text-2xl font-bold text-yellow-900">{avgSentiment > 0 ? '+' : ''}{avgSentiment}</div>
            </div>
          </div>
        </div>
        <div className="bg-red-50 border-l-4 border-red-400 rounded-2xl p-5 shadow-sm hover:shadow-md transition duration-300">
          <div className="flex items-center gap-4">
            <div className="text-red-600">
              <Activity size={28} />
            </div>
            <div>
              <div className="text-sm text-red-700">Buy / Hold / Sell</div>
              <div className="text-2xl font-bold text-red-900">{buyCount} / {holdCount} / {sellCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and filter controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <input
          type="text"
          placeholder="Search ticker or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 w-full md:w-1/3 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 w-full md:w-48 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All Ratings</option>
          <option value="buy">Buy</option>
          <option value="hold">Hold</option>
          <option value="sell">Sell</option>
        </select>
      </div>

      {/* Render top buy and sell lists */}
      {[{ title: 'Top Buy Stocks', stocks: topBuys }, { title: 'Top Sell Stocks', stocks: topSells }].map(({ title, stocks }) => {
        const filtered = sortRows(
        stocks
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
            }),
        sortConfig
        );

        return (
          <div key={title} className="mb-10">
            <h2 className="text-xl font-semibold mb-4">{title}</h2>
            <div className="bg-white rounded shadow overflow-x-auto">
              <table className={`min-w-full text-sm text-left ${title === 'Top Buy Stocks' ? 'buy-table' : title === 'Top Sell Stocks' ? 'sell-table' : ''}`}>
                <thead className="bg-gray-100">
                <tr>
                    <th className="px-3 py-2">Ticker</th>
                    <th className="px-3 py-2">Security</th>

                    <SortableTH
                    label="TickWise Score"
                    sortKey="tickwise_score"
                    sortConfig={sortConfig}
                    setSortConfig={setSortConfig}
                    />

                    <SortableTH
                    label="Sentiment"
                    sortKey="sentiment"
                    sortConfig={sortConfig}
                    setSortConfig={setSortConfig}
                    />

                    <SortableTH
                    label="Technical"
                    sortKey="technical"
                    sortConfig={sortConfig}
                    setSortConfig={setSortConfig}
                    />

                    <SortableTH
                    label="Fundamental"
                    sortKey="fundamental_score"
                    sortConfig={sortConfig}
                    setSortConfig={setSortConfig}
                    />

                    <SortableTH
                    label="AI 1M Upper %"
                    sortKey="forecast1m_p95"
                    sortConfig={sortConfig}
                    setSortConfig={setSortConfig}
                    />

                    <SortableTH
                    label="AI 1M Lower %"
                    sortKey="forecast1m_p5"
                    sortConfig={sortConfig}
                    setSortConfig={setSortConfig}
                    />

                    <SortableTH
                    label="Analysts 1Y %"
                    sortKey="analysts_forecast"
                    sortConfig={sortConfig}
                    setSortConfig={setSortConfig}
                    />

                </tr>
                </thead>

                <tbody>
                  {filtered.map((stock, idx) => (
                    <React.Fragment key={idx}>
                      <tr
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => setExpandedTicker(expandedTicker === stock.ticker ? null : stock.ticker)}
                      >
                        <td className="px-3 py-2 font-medium">{stock.ticker}</td>
                        <td className="px-3 py-2">{stock.Security}</td>
                        <td className="px-3 py-2">{stock.tickwise_score.toFixed(1)}%</td>
                        <td className="px-3 py-2">{(Number(stock.sentiment)).toFixed(1)}%</td>
                        <td className="px-3 py-2">{(Number(stock.technical)).toFixed(1)}%</td>
                        <td className="px-3 py-2">{(Number(stock.fundamental_score)).toFixed(1)}%</td>
                        <td className="px-3 py-2">{Number((stock.forecast1m_p5 - stock.Close)*100/stock.Close).toFixed(1)}</td>
                        <td className="px-3 py-2">{Number((stock.forecast1m_p95 - stock.Close)*100/stock.Close).toFixed(1)}</td>
                        <td className="px-3 py-2">{Number((stock.analysts_forecast - stock.Close)*100/stock.Close).toFixed(1)}</td>
                      </tr>
                      {expandedTicker === stock.ticker && (
                        <tr>
                          <td colSpan="8" className="p-4 bg-gray-50">
                            <div className="mb-2 flex gap-4 text-sm text-gray-700">
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
                              ticker={stock.ticker}
                              priceData={priceHistory[stock.ticker] || []}
                              mlForecast={generateForecastLine(
                                priceHistory[stock.ticker] || [],
                                (stock.forecast1m - stock.Close)*100/stock.Close,
                                30
                              )}
                              analystForecast={generateForecastLine(
                                priceHistory[stock.ticker] || [],
                                stock.analysts_forecast,
                                365
                              )}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <div className="mb-6 bg-white rounded shadow p-4">
        <details>
          <summary className="cursor-pointer text-lg font-semibold text-blue-600 mb-2">
            How These Stock Recommendations Are Generated
          </summary>
          <div className="mt-2 text-sm text-gray-700 space-y-2">
            <p>
              These stock picks are generated using a combination of:
            </p>
            <ul className="list-disc pl-6">
              <li><strong>News Sentiment Analysis:</strong> We analyze recent financial news using a transformer-based NLP model (FinBERT) to assess the tone around each stock.</li>
              <li><strong>Technical Indicators:</strong> Price patterns and trends are quantified using technical signals like momentum, RSI, and moving averages.</li>
              <li><strong>Machine Learning Forecasts:</strong> A trained regression model predicts near-term and long-term performance based on historical data.</li>
            </ul>
            <p>
              Tickwise scores are calculated by weighting the alignment of news sentiment, technical strength, and model forecast.
            </p>
          </div>
        </details>
      </div>
      <footer className="text-center text-sm text-gray-500 mt-10">© {new Date().getFullYear()} AI Stock Picks</footer>
    </div>
  );
}
