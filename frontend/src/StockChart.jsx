import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

const StockChart = ({ ticker, priceData, mlForecast, analystForecast }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!priceData || priceData.length === 0) return;

    // Build candlestick data and separate date arrays once.
    const ohlc = priceData.map((item) => [item.open, item.close, item.low, item.high]);
    const dates = priceData.map((item) => item.time);

    /*
     * The original implementation constructed forecast lines by pairing an
     * existing price date with the forecast value.  That approach broke when
     * the forecast contained its own timestamps.  Here we instead map each
     * forecast item to a tuple of [time, value], preserving the timestamp
     * returned by the forecast generator.  This yields a more accurate chart.
     */
    const mlLine = mlForecast.map((item) => [item.time, item.value]);
    const analystLine = analystForecast.map((item) => [item.time, item.value]);

    const option = {
      title: { text: `${ticker} Price & Forecast`, left: 'center' },
      tooltip: { trigger: 'axis' },
      legend: {
        top: 30,
        data: ['Candlestick', 'ML Forecast', 'Analyst Forecast']
      },
      xAxis: {
        type: 'category',
        data: dates,
        scale: true,
        boundaryGap: false,
        axisLine: { onZero: false }
      },
      yAxis: { scale: true },
      dataZoom: [{ type: 'inside' }, { type: 'slider' }],
      series: [
        
        {
          name: 'Candlestick',
          type: 'candlestick',
          data: ohlc,
          itemStyle: {
            color: '#26a69a',     // Green for bullish candles (close > open)
            color0: '#ef5350',    // Red for bearish candles (close < open)
            borderColor: '#26a69a',
            borderColor0: '#ef5350'
          }
        },
        {
          name: 'ML Forecast',
          type: 'line',
          data: mlLine,
          lineStyle: { color: '#2196F3' },
        },
        {
          name: 'Analyst Forecast',
          type: 'line',
          data: analystLine,
          lineStyle: { color: '#4CAF50' },
        },
      ],
    };

    if (chartInstance.current) {
      chartInstance.current.dispose();
    }
    chartInstance.current = echarts.init(chartRef.current);
    chartInstance.current.setOption(option);

    return () => {
      chartInstance.current?.dispose();
    };
  }, [ticker, priceData, mlForecast, analystForecast]);

  return <div ref={chartRef} style={{ width: '100%', height: '400px' }} />;
};

export default StockChart;