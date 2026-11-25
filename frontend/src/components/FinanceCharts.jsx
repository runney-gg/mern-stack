import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney } from './TransactionList.jsx';

const chartColors = ['#286347', '#4f795c', '#72916e', '#9bab7f', '#b99061', '#a76556', '#66847b'];
const compactMoney = (value) => (value >= 1000 ? `NPR ${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : `${value}`);
const categoryTooltipWidth = 100;

export function getCategoryTooltipPlacement(sector) {
  const side = Math.cos((sector.midAngle * Math.PI) / 180) >= 0 ? 'right' : 'left';
  const chartWidth = sector.cx * 2;
  const chartHeight = sector.cy * 2;
  const x = side === 'right'
    ? Math.min(chartWidth - categoryTooltipWidth, sector.cx + sector.outerRadius + 8)
    : Math.max(0, sector.cx - sector.outerRadius - categoryTooltipWidth - 8);
  const y = Math.max(4, Math.min(chartHeight - 48, sector.tooltipPosition.y - 24));
  return { side, position: { x, y } };
}

function CategoryTooltip({ active, payload, side }) {
  const entry = payload?.[0];
  if (!active || !entry) return null;

  return (
    <div className="category-hover-tooltip" role="status" data-side={side}>
      <strong>{entry.name}</strong>
      <span>{formatMoney(entry.value)}</span>
    </div>
  );
}

export function MonthlyChart({ data }) {
  const hasValues = data.some((item) => item.income > 0 || item.expenses > 0);
  return (
    <div className="chart-frame">
      {hasValues ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 6, left: -12, bottom: 0 }} barGap={5}>
            <CartesianGrid stroke="#e5e9e3" strokeDasharray="4 5" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#59665d', fontSize: 11 }} dy={8} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4e5c52', fontSize: 11 }} tickFormatter={compactMoney} width={52} />
            <Tooltip formatter={(value) => formatMoney(value)} contentStyle={{ borderRadius: 8, border: '1px solid #e4e8e1', fontSize: 12, boxShadow: '0 4px 14px rgba(32, 43, 36, .10)' }} />
            <Bar dataKey="income" name="Income" fill="#286347" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="expenses" name="Expenses" fill="#a64f45" radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      ) : <div className="chart-empty-state"><span className="empty-state-icon">▥</span><strong>No monthly activity yet</strong><span>Add transactions to see income and spending trends.</span></div>}
    </div>
  );
}

export function CategoryChart({ data }) {
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const [tooltipSide, setTooltipSide] = useState('right');
  const total = data.reduce((sum, item) => sum + item.total, 0);
  return (
    <div className="category-chart-content">
      {total > 0 ? (
        <>
          <div className="pie-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="total"
                  nameKey="category"
                  innerRadius="68%"
                  outerRadius="92%"
                  paddingAngle={3}
                  stroke="none"
                  onMouseEnter={(sector) => {
                    const placement = getCategoryTooltipPlacement(sector);
                    const { side } = placement;
                    setTooltipSide(side);
                    setTooltipPosition(placement.position);
                  }}
                >
                  {data.map((item, index) => <Cell key={item.category} fill={chartColors[index % chartColors.length]} />)}
                </Pie>
                <Tooltip
                  position={tooltipPosition || undefined}
                  content={<CategoryTooltip side={tooltipSide} />}
                  wrapperStyle={{ zIndex: 2, pointerEvents: 'none' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-center"><strong>{formatMoney(total)}</strong><span>spent</span></div>
          </div>
          <ul className="category-legend">
            {data.map((item, index) => (
              <li key={item.category}><span className="legend-name"><i style={{ backgroundColor: chartColors[index % chartColors.length] }} />{item.category}</span><strong>{formatMoney(item.total)}</strong></li>
            ))}
          </ul>
        </>
      ) : <div className="chart-empty-state category-empty-state"><span className="empty-state-icon">◌</span><strong>No expenses this month</strong><span>Category spending will appear here.</span></div>}
    </div>
  );
}
