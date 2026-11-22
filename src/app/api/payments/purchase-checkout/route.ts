import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createPurchaseCheckout, PURCHASE_ITEM_TYPES, PurchaseError } from '@/lib/purchases';

// The client names the item. The price is looked up on the server; only a
// pay-what-you-want item accepts an amount, which the server checks against
// the item's minimum and maximum.
const purchaseCheckoutSchema = z
  .object({
    itemType: z.enum(PURCHASE_ITEM_TYPES),
    itemId: z.string().min(1).max(200),
    amount: z.number().finite().positive().optional(),
    // The fan's opt-in to the artist's email list, from an unticked-by-default box.
    joinFanList: z.boolean().optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { itemType, itemId, amount, joinFanList } = purchaseCheckoutSchema.parse(body);

    const user = await prisma.users.findUnique({ where: { id: session.user.id } });

    if (!user || user.role !== 'FAN') {
      return NextResponse.json({ error: 'Only fans can make purchases' }, { status: 403 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const { purchaseId, checkoutUrl } = await createPurchaseCheckout({
      fan: { id: user.id, email: user.email, displayName: user.displayName },
      itemType,
      itemId,
      amountCents: amount === undefined ? undefined : Math.round(amount * 100),
      joinFanList,
      baseUrl,
    });

    return NextResponse.json({ purchaseId, checkoutUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof PurchaseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Create purchase checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
