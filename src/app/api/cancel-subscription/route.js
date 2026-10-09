import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// We use the Service Role Key here so the server can safely bypass Row Level Security to update the DB
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
    try {
        const { trailerId } = await req.json();

        if (!trailerId) {
            return NextResponse.json({ error: 'Trailer ID is required' }, { status: 400 });
        }

        // 1. Find the trailer in the database to get its Stripe Subscription ID
        const { data: trailer, error: fetchError } = await supabase
            .from('trailers')
            .select('stripe_subscription_id, is_sold, seller_email')
            .eq('id', trailerId)
            .single();

        if (fetchError || !trailer) {
            console.error("Database fetch error:", fetchError);
            return NextResponse.json({ error: 'Trailer not found' }, { status: 404 });
        }

        if (trailer.is_sold) {
            return NextResponse.json({ error: 'Trailer is already marked as sold' }, { status: 400 });
        }

        // 2. If it has an active Stripe subscription, cancel it immediately
        if (trailer.stripe_subscription_id) {
            try {
                await stripe.subscriptions.cancel(trailer.stripe_subscription_id);
                console.log(`Successfully canceled Stripe subscription: ${trailer.stripe_subscription_id}`);
            } catch (stripeError) {
                console.error("Stripe cancellation error:", stripeError);
                return NextResponse.json({ error: 'Failed to cancel billing with Stripe' }, { status: 500 });
            }
        }

        // 3. Mark the trailer as sold in Supabase so it drops off the Browse page
        const { error: updateError } = await supabase
            .from('trailers')
            .update({ is_sold: true })
            .eq('id', trailerId);

        if (updateError) {
            console.error("Database update error:", updateError);
            return NextResponse.json({ error: 'Failed to mark trailer as sold in database' }, { status: 500 });
        }

       

// 5. Return a success message back to our frontend
return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Cancel Subscription API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}