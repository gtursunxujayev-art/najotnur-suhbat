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
  finalMessage: string;
};

type EventItem = {
  id: number;
  title: string;
  dateTime: string;
  isActive: boolean;
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

  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDateTime, setNewEventDateTime] = useState('');
  const [settingActiveId, setSettingActiveId] = useState<number | null>(
    null
  );

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Load users
  const fetchUsers = async () => {
    setLoadingUsers(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users');
      const data: User[] = await res.json();
      setUsers(data);
    } catch {
      setError('Cannot load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load bot settings
  const fetchSettings = async () => {
    setSettingsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/settings');
      const data: BotSettings = await res.json();
      setSettings(data);
    } catch {
      setError('Cannot load bot messages settings');
    } finally {
      setSettingsLoading(false);
    }
  };

  // Load events
  const fetchEvents = async () => {
    setEventsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/events');
      const data: EventItem[] = await res.json();
      setEvents(data);
    } catch {
      setError('Cannot load events');
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSettings();
    fetchEvents();
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
    } catch {
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
    } catch {
      setError('Cannot save bot messages');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!newEventTitle.trim()) {
      setError('Event title is required');
      return;
    }
    if (!newEventDateTime.trim()) {
      setError('Event date/time is required');
      return;
    }

    setCreatingEvent(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newEventTitle,
          dateTime: newEventDateTime
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Cannot create event');
      } else {
        setInfo('Event created successfully.');
        setNewEventTitle('');
        setNewEventDateTime('');
        await fetchEvents();
      }
    } catch {
      setError('Cannot create event');
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleSetActiveEvent = async (id: number) => {
    setSettingActiveId(id);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch('/api/admin/events/set-current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: id })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Cannot set active event');
      } else {
        setEvents(data);
        setInfo('Active event updated.');
      }
    } catch {
      setError('Cannot set active event');
    } finally {
      setSettingActiveId(null);
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
          Users list, CSV export, bulk messages, bot text settings and event
          management.
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

        {/* EVENTS SECTION */}
        <section
          style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid #e2e8f0',
            background: '#f8fafc'
          }}
        >
          <h2 style={{ marginBottom: '0.5rem' }}>Events</h2>
          <p
            style={{
              marginBottom: '0.75rem',
              fontSize: '0.9rem',
              color: '#475569'
            }}
          >
            Bu bo‘limda tadbir yaratish va hozirgi aktiv tadbirni tanlaysiz.
            Bot foydalanuvchilarni shu aktiv tadbirga bog‘laydi.
          </p>

          {/* Create event form */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginBottom: '1rem'
            }}
          >
            <input
              type="text"
              placeholder="Event title (masalan: Biznes nonushta)"
              value={newEventTitle}
              onChange={(e) => setNewEventTitle(e.target.value)}
              style={{
                flex: '2 1 240px',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1'
              }}
            />
            <input
              type="datetime-local"
              value={newEventDateTime}
              onChange={(e) => setNewEventDateTime(e.target.value)}
              style={{
                flex: '1 1 200px',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1'
              }}
            />
            <button
              onClick={handleCreateEvent}
              disabled={creatingEvent}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {creatingEvent ? 'Creating...' : 'Create event'}
            </button>
          </div>

          {/* Events list */}
          {eventsLoading ? (
            <p>Loading events...</p>
          ) : events.length === 0 ? (
            <p>Hali tadbirlar yo‘q.</p>
          ) : (
            <div
              style={{
                maxHeight: '220px',
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
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>
                      ID
                    </th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>
                      Title
                    </th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>
                      Date/Time
                    </th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>
                      Status
                    </th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id}>
                      <td
                        style={{
                          padding: '0.5rem',
                          borderTop: '1px solid #e5e7eb'
                        }}
                      >
                        {ev.id}
                      </td>
                      <td
                        style={{
                          padding: '0.5rem',
                          borderTop: '1px solid #e5e7eb'
                        }}
                      >
                        {ev.title}
                      </td>
                      <td
                        style={{
                          padding: '0.5rem',
                          borderTop: '1px solid #e5e7eb'
                        }}
                      >
                        {new Date(ev.dateTime).toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: '0.5rem',
                          borderTop: '1px solid #e5e7eb'
                        }}
                      >
                        {ev.isActive ? 'ACTIVE' : '-'}
                      </td>
                      <td
                        style={{
                          padding: '0.5rem',
                          borderTop: '1px solid #e5e7eb'
                        }}
                      >
                        {ev.isActive ? (
                          <span>Current</span>
                        ) : (
                          <button
                            onClick={() => handleSetActiveEvent(ev.id)}
                            disabled={settingActiveId === ev.id}
                            style={{
                              padding: '0.25rem 0.75rem',
                              borderRadius: '0.5rem',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            {settingActiveId === ev.id
                              ? 'Setting...'
                              : 'Set active'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

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
            o‘zgartirasiz.
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
                1. Birinchi xabar (ism so‘rash):
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
                  padding: '0.5rem',
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
                2. Telefon raqamini so‘rash xabari:
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
                  padding: '0.5rem',
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
                3. Kasbini so‘rash xabari:
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
                  padding: '0.5rem',
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
                4. Oxirgi xabar (ro‘yxatdan o‘tganidan keyin yuboriladi):
              </label>
              <textarea
                value={settings.finalMessage}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev
                      ? { ...prev, finalMessage: e.target.value }
                      : prev
                  )
                }
                rows={3}
                style={{
                  width: '100%',
                  borderRadius: '0.5rem',
                  padding: '0.5rem',
                  border: '1px solid #cbd5f5',
                  marginBottom: '1rem'
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
            {selectedIds.length === users.length ? 'Unselect all' : 'Select all'}
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
              padding: '0.5rem',
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
