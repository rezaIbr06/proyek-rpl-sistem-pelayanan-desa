'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useChat } from 'ai/react'

function renderInlineText(text: string): React.ReactNode {
  if (!text) return null

  // Tokenize for inline patterns:
  // 1) Inline code: `code`
  // 2) Bold Italic: ***text***
  // 3) Bold: **text**
  // 4) Italic: *text* or _text_
  // 5) Markdown links: [text](url)
  const regex = /(`[^`]+`|\*\*\*[^*]+?\*\*\*|\*\*[^*]+?\*\*|\*[^*]+?\*|_[^_]+?_|\[[^\]]+\]\([^)]+\))/g
  const tokens = text.split(regex)

  return tokens.map((token, idx) => {
    if (!token) return null

    // Inline code
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return (
        <code
          key={idx}
          style={{
            backgroundColor: 'rgba(125, 125, 125, 0.15)',
            padding: '0.15rem 0.35rem',
            borderRadius: '4px',
            fontSize: '0.85em',
            fontFamily: 'monospace',
          }}
        >
          {token.slice(1, -1)}
        </code>
      )
    }

    // Bold + Italic
    if (token.startsWith('***') && token.endsWith('***') && token.length > 6) {
      return (
        <strong key={idx} style={{ fontWeight: 700 }}>
          <em>{token.slice(3, -3)}</em>
        </strong>
      )
    }

    // Bold (**text**)
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong key={idx} style={{ fontWeight: 700 }}>
          {token.slice(2, -2)}
        </strong>
      )
    }

    // Italic (*text*)
    if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      return <em key={idx}>{token.slice(1, -1)}</em>
    }

    // Italic (_text_)
    if (token.startsWith('_') && token.endsWith('_') && token.length > 2) {
      return <em key={idx}>{token.slice(1, -1)}</em>
    }

    // Links [text](url)
    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--primary)', textDecoration: 'underline' }}
        >
          {linkMatch[1]}
        </a>
      )
    }

    return <span key={idx}>{token}</span>
  })
}

function FormattedMessage({ content }: { content: string }) {
  if (!content) return null

  // Normalize Windows newlines \r\n to \n
  const normalized = content.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')

  const elements: React.ReactNode[] = []
  let listItems: string[] = []
  let listType: 'ul' | 'ol' | null = null

  const flushList = (key: string | number) => {
    if (!listType || listItems.length === 0) return
    if (listType === 'ul') {
      elements.push(
        <ul
          key={`ul-${key}`}
          style={{
            margin: '0.35rem 0',
            paddingLeft: '1.25rem',
            listStyleType: 'disc',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem',
          }}
        >
          {listItems.map((item, i) => (
            <li key={i} style={{ lineHeight: '1.5' }}>
              {renderInlineText(item)}
            </li>
          ))}
        </ul>
      )
    } else {
      elements.push(
        <ol
          key={`ol-${key}`}
          style={{
            margin: '0.35rem 0',
            paddingLeft: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem',
          }}
        >
          {listItems.map((item, i) => (
            <li key={i} style={{ lineHeight: '1.5' }}>
              {renderInlineText(item)}
            </li>
          ))}
        </ol>
      )
    }
    listItems = []
    listType = null
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()

    // Empty line -> flush list and skip
    if (!trimmed) {
      flushList(index)
      return
    }

    // Bullet point: •, -, *, or ·
    const ulMatch = line.match(/^\s*[•\-\*·]\s+(.*)$/)
    if (ulMatch) {
      if (listType && listType !== 'ul') {
        flushList(index)
      }
      listType = 'ul'
      listItems.push(ulMatch[1])
      return
    }

    // Numbered list: 1., 2., etc.
    const olMatch = line.match(/^\s*\d+[\.\)]\s+(.*)$/)
    if (olMatch) {
      if (listType && listType !== 'ol') {
        flushList(index)
      }
      listType = 'ol'
      listItems.push(olMatch[1])
      return
    }

    // Heading: ### Header or ## Header
    const headingMatch = line.match(/^(\#{1,3})\s+(.*)$/)
    if (headingMatch) {
      flushList(index)
      const level = headingMatch[1].length
      const headingFontSize = level === 1 ? '1.1rem' : level === 2 ? '1rem' : '0.95rem'
      elements.push(
        <div
          key={`h-${index}`}
          style={{
            fontWeight: 700,
            fontSize: headingFontSize,
            margin: '0.5rem 0 0.25rem',
            color: 'var(--text-primary)',
          }}
        >
          {renderInlineText(headingMatch[2])}
        </div>
      )
      return
    }

    // Regular paragraph
    flushList(index)
    elements.push(
      <p
        key={`p-${index}`}
        style={{
          margin: '0.25rem 0',
          lineHeight: '1.5',
        }}
      >
        {renderInlineText(line)}
      </p>
    )
  })

  flushList('end')

  return <div style={{ display: 'flex', flexDirection: 'column' }}>{elements}</div>
}

export default function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, append } = useChat({
    api: '/api/chat',
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Halo! Saya adalah Asisten AI Desa. Ada yang bisa saya bantu terkait informasi pelayanan desa?'
      }
    ]
  })

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const suggestedQuestions = [
    "Bagaimana cara mengajukan layanan?",
    "Apa saja layanan yang tersedia?",
    "Apa syarat Surat Keterangan Domisili?",
    "Bagaimana cara melihat status permohonan saya?"
  ]

  const handleSuggestedClick = (question: string) => {
    append({
      role: 'user',
      content: question,
    })
  }

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary)',
            color: 'white',
            border: 'none',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.15)',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '1.75rem',
            zIndex: 9999,
            transition: 'transform 0.2s',
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          aria-label="Buka Chat AI"
        >
          💬
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: '380px',
          height: '600px',
          maxHeight: '80vh',
          backgroundColor: 'var(--bg-color)',
          borderRadius: '16px',
          boxShadow: '0 20px 30px -5px rgba(0, 0, 0, 0.2), 0 10px 15px -5px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999,
          overflow: 'hidden',
          transition: 'background-color 0.25s ease, border-color 0.25s ease'
        }}>
          {/* Header */}
          <div style={{
            padding: '1rem 1.25rem',
            background: 'linear-gradient(195deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Asisten Desa AI 🤖</h3>
              <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>Siap membantu Anda</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1 }}
              aria-label="Tutup chat"
            >
              ×
            </button>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            backgroundColor: 'var(--bg-color)',
            transition: 'background-color 0.25s ease'
          }}>
            {messages.map((m) => {
              const isUser = m.role === 'user'
              return (
                <div key={m.id} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start'
                }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', marginLeft: '0.5rem', marginRight: '0.5rem' }}>
                    {isUser ? 'Anda' : 'AI Assistant'}
                  </span>
                  <div style={{
                    maxWidth: '88%',
                    padding: '0.75rem 1rem',
                    borderRadius: '14px',
                    backgroundColor: isUser ? 'var(--primary)' : 'var(--surface)',
                    color: isUser ? 'white' : 'var(--text-primary)',
                    border: isUser ? 'none' : '1px solid var(--border)',
                    boxShadow: isUser ? '0 2px 8px rgba(220, 38, 38, 0.3)' : 'var(--shadow-sm)',
                    borderBottomRightRadius: isUser ? '4px' : '14px',
                    borderBottomLeftRadius: isUser ? '14px' : '4px',
                    lineHeight: '1.5',
                    fontSize: '0.9rem',
                    transition: 'background-color 0.25s ease, border-color 0.25s ease, color 0.25s ease'
                  }}>
                    <FormattedMessage content={m.content} />
                  </div>
                </div>
              )
            })}

            {isLoading && (
              <div style={{ alignSelf: 'flex-start', backgroundColor: 'transparent', padding: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <span className="typing-indicator">Memproses jawaban...</span>
              </div>
            )}

            {error && (
              <div style={{ alignSelf: 'center', backgroundColor: 'var(--error-bg-from)', color: 'var(--error-text)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', marginTop: '1rem', border: '1px solid var(--error-border)' }}>
                Koneksi ke AI gagal. Mohon periksa API Key atau coba lagi nanti.
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          {messages.length === 1 && !isLoading && (
            <div style={{ padding: '0 1rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Coba tanyakan:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestedClick(q)}
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.75rem',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--primary)',
                      color: 'var(--primary)',
                      borderRadius: '999px',
                      cursor: 'pointer',
                      fontWeight: 500,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--primary)'
                      e.currentTarget.style.color = 'white'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = 'var(--primary)'
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-color)', transition: 'background-color 0.25s ease' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Tanya sesuatu..."
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '0.7rem 1rem',
                  borderRadius: '999px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontSize: '0.875rem',
                  transition: 'background-color 0.25s ease, border-color 0.25s ease, color 0.25s ease'
                }}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: input.trim() && !isLoading ? 'var(--primary)' : 'var(--text-secondary)',
                  color: 'white',
                  border: 'none',
                  cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  flexShrink: 0,
                  transition: 'background-color 0.2s ease'
                }}
                aria-label="Kirim pesan"
              >
                ➤
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
