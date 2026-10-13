import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Use the Service Role Key to insert data securely as an admin
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
    try {
        const { TruckData, userId } = await req.json();
        const origin = req.headers.get('origin') || 'https://www.Trucklion.com';

        // 1. INSERT DATA INTO SUPABASE FIRST
        // We create the Truck record as a 'draft' so it isn't live yet
        const { data: TruckRecord, error: dbError } = await supabase
            .from('trucks')
            .insert([{
                ...TruckData,
                seller_id: userId,
                is_approved: false, // Ensure it's hidden from the public
                is_sold: false
            }])
            .select('id')
            .single();

        if (dbError) {
            console.error("Supabase Insert Error:", dbError);
            throw new Error("Failed to save Truck to database");
        }

        // 2. CREATE STRIPE SESSION
        // We only pass the ID. This will NEVER hit the 500-char limit.
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: 'Truck Listing Subscription' },
                    unit_amount: 1900, // $19.00
                    recurring: { interval: 'month' },
                },
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: `${origin}/?success=true`,
            cancel_url: `${origin}/?canceled=true`,
            metadata: {
                TruckId: TruckRecord.id, // Only passing the ID
                userId: userId
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (err) {
        console.error("Stripe Checkout Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}