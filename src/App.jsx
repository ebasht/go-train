import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import AuthScreen from './AuthScreen'
import Tracker from './Tracker'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  if (session === undefined) {
    return <main className="boot">Загрузка…</main>
  }

  if (!session) return <AuthScreen />
  return <Tracker session={session} />
}
