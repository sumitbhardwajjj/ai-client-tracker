import { useState, useRef, useEffect } from 'react'
import Layout from '../components/Layout'
import ChatBubble from '../components/ChatBubble'
import { useChat } from '../hooks/useChat'
import { Send } from 'lucide-react'

const QUICK = [
  'Renewals this month?',
  'Overdue invoices?',
  'Not contacted in 30 days?',
  'Top clients by value?',
  'Who needs follow-up today?',
  'Active clients list?',
]

export default function Chatbot() {
  const [input, setInput]     = useState('')
  const { messages, loading, sendMessage } = useChat()
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = () => {
    if (!input.trim() || loading) return
    sendMessage(input.trim())
    setInput('')
  }

  return (
    <Layout title="AI Assistant" subtitle="Ask anything about your clients">
      <div style={{ maxWidth: 760 }}>
        {/* Quick ask chips */}
        <div className="card" style={{ marginBottom: 16, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Quick asks
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {QUICK.map(q => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                disabled={loading}
                style={{
                  padding: '5px 13px', borderRadius: 20,
                  border: '1px solid var(--border-2)',
                  background: 'var(--bg-3)',
                  color: 'var(--text-2)', fontSize: 12.5,
                  cursor: 'pointer', transition: 'all .15s',
                }}
                onMouseOver={e => {
                  e.target.style.borderColor = 'var(--blue)'
                  e.target.style.color = 'var(--badge-blue-text)'
                  e.target.style.background = 'var(--blue-glow)'
                }}
                onMouseOut={e => {
                  e.target.style.borderColor = 'var(--border-2)'
                  e.target.style.color = 'var(--text-2)'
                  e.target.style.background = 'var(--bg-3)'
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Chat window */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: 'var(--green)',
              animation: 'pulse-dot 2s ease infinite',
            }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>AI Client Assistant</span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px',
              borderRadius: 20, background: 'var(--purple-bg)', color: 'var(--purple)',
              textTransform: 'uppercase', letterSpacing: '.05em',
            }}>Claude API</span>
          </div>

          {/* Messages */}
          <div style={{
            height: 400, overflowY: 'auto',
            padding: '20px 20px 12px',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            {messages.map((m, i) => (
              <ChatBubble key={i} role={m.role} content={m.content} />
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--blue), var(--purple))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>AI</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--text-3)',
                      display: 'inline-block',
                      animation: `pulse-dot 1s ease infinite`,
                      animationDelay: `${i * 0.2}s`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex', gap: 10,
          }}>
            <input
              className="input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask about a client…"
              disabled={loading}
              style={{ fontSize: 13, flex: 1, minWidth: 0 }}
            />
            <button
              className="btn btn-primary"
              onClick={send}
              disabled={loading || !input.trim()}
              style={{ flexShrink: 0 }}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
