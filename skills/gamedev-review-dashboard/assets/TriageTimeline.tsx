import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';

interface TimelineDataPoint {
  timestamp: string; // e.g., "00:00", "06:00"
  revenue: number;
  paymentSuccess: number; // as percentage
  crashFree: number; // as percentage
  negativeFeedback: number;
}

interface EventMarker {
  timestamp: string;
  type: 'release' | 'liveops_start' | 'liveops_end' | 'incident' | 'config';
  label: string;
}

interface TriageTimelineProps {
  data: TimelineDataPoint[];
  events: EventMarker[];
  width?: number;
  height?: number;
}

const EVENT_ICONS: Record<EventMarker['type'], string> = {
  release: '×',
  liveops_start: '▲',
  liveops_end: '▼',
  incident: '⚠',
  config: '⚙',
};

const EVENT_COLORS: Record<EventMarker['type'], string> = {
  release: '#3b82f6',
  liveops_start: '#22c55e',
  liveops_end: '#6b7280',
  incident: '#ef4444',
  config: '#f59e0b',
};

export function TriageTimeline({
  data,
  events,
  width = 1200,
  height = 400,
}: TriageTimelineProps) {
  return (
    <div
      style={{
        padding: '1.5rem',
        borderRadius: '0.5rem',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
      }}
    >
      <h3
        style={{
          fontSize: '1.125rem',
          fontWeight: 700,
          color: '#111827',
          marginBottom: '1rem',
        }}
      >
        Triage Timeline (24h)
      </h3>

      {/* Event Markers Legend */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1rem',
          fontSize: '0.75rem',
          color: '#6b7280',
        }}
      >
        {events.map((event, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ color: EVENT_COLORS[event.type], fontWeight: 700, fontSize: '1rem' }}>
              {EVENT_ICONS[event.type]}
            </span>
            <span>{event.label}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <LineChart width={width} height={height} data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="timestamp"
          stroke="#6b7280"
          style={{ fontSize: '0.75rem' }}
        />
        <YAxis
          yAxisId="left"
          stroke="#6b7280"
          style={{ fontSize: '0.75rem' }}
          label={{ value: 'Revenue / Feedback', angle: -90, position: 'insideLeft' }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#6b7280"
          style={{ fontSize: '0.75rem' }}
          label={{ value: 'Success Rate (%)', angle: 90, position: 'insideRight' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '0.25rem',
            fontSize: '0.875rem',
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: '0.875rem' }}
        />

        {/* Event markers */}
        {events.map((event, idx) => (
          <ReferenceLine
            key={idx}
            x={event.timestamp}
            stroke={EVENT_COLORS[event.type]}
            strokeDasharray="3 3"
            label={{
              value: EVENT_ICONS[event.type],
              position: 'top',
              fill: EVENT_COLORS[event.type],
              fontSize: 16,
            }}
          />
        ))}

        {/* Lines */}
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="revenue"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          name="Revenue"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="paymentSuccess"
          stroke="#22c55e"
          strokeWidth={2}
          dot={false}
          name="Payment Success %"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="crashFree"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
          name="Crash-Free %"
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="negativeFeedback"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          name="Negative Feedback"
        />
      </LineChart>
    </div>
  );
}

// Example usage:
// const timelineData: TimelineDataPoint[] = [
//   { timestamp: "00:00", revenue: 12000, paymentSuccess: 96.8, crashFree: 99.2, negativeFeedback: 15 },
//   { timestamp: "06:00", revenue: 15000, paymentSuccess: 97.1, crashFree: 99.3, negativeFeedback: 12 },
//   { timestamp: "12:00", revenue: 18000, paymentSuccess: 94.7, crashFree: 98.1, negativeFeedback: 45 },
//   { timestamp: "18:00", revenue: 14000, paymentSuccess: 95.2, crashFree: 98.8, negativeFeedback: 32 },
// ];
//
// const timelineEvents: EventMarker[] = [
//   { timestamp: "08:00", type: "release", label: "iOS 1.2.3" },
//   { timestamp: "14:00", type: "incident", label: "Payment provider timeout" },
//   { timestamp: "16:00", type: "liveops_start", label: "Weekend event" },
// ];
//
// <TriageTimeline data={timelineData} events={timelineEvents} />
