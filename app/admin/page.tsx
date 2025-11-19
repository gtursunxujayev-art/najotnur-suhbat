'use client';

import { useEffect, useState } from 'react';

type User = {
  id: number;
  name: string;
  username: string | null;
  phone: string;
  job: string;
  createdAt: string;
};

type BotSettings = {
  greetingText: string;
  askPhoneText: string;
  askJobText: string;
};

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users');
      const data: User[] = await res.json();
      setUsers(data);
    } catch (e) {
      console.error(e);
      setError('Cannot load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchSettings = async () => {
    setSettingsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/settings');
      const data: BotSettings = await res.json();
      setSettings(data);
    } catch (e) {
      console.error(e);
      setError('Cannot load bot messages settings');
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSettings();
  }, []);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === users.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map((u) => u.id));
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      setError('Message text is empty');
      return;
    }
    if (selectedIds.length === 0) {
      setError('No users selected');
      return;
    }

    setSending(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch('/api/admin/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedIds, text: message })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error sending messages');
      } else {
        setInfo(`Message sent to ${data.sent} user(s).`);
      }
    } catch (e) {
      console.error(e);
      setError('Error sending messages');
    } finally {
      setSending(false);
    }
  };

  const handleExport = () => {
    window.location.href = '/api/admin/export';
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSettingsSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Cannot save bot messages');
      } else {
        setSettings(data);
        setInfo('Bot messages updated successfully.');
      }
    } catch (e) {
      console.error(e);
      setError('Cannot save bot messages');
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '2rem',
        background: '#f1f5f9'
      }}
    >
      <div
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          background: 'white',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          boxShadow: '0 10px 25px rgba(15,23,42,0.08)'
        }}
      >
        <h1 style={{ marginBottom: '0.5rem' }}>Admin panel</h1>
        <p style={{ marginBottom: '1.5rem' }}>
          Users list, CSV export, bulk messages and bot text settings.
        </p>

        {error && (
          <div
            style={{
              marginBottom: '0.75rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              background: '#fee2e2',
              color: '#b91c1c'
            }}
          >
            {error}
          </div>
        )}

        {info && (
          <div
            style={{
              marginBottom: '0.75rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              background: '#dcfce7',
              color: '#166534'
            }}
          >
            {info}
          </div>
        )}

        {/* BOT MESSAGES SETTINGS */}
        <section
          style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid #e2e8f0',
            background: '#f8fafc'
          }}
        >
          <h2 style={{ marginBottom: '0.5rem' }}>Bot messages</h2>
          <p
            style={{
              marginBottom: '0.75rem',
              fontSize: '0.9rem',
              color: '#475569'
            }}
          >
            Bu yerda botning foydalanuvchiga yozadigan matnlarini
            o&apos;zgartirasiz.
          </p>

          {settingsLoading && !settings ? (
            <p>Loading bot messages...</p>
          ) : settings ? (
            <>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.9rem',
                  marginBottom: '0.25rem'
                }}
              >
                1. Birinchi xabar (ism so&apos;rash):
              </label>
              <textarea
                value={settings.greetingText}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev
                      ? { ...prev, greetingText: e.target.value }
                      : prev
                  )
                }
                rows={2}
                style={{
                  width: '100%',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #cbd5f5',
                  marginBottom: '0.75rem'
                }}
              />

              <label
                style={{
                  display: 'block',
                  fontSize: '0.9rem',
                  marginBottom: '0.25rem'
                }}
              >
                2. Telefon raqamini so&apos;rash xabari:
              </label>
              <textarea
                value={settings.askPhoneText}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev
                      ? { ...prev, askPhoneText: e.target.value }
                      : prev
                  )
                }
                rows={2}
                style={{
                  width: '100%',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #cbd5f5',
                  marginBottom: '0.75rem'
                }}
              />

              <label
                style={{
                  display: 'block',
                  fontSize: '0.9rem',
                  marginBottom: '0.25rem'
                }}
              >
                3. Kasbini so&apos;rash xabari:
              </label>
              <textarea
                value={settings.askJobText}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev
                      ? { ...prev, askJobText: e.target.value }
                      : prev
                  )
                }
                rows={2}
                style={{
                  width: '100%',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #cbd5f5',
                  marginBottom: '0.75rem'
                }}
              />

              <button
                onClick={handleSaveSettings}
                disabled={settingsSaving}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {settingsSaving ? 'Saving...' : 'Save bot messages'}
              </button>
            </>
          ) : (
            <p>Could not load bot settings.</p>
          )}
        </section>

        {/* CONTROLS */}
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            marginBottom: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <button
            onClick={fetchUsers}
            disabled={loadingUsers}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {loadingUsers ? 'Loading users...' : 'Reload users'}
          </button>
          <button
            onClick={handleExport}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Export CSV
          </button>
          <button
            onClick={selectAll}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {selectedIds.length === users.length
              ? 'Unselect all'
              : 'Select all'}
          </button>
        </div>

        {/* MESSAGE SENDER */}
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>Send message</h2>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Write message for selected users..."
            style={{
              width: '100%',
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
              border: '1px solid #cbd5f5',
              marginBottom: '0.75rem'
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {sending ? 'Sending...' : 'Send to selected'}
          </button>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
            Selected: {selectedIds.length} / {users.length}
          </p>
        </section>

        {/* USERS TABLE */}
        <section>
          <h2 style={{ marginBottom: '0.5rem' }}>Users</h2>
          {users.length === 0 ? (
            <p>No users yet.</p>
          ) : (
            <div
              style={{
                maxHeight: '400px',
                overflow: 'auto',
                borderRadius: '0.5rem',
                border: '1px solid #e2e8f0'
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.9rem'
                }}
              >
                <thead
                  style={{
                    position: 'sticky',
                    top: 0,
                    background: '#e2e8f0',
                    zIndex: 1
                  }}
                >
                  <tr>
                    <th style={{ padding: '0.5rem' }}>
                      <input
                        type="checkbox"
                        onChange={selectAll}
                        checked={
                          users.length > 0 &&
                          selectedIds.length === users.length
                        }
                      />
                    </th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>ID</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>
                      Name
                    </th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>
                      Username
                    </th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>
                      Phone
                    </th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>
                      Job
                    </th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td
                        style={{
                          padding: '0.5rem',
                          textAlign: 'center',
                          borderTop: '1px solid #e5e7eb'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(u.id)}
                          onChange={() => toggleSelect(u.id)}
                        />
                      </td>
                      <td
                        style={{
                          padding: '0.5rem',
                          borderTop: '1px solid #e5e7eb'
                        }}
                      >
                        {u.id}
                      </td>
                      <td
                        style={{
                          padding: '0.5rem',
                          borderTop: '1px solid #e5e7eb'
                        }}
                      >
                        {u.name}
                      </td>
                      <td
                        style={{
                          padding: '0.5rem',
                          borderTop: '1px solid #e5e7eb'
                        }}
                      >
                        {u.username ? `@${u.username}` : '-'}
                      </td>
                      <td
                        style={{
                          padding: '0.5rem',
                          borderTop: '1px solid #e5e7eb'
                        }}
                      >
                        {u.phone}
                      </td>
                      <td
                        style={{
                          padding: '0.5rem',
                          borderTop: '1px solid #e5e7eb'
                        }}
                      >
                        {u.job}
                      </td>
                      <td
                        style={{
                          padding: '0.5rem',
                          borderTop: '1px solid #e5e7eb'
                        }}
                      >
                        {new Date(u.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
