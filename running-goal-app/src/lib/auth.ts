import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthChange(
  cb: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  if (!supabase) return () => {}
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(cb)
  return () => subscription.unsubscribe()
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Supabase is not configured.'
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error?.message ?? null
}

export async function signUp(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Supabase is not configured.'
  const { error } = await supabase.auth.signUp({ email, password })
  return error?.message ?? null
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}

