import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

const formatPct = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
};

const PortfolioReturnChart = ({ data = [], height = 280 }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

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

    const option = {
      title: {
        text: 'Portfolio Return Over Time',
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
          const value = params?.[0]?.data;
          const holdings = holdingsMap.get(date) || [];
          let text = `<b>${date}</b><br/>Portfolio: ${formatPct(value)}<br/>`;
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
          data: values,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#0ea5e9', width: 2 },
          areaStyle: { color: 'rgba(14, 165, 233, 0.12)' },
        },
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
  }, [data, height]);

  return <div ref={chartRef} style={{ width: '100%', height: `${height}px` }} />;
};

export default PortfolioReturnChart;
