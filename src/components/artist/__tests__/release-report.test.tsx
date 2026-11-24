/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReleaseReport from '../release-report';

const report = {
  rows: [
    {
      dropId: 'drop-1',
      artistName: 'Nahvee',
      title: 'Nahvee Single',
      status: 'PUBLISHED',
      currency: 'usd',
      releaseDate: '2026-12-01T00:00:00.000Z',
      windowStart: '2026-11-24T00:00:00.000Z',
      windowEnd: '2026-12-15T00:00:00.000Z',
      unitsSold: 12,
      buyers: 11,
      grossSalesCents: 12000,
      refundsCents: 1000,
      platformFeeCents: 1200,
      stripeFeeEstimateCents: 708,
      artistNetCents: 9092,
      newMembers: 4,
      costs: {
        recordingCents: 5000,
        videoCents: 0,
        marketingCents: 2000,
        otherCents: 0,
        fixedShareCents: 0,
        totalCents: 7000,
      },
      profitCents: 2092,
    },
  ],
  totals: [
    {
      currency: 'usd',
      releases: 1,
      unitsSold: 12,
      grossSalesCents: 12000,
      artistNetCents: 9092,
      costsCents: 7000,
      profitCents: 2092,
    },
  ],
  assumptions: { windowDaysAfterRelease: 14, stripeFeePercent: 2.9, stripeFeeFixedCents: 30 },
};

const ok = (data: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data }) });

describe('ReleaseReport', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() => ok(report)) as any;
  });

  it('shows each release with its numbers and the totals', async () => {
    render(<ReleaseReport />);

    expect(await screen.findByText('Nahvee Single')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/artist/reports/releases');
    expect(screen.getAllByText('$120.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$20.92').length).toBe(2); // profit row + total
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download CSV' })).toHaveAttribute(
      'href',
      '/api/artist/reports/releases?format=csv'
    );
  });

  it('saves edited costs and reloads', async () => {
    render(<ReleaseReport />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit costs for Nahvee Single' }));
    fireEvent.change(screen.getByLabelText('Video ($)'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save costs' }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/artist/drops/drop-1/costs',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ recording: 50, video: 300, marketing: 20, other: 0 }),
        })
      )
    );
    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.length).toBe(3));
  });

  it('applies a monthly fixed cost to the report and the CSV link', async () => {
    render(<ReleaseReport />);
    await screen.findByText('Nahvee Single');
    fireEvent.change(screen.getByLabelText('Monthly fixed costs ($)'), { target: { value: '73' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/artist/reports/releases?fixedMonthly=73')
    );
    expect(screen.getByRole('link', { name: 'Download CSV' })).toHaveAttribute(
      'href',
      '/api/artist/reports/releases?format=csv&fixedMonthly=73'
    );
  });

  it('shows every artist read only for an admin', async () => {
    render(<ReleaseReport admin />);
    expect(await screen.findByText(/Nahvee ·/)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/reports/releases');
    expect(screen.queryByRole('button', { name: /Edit costs/ })).not.toBeInTheDocument();
  });

  it('says so when there are no releases', async () => {
    global.fetch = jest.fn(() => ok({ ...report, rows: [], totals: [] })) as any;
    render(<ReleaseReport />);
    expect(await screen.findByText(/No releases yet/)).toBeInTheDocument();
  });
});
