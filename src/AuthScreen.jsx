import { useState } from 'react'
import { supabase } from './supabase'

function humanize(message) {
  if (!message) return 'Не получилось выполнить запрос'
  if (/invalid login credentials/i.test(message)) return 'Неверный email или пароль'
  if (/signup is disabled/i.test(message)) return 'Регистрация на проекте выключена'
  return message
}

export default function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    setError('')
    setPending(true)
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setPending(false)
    if (authError) setError(humanize(authError.message))
  }

  return (
    <main className="auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="eyebrow">GO DEVELOPER · INTERVIEW PREP</div>
        <h1>Тренажёр интервью по Go</h1>
        <p>
          Два уровня, Middle и Senior. Отмечайте разобранные темы и пишите конспект:
          прогресс хранится в аккаунте, а не в одном браузере.
        </p>
        <label>
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? (
          <div className="banner error" role="alert">
            {error}
          </div>
        ) : null}
        <button type="submit" className="primary" disabled={pending}>
          {pending ? 'Подождите…' : 'Войти'}
        </button>
      </form>
    </main>
  )
}
