import { lazy, Suspense } from 'react';
import { PieChartSkeleton } from '@/components/DashboardSkeleton';

const RechartsComponents = lazy(() =>
  import('recharts').then(mod => ({
    default: ({ data, dataKey, nameKey, colors, tooltipFormatter, height = 180 }: LazyPieChartProps) => (
      <mod.ResponsiveContainer width="100%" height={height}>
        <mod.PieChart>
          <mod.Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={70}
            paddingAngle={3}
            dataKey={dataKey}
            nameKey={nameKey}
          >
            {data.map((entry, idx) => (
              <mod.Cell key={idx} fill={typeof colors === 'function' ? colors(entry, idx) : colors[idx % colors.length]} />
            ))}
          </mod.Pie>
          <mod.Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
            formatter={tooltipFormatter}
          />
        </mod.PieChart>
      </mod.ResponsiveContainer>
    ),
  }))
);

interface LazyPieChartProps {
  data: any[];
  dataKey: string;
  nameKey: string;
  colors: string[] | ((entry: any, index: number) => string);
  tooltipFormatter: (value: number, name: string) => [string, string];
  height?: number;
}

const LazyPieChart = (props: LazyPieChartProps) => (
  <Suspense fallback={<div className="h-[180px] animate-pulse rounded-lg bg-muted" />}>
    <RechartsComponents {...props} />
  </Suspense>
);

export default LazyPieChart;
