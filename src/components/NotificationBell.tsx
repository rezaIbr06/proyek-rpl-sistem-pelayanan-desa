'use client'

import { useState, useEffect, useRef } from 'react'
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '@/app/actions/notification'

type Notification = {
  id: string
  title: string
  message: string
  isRead: boolean
  createdAt: Date
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchUnreadCount = async () => {
    try {
      const count = await getUnreadCount()
      setUnreadCount(count)
    } catch (e) {
      console.error(e)
    }
  }

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const data = await getNotifications()
      setNotifications(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Defer initial notification check slightly to give main thread render priority
    const timer = setTimeout(() => {
      fetchUnreadCount()
    }, 150)

    // Poll for new notifications every 60 seconds
    const interval = setInterval(fetchUnreadCount, 60000)
    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const [menuPos, setMenuPos] = useState<{
    top?: number
    bottom?: number
    left?: number
    right?: number
    width: number
  } | null>(null)

  const updatePosition = () => {
    if (!dropdownRef.current) return
    const rect = dropdownRef.current.getBoundingClientRect()
    const dropdownWidth = 360
    const dropdownHeight = 420
    const pad = 16

    let left: number | undefined
    let right: number | undefined

    // Cek apakah tombol berada di area kiri layar (misal di sidebar footer)
    if (rect.left < 320) {
      // Buka ke arah kanan agar tidak terpotong tepi kiri layar
      if (rect.left + dropdownWidth <= window.innerWidth - pad) {
        left = Math.max(pad, rect.left)
      } else {
        left = pad
      }
    } else {
      // Tombol di area kanan layar (misal di top header)
      right = Math.max(pad, window.innerWidth - rect.right)
    }

    let top: number | undefined
    let bottom: number | undefined
    const spaceBelow = window.innerHeight - rect.bottom

    // Jika ruang di bawah tidak cukup, buka ke atas (upwards)
    if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
      bottom = window.innerHeight - rect.top + 8
    } else {
      top = rect.bottom + 8
    }

    setMenuPos({
      top,
      bottom,
      left,
      right,
      width: Math.min(dropdownWidth, window.innerWidth - 2 * pad),
    })
  }

  const toggleDropdown = () => {
    if (!isOpen) {
      fetchNotifications()
      updatePosition()
    }
    setIsOpen(!isOpen)
  }

  useEffect(() => {
    if (!isOpen) return
    const handleReposition = () => updatePosition()
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [isOpen])

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await markAsRead(id)
    setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnreadCount(Math.max(0, unreadCount - 1))
  }

  const handleMarkAllAsRead = async () => {
    await markAllAsRead()
    setNotifications(notifications.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        aria-label="Notifikasi"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: '0.4rem',
          fontSize: '1.25rem',
          lineHeight: 1,
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '0',
            right: '0',
            backgroundColor: '#ef4444',
            color: 'white',
            borderRadius: '999px',
            fontSize: '0.65rem',
            padding: '2px 6px',
            fontWeight: 'bold',
            transform: 'translate(25%, -25%)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && menuPos && (
        <div style={{
          position: 'fixed',
          top: menuPos.top !== undefined ? `${menuPos.top}px` : undefined,
          bottom: menuPos.bottom !== undefined ? `${menuPos.bottom}px` : undefined,
          left: menuPos.left !== undefined ? `${menuPos.left}px` : undefined,
          right: menuPos.right !== undefined ? `${menuPos.right}px` : undefined,
          width: `${menuPos.width}px`,
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
          zIndex: 9999,
          maxHeight: '440px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out',
        }}>
          {/* Header */}
          <div style={{
            padding: '0.875rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--surface)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                Notifikasi
              </h3>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '99px',
                  backgroundColor: 'rgba(220, 38, 38, 0.15)',
                  color: 'var(--danger, #dc2626)',
                  fontWeight: '700'
                }}>
                  {unreadCount} baru
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--danger, #dc2626)',
                  fontSize: '0.775rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                Tandai semua dibaca
              </button>
            )}
          </div>

          {/* Notification List */}
          <div style={{ overflowY: 'auto', flex: 1, backgroundColor: 'var(--surface)' }}>
            {loading ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Memuat notifikasi...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Belum ada notifikasi</div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Notifikasi terbaru akan muncul di sini.</div>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {notifications.map(notification => (
                  <li
                    key={notification.id}
                    style={{
                      padding: '0.875rem 1.25rem',
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: notification.isRead ? 'transparent' : 'rgba(220, 38, 38, 0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.3rem',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <strong style={{
                        fontSize: '0.875rem',
                        color: notification.isRead ? 'var(--text-primary)' : 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}>
                        {!notification.isRead && (
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary)', flexShrink: 0 }} />
                        )}
                        {notification.title}
                      </strong>
                      {!notification.isRead && (
                        <button
                          onClick={(e) => handleMarkAsRead(notification.id, e)}
                          title="Tandai sudah dibaca"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            fontSize: '0.85rem',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            lineHeight: 1
                          }}
                        >
                          ✓
                        </button>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                      {notification.message}
                    </p>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.15rem' }}>
                      {new Date(notification.createdAt).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
