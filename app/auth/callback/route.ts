import { handleOAuthCallback } from '@/app/actions'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')

    if (code) {
        const result = await handleOAuthCallback(code)
        if (result.success) {
            return redirect('/?gmail=connected')
        } else {
            return redirect(`/?gmail=error&message=${encodeURIComponent(result.error || 'Unknown Error')}`)
        }
    }

    return redirect('/?gmail=error&message=NoCode')
}
