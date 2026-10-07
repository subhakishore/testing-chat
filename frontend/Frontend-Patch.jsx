
// In your Chat component (e.g., src/components/Chat.jsx or App.js)

// State for HTML download
const [htmlUrl, setHtmlUrl] = useState(null);

// In your ask function:
const handleAsk = async (query, topic) => {
  const res = await fetch('http://127.0.0.1:8000/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: query, topic: topic })
  });
  const data = await res.json();
  
  // data now contains:
  // data.answer - LLM generated exact answer
  // data.images - list like ["/static/images/tc30/TC30_tsh/page11_img1.png"]
  // data.html_download_url - "/static/TASS_tc30_No_connection_in_NADCM_20250923_152500.html"
  // data.heading - "3. Ping is available & No connection in NADCM"
  // data.page - 4
  
  setAnswer(data.answer);
  setSources(data.sources);
  setImages(data.images);
  setHtmlUrl(data.html_download_url);
  setHeading(data.heading);
};

// In JSX render:
<div>
  <div style={{ whiteSpace: 'pre-wrap' }}>{answer}</div>
  
  {/* Show images */}
  {images && images.map((img, idx) => (
    <div key={idx} style={{ margin: '15px 0', border: '1px solid #ddd', padding: '10px', borderRadius: '8px' }}>
      <img 
        src={`http://127.0.0.1:8000${img}`} 
        alt={`Screenshot ${idx+1}`}
        style={{ maxWidth: '100%', borderRadius: '4px' }}
        onError={(e) => e.target.style.display='none'}
      />
      <p style={{ fontSize: '11px', color: '#888' }}>{img}</p>
    </div>
  ))}
  
  {/* Download buttons */}
  <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
    {htmlUrl && (
      <a 
        href={`http://127.0.0.1:8000${htmlUrl}`}
        download
        style={{ 
          padding: '10px 20px', 
          background: '#0055A5', 
          color: 'white', 
          borderRadius: '6px', 
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        📥 Download as HTML (with images)
      </a>
    )}
    <button 
      onClick={() => {
        const blob = new Blob([answer], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `TASS_${topic}_${query.substring(0,20)}.txt`;
        a.click();
      }}
      style={{ padding: '10px 20px', background: '#f0f0f0', border: '1px solid #ddd', borderRadius: '6px' }}
    >
      ⬇️ Download as .txt
    </button>
  </div>
  
  <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
    Sources: {sources.map(s => s.file).join(', ')} | Topic: {topic} | Heading: {heading}
  </p>
</div>
