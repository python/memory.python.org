'use client';

import { Suspense, lazy } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load Recharts components to reduce initial bundle size
const LazyLineChart = lazy(() =>
  import('recharts').then((module) => ({ default: module.LineChart }))
);
const LazyLine = lazy(() =>
  import('recharts').then((module) => ({ default: module.Line }))
);
const LazyXAxis = lazy(() =>
  import('recharts').then((module) => ({ default: module.XAxis }))
);
const LazyYAxis = lazy(() =>
  import('recharts').then((module) => ({ default: module.YAxis }))
);
const LazyCartesianGrid = lazy(() =>
  import('recharts').then((module) => ({ default: module.CartesianGrid }))
);
const LazyTooltip = lazy(() =>
  import('recharts').then((module) => ({ default: module.Tooltip }))
);
const LazyLegend = lazy(() =>
  import('recharts').then((module) => ({ default: module.Legend }))
);
const LazyResponsiveContainer = lazy(() =>
  import('recharts').then((module) => ({ default: module.ResponsiveContainer }))
);

// Chart loading skeleton
function ChartSkeleton() {
  return (
    <div className="w-full h-80 p-4">
      <Skeleton className="w-full h-full rounded-lg" />
    </div>
  );
}

// Optimized trend chart component
export function LazyTrendChart({
  data,
  selectedBenchmarks,
  yAxisDomain,
  colors,
}: {
  data: any[];
  selectedBenchmarks: string[];
  yAxisDomain: [number, number];
  colors: string[];
}) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <div className="w-full h-80">
        <LazyResponsiveContainer width="100%" height="100%">
          <LazyLineChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <LazyCartesianGrid strokeDasharray="3 3" />
            <LazyXAxis dataKey="date" />
            <LazyYAxis
              domain={yAxisDomain}
              tickFormatter={(value) => {
                if (value >= 1e9) return `${(value / 1e9).toFixed(1)}GB`;
                if (value >= 1e6) return `${(value / 1e6).toFixed(1)}MB`;
                if (value >= 1e3) return `${(value / 1e3).toFixed(1)}KB`;
                return `${value}B`;
              }}
            />
            <LazyTooltip
              formatter={(value: number, name: string) => [
                `${(value / 1e6).toFixed(2)} MB`,
                name,
              ]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <LazyLegend />
            {selectedBenchmarks.map((benchmark, index) => (
              <LazyLine
                key={benchmark}
                type="monotone"
                dataKey={benchmark}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            ))}
          </LazyLineChart>
        </LazyResponsiveContainer>
      </div>
    </Suspense>
  );
}

// Optimized comparison chart component
export function LazyComparisonChart({
  data,
  metric,
  colors,
}: {
  data: any[];
  metric: string;
  colors: string[];
}) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <div className="w-full h-64">
        <LazyResponsiveContainer width="100%" height="100%">
          <LazyLineChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <LazyCartesianGrid strokeDasharray="3 3" />
            <LazyXAxis dataKey="date" />
            <LazyYAxis
              tickFormatter={(value) => {
                if (value >= 1e9) return `${(value / 1e9).toFixed(1)}GB`;
                if (value >= 1e6) return `${(value / 1e6).toFixed(1)}MB`;
                if (value >= 1e3) return `${(value / 1e3).toFixed(1)}KB`;
                return `${value}B`;
              }}
            />
            <LazyTooltip
              formatter={(value: number) => [
                `${(value / 1e6).toFixed(2)} MB`,
                metric,
              ]}
            />
            <LazyLine
              type="monotone"
              dataKey={metric}
              stroke={colors[0]}
              strokeWidth={2}
              dot={false}
            />
          </LazyLineChart>
        </LazyResponsiveContainer>
      </div>
    </Suspense>
  );
}
