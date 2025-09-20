import { createClient } from '@supabase/supabase-js'

// Supabase configuration
// NOTE: For production, use environment variables in .env.local
// For demo/school project, these credentials are included for easy setup
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://yfsoyzsrvwlnriupzegp.supabase.co'
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlmc295enNydndsbnJpdXB6ZWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMDI2ODYsImV4cCI6MjA3Mzg3ODY4Nn0.Zb7PHY2C2rmp5br9EiRMtIBucsmT01iweYv_Fl_wX5E'

if (!process.env.REACT_APP_SUPABASE_URL || !process.env.REACT_APP_SUPABASE_ANON_KEY) {
  console.log('Using fallback Supabase credentials. For production, set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
