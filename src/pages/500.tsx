export default function Custom500() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>500 - Server Error</h1>
      <p style={{ color: '#666' }}>Something went wrong. Please try again later.</p>
      <a href="/" style={{ marginTop: '1rem', color: '#6366f1', textDecoration: 'underline' }}>Go Home</a>
    </div>
  );
}
