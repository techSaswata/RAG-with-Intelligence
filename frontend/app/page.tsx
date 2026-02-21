'use client'

import { useState, useEffect, useRef } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface TokenUsage {
  input: number
  output: number
}

interface ResponseMetadata {
  model_used: string
  classification: string
  tokens: TokenUsage
  latency_ms: number
  chunks_retrieved: number
  evaluator_flags: string[]
}

interface Source {
  document: string
  page?: number
  relevance_score?: number
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<ResponseMetadata | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [showDebug, setShowDebug] = useState(true)
  const [useStreaming, setUseStreaming] = useState(true)
  const [isWakingUp, setIsWakingUp] = useState(false)
  const [backendStatus, setBackendStatus] = useState<'unknown' | 'awake' | 'sleeping'>('unknown')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const streamingMessageRef = useRef<HTMLDivElement>(null)
  
  // API URL from environment variable or default to localhost
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  // Wake up backend on mount
  useEffect(() => {
    const wakeUpBackend = async () => {
      try {
        setIsWakingUp(true)
        const startTime = Date.now()
        
        const response = await fetch(`${API_URL}/wake`, {
          method: 'GET',
          signal: AbortSignal.timeout(30000) // 30 second timeout
        })
        
        const elapsed = Date.now() - startTime
        
        if (response.ok) {
          setBackendStatus('awake')
          // If it took more than 5 seconds, it was likely a cold start
          if (elapsed > 5000) {
            console.log(`Backend woke up after ${elapsed}ms (cold start detected)`)
          }
        } else {
          setBackendStatus('sleeping')
        }
      } catch (error) {
        console.error('Failed to wake backend:', error)
        setBackendStatus('sleeping')
      } finally {
        setIsWakingUp(false)
      }
    }
    
    wakeUpBackend()
  }, [API_URL])

  // Load chat history from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('chatMessages')
    const savedConversationId = localStorage.getItem('conversationId')
    const savedMetadata = localStorage.getItem('chatMetadata')
    const savedSources = localStorage.getItem('chatSources')

