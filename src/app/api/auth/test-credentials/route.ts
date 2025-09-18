import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ ok: false, reason: 'user_not_found' })
    }
    if (!user.password) {
      return NextResponse.json({ ok: false, reason: 'no_password' })
    }
    const valid = await bcrypt.compare(password, user.password)
    return NextResponse.json({ ok: valid, user: { id: user.id, role: user.role } })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}