import { createClient } from '@supabase/supabase-js'

// No front só usamos a URL e a anon key (protegidas por RLS no banco).
// Chaves secretas (service_role, Gemini, Telegram) ficam só nas Edge Functions.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  console.error(
    'Faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY. Copie .env.example para .env e preencha.',
  )
}

// Valores de fallback evitam que o app quebre ao abrir sem .env (só as chamadas falham)
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'sem-chave')