    if (savedMessages) {
      setMessages(JSON.parse(savedMessages))
    }
    if (savedConversationId) {
      setConversationId(savedConversationId)
    }
    if (savedMetadata) {
      setMetadata(JSON.parse(savedMetadata))
    }
    if (savedSources) {
      setSources(JSON.parse(savedSources))
    }
  }, [])

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('chatMessages', JSON.stringify(messages))
    }
  }, [messages])

  useEffect(() => {
    if (conversationId) {
      localStorage.setItem('conversationId', conversationId)
    }
  }, [conversationId])

  useEffect(() => {
    if (metadata) {
      localStorage.setItem('chatMetadata', JSON.stringify(metadata))
    }
  }, [metadata])

  useEffect(() => {
    if (sources.length > 0) {
      localStorage.setItem('chatSources', JSON.stringify(sources))
    }
  }, [sources])

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const clearChat = () => {
    setMessages([])
    setConversationId(null)
    setMetadata(null)
    setSources([])
    localStorage.removeItem('chatMessages')
    localStorage.removeItem('conversationId')
    localStorage.removeItem('chatMetadata')
    localStorage.removeItem('chatSources')
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    if (useStreaming) {
      await handleStreamingSubmit(userMessage)
    } else {
      await handleRegularSubmit(userMessage)
    }
  }

  const handleStreamingSubmit = async (userMessage: string) => {
    let accumulatedText = ''
    let messageIndex = -1
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout
      
      const response = await fetch(`${API_URL}/query/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage,
          conversation_id: conversationId,
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error('Failed to get streaming response')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      if (!reader) {
        throw new Error('No response body')
      }

      let buffer = ''
      
      // Add empty assistant message
      setMessages(prev => {
        messageIndex = prev.length
        return [...prev, { role: 'assistant', content: '' }]
      })
      
      // Wait for DOM to update
      await new Promise(resolve => setTimeout(resolve, 50))

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true })
        
        // Process complete lines from buffer
        const lines = buffer.split('\n')
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'token') {
                // Update accumulated text
                accumulatedText += data.content
                console.log('Received token:', data.content, 'Total length:', accumulatedText.length)
                
                // Update DOM directly for immediate visual feedback
                if (streamingMessageRef.current) {
                  streamingMessageRef.current.textContent = accumulatedText
                  console.log('Updated DOM ref')
                  // Force browser to paint the update
                  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
                } else {
                  console.log('Ref not available yet')
                }
                
                // Also update state periodically (every 10 tokens to reduce re-renders)
                if (accumulatedText.length % 10 === 0) {
                  setMessages(prev => {
                    const newMessages = [...prev]
                    if (newMessages[messageIndex]) {
                      newMessages[messageIndex] = {
                        role: 'assistant',
                        content: accumulatedText
                      }
                    }
                    return newMessages
                  })
                }
              } else if (data.type === 'metadata') {
                // Update metadata and sources
                if (!conversationId) {
                  setConversationId(data.data.conversation_id)
                }
                setMetadata(data.data.metadata)
                setSources(data.data.sources || [])
              } else if (data.type === 'error') {
                throw new Error(data.error.message)
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError, 'Line:', line)
            }
          }
        }
      }
      
      // Final state update with complete text
      setMessages(prev => {
        const newMessages = [...prev]
        if (newMessages[messageIndex]) {
          newMessages[messageIndex] = {
            role: 'assistant',
            content: accumulatedText
          }
        }
        return newMessages
      })
      
      setBackendStatus('awake')
    } catch (error) {
      console.error('Streaming error:', error)
      
      let errorMessage = accumulatedText || 'Sorry, I encountered an error during streaming. Please try again.'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timed out. The backend might be waking up from a cold start. Please try again in a moment.'
          setBackendStatus('sleeping')
        } else if (error.message.includes('fetch')) {
          errorMessage = 'Unable to connect to the backend. It might be starting up. Please wait a moment and try again.'
          setBackendStatus('sleeping')
        }
      }
      
      setMessages(prev => {
        const newMessages = [...prev]
        if (messageIndex >= 0 && newMessages[messageIndex]) {
          newMessages[messageIndex] = {
            role: 'assistant',
            content: errorMessage
          }
        }
        return newMessages
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegularSubmit = async (userMessage: string) => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout
      
      const response = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage,
          conversation_id: conversationId,
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()
      
      if (!conversationId) {
        setConversationId(data.conversation_id)
      }

      // Update metadata and sources from response
      setMetadata(data.metadata)
      setSources(data.sources || [])

      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
      setBackendStatus('awake')
    } catch (error) {
      console.error('Error:', error)
      
      let errorMessage = 'Sorry, I encountered an error. Please try again.'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timed out. The backend might be waking up from a cold start. Please try again in a moment.'
          setBackendStatus('sleeping')
        } else if (error.message.includes('fetch')) {
          errorMessage = 'Unable to connect to the backend. It might be starting up. Please wait a moment and try again.'
          setBackendStatus('sleeping')
        }
      }
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: errorMessage
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const statusMeta = {
    awake: {
      label: 'Backend online',
      classes: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
    },
    sleeping: {
      label: 'Backend asleep',
      classes: 'border-amber-400/30 bg-amber-500/10 text-amber-200'
    },
    unknown: {
      label: 'Backend idle',
      classes: 'border-slate-400/20 bg-slate-500/10 text-slate-200'
    }
  }[backendStatus]

  return (
    <main className="relative h-screen bg-black text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/5 blur-[160px]" />
        <div className="absolute -bottom-32 right-[-10%] h-[420px] w-[420px] rounded-full bg-slate-200/5 blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,0,0,0.35)_0%,_rgba(0,0,0,0.98)_65%)]" />
      </div>

      <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col gap-4 px-6 pt-4 pb-2">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-800/60 bg-neutral-950/90 p-3 shadow-2xl shadow-black/60 backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-xl font-semibold text-white shadow-lg shadow-black/60">
              CP
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">ClearPath Studio</h1>
              <p className="text-sm text-slate-400">Conversational analytics and knowledge companion</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${statusMeta.classes}`}>
              {statusMeta.label}
            </span>
            <button
              onClick={() => setUseStreaming(!useStreaming)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                useStreaming
                  ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                  : 'border-slate-800/70 bg-neutral-950/90 text-slate-300 hover:bg-neutral-900'
              }`}
            >
              {useStreaming ? 'Streaming on' : 'Streaming off'}
            </button>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-rose-200 transition hover:bg-rose-500/20"
              >
                Reset Session
              </button>
            )}
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-800/60 bg-neutral-950/80 shadow-2xl shadow-black/70 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/60 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Conversation</p>
                <h2 className="text-lg font-semibold">Live guidance</h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="rounded-full border border-slate-800/60 bg-neutral-950/90 px-3 py-1">
                  {conversationId ? `Session ${conversationId.slice(0, 8)}` : 'New session'}
                </span>
                <span className="rounded-full border border-slate-800/60 bg-neutral-950/90 px-3 py-1">
                  {useStreaming ? 'Live stream' : 'Standard'}
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
              {isWakingUp && (
                <div className="flex flex-col items-center gap-4 rounded-3xl border border-slate-800/60 bg-neutral-950/80 px-8 py-10 text-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-slate-200" />
                  <div>
                    <p className="text-lg font-semibold text-slate-100">Warming up the backend</p>
                    <p className="text-sm text-slate-400">Cold start detected. First response can take up to a minute.</p>
                  </div>
                </div>
              )}

              {!isWakingUp && messages.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-800/60 bg-neutral-950/70 px-8 py-10 text-center">
                  <p className="text-lg font-semibold text-slate-100">Welcome to ClearPath Studio</p>
                  <p className="text-sm text-slate-400">
                    Ask about onboarding, pricing, integrations, or operational policies.
                  </p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[78%] space-y-2">
                      <p className="text-xs tracking-[0.08em] text-slate-400 font-mono">
                        {message.role === 'user' ? 'You' : 'ClearPath'}
                      </p>
                      <div
                        className={`rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-lg ${
                          message.role === 'user'
                            ? 'border border-slate-700/70 bg-neutral-900 text-white shadow-black/70'
                            : 'border border-slate-800/80 bg-neutral-950/80 text-slate-100 shadow-black/70'
                        }`}
                      >
                        <p
                          className="whitespace-pre-wrap"
                          ref={index === messages.length - 1 && message.role === 'assistant' ? streamingMessageRef : null}
                        >
                          {message.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-slate-800/60 bg-neutral-950/80 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-slate-200" />
                      Crafting response...
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-slate-800/60 bg-neutral-950/90 px-6 py-4">
              {backendStatus === 'sleeping' && (
                <div className="mb-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  Backend is asleep. Give it a moment and try again.
                </div>
              )}
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="flex items-end gap-3 rounded-3xl border border-slate-800/70 bg-neutral-950/80 px-4 py-3 shadow-inner shadow-black/80 focus-within:border-slate-500/60">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a question. Shift + Enter for new line."
                    className="min-h-[44px] flex-1 resize-none bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                    disabled={isLoading || isWakingUp}
                    rows={1}
                    style={{ maxHeight: '140px' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement
                      target.style.height = 'auto'
                      target.style.height = Math.min(target.scrollHeight, 140) + 'px'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim() || isWakingUp}
                    className="rounded-2xl bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Supports multi-line questions and follow-ups.</span>
                  <span>{input.trim().length} chars</span>
                </div>
              </form>
            </div>
          </section>

          <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-800/60 bg-neutral-950/80 shadow-2xl shadow-black/70 backdrop-blur">
            <div className="flex items-center justify-between border-b border-slate-800/60 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Insights</p>
                <h2 className="text-lg font-semibold">Response telemetry</h2>
              </div>
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="rounded-full border border-slate-800/60 bg-neutral-950/90 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300 transition hover:bg-neutral-900"
              >
                {showDebug ? 'Hide' : 'Show'}
              </button>
            </div>

            {showDebug && (
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
                {!metadata ? (
                  <div className="rounded-2xl border border-dashed border-slate-800/60 bg-neutral-950/70 px-6 py-10 text-center text-sm text-slate-400">
                    Send a message to reveal model telemetry.
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border border-slate-800/70 bg-neutral-950/90 p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Model</p>
                      <p className="mt-2 text-sm font-semibold text-slate-100">{metadata.model_used}</p>
                      <p className="text-xs text-slate-400">
                        Classification: <span className="font-semibold text-slate-200">{metadata.classification}</span>
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-800/70 bg-neutral-950/90 p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Token usage</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-300">
                        <div className="flex justify-between">
                          <span>Input</span>
                          <span className="font-semibold text-slate-100">{metadata.tokens.input}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Output</span>
                          <span className="font-semibold text-slate-100">{metadata.tokens.output}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-800/60 pt-2">
                          <span>Total</span>
                          <span className="font-semibold text-slate-200">
                            {metadata.tokens.input + metadata.tokens.output}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800/70 bg-neutral-950/90 p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Evaluator</p>
                      {metadata.evaluator_flags.length === 0 ? (
                        <div className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                          <span className="h-2 w-2 rounded-full bg-slate-300" />
                          No issues detected
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {metadata.evaluator_flags.map((flag, index) => (
                            <div key={index} className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                              <p className="font-semibold">{flag}</p>
                              <p className="text-xs text-amber-100/80">{getFlagDescription(flag)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-800/70 bg-neutral-950/90 p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Performance</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-300">
                        <div className="flex justify-between">
                          <span>Latency</span>
                          <span className="font-semibold text-slate-100">{metadata.latency_ms}ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Chunks</span>
                          <span className="font-semibold text-slate-100">{metadata.chunks_retrieved}</span>
                        </div>
                      </div>
                    </div>

                    {sources.length > 0 && (
                      <div className="rounded-2xl border border-slate-800/70 bg-neutral-950/90 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Sources</p>
                        <div className="mt-3 space-y-3 text-sm text-slate-200">
                          {sources.map((source, index) => (
                            <div key={index} className="rounded-xl border border-slate-800/60 bg-neutral-950/80 px-3 py-2">
                              <p className="font-semibold text-slate-100">{source.document}</p>
                              <div className="flex justify-between text-xs text-slate-400">
                                {source.page && <span>Page {source.page}</span>}
                                {source.relevance_score && <span>{source.relevance_score.toFixed(3)}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}

function getFlagDescription(flag: string): string {
  const descriptions: Record<string, string> = {
    'no_context': 'Answer generated without relevant documentation',
    'refusal': 'System declined to answer the question',
    'unverified_feature': 'Mentioned features not found in documentation',
    'pricing_uncertainty': 'Pricing information may be uncertain or conflicting'
  }
  return descriptions[flag] || 'Quality warning detected'
}
