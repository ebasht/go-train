import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { TRACK_LIST, TRACKS, flatten } from './tracks'

function emptyProgress() {
  return { middle: {}, senior: {} }
}

function TopicDrill({ item, note, onNote }) {
  const [showPoints, setShowPoints] = useState(false)

  return (
    <div className="drill">
      <p className="question">{item.question}</p>
      <button type="button" className="ghost" onClick={() => setShowPoints((value) => !value)}>
        {showPoints ? 'Скрыть ориентиры' : 'Ориентиры ответа'}
      </button>
      {showPoints ? (
        <ul>
          {item.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      ) : null}
      <label className="note-label">
        Мой конспект
        <textarea
          value={note}
          maxLength={4000}
          rows={4}
          placeholder="Тезисы, которые хотите удержать к созвону"
          onChange={(event) => onNote(event.target.value)}
        />
      </label>
    </div>
  )
}

export default function Tracker({ session }) {
  const userId = session.user.id
  const [trackId, setTrackId] = useState('middle')
  const [progress, setProgress] = useState(emptyProgress)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [sync, setSync] = useState('idle')
  const [saveError, setSaveError] = useState('')
  const [openId, setOpenId] = useState(null)
  const [onlyLeft, setOnlyLeft] = useState(false)
  const progressRef = useRef(emptyProgress())
  const timers = useRef({})

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error } = await supabase.from('progress').select('track, item_id, done, note')
      if (cancelled) return
      if (error) {
        setLoadError(error.message)
        setLoaded(true)
        return
      }
      const next = emptyProgress()
      for (const row of data || []) {
        if (!next[row.track]) continue
        next[row.track][row.item_id] = { done: !!row.done, note: row.note || '' }
      }
      progressRef.current = next
      setProgress(next)
      setLoaded(true)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(
    () => () => {
      Object.values(timers.current).forEach(clearTimeout)
    },
    [],
  )

  const track = TRACKS[trackId]
  const items = flatten(track)
  const doneCount = items.filter((item) => progress[trackId]?.[item.id]?.done).length
  const total = items.length
  const pct = total ? Math.round((doneCount / total) * 100) : 0
  const current = items.find((item) => !progress[trackId]?.[item.id]?.done)

  function commit(trackKey, id, patch) {
    const currentRow = progressRef.current[trackKey]?.[id] || { done: false, note: '' }
    const nextRow = { ...currentRow, ...patch }
    const next = {
      ...progressRef.current,
      [trackKey]: { ...(progressRef.current[trackKey] || {}), [id]: nextRow },
    }
    progressRef.current = next
    setProgress(next)
    return nextRow
  }

  async function persist(trackKey, id, row) {
    setSync('saving')
    const { error } = await supabase.from('progress').upsert({
      user_id: userId,
      track: trackKey,
      item_id: id,
      done: row.done,
      note: row.note,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      setSync('error')
      setSaveError(error.message)
      return false
    }
    setSaveError('')
    setSync('saved')
    return true
  }

  async function onToggle(id, done) {
    const trackKey = trackId
    clearTimeout(timers.current[`${trackKey}:${id}`])
    const previous = progressRef.current[trackKey]?.[id] || { done: false, note: '' }
    const nextRow = commit(trackKey, id, { done })
    const ok = await persist(trackKey, id, nextRow)
    if (!ok && progressRef.current[trackKey]?.[id]?.done === done) {
      commit(trackKey, id, previous)
    }
  }

  function onNote(id, note) {
    const trackKey = trackId
    const nextRow = commit(trackKey, id, { note })
    const timerKey = `${trackKey}:${id}`
    clearTimeout(timers.current[timerKey])
    timers.current[timerKey] = setTimeout(() => {
      const latest = progressRef.current[trackKey]?.[id] || nextRow
      persist(trackKey, id, latest)
    }, 500)
  }

  async function resetTrack() {
    const accepted = window.confirm('Сбросить галочки и конспекты этого уровня?')
    if (!accepted) return
    Object.values(timers.current).forEach(clearTimeout)
    const { error } = await supabase.from('progress').delete().eq('user_id', userId).eq('track', trackId)
    if (error) {
      setSync('error')
      setSaveError(error.message)
      return
    }
    const next = { ...progressRef.current, [trackId]: {} }
    progressRef.current = next
    setProgress(next)
    setSaveError('')
    setSync('saved')
  }

  function exportProgress() {
    const payload = {
      exportedAt: new Date().toISOString(),
      track: trackId,
      email: session.user.email,
      done: doneCount,
      total,
      topics: items.map((item) => ({
        id: item.id,
        week: track.weeks[item.weekIndex].name,
        title: item.title,
        question: item.question,
        done: !!progress[trackId]?.[item.id]?.done,
        note: progress[trackId]?.[item.id]?.note || '',
      })),
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `go-${trackId}-progress.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const syncLabel = {
    idle: 'Прогресс привязан к аккаунту',
    saving: 'Сохраняем…',
    saved: 'Сохранено в аккаунте',
    error: 'Не удалось сохранить',
  }[sync]

  return (
    <main>
      <div className="top">
        <div>
          <div className="eyebrow">{track.eyebrow}</div>
          <h1>{track.title}</h1>
          <p>{track.subtitle}</p>
        </div>
        <div className="side">
          <div className="stat">
            <strong>{pct}%</strong>
            <div>
              выполнено: {doneCount} / {total}
            </div>
          </div>
          <div className="who">
            <span>{session.user.email}</span>
            <button type="button" onClick={() => supabase.auth.signOut()}>
              Выйти
            </button>
          </div>
        </div>
      </div>

      <div className="levels" role="tablist" aria-label="Уровень">
        {TRACK_LIST.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === trackId}
            className={item.id === trackId ? 'level active' : 'level'}
            onClick={() => setTrackId(item.id)}
          >
            {item.level}
          </button>
        ))}
      </div>

      <div className="bar" aria-hidden="true">
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>
      <p className={sync === 'error' ? 'sync error-text' : 'sync'}>
        {loaded ? syncLabel : 'Загружаем прогресс…'}
        {saveError ? ` · ${saveError}` : ''}
      </p>
      {loadError ? (
        <div className="banner error" role="alert">
          Не удалось загрузить прогресс: {loadError}
        </div>
      ) : null}

      <div className="note">
        <strong>{current ? 'Следующая тема:' : 'Уровень закрыт.'}</strong>{' '}
        {current ? current.title : 'Все темы отмечены. Имеет смысл проговорить mock ещё раз вслух.'}
      </div>

      <div className="weeks">
        {track.weeks.map((week, weekIndex) => {
          const weekItems = week.items
            .map((item, itemIndex) => ({ ...item, id: `${weekIndex}-${itemIndex}` }))
            .filter((item) => !onlyLeft || !progress[trackId]?.[item.id]?.done)
          if (!weekItems.length) return null
          return (
            <section className="week" key={week.name}>
              <h2>{week.name}</h2>
              <small>{week.sub}</small>
              {weekItems.map((item) => {
                const row = progress[trackId]?.[item.id] || { done: false, note: '' }
                const isOpen = openId === item.id
                return (
                  <div key={item.id}>
                    <div className="item">
                      <input
                        type="checkbox"
                        checked={row.done}
                        disabled={!loaded}
                        aria-label={item.title}
                        onChange={(event) => onToggle(item.id, event.target.checked)}
                      />
                      <button
                        type="button"
                        className="topic-name"
                        aria-expanded={isOpen}
                        onClick={() => setOpenId(isOpen ? null : item.id)}
                      >
                        <span>{item.title}</span>
                      </button>
                      {current?.id === item.id ? <b className="pill">СЕЙЧАС</b> : null}
                    </div>
                    {isOpen ? <TopicDrill item={item} note={row.note} onNote={(note) => onNote(item.id, note)} /> : null}
                  </div>
                )
              })}
            </section>
          )
        })}
      </div>

      <div className="actions">
        <button type="button" onClick={() => setOnlyLeft((value) => !value)}>
          {onlyLeft ? 'Показать все темы' : 'Только оставшиеся'}
        </button>
        <button type="button" onClick={exportProgress} disabled={!loaded}>
          Экспорт прогресса (JSON)
        </button>
        <button type="button" onClick={resetTrack} disabled={!loaded}>
          Сбросить уровень
        </button>
      </div>
      <footer>Галочки и конспекты лежат в Supabase и открываются с этим аккаунтом на другом устройстве.</footer>
    </main>
  )
}
