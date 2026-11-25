// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryChart, getCategoryTooltipPlacement, MonthlyChart } from './FinanceCharts.jsx';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class ResizeObserverStub {
    constructor(callback) {
      this.callback = callback;
    }
    observe(target) {
      this.callback([{ target, contentRect: { width: 320, height: 200 } }]);
    }
    unobserve() {}
    disconnect() {}
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('finance charts', () => {
  it('renders clear empty states when there is no chart data', () => {
    const { rerender } = render(<MonthlyChart data={[]} />);
    expect(screen.getByText('No monthly activity yet')).toBeTruthy();

    rerender(<CategoryChart data={[]} />);
    expect(screen.getByText('No expenses this month')).toBeTruthy();
  });

  it('renders populated category totals and labels every chart segment', () => {
    const { container } = render(<CategoryChart data={[
      { category: 'Food', total: 12.5 },
      { category: 'Transport', total: 8 },
      { category: 'Housing', total: 20 },
      { category: 'Bills', total: 5 },
      { category: 'Health', total: 4 },
      { category: 'Travel', total: 10 },
    ]} />);
    expect(screen.getByText('Food')).toBeTruthy();
    expect(screen.getByText('Travel')).toBeTruthy();
    expect(screen.getByText('spent')).toBeTruthy();
    expect(container.querySelector('.recharts-responsive-container svg')).not.toBeNull();
  });

  it('places category callouts at the outside edge for left- and right-side slices', () => {
    const housing = getCategoryTooltipPlacement({
      midAngle: 160, cx: 180, cy: 83, outerRadius: 76, tooltipPosition: { x: 108, y: 96 },
    });
    const food = getCategoryTooltipPlacement({
      midAngle: 340, cx: 180, cy: 83, outerRadius: 76, tooltipPosition: { x: 108, y: 72 },
    });

    expect(housing.side).toBe('left');
    expect(housing.position.x).toBe(0);
    expect(food.side).toBe('right');
    expect(food.position.x).toBe(260);
  });

  it('renders the monthly bar chart when transaction totals are present', () => {
    const { container } = render(<MonthlyChart data={[
      { month: '2026-11', label: 'Nov', income: 100, expenses: 40 },
    ]} />);
    expect(container.querySelector('.recharts-responsive-container svg')).not.toBeNull();
  });
});
