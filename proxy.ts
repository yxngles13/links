// proxy.ts
// This file must live at the REPO ROOT — same folder as package.json —
// not inside utils/ or app/. Next.js only runs the proxy from this exact
// location; it will not find it anywhere else, no matter how correct the
// logic inside utils/supabase/middleware.ts is.

import { type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await createClient(request)
}

export const config = {
  matcher: ['/onboarding/:path*', '/matches/:path*'],
}
