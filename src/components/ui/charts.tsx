'use client';

import React, { useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { cn } from '@/lib/utils';
import { EnhancedCard, EnhancedCardHeader, EnhancedCardContent, EnhancedCardTitle } from './enhanced-card';
import { format } from 'date-fns';

// Chart theme configuration
const chartTheme = {
  colors: {
    primary: '#6366f1',
    secondary: '#8b5cf6', 
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    gradient: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
  },
  gradients: {
    primary: 'url(#primaryGradient)',
    secondary: 'url(#secondaryGradient)',
    success: 'url(#successGradient)',
  }
};

// Gradient definitions component
function ChartGradients() {
  return (
    <defs>
      <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={chartTheme.colors.primary} stopOpacity={0.3} />
        <stop offset="95%" stopColor={chartTheme.colors.primary} stopOpacity={0.05} />
      </linearGradient>
      <linearGradient id="secondaryGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={chartTheme.colors.secondary} stopOpacity={0.3} />
        <stop offset="95%" stopColor={chartTheme.colors.secondary} stopOpacity={0.05} />
      </linearGradient>
      <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={chartTheme.colors.success} stopOpacity={0.3} />
        <stop offset="95%" stopColor={chartTheme.colors.success} stopOpacity={0.05} />
      </linearGradient>
    </defs>
  );
}

// Custom tooltip component
function CustomTooltip({ active, payload, label, formatter, labelFormatter }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[150px]">
      {label && (
        <p className="text-sm font-medium text-gray-900 mb-2">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-semibold text-gray-900">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// Base chart wrapper interface
interface BaseChartProps {
  title?: string;
  description?: string;
  className?: string;
  height?: number;
  loading?: boolean;
  actions?: React.ReactNode;
  variant?: 'default' | 'elevated' | 'glass';
}

// Line Chart Component
interface LineChartProps extends BaseChartProps {
  data: any[];
  lines: {
    dataKey: string;
    name: string;
    color?: string;
    strokeWidth?: number;
    strokeDasharray?: string;
  }[];
  xAxisKey: string;
  formatXAxis?: (value: any) => string;
  formatTooltip?: (value: any) => string;
  showGrid?: boolean;
  showLegend?: boolean;
  showDots?: boolean;
  curved?: boolean;
}

export function ModernLineChart({
  data,
  lines,
  xAxisKey,
  title,
  description,
  className,
  height = 300,
  loading = false,
  actions,
  variant = 'default',
  formatXAxis,
  formatTooltip,
  showGrid = true,
  showLegend = true,
  showDots = true,
  curved = true,
}: LineChartProps) {
  return (
    <EnhancedCard variant={variant} loading={loading} className={className}>
      {(title || actions) && (
        <EnhancedCardHeader actions={actions}>
          {title && (
            <div>
              <EnhancedCardTitle>{title}</EnhancedCardTitle>
              {description && (
                <p className="text-sm text-gray-600 mt-1">{description}</p>
              )}
            </div>
          )}
        </EnhancedCardHeader>
      )}
      
      <EnhancedCardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <ChartGradients />
            {showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
            )}
            <XAxis
              dataKey={xAxisKey}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={formatXAxis}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <Tooltip
              content={<CustomTooltip formatter={formatTooltip} labelFormatter={formatXAxis} />}
            />
            {showLegend && (
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
            )}
            {lines.map((line, index) => (
              <Line
                key={line.dataKey}
                type={curved ? "monotone" : "linear"}
                dataKey={line.dataKey}
                stroke={line.color || chartTheme.colors.gradient[index % chartTheme.colors.gradient.length]}
                strokeWidth={line.strokeWidth || 2}
                strokeDasharray={line.strokeDasharray}
                dot={showDots ? { r: 4, strokeWidth: 2, fill: '#fff' } : false}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name={line.name}
                animationDuration={1500}
                animationBegin={index * 200}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </EnhancedCardContent>
    </EnhancedCard>
  );
}

// Area Chart Component
interface AreaChartProps extends BaseChartProps {
  data: any[];
  areas: {
    dataKey: string;
    name: string;
    color?: string;
    gradient?: boolean;
  }[];
  xAxisKey: string;
  formatXAxis?: (value: any) => string;
  formatTooltip?: (value: any) => string;
  showGrid?: boolean;
  showLegend?: boolean;
  stacked?: boolean;
}

export function ModernAreaChart({
  data,
  areas,
  xAxisKey,
  title,
  description,
  className,
  height = 300,
  loading = false,
  actions,
  variant = 'default',
  formatXAxis,
  formatTooltip,
  showGrid = true,
  showLegend = true,
  stacked = false,
}: AreaChartProps) {
  return (
    <EnhancedCard variant={variant} loading={loading} className={className}>
      {(title || actions) && (
        <EnhancedCardHeader actions={actions}>
          {title && (
            <div>
              <EnhancedCardTitle>{title}</EnhancedCardTitle>
              {description && (
                <p className="text-sm text-gray-600 mt-1">{description}</p>
              )}
            </div>
          )}
        </EnhancedCardHeader>
      )}
      
      <EnhancedCardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <ChartGradients />
            {showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
            )}
            <XAxis
              dataKey={xAxisKey}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={formatXAxis}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <Tooltip
              content={<CustomTooltip formatter={formatTooltip} labelFormatter={formatXAxis} />}
            />
            {showLegend && (
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="rect"
              />
            )}
            {areas.map((area, index) => (
              <Area
                key={area.dataKey}
                type="monotone"
                dataKey={area.dataKey}
                stackId={stacked ? '1' : undefined}
                stroke={area.color || chartTheme.colors.gradient[index % chartTheme.colors.gradient.length]}
                fill={
                  area.gradient 
                    ? chartTheme.gradients.primary 
                    : (area.color || chartTheme.colors.gradient[index % chartTheme.colors.gradient.length])
                }
                fillOpacity={area.gradient ? 1 : 0.1}
                name={area.name}
                animationDuration={1500}
                animationBegin={index * 200}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </EnhancedCardContent>
    </EnhancedCard>
  );
}

// Bar Chart Component
interface BarChartProps extends BaseChartProps {
  data: any[];
  bars: {
    dataKey: string;
    name: string;
    color?: string;
  }[];
  xAxisKey: string;
  formatXAxis?: (value: any) => string;
  formatTooltip?: (value: any) => string;
  showGrid?: boolean;
  showLegend?: boolean;
  horizontal?: boolean;
}

export function ModernBarChart({
  data,
  bars,
  xAxisKey,
  title,
  description,
  className,
  height = 300,
  loading = false,
  actions,
  variant = 'default',
  formatXAxis,
  formatTooltip,
  showGrid = true,
  showLegend = true,
  horizontal = false,
}: BarChartProps) {
  return (
    <EnhancedCard variant={variant} loading={loading} className={className}>
      {(title || actions) && (
        <EnhancedCardHeader actions={actions}>
          {title && (
            <div>
              <EnhancedCardTitle>{title}</EnhancedCardTitle>
              {description && (
                <p className="text-sm text-gray-600 mt-1">{description}</p>
              )}
            </div>
          )}
        </EnhancedCardHeader>
      )}
      
      <EnhancedCardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart 
            data={data} 
            layout={horizontal ? 'horizontal' : 'vertical'}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            {showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
            )}
            <XAxis
              type={horizontal ? 'number' : 'category'}
              dataKey={horizontal ? undefined : xAxisKey}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={formatXAxis}
            />
            <YAxis
              type={horizontal ? 'category' : 'number'}
              dataKey={horizontal ? xAxisKey : undefined}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={horizontal ? formatXAxis : undefined}
            />
            <Tooltip
              content={<CustomTooltip formatter={formatTooltip} labelFormatter={formatXAxis} />}
            />
            {showLegend && (
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="rect"
              />
            )}
            {bars.map((bar, index) => (
              <Bar
                key={bar.dataKey}
                dataKey={bar.dataKey}
                fill={bar.color || chartTheme.colors.gradient[index % chartTheme.colors.gradient.length]}
                name={bar.name}
                radius={[4, 4, 0, 0]}
                animationDuration={1200}
                animationBegin={index * 100}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </EnhancedCardContent>
    </EnhancedCard>
  );
}

// Pie Chart Component
interface PieChartProps extends BaseChartProps {
  data: { name: string; value: number; color?: string }[];
  formatTooltip?: (value: any) => string;
  showLegend?: boolean;
  innerRadius?: number;
  showLabels?: boolean;
}

export function ModernPieChart({
  data,
  title,
  description,
  className,
  height = 300,
  loading = false,
  actions,
  variant = 'default',
  formatTooltip,
  showLegend = true,
  innerRadius = 0,
  showLabels = true,
}: PieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>();

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(undefined);
  };

  return (
    <EnhancedCard variant={variant} loading={loading} className={className}>
      {(title || actions) && (
        <EnhancedCardHeader actions={actions}>
          {title && (
            <div>
              <EnhancedCardTitle>{title}</EnhancedCardTitle>
              {description && (
                <p className="text-sm text-gray-600 mt-1">{description}</p>
              )}
            </div>
          )}
        </EnhancedCardHeader>
      )}
      
      <EnhancedCardContent>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={height / 3}
              innerRadius={innerRadius}
              dataKey="value"
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
              animationDuration={1200}
              label={showLabels ? ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%` : false}
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.color || 
                    chartTheme.colors.gradient[index % chartTheme.colors.gradient.length]
                  }
                  stroke={activeIndex === index ? '#fff' : 'none'}
                  strokeWidth={activeIndex === index ? 2 : 0}
                />
              ))}
            </Pie>
            <Tooltip
              content={<CustomTooltip formatter={formatTooltip} />}
            />
            {showLegend && (
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="circle"
              />
            )}
          </PieChart>
        </ResponsiveContainer>
      </EnhancedCardContent>
    </EnhancedCard>
  );
}