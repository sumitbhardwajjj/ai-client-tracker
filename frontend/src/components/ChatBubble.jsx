export default function ChatBubble({ role, content }) {
  const isUser = role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', gap: 10 }}>
      {!isUser && (
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0, marginTop: 2,
          background: 'linear-gradient(135deg, var(--blue), var(--purple))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff',
        }}>AI</div>
      )}
      <div style={{
        maxWidth: '72%',
        padding: '10px 16px',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        fontSize: 13.5,
        lineHeight: 1.6,
        whiteSpace: 'pre-line',
        background: isUser ? 'var(--blue)' : 'var(--card)',
        color: isUser ? '#fff' : 'var(--text-1)',
        border: isUser ? 'none' : '1px solid var(--border)',
        boxShadow: isUser ? '0 0 14px var(--blue-glow)' : 'none',
      }}>
        {content}
      </div>
    </div>
  )
}
