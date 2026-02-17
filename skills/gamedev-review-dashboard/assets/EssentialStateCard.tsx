import React from 'react';

export type StateStatus = 'green' | 'yellow' | 'red' | 'gray';

interface EssentialStateCardProps {
  title: string;
  status: StateStatus;
  primaryMetric: {
    value: string;
    label: string;
  };
  delta: {
    value: string;
    label: string;
  };
  context: {
    topIssue?: string;
    owner: string;
    since: string;
  };
  onClick?: () => void;
}

const STATUS_COLORS: Record<StateStatus, string> = {
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#ef4444',
  gray: '#6b7280',
};

const STATUS_ICONS: Record<StateStatus, string> = {
  green: '🟢',
  yellow: '🟡',
  red: '🔴',
  gray: '⚪',
};

export function EssentialStateCard({
  title,
  status,
  primaryMetric,
  delta,
  context,
  onClick,
}: EssentialStateCardProps) {
  const statusColor = STATUS_COLORS[status];
  const statusIcon = STATUS_ICONS[status];

  return (
    <div
      onClick={onClick}
      className="essential-state-card"
      style={{
        padding: '1.5rem',
        borderRadius: '0.5rem',
        backgroundColor: 'white',
        border: `2px solid ${statusColor}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <span style={{ fontSize: '1.25rem' }}>{statusIcon}</span>
        <h3
          style={{
            fontSize: '0.875rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#374151',
            margin: 0,
          }}
        >
          {title}
        </h3>
      </div>

      {/* Primary Metric */}
      <div style={{ marginBottom: '0.5rem' }}>
        <div
          style={{
            fontSize: '2.5rem',
            fontWeight: 700,
            color: '#111827',
            lineHeight: 1,
          }}
        >
          {primaryMetric.value}
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            color: '#6b7280',
            marginTop: '0.25rem',
          }}
        >
          {primaryMetric.label}
        </div>
      </div>

      {/* Delta */}
      <div
        style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: statusColor,
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span>{delta.value.startsWith('-') ? '↓' : '↑'}</span>
        <span>{delta.value}</span>
        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{delta.label}</span>
      </div>

      {/* Context */}
      <div
        style={{
          borderTop: '1px solid #e5e7eb',
          paddingTop: '0.75rem',
          fontSize: '0.75rem',
          color: '#6b7280',
        }}
      >
        {context.topIssue && (
          <div style={{ marginBottom: '0.25rem' }}>
            <strong>Top issue:</strong> {context.topIssue}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>
            <strong>Owner:</strong> {context.owner}
          </span>
          <span>
            <strong>Since:</strong> {context.since}
          </span>
        </div>
      </div>
    </div>
  );
}

// Example usage:
// <EssentialStateCard
//   title="PAYMENTS"
//   status="red"
//   primaryMetric={{ value: "94.7%", label: "success rate" }}
//   delta={{ value: "-2.1pp", label: "vs 7d baseline" }}
//   context={{
//     topIssue: "3DS timeout (iOS)",
//     owner: "@monetization",
//     since: "2h ago"
//   }}
//   onClick={() => console.log("Navigate to payments detail")}
// />
