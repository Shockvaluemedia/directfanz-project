export default function MinimalTestPage() {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', backgroundColor: '#f5f5f5' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ color: '#333' }}>Minimal Test Page</h1>
        <p style={{ color: '#666' }}>If you can see this text, React is rendering.</p>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginTop: '20px'
        }}>
          <p><strong>Status:</strong> Page loaded successfully</p>
        </div>
      </div>
    </div>
  )
}
