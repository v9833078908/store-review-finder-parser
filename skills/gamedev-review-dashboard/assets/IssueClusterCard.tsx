import React from 'react';

type Severity = 'P0' | 'P1' | 'P2';
type IssueStatus = 'New' | 'Investigating' | 'Fixed' | 'Monitoring';

interface IssueClusterCardProps {
  severity: Severity;
  title: string;
  volume: {
    total: number;
    change: string; // e.g., "+340%"
    baseline: string; // e.g., "vs baseline"
  };
  sources: {
    reviews: number;
    tickets: number;
    discord: number;
  };
  affected: {
    versions?: string[];
    platforms?: string[];
    regions?: string[];
  };
  owner: string;
  status: IssueStatus;
  examples: string[];
  onClick?: () => void;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  P0: '#ef4444',
  P1: '#f59e0b',
  P2: '#22c55e',
};

const SEVERITY_ICONS: Record<Severity, string> = {
  P0: '🔴',
  P1: '🟡',
  P2: '🟢',
};

const STATUS_COLORS: Record<IssueStatus, string> = {
  New: '#ef4444',
  Investigating: '#f59e0b',
  Fixed: '#22c55e',
  Monitoring: '#3b82f6',
};

export function IssueClusterCard({
  severity,
  title,
  volume,
  sources,
  affected,
  owner,
  status,
  examples,
  onClick,
}: IssueClusterCardProps) {
  const severityColor = SEVERITY_COLORS[severity];
  const severityIcon = SEVERITY_ICONS[severity];
  const statusColor = STATUS_COLORS[status];

  return (
    <div
      onClick={onClick}
      className="issue-cluster-card"
      style={{
        padding: '1.5rem',
        borderRadius: '0.5rem',
        backgroundColor: 'white',
        border: `2px solid ${severityColor}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>{severityIcon}</span>
          <span
            style={{
              fontSize: '0.875rem',
              fontWeight: 700,
              color: severityColor,
            }}
          >
            {severity}
          </span>
          <span style={{ flex: 1 }} />
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'white',
              backgroundColor: statusColor,
              padding: '0.25rem 0.5rem',
              borderRadius: '0.25rem',
            }}
          >
            {status}
          </span>
        </div>
        <h4
          style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            color: '#111827',
            margin: 0,
          }}
        >
          {title}
        </h4>
      </div>

      {/* Volume */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
          {volume.total} items
          <span
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: severityColor,
              marginLeft: '0.5rem',
            }}
          >
            ({volume.change} {volume.baseline})
          </span>
        </div>
        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
          Sources: {sources.reviews} reviews + {sources.tickets} tickets + {sources.discord} Discord
        </div>
      </div>

      {/* Affected */}
      <div
        style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          backgroundColor: '#f9fafb',
          borderRadius: '0.25rem',
          fontSize: '0.875rem',
        }}
      >
        {affected.platforms && (
          <div style={{ marginBottom: '0.25rem' }}>
            <strong>Platforms:</strong> {affected.platforms.join(', ')}
          </div>
        )}
        {affected.versions && (
          <div style={{ marginBottom: '0.25rem' }}>
            <strong>Versions:</strong> {affected.versions.join(', ')}
          </div>
        )}
        {affected.regions && (
          <div>
            <strong>Regions:</strong> {affected.regions.join(', ')}
          </div>
        )}
      </div>

      {/* Owner */}
      <div
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#374151',
          marginBottom: '1rem',
        }}
      >
        Owner: {owner}
      </div>

      {/* Examples */}
      <div
        style={{
          borderTop: '1px solid #e5e7eb',
          paddingTop: '0.75rem',
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#6b7280',
            marginBottom: '0.5rem',
          }}
        >
          Examples:
        </div>
        <ul
          style={{
            margin: 0,
            paddingLeft: '1rem',
            fontSize: '0.875rem',
            color: '#374151',
          }}
        >
          {examples.slice(0, 3).map((example, idx) => (
            <li key={idx} style={{ marginBottom: '0.25rem' }}>
              "{example}"
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Example usage:
// <IssueClusterCard
//   severity="P0"
//   title="Payment errors on iOS 1.2.3"
//   volume={{ total: 146, change: "+340%", baseline: "vs baseline" }}
//   sources={{ reviews: 45, tickets: 89, discord: 12 }}
//   affected={{
//     platforms: ["iOS 1.2.3"],
//     regions: ["US", "UK", "CA"]
//   }}
//   owner="@monetization"
//   status="Investigating"
//   examples={[
//     "Charged twice, no gems received",
//     "Error 503 on checkout",
//     "Payment stuck on loading..."
//   ]}
//   onClick={() => console.log("Navigate to issue detail")}
// />
