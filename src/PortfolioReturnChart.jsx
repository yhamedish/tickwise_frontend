import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

const formatPct = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
};

const PortfolioReturnChart = ({
  data = [],
  benchmarkData = [],
  benchmarkLabel = 'S&P 500 Buy & Hold',
  height = 280,
}) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const portfolioColor = '#0ea5e9';
  const benchmarkColor = '#64748b';

  useEffect(() => {
    if (!data || data.length === 0) {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
      return;
    }

    const dates = data.map((d) => d.time);
    const values = data.map((d) => d.value);
    const holdingsMap = new Map(data.map((d) => [d.time, d.holdings || []]));
    const benchmarkMap = new Map((benchmarkData || []).map((d) => [d.time, d.value]));
    const benchmarkValues = dates.map((date) => benchmarkMap.get(date) ?? null);
    const showBenchmark = benchmarkValues.some((value) => Number.isFinite(value));

    const option = {
      color: showBenchmark ? [portfolioColor, benchmarkColor] : [portfolioColor],
      title: {
        text: showBenchmark ? 'Backtest Return vs Benchmark' : 'Portfolio Return Over Time',
        left: 'center',
        textStyle: { color: '#0f172a', fontSize: 14, fontWeight: 600 },
      },
      backgroundColor: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: '#f8fafc' },
        { offset: 0.6, color: '#ffffff' },
        { offset: 1, color: '#eef2ff' },
      ]),
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        textStyle: { fontSize: 11, color: '#f8fafc' },
        formatter: (params) => {
          const date = params?.[0]?.axisValue;
          const portfolioPoint = params?.find((item) => item?.seriesName === 'Portfolio Return');
          const benchmarkPoint = params?.find((item) => item?.seriesName === benchmarkLabel);
          const holdings = holdingsMap.get(date) || [];
          let text = `<b>${date}</b><br/>Portfolio: ${formatPct(portfolioPoint?.data)}<br/>`;
          if (benchmarkPoint && Number.isFinite(benchmarkPoint.data)) {
            text += `${benchmarkLabel}: ${formatPct(benchmarkPoint.data)}<br/>`;
          }
          if (holdings.length) {
            text += '<br/><span>Holdings</span><br/>';
            holdings.forEach((h) => {
              text += `${h.ticker}: ${formatPct(h.returnPct)}<br/>`;
            });
          } else {
            text += '<br/>Holdings: Cash<br/>';
          }
          return text;
        },
      },
      legend: showBenchmark
        ? {
            top: 26,
            icon: 'rect',
            itemWidth: 18,
            itemHeight: 3,
            textStyle: { color: '#475569', fontSize: 11 },
          }
        : undefined,
      grid: { left: '8%', right: '6%', top: 55, bottom: 30 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#94a3b8' } },
        axisLabel: { color: '#64748b' },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#64748b',
          formatter: (v) => `${v}%`,
        },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.25)' } },
      },
      series: [
        {
          name: 'Portfolio Return',
          type: 'line',
          color: portfolioColor,
          data: values,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: portfolioColor, width: 2 },
          areaStyle: { color: 'rgba(14, 165, 233, 0.12)' },
        },
        ...(showBenchmark
          ? [
              {
                name: benchmarkLabel,
                type: 'line',
                color: benchmarkColor,
                data: benchmarkValues,
                smooth: true,
                symbol: 'none',
                connectNulls: true,
                lineStyle: { color: benchmarkColor, width: 2, type: 'dashed' },
              },
            ]
          : []),
      ],
    };

    if (chartInstance.current) {
      chartInstance.current.dispose();
    }
    chartInstance.current = echarts.init(chartRef.current);
    chartInstance.current.setOption(option);
    chartInstance.current.resize();

    return () => {
      chartInstance.current?.dispose();
    };
  }, [data, benchmarkData, benchmarkLabel, height]);

  return <div ref={chartRef} style={{ width: '100%', height: `${height}px` }} />;
};

export default PortfolioReturnChart;
