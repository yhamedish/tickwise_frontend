import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

const StockChart = ({ ticker, priceData, mlForecast = [], analystForecast = [] }) => {
  console.log('after mod')
  console.log(priceData)
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    // Only render the chart when we have some price data. If there's no data,
    // just exit early. This prevents ECharts from throwing errors on empty
    // arrays.
    if (!priceData || priceData.length === 0) return;

    // Extract OHLC arrays for the candlestick series. ECharts expects the
    // ordering: [open, close, low, high].
    const ohlc = priceData.map(item => [item.open, item.close, item.low, item.high]);
    const dates = priceData.map(item => item.time);

    // Map forecast data into ECharts series format. Each forecast entry has
    // { time, value }. We map it to [time, value]. If no forecast is provided
    // or the length doesn't match the main price series, ECharts will still
    // render the points on the correct dates.
    const mlLine = mlForecast.map(item => [item.time, item.value]);
    const analystLine = analystForecast.map(item => [item.time, item.value]);
    const volumes = priceData.map(item => item.volume || 0);

    const option = {
      title: { text: `${ticker} Price & Forecast`, left: 'center' },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(39, 189, 102, 0.9)',
        textStyle: { fontSize: 11 },
        formatter: (params) => {
          // params is an array of all series at that x point
          const date = params[0].axisValue;
          const candle = params.find(p => p.seriesType === 'candlestick');
          const volume = params.find(p => p.seriesName === 'Volume');
          const ml = params.find(p => p.seriesName === 'ML Forecast');
          const analyst = params.find(p => p.seriesName === 'Analyst Forecast');

          let text = `<b>${date}</b><br/>`;

          if (candle) {
            const [open, close, low, high] = candle.data;
            text += `Open: ${open}<br/>Close: ${close}<br/>Low: ${low}<br/>High: ${high}<br/>`;
          }

          if (volume) {
            text += `Volume: ${volume.data.toLocaleString()}<br/>`;
          }

          if (ml) {
            text += `ML Forecast: ${ml.data[1].toFixed(2)}<br/>`;
          }

          if (analyst) {
            text += `Analyst Forecast: ${analyst.data[1].toFixed(2)}<br/>`;
          }

          return text;
        }
      },

      legend: {
        top: 30,
        data: ['Candlestick', 'ML Forecast', 'Analyst Forecast', 'Volume'],
      },

      toolbox: {
        show: true,
        right: 20,       // keep it top-right, adjust if you want
        top: 10,
        feature: {
          restore: { title: 'Reset Zoom' }, // <- this is the reset button
          saveAsImage: { title: 'Save PNG' } // optional, nice to have
        }
      },
      grid: [
        {
          left: '10%',
          right: '8%',
          top: 60,
          height: '65%', // leave space for volume and labels
        },
        {
          left: '10%',
          right: '8%',
          top: '77%',     // push volume grid slightly below price chart
          height: '15%',  // gives bars room and separates from labels
        },
      ],
      xAxis: [
        {
          type: 'category',
          data: dates,
          scale: true,
          boundaryGap: false,
          axisLine: { onZero: false },
          gridIndex: 0,
        },
        {
          type: 'category',
          data: dates,
          gridIndex: 1,
          axisLabel: { show: false },
          axisTick: { show: false },
        },
      ],
      yAxis: [
        { scale: true, gridIndex: 0 },
        {
          gridIndex: 1,
          min: 0,                         // force bars to start at y=0
          axisLabel: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
        },
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1] },
        { type: 'inside', yAxisIndex: [0] },
        { type: 'slider', xAxisIndex: [0] },
        { type: 'slider', yAxisIndex: [0], right: 0 }
      ],
      series: [
        {
          name: ticker,
          type: 'candlestick',
          data: ohlc,
          itemStyle: {
            color: '#26a69a',
            color0: '#ef5350',
            borderColor: '#26a69a',
            borderColor0: '#ef5350',
          },
          xAxisIndex: 0,
          yAxisIndex: 0,
        },
        {
          name: 'ML Forecast',
          type: 'line',
          data: mlLine,
          lineStyle: { color: '#2196F3' },
          smooth: true,
          xAxisIndex: 0,
          yAxisIndex: 0,
        },
        {
          name: 'Analyst Forecast',
          type: 'line',
          data: analystLine,
          lineStyle: { color: '#4CAF50' },
          smooth: true,
          xAxisIndex: 0,
          yAxisIndex: 0,
        },
        {
          name: 'Volume',
          type: 'bar',
          data: volumes,
          xAxisIndex: 1,
          yAxisIndex: 1,
          itemStyle: { color: '#90A4AE' },
        },
      ],
    };




    // Dispose of existing instance if it exists to prevent memory leaks
    if (chartInstance.current) {
      chartInstance.current.dispose();
    }
    chartInstance.current = echarts.init(chartRef.current);
    chartInstance.current.setOption(option);


    // Force a resize after setting the option to ensure the chart fills
    // the available space. Without this, charts embedded in table cells
    // sometimes render blank until a resize event occurs.
    chartInstance.current.resize();

    return () => {
      chartInstance.current?.dispose();
    };
  }, [ticker, priceData, mlForecast, analystForecast]);

  return <div ref={chartRef} style={{ width: '100%', height: '400px' }} />;
};

export default StockChart;