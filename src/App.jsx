import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import {
  loadAiStockAnalysisPage,
  loadDashboardPage,
  loadLandingPage,
  loadStockAnalysisToolsPage,
} from './routeLoaders';

const Landing = lazy(loadLandingPage);
const Dashboard = lazy(loadDashboardPage);
const AiStockAnalysis = lazy(loadAiStockAnalysisPage);
const StockAnalysisTools = lazy(loadStockAnalysisToolsPage);

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, search]);

  return null;
}

function RouteLoadingFallback() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-cyan-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Loading TickWise</h1>
        <p className="mt-2 text-sm text-slate-600">Preparing the dashboard and market data.</p>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/picks" element={<Dashboard />} />
          <Route path="/picks/" element={<Dashboard />} />
          <Route path="/ai-stock-analysis" element={<AiStockAnalysis />} />
          <Route path="/ai-stock-analysis/" element={<AiStockAnalysis />} />
          <Route path="/stock-analysis-tools" element={<StockAnalysisTools />} />
          <Route path="/stock-analysis-tools/" element={<StockAnalysisTools />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

