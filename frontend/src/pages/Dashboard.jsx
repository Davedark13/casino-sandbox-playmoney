import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import Panel from '../components/Panel.jsx';

function fmtMoney(cents) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);
}

function fmtDate(value) {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString('de-AT');
}

const initialData = {
  stats: {
    users_total: 0,
    pending_withdrawals: 0,
    open_flags: 0,
    pending_kyc: 0
  },
  security: {
    appMode: 'test',
    warnings: []
  },
  users: [],
  withdrawals: [],
  transactions: [],
  fraud: [],
  logs: [],
  kyc: []
};

export default function Dashboard() {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState('');
  const [lastSimulation, setLastSimulation] = useState(null);
  const [busyAction, setBusyAction] = useState('');

  async function load() {
    try {
      setData(await api('/admin/overview'));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function runAndRefresh(action, work) {
    try {
      setBusyAction(action);
      await work();
      await load();
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyAction('');
    }
  }

  async function toggleBlock(user) {
    await runAndRefresh(`block:${user.id}`, () => api(`/admin/users/${user.id}/block`, {
      method: 'POST',
      body: JSON.stringify({
        blocked: !user.is_blocked,
        reason: user.is_blocked ? null : 'Manual review from dashboard'
      })
    }));
  }

  async function recalculateRisk(userId) {
    await runAndRefresh(`risk:${userId}`, () => api(`/admin/users/${userId}/recalculate-risk`, {
      method: 'POST',
      body: JSON.stringify({})
    }));
  }

  async function reviewWithdrawal(withdrawalId, action) {
    await runAndRefresh(`withdraw:${withdrawalId}:${action}`, () => api(`/admin/withdrawals/${withdrawalId}/review`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        adminNote: `${action} via dashboard`
      })
    }));
  }

  async function reviewKyc(documentId, status) {
    await runAndRefresh(`kyc:${documentId}:${status}`, () => api(`/kyc/${documentId}/review`, {
      method: 'POST',
      body: JSON.stringify({
        status,
        reviewerNote: `${status} via dashboard`
      })
    }));
  }

  async function runStressScenario(scenario) {
    await runAndRefresh(`stress:${scenario}`, async () => {
      const result = await api('/admin/simulate/stress', {
        method: 'POST',
        body: JSON.stringify({
          scenario,
          iterations: scenario === 'bot_attack' ? 15 : 12
        })
      });
      setLastSimulation(result);
    });
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="layout">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Casino Sandbox Admin</p>
          <h1>Play-Money Ops, Fraud Signals and Stress Tests</h1>
          <p className="subline">
            Sandbox-only control room for balances, withdrawals, KYC review, RNG rounds and risk monitoring.
          </p>
        </div>
        <div className="hero-actions">
          <button onClick={load}>Refresh now</button>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="stats-grid">
        <article className="stat-card">
          <span>Total Users</span>
          <strong>{data.stats.users_total}</strong>
        </article>
        <article className="stat-card">
          <span>Pending Withdrawals</span>
          <strong>{data.stats.pending_withdrawals}</strong>
        </article>
        <article className="stat-card">
          <span>Open Fraud Flags</span>
          <strong>{data.stats.open_flags}</strong>
        </article>
        <article className="stat-card">
          <span>Pending KYC</span>
          <strong>{data.stats.pending_kyc}</strong>
        </article>
      </section>

      <div className="grid">
        <Panel title="Security Posture" subtitle="Current sandbox deployment hardening signals and warnings.">
          <div className="security-grid">
            <div className="security-item">
              <span>Mode</span>
              <strong>{data.security.appMode}</strong>
            </div>
            <div className="security-item">
              <span>Trust Proxy</span>
              <strong>{data.security.trustProxy ? 'Enabled' : 'Disabled'}</strong>
            </div>
            <div className="security-item">
              <span>Stripe</span>
              <strong>{data.security.stripeConfigured ? 'Configured' : 'Off'}</strong>
            </div>
            <div className="security-item">
              <span>Discord Alerts</span>
              <strong>{data.security.discordAlertsConfigured ? 'On' : 'Off'}</strong>
            </div>
          </div>
          <div className="flag-row">
            {data.security.liveMoneyEnabled ? <span className="badge critical">live money flag</span> : null}
            {data.security.legalApproved ? <span className="badge critical">legal flag</span> : null}
            {!data.security.liveMoneyEnabled && !data.security.legalApproved ? <span className="badge verified">sandbox only</span> : null}
          </div>
          {data.security.warnings?.length ? (
            <ul className="warning-list">
              {data.security.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : (
            <p className="muted-copy">No immediate configuration warnings detected.</p>
          )}
        </Panel>

        <Panel
          title="Stress Lab"
          subtitle="Concurrent sandbox scenarios for bets, withdraw races and bot-like risk bursts."
        >
          <div className="button-row wrap">
            <button disabled={busyAction === 'stress:concurrent_bets'} onClick={() => runStressScenario('concurrent_bets')}>
              Concurrent Bets
            </button>
            <button disabled={busyAction === 'stress:withdraw_race'} className="secondary" onClick={() => runStressScenario('withdraw_race')}>
              Withdraw Race
            </button>
            <button disabled={busyAction === 'stress:bot_attack'} className="ghost" onClick={() => runStressScenario('bot_attack')}>
              Bot Attack
            </button>
          </div>
          {lastSimulation ? (
            <pre className="result-box">{JSON.stringify(lastSimulation, null, 2)}</pre>
          ) : (
            <p className="muted-copy">No simulation executed yet.</p>
          )}
        </Panel>

        <Panel title="Users" subtitle="Balances, KYC state and manual intervention controls.">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Balance</th>
                  <th>Risk</th>
                  <th>KYC</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.username}</strong>
                      <div className="cell-subtext">{user.email}</div>
                    </td>
                    <td>
                      {fmtMoney(user.balance_cents)}
                      <div className="cell-subtext">Locked: {fmtMoney(user.locked_balance_cents)}</div>
                    </td>
                    <td>{user.risk_score}</td>
                    <td>
                      <span className={`badge ${user.kyc_status || 'pending'}`}>{user.kyc_status || 'pending'}</span>
                    </td>
                    <td>
                      <span className={`badge ${user.is_blocked ? 'rejected' : 'verified'}`}>
                        {user.is_blocked ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                    <td className="button-row wrap">
                      <button className="secondary" onClick={() => recalculateRisk(user.id)}>
                        Recalc
                      </button>
                      <button onClick={() => toggleBlock(user)}>
                        {user.is_blocked ? 'Unblock' : 'Block'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Withdraw Requests" subtitle="Pending requests are locked against the wallet until reviewed.">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Risk</th>
                  <th>Requested</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.withdrawals.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.username}</strong>
                      <div className="cell-subtext">{item.user_id.slice(0, 8)}</div>
                    </td>
                    <td>{fmtMoney(item.amount_cents)}</td>
                    <td>
                      <span className={`badge ${item.status}`}>{item.status}</span>
                    </td>
                    <td>{item.risk_score}</td>
                    <td>{fmtDate(item.requested_at)}</td>
                    <td className="button-row wrap">
                      <button
                        disabled={!['pending', 'requested'].includes(item.status)}
                        onClick={() => reviewWithdrawal(item.id, 'approve')}
                      >
                        Approve
                      </button>
                      <button
                        disabled={!['pending', 'requested'].includes(item.status)}
                        className="secondary"
                        onClick={() => reviewWithdrawal(item.id, 'reject')}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="KYC Queue" subtitle="Latest document submissions with one-click sandbox review.">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Document</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.kyc.map((item) => (
                  <tr key={item.id}>
                    <td>{item.username}</td>
                    <td>
                      <strong>{item.document_type}</strong>
                      <div className="cell-subtext">{item.storage_path}</div>
                    </td>
                    <td>
                      <span className={`badge ${item.status}`}>{item.status}</span>
                    </td>
                    <td>{fmtDate(item.created_at)}</td>
                    <td className="button-row wrap">
                      <button onClick={() => reviewKyc(item.id, 'verified')}>Verify</button>
                      <button className="secondary" onClick={() => reviewKyc(item.id, 'rejected')}>Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Transactions" subtitle="Latest ledger-affecting events across deposits, bets, wins and withdrawals.">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Reference</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{tx.username}</td>
                    <td>{tx.type}</td>
                    <td>{fmtMoney(tx.amount_cents)}</td>
                    <td>
                      <span className={`badge ${tx.status}`}>{tx.status}</span>
                    </td>
                    <td className="mono-cell">{tx.reference || '-'}</td>
                    <td>{fmtDate(tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Fraud Alerts" subtitle="Aggregated user risk snapshots and active unresolved flags.">
          <div className="fraud-list">
            {data.fraud.map((user) => (
              <article key={user.id} className="fraud-card">
                <div className="fraud-head">
                  <div>
                    <strong>{user.username}</strong>
                    <div className="cell-subtext">{user.email}</div>
                  </div>
                  <span className={`badge ${user.is_blocked ? 'rejected' : 'verified'}`}>
                    Risk {user.risk_score}
                  </span>
                </div>
                <p className="muted-copy">
                  {user.is_blocked ? user.block_reason || 'Auto blocked' : 'Monitoring active'}
                </p>
                <div className="flag-row">
                  {user.flags.slice(0, 4).map((flag) => (
                    <span key={flag.id} className={`badge ${flag.severity}`}>
                      {flag.flagType}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="System Logs" subtitle="Recent audit trail events exposed via the activity log view.">
          <div className="logs">
            {data.logs.map((log) => (
              <article key={log.id} className="log-card">
                <div className="log-head">
                  <strong>{log.action}</strong>
                  <span>{fmtDate(log.created_at)}</span>
                </div>
                <div className="cell-subtext">
                  actor={log.actor_type}:{log.actor_id}
                </div>
                <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
              </article>
            ))}
          </div>
        </Panel>
      </div>
    </main>
  );
}
