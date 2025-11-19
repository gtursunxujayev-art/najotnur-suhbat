export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1rem'
      }}
    >
      <h1>Telegram QR Bot</h1>
      <p>Bot webhook & admin panel are running.</p>
      <a href="/admin" style={{ textDecoration: 'underline' }}>
        Go to admin panel
      </a>
    </main>
  );
}
