import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import AiStockAnalysis from './pages/AiStockAnalysis';
import StockAnalysisTools from './pages/StockAnalysisTools';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/picks" element={<Dashboard />} />
      <Route path="/ai-stock-analysis" element={<AiStockAnalysis />} />
      <Route path="/stock-analysis-tools" element={<StockAnalysisTools />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

