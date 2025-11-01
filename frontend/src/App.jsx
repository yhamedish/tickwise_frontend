import React, { useEffect, useState } from 'react';
import StockChart from './StockChart';
import './index.css';
import { BarChart2, ThumbsUp, MessageCircle, Activity } from 'lucide-react';

/*
 * NOTE
 * The application originally contained a hard‑coded `dummyData` array.  To
 * support live data, we still keep a copy of that array as a fallback but
 * introduce state variables which are populated by fetching a JSON file from
 * Azure Blob Storage.  See the `useEffect` hook further down for details.
 */
const dummyData = [
  {
    ticker: 'AAPL',
    company: 'Apple Inc.',
    recommendation: 'Buy',
    confidence: 92,
    sentiment: 0.85,
    technical: 0.78,
    forecast1m: 5.3,
    forecast1y: 28,
  },
  {
    ticker: 'TSLA',
    company: 'Tesla Inc.',
    recommendation: 'Hold',
    confidence: 75,
    sentiment: 0.4,
    technical: 0.5,
    forecast1m: -0.2,
    forecast1y: 12,
  },
  {
    ticker: 'AMZN',
    company: 'Amazon.com Inc.',
    recommendation: 'Sell',
    confidence: 68,
    sentiment: -0.2,
    technical: 0.3,
    forecast1m: -3.1,
    forecast1y: 8,
  },
  {
    ticker: 'MSFT',
    company: 'Microsoft Corp.',
    recommendation: 'Buy',
    confidence: 88,
    sentiment: 0.7,
    technical: 0.9,
    forecast1m: 4.7,
    forecast1y: 25,
  },
  {
    ticker: 'NFLX',
    company: 'Netflix Inc.',
    recommendation: 'Sell',
    confidence: 70,
    sentiment: -0.1,
    technical: 0.4,
    forecast1m: -2.5,
    forecast1y: 10,
  },
];

const priceHistory = {
  AAPL: [
    { time: '2023-07-01', open: 180, high: 185, low: 178, close: 183 },
    { time: '2023-07-02', open: 183, high: 186, low: 182, close: 184 },
    { time: '2023-07-03', open: 184, high: 187, low: 183, close: 186 },
    { time: '2023-07-04', open: 186, high: 190, low: 185, close: 188 },
    { time: '2023-07-05', open: 188, high: 192, low: 187, close: 191 },
  ],
  AMZN: [
    { time: '2023-07-01', open: 130, high: 133, low: 128, close: 129 },
    { time: '2023-07-02', open: 129, high: 133, low: 126, close: 128 },
    { time: '2023-07-03', open: 128, high: 133, low: 126, close: 129 },
    { time: '2023-07-04', open: 129, high: 131, low: 125, close: 130 },
    { time: '2023-07-05', open: 130, high: 134, low: 124, close: 128 },
  ],
  MSFT: [
    { time: '2023-07-01', open: 300, high: 305, low: 298, close: 303 },
    { time: '2023-07-02', open: 303, high: 306, low: 302, close: 304 },
    { time: '2023-07-03', open: 304, high: 308, low: 303, close: 307 },
    { time: '2023-07-04', open: 307, high: 310, low: 306, close: 309 },
    { time: '2023-07-05', open: 309, high: 312, low: 308, close: 311 },
  ],
  NFLX: [
    { time: '2023-07-01', open: 500, high: 505, low: 495, close: 498 },
    { time: '2023-07-02', open: 498, high: 502, low: 495, close: 500 },
    { time: '2023-07-03', open: 500, high: 505, low: 499, close: 504 },
    { time: '2023-07-04', open: 504, high: 508, low: 503, close: 506 },
    { time: '2023-07-05', open: 506, high: 510, low: 505, close: 509 },
  ],
};

function generateForecastLine(priceData, percentChange) {
  if (!priceData || priceData.length === 0) return [];
  const lastTime = priceData[priceData.length - 1].time;
  const lastClose = priceData[priceData.length - 1].close;
  const forecastValue = lastClose * (1 + percentChange / 100);
  return [
    { time: lastTime, value: lastClose },
    { time: addDays(lastTime, 1), value: forecastValue },
  ];
}

