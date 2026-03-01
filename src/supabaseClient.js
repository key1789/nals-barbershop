import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://oisxwukvwrhqvrwrkuhe.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pc3h3dWt2d3JocXZyd3JrdWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNjQ3MTEsImV4cCI6MjA4NjY0MDcxMX0.MWE0VleufegY3VUcHs8uKmyr1ArBX1tqYk-RTl6SbKY'

export const supabase = createClient(supabaseUrl, supabaseKey)