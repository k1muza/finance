'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Send, Smartphone, Megaphone, Music, Calendar, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { Notification } from '@/types'

const TYPES = [
  { value: 'announcement', label: 'Announcement', icon: Megaphone, color: 'text-yellow-400' },
  { value: 'programme',    label: 'Programme',    icon: Calendar,  color: 'text-cyan-400' },
  { value: 'song',         label: 'Song',         icon: Music,     color: 'text-purple-400' },
  { value: 'general',      label: 'General',      icon: Info,      color: 'text-slate-400' },
] as const

type NotifType = typeof TYPES[number]['value']

export default function NotificationsPage() {
  const supabase = createClient()
  const toast = useToast()

  const [deviceCount, setDeviceCount] = useState<number | null>(null)
  const [history, setHistory] = useState<Notification[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState<NotifType>('announcement')
  const [sending, setSending] = useState(false)

  const loadData = useCallback(async () => {
    const [countRes, histRes] = await Promise.all([
      supabase.from('device_tokens').select('id', { count: 'exact', head: true }),
      supabase.from('notifications').select('*').order('sent_at', { ascending: false }).limit(20),
    ])
    setDeviceCount(countRes.count ?? 0)
    setHistory(histRes.data ?? [])
    setLoadingHistory(false)
  }, []) // eslint-disable-line

  useEffect(() => { loadData() }, [loadData])

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), type }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to send')
      toast.success(`Sent to ${json.sent} device${json.sent !== 1 ? 's' : ''}`)
      setTitle('')
      setBody('')
      setType('announcement')
      await loadData()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSending(false)
    }
  }

  const typeInfo = (t: string) => TYPES.find((x) => x.value === t) ?? TYPES[3]

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-7 w-7 text-cyan-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Notifications</h1>
            <p className="text-sm text-slate-400 mt-1">Send push notifications to all Flutter devices</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg">
          <Smartphone className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-300">
            {deviceCount === null ? '…' : deviceCount} device{deviceCount !== 1 ? 's' : ''} registered
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Compose */}
        <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4 self-start">
          <h2 className="text-sm font-semibold text-slate-200">Compose</h2>

          {/* Type selector */}
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
                    type === t.value
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                      : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${type === t.value ? 'text-cyan-400' : t.color}`} />
                  {t.label}
                </button>
              )
            })}
          </div>

          <Input
            label="Title"
            placeholder="e.g. New songs added"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-300">Message</label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="e.g. Check out the latest worship songs now available in the app."
              className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
            />
          </div>

          <Button
            onClick={handleSend}
            loading={sending}
            disabled={!title.trim() || !body.trim()}
            className="w-full"
          >
            <Send className="h-4 w-4" />
            Send to All Devices
          </Button>
        </div>

        {/* History */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">Recent Notifications</h2>
          {loadingHistory ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : history.length === 0 ? (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
              <p className="text-slate-500 text-sm">No notifications sent yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((n) => {
                const t = typeInfo(n.type)
                const Icon = t.icon
                return (
                  <div key={n.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center mt-0.5">
                      <Icon className={`h-4 w-4 ${t.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-slate-100 text-sm truncate">{n.title}</p>
                        <span className="shrink-0 text-xs text-slate-500">{formatTime(n.sent_at)}</span>
                      </div>
                      <p className="text-sm text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-slate-500 capitalize">{n.type}</span>
                        <span className="text-xs text-slate-600">·</span>
                        <span className="text-xs text-slate-500">
                          <Smartphone className="h-3 w-3 inline mr-0.5" />
                          {n.recipient_count} delivered
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Flutter setup guide */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-slate-400" />
          Flutter Integration
        </h2>
        <p className="text-xs text-slate-400">Add this to your Flutter app to register for notifications. Call it once after Firebase initialises.</p>
        <pre className="text-xs text-slate-300 bg-slate-900 rounded-lg p-4 overflow-x-auto leading-relaxed">{`// pubspec.yaml
// firebase_messaging: ^15.0.0
// http: ^1.0.0

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:http/http.dart' as http;
import 'dart:io';

Future<void> registerDevice() async {
  final messaging = FirebaseMessaging.instance;
  await messaging.requestPermission();
  final token = await messaging.getToken();
  if (token == null) return;

  await http.post(
    Uri.parse('https://YOUR_DASHBOARD_URL/api/notifications/register'),
    headers: {'Content-Type': 'application/json'},
    body: '{"token":"${'$'}token","platform":"${'$'}{Platform.isIOS ? 'ios' : 'android'}"}',
  );

  // Refresh token when it rotates
  messaging.onTokenRefresh.listen((newToken) async {
    await http.post(
      Uri.parse('https://YOUR_DASHBOARD_URL/api/notifications/register'),
      headers: {'Content-Type': 'application/json'},
      body: '{"token":"${'$'}newToken","platform":"${'$'}{Platform.isIOS ? 'ios' : 'android'}"}',
    );
  });
}`}</pre>
      </div>
    </div>
  )
}