function addDays(dateString, days) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function App() {
  const [expandedTicker, setExpandedTicker] = useState(null);

  // New state variables for loading data from Azure Blob Storage
  const [stocksData, setStocksData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /*
   * Fetch stock recommendations from an Azure Blob Storage JSON file using a
   * SAS (shared access signature) URL.  The SAS URL should be provided via a
   * Vite environment variable named VITE_STOCKS_JSON_SAS_URL.  Exposing
   * credentials in source code is not recommended, so environment variables
   * allow you to keep secrets out of version control.  When the component
   * mounts, we attempt to retrieve the JSON.  If the fetch fails (for
   * example, because the SAS token has expired or CORS is not configured), the
   * error is captured and the dummyData fallback will be used.
   */
  useEffect(() => {
    const sasUrl = import.meta.env.VITE_STOCKS_JSON_SAS_URL;
    async function loadData() {
      if (!sasUrl) {
        // No URL provided – skip remote fetch and fall back on dummy data
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(sasUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch stocks: ${response.status}`);
        }
        const json = await response.json();
        // Expect the JSON to be an array of stock recommendation objects
        setStocksData(Array.isArray(json) ? json : []);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Determine the data source: prefer remote data, fall back to dummyData
  const dataSource = stocksData && stocksData.length > 0 ? stocksData : dummyData;

  // search terms for search and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');

  // Apply search and rating filters to the data when building the lists.  The
  // search term matches against both the ticker and company name.  Rating
  // filtering is case‑insensitive on the recommendation field.
  const filteredData = dataSource.filter((stock) => {
    const matchesSearch = searchTerm
      ? stock.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.company.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    const matchesFilter = filterType
      ? stock.recommendation.toLowerCase() === filterType.toLowerCase()
      : true;
    return matchesSearch && matchesFilter;
  });

  const topBuys = filteredData.filter((stock) => stock.recommendation === 'Buy');
  const topSells = filteredData.filter((stock) => stock.recommendation === 'Sell');

  // statistics parameters
  const totalAnalyzed = dataSource.length;
  const buyCount = dataSource.filter((s) => s.recommendation === 'Buy').length;
  const sellCount = dataSource.filter((s) => s.recommendation === 'Sell').length;
  const holdCount = dataSource.filter((s) => s.recommendation === 'Hold').length;

  const avgBuyConfidence = buyCount
    ? (
        dataSource
          .filter((s) => s.recommendation === 'Buy')
          .reduce((sum, s) => sum + s.confidence, 0) / buyCount
      ).toFixed(1)
    : '0.0';

  const avgSentiment = totalAnalyzed
    ? (
        dataSource.reduce((sum, s) => sum + s.sentiment, 0) / totalAnalyzed
      ).toFixed(2)
    : '0.00';


  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 p-6">
      <h1 className="text-2xl font-bold mb-6">AI Stock Recommendations</h1>
      {/* Show loading or error state messages */}
      {loading && (
        <p className="mb-4 text-blue-600">Loading stock data...</p>
      )}
      {error && !loading && (
        <p className="mb-4 text-red-600">Failed to load stock data: {error}</p>
      )}
      
      {/* Displaying the statistic cards at the top */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Stocks Analyzed */}
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

        {/* Card 2: Avg Buy Confidence */}
        <div className="bg-green-50 border-l-4 border-green-400 rounded-2xl p-5 shadow-sm hover:shadow-md transition duration-300">
          <div className="flex items-center gap-4">
            <div className="text-green-600">
              <ThumbsUp size={28} />
            </div>
            <div>
              <div className="text-sm text-green-700">Avg Buy Confidence</div>
              <div className="text-2xl font-bold text-green-900">{avgBuyConfidence}%</div>
            </div>
          </div>
        </div>

        {/* Card 3: Net Sentiment */}
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

        {/* Card 4: Buy / Hold / Sell */}
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

      {/* Search and filters*/}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        {/* Search Bar */}
        <input
          type="text"
          placeholder="Search ticker or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 w-full md:w-1/3 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        {/* Filter Dropdown */}
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



      {[{ title: 'Top Buy Stocks', stocks: topBuys }, { title: 'Top Sell Stocks', stocks: topSells }].map(({ title, stocks }) => (
        <div key={title} className="mb-10">
          <h2 className="text-xl font-semibold mb-4">{title}</h2>
          <div className="bg-white rounded shadow overflow-x-auto">
            <table className={`min-w-full text-sm text-left ${title === 'Top Buy Stocks' ? 'buy-table' : title === 'Top Sell Stocks' ? 'sell-table' : ''}`}>
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2">Ticker</th>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2">Sentiment</th>
                  <th className="px-3 py-2">Technical</th>
                  <th className="px-3 py-2">1M Forecast</th>
                  <th className="px-3 py-2">1Y Forecast</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((stock, idx) => (
                  <React.Fragment key={idx}>
                    <tr
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedTicker(expandedTicker === stock.ticker ? null : stock.ticker)}
                    >
                      <td className="px-3 py-2 font-medium">{stock.ticker}</td>
                      <td className="px-3 py-2">{stock.company}</td>
                      <td className="px-3 py-2">{stock.confidence}%</td>
                      <td className="px-3 py-2">{(stock.sentiment).toFixed(1)}%</td>
                      <td className="px-3 py-2">{(stock.technical).toFixed(1)}%</td>
                      <td className="px-3 py-2">{stock.forecast1m > 0 ? '+' : ''}{stock.forecast1m}%</td>
                      <td className="px-3 py-2">{stock.forecast1y}%</td>
                    </tr>
                    {expandedTicker === stock.ticker && (
                      <tr>
                        <td colSpan="7" className="p-4 bg-gray-50">
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
                              priceHistory[stock.ticker],
                              stock.forecast1m,
                            )}
                            analystForecast={generateForecastLine(
                              priceHistory[stock.ticker],
                              stock.forecast1y,
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
      ))}
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
              Confidence scores are calculated by weighting the alignment of news sentiment, technical strength, and model forecast.
            </p>
          </div>
        </details>
      </div>


      <footer className="text-center text-sm text-gray-500 mt-10">© {new Date().getFullYear()} AI Stock Picks</footer>
    </div>
  );
}

export default App;
