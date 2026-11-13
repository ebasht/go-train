import { createClient } from '@supabase/supabase-js'

const runtime = window.__GO_TRACKER_CONFIG__
const url = String(runtime?.url || import.meta.env.VITE_SUPABASE_URL || '').trim()
const anonKey = String(runtime?.anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

if (!url || !anonKey) {
  throw new Error('Нужны VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(url, anonKey)
