import { redirect } from 'next/navigation'
import { createServerActionClient } from '@/lib/supabase-server'

export default async function Home() {
  const supabase = await createServerActionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  redirect('/berichte')
}
