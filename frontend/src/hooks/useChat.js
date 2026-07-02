import { useState } from 'react'
import { getClients } from '../lib/api'
import { computeContractStatus, computeInvoiceStatus, daysUntilContractEnd } from '../lib/status'

export function useChat() {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: "Hi! I'm your AI client assistant. Ask me anything about your clients — renewals, invoices, follow-ups, contract values, and more.",
  }])
  const [loading, setLoading] = useState(false)

  const sendMessage = async (userText) => {
    const userMsg = { role: 'user', content: userText }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setLoading(true)

    try {
      // Fetch live client data from Supabase
      const { data } = await getClients()
      const clientContext = JSON.stringify(
        data.map(c => ({
          name: c.name,
          status: computeContractStatus(c),           // auto-computed from contract end date
          daysUntilContractEnd: daysUntilContractEnd(c),
          contractEnd: c.contract_end,
          contractValue: c.contract_value,
          invoiceStatus: computeInvoiceStatus(c),      // auto-computed; Overdue once past due and unpaid
          invoiceAmount: c.invoice_amount,
          lastContact: c.last_contact,
          projectsDone: c.projects_done,
          email: c.email,
        }))
      )

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
          system: `You are an AI assistant for an agency client tracker called ClientAI, used by Pixelmattic.
Help the team manage client relationships.

Live client data from database:
${clientContext}

Rules:
- Be concise and direct
- Use bullet points for lists
- Highlight urgent items (overdue invoices, missed follow-ups > 30 days, upcoming renewals)
- Include contract values and dates when relevant
- Keep answers under 150 words`,
          messages: updated.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const json = await res.json()
      const reply = json.content?.[0]?.text || 'Could not get a response. Check your API key in .env'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error connecting. Make sure the backend is running and your API key is set.',
      }])
    } finally {
      setLoading(false)
    }
  }

  return { messages, loading, sendMessage }
}
