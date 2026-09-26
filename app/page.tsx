import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server' // adjust to your actual path

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data } = await supabase.auth.getSession()
  console.log(data)

  return (
    <h1>LINKS</h1>
  )
}