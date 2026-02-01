import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

function computeCutoffIndex(timesISO, months = 4) {
  if (!timesISO?.length) return 0;

  const last = new Date(timesISO[timesISO.length - 1]); // YYYY-MM-DD
  const cutoff = new Date(last);
  cutoff.setMonth(cutoff.getMonth() - months);

  // find first index >= cutoff
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  const idx = timesISO.findIndex(t => t >= cutoffISO);
  return idx === -1 ? 0 : idx;
}


const StockChart = ({
  ticker,
  priceData,
  mlForecast = [],
  mlForecastP5 = [],
  mlForecastP95 = [],
  analystForecast = [],
  mlHistory = []
}) => {
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
    const volumes = priceData.map(item => item.volume || 0);
    // // add ML forecast x-values that aren't already present
    // for (const { time } of mlForecast) {
    //   if (time && !dates.includes(time)) dates.push(time);
    // }

        // If you have a target future date in mlForecast (e.g., last+30d)
    const future_1m = mlForecast?.[mlForecast.length - 1]?.time; // 'YYYY-MM-DD'
    const future_ml_val = mlForecast?.[mlForecast.length - 1]?.value;
    if (future_1m) {
      const last = dates[dates.length - 1]; // last candle date
      const d = new Date(last + 'T00:00:00');
      const end = new Date(future_1m + 'T00:00:00');

      // add each missing day as a category to create proportional spacing
      while (d < end) {
        d.setDate(d.getDate() + 1);
        const iso = d.toISOString().slice(0, 10);
        if (!dates.includes(iso)) {
          dates.push(iso);
          ohlc.push([null, null, null, null]);   // pad candles
          volumes.push(null);                    // pad volume
        }
      }
    }
    const cutoffIndex = computeCutoffIndex(dates, 4);
    const historyMap = new Map();
    mlHistory.forEach(point => {
      if (!point?.time || point.value == null) return;
      historyMap.set(point.time, point.value);
    });

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    const updatePriceYAxisToZoom = () => {
      const opt = chartInstance.current?.getOption();
      if (!opt?.dataZoom?.length) return;

      // your zoom is dataZoom[0] with startValue/endValue
      const dz = opt.dataZoom[0];

      // Prefer startValue/endValue; fall back to percent if needed
      let start = dz.startValue;
      let end = dz.endValue;

      if (start == null && dz.start != null) start = Math.floor((dz.start / 100) * (ohlc.length - 1));
      if (end == null && dz.end != null) end = Math.floor((dz.end / 100) * (ohlc.length - 1));

      start = clamp(start ?? 0, 0, ohlc.length - 1);
      end = clamp(end ?? (ohlc.length - 1), 0, ohlc.length - 1);
      if (end < start) [start, end] = [end, start];

      // Compute min(low) and max(high) in the visible window
      let minLow = Infinity;
      let maxHigh = -Infinity;
      for (let i = start; i <= end; i++) {
        const low = ohlc[i][2];
        const high = ohlc[i][3];
        if (low != null && low < minLow) minLow = low;
        if (high != null &&  high > maxHigh) maxHigh = high;
        const historyValue = historyMap.get(dates[i]);
        if (historyValue != null) {
          if (historyValue < minLow) minLow = historyValue;
          if (historyValue > maxHigh) maxHigh = historyValue;
        }
      }
      if (future_ml_val != -100) {
        if (future_ml_val > maxHigh) maxHigh = future_ml_val;
        if (future_ml_val < minLow) minLow = future_ml_val;
      }
    

      if (!isFinite(minLow) || !isFinite(maxHigh)) return;

      // Add a bit of padding so candles don’t touch top/bottom
      const range = Math.max(1e-9, maxHigh - minLow);
      const pad = range * 0.06;
      const DECIMALS = 0;
      const roundDown = (v) => Math.floor(v * 10 ** DECIMALS) / 10 ** DECIMALS;
      const roundUp   = (v) => Math.ceil(v * 10 ** DECIMALS) / 10 ** DECIMALS;

      chartInstance.current.setOption(
        {
          yAxis: [
            { min: roundDown(minLow - pad), max: roundUp(maxHigh + pad), scale: true, gridIndex: 0 },
            {} // keep volume axis unchanged
          ]
        },
        { lazyUpdate: true }
      );
      

    };


    // Map forecast data into ECharts series format. Each forecast entry has
    // { time, value }. We map it to [time, value]. If no forecast is provided
    // or the length doesn't match the main price series, ECharts will still
    // render the points on the correct dates.
    const mlLine = mlForecast.map(item => [item.time, item.value]);
    const mlLineP5 = mlForecastP5.map(item => [item.time, item.value]);
    const mlLineP95 = mlForecastP95.map(item => [item.time, item.value]);
    const analystLine = analystForecast.map(item => [item.time, item.value]);
    const mlHistoryPoints = mlHistory.map(item => [item.time, item.value]);
    


    const option = {
      title: { text: `${ticker} Price & Forecast`, left: 'center', textStyle: { color: '#0f172a', fontSize: 14, fontWeight: 600 } },
      backgroundColor: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: '#f8fafc' },
        { offset: 0.55, color: '#ffffff' },
        { offset: 1, color: '#ecfeff' }
      ]),
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        textStyle: { fontSize: 11, color: '#f8fafc' },
        formatter: (params) => {
          // params is an array of all series at that x point
          const date = params[0].axisValue;
          const candle = params.find(p => p.seriesType === 'candlestick');
          const volume = params.find(p => p.seriesName === 'Volume');
          const ml = params.find(p => p.seriesName === 'ML Forecast');
          const analyst = params.find(p => p.seriesName === 'Analyst Forecast');
          const mlP5 = params.find(p => p.seriesName === 'ML P5');
          const mlP95 = params.find(p => p.seriesName === 'ML P95');
          const mlHistoryPoint = params.find(p => p.seriesName === 'ML 1M History');

          let text = `<b>${date}</b><br/>`;

          if (candle) {
            // ECharts candlestick tooltip values are usually in `value`
            // (and sometimes `data` is an object), so guard it.
            const v = Array.isArray(candle.value)
              ? candle.value
              : (Array.isArray(candle.data) ? candle.data : null);
            console.log(v[1])
            if (v[1] != null) {
              const [idx, open, close, low, high] = v;
              text += `Open: ${open}<br/>Close: ${close}<br/>Low: ${low}<br/>High: ${high}<br/>`;
            }
          }


          if (volume?.data != null) {
            text += `Volume: ${volume.data.toLocaleString()}<br/>`;
          }

          if (ml) {
            text += `ML Forecast: ${ml.data[1].toFixed(2)}<br/>`;
          }

          if (analyst) {
            text += `Analyst Forecast: ${analyst.data[1].toFixed(2)}<br/>`;
          }
          if (mlP5) {
            text += `ML P5: ${mlP5.data[1].toFixed(2)}<br/>`;
          }
          if (mlP95) {
            text += `ML P95: ${mlP95.data[1].toFixed(2)}<br/>`;
          }
          if (mlHistoryPoint) {
            text += `ML 1M (History): ${mlHistoryPoint.data[1].toFixed(2)}<br/>`;
          }

          return text;
        }
      },

      legend: {
        top: 30,
        textStyle: { color: '#334155' },
        data: [ticker, 'ML Forecast', 'ML P5', 'ML P95', 'ML 1M History', 'Analyst Forecast', 'Volume'],
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
          max: value => value.max + 5,
          data: dates,
          scale: true,
          boundaryGap: true,
          axisLine: { onZero: false, lineStyle: { color: '#94a3b8' } },
          axisLabel: { color: '#64748b' },
          gridIndex: 0,
        },
        {
          type: 'category',
          data: dates,
          boundaryGap: true,
          max: value => value.max + 5,
          scale: true,
          axisLine: { onZero: false, lineStyle: { color: '#94a3b8' } },
          axisLabel: { color: '#64748b' },
          gridIndex: 1,
          axisLabel: { show: false, color: '#64748b' },
          axisTick: { show: false },
        },
      ],
      yAxis: [
        {
          scale: true,
          gridIndex: 0,
          axisLabel: { color: '#64748b' },
          splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.25)' } },
        },
        {
          gridIndex: 1,
          min: 0,                         // force bars to start at y=0
          axisLabel: { show: false, color: '#64748b' },
          axisTick: { show: false },
          splitLine: { show: false },
        },
      ],
      // dataZoom: [
      //   { type: 'inside', xAxisIndex: [0, 1] },
      //   { type: 'inside', yAxisIndex: [0] },
      //   { type: 'slider', xAxisIndex: [0] },
      //   { type: 'slider', yAxisIndex: [0], right: 0 }
      // ],
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0,1],
          startValue: cutoffIndex,
          endValue: dates.length - 1
        },
        {
          type: 'slider',
          xAxisIndex: [0,1],
          startValue: cutoffIndex,
          endValue: dates.length - 1,
          height: 22,
          bottom: 6
        }
      ],

      series: [
        {
          name: ticker,
          type: 'candlestick',
          data: ohlc,
          itemStyle: {
            color: '#22c55e',
            color0: '#ef4444',
            borderColor: '#16a34a',
            borderColor0: '#dc2626',
          },
          xAxisIndex: 0,
          yAxisIndex: 0,
        },
        {
          name: 'ML Forecast',
          type: 'line',
          data: mlLine,
          lineStyle: { color: '#3b82f6', width: 2, type: 'dashed' },
          smooth: true,
          xAxisIndex: 0,
          yAxisIndex: 0,
        },
        {
          name: 'ML P5',
          type: 'line',
          data: mlLineP5,
          lineStyle: { color: '#a855f7', width: 1.5 },
          smooth: true,
          xAxisIndex: 0,
          yAxisIndex: 0,
        },
        {
          name: 'ML P95',
          type: 'line',
          data: mlLineP95,
          lineStyle: { color: '#f97316', width: 1.5 },
          smooth: true,
          xAxisIndex: 0,
          yAxisIndex: 0,
        },
        {
          name: 'Analyst Forecast',
          type: 'line',
          data: analystLine,
          lineStyle: { color: '#10b981', width: 2 },
          smooth: true,
          xAxisIndex: 0,
          yAxisIndex: 0,
        },
        {
          name: 'ML 1M History',
          type: 'scatter',
          data: mlHistoryPoints,
          itemStyle: { color: '#06b6d4', shadowBlur: 8, shadowColor: 'rgba(6, 182, 212, 0.4)' },
          symbolSize: 8,
          xAxisIndex: 0,
          yAxisIndex: 0,
        },
        {
          name: 'Volume',
          type: 'bar',
          data: volumes,
          xAxisIndex: 1,
          yAxisIndex: 1,
          itemStyle: { color: '#38bdf8', opacity: 0.55 },
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
    // ✅ attach zoom handler ONCE (outside the function)
    chartInstance.current.off('dataZoom');
    chartInstance.current.on('dataZoom', updatePriceYAxisToZoom);

    // ✅ set initial y-range to the default zoom window
    updatePriceYAxisToZoom();


    return () => {
      chartInstance.current?.dispose();
    };
  }, [ticker, priceData, mlForecast, mlForecastP5, mlForecastP95, analystForecast, mlHistory]);

  return <div ref={chartRef} style={{ width: '100%', height: '400px' }} />;
};

export default StockChart;
