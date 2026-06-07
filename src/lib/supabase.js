import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://afczgttnakutfqoctumu.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmY3pndHRuYWt1dGZxb2N0dW11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3ODE4NTksImV4cCI6MjA5NjM1Nzg1OX0.fp4ZATNRNvqC104LCPFXPYMBBiKwP1qiQaOy19AvbvY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
