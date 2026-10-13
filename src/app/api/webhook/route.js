import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
    const body = await req.text();
    const signature = (await headers()).get('Stripe-Signature');
    let event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
        console.error('Webhook Error:', error.message);
        return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
    }

    try {
        // EVENT 1: PAYMENT SUCCESSFUL!
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const subscriptionId = session.subscription;
            const customerEmail = session.customer_details?.email;
            
            // Fetch ID from metadata (ensure your checkout route sets this exact key)
            const truckId = session.metadata?.truckId || session.metadata?.TruckId;

            if (truckId) {
                // 1. Update the existing row in Supabase
                const { data: truckData, error: updateError } = await supabase
                    .from('trucks')
                    .update({ 
                        stripe_subscription_id: subscriptionId,
                        is_approved: false 
                    })
                    .eq('id', truckId)
                    .select('*')
                    .single();
                
                if (updateError) throw updateError;

                const truckTitle = `${truckData.year || ''} ${truckData.make || ''} ${truckData.model || ''}`.trim() || 'Truck';

                // 2. Send "Under Review" Email to Customer (DARK MODE UI)
                if (customerEmail) {
                    await resend.emails.send({
                        from: 'support@trucklion.com', 
                        to: customerEmail,
                        subject: 'Payment Successful - Truck Under Review',
                        html: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 8px; overflow: hidden; background-color: #27272a;">
        <div style="background-color: #eff6ff; padding: 25px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #111827;">Truck<span style="color: #f87171;">Lion</span></h1>
        </div>
        <div style="padding: 30px; color: #e5e7eb;">
            <h2 style="color: #ffffff; margin-top: 0; font-size: 22px;">Payment Received!</h2>
            <p style="font-size: 16px; line-height: 1.5; color: #e5e7eb;">Your payment was successful. Your <strong>${truckTitle}</strong> listing is currently under review by our admin team to ensure quality.</p>
            <p style="font-size: 16px; line-height: 1.5; color: #e5e7eb;">It will be live on the site shortly! If you sell your truck or wish to cancel your subscription, you can do so at any time from your Seller Dashboard.</p>
        </div>
        <div style="background-color: #1f2937; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af;">
            &copy; ${new Date().getFullYear()} TruckLion. All rights reserved.
        </div>
    </div>
                        `
                    });
                }

                // 3. Send Admin Alert Email (Routed to your admin inbox)
                await resend.emails.send({
                    from: 'support@trucklion.com', 
                    to: 'trucklion@trucklion.com', 
                    subject: '🚨 New Paid Listing Awaiting Approval!',
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; max-width: 600px; border: 1px solid #e5e7eb; border-radius: 8px;">
                            <h2 style="color: #dc2626; margin-top: 0;">Action Required: Approve Listing</h2>
                            <p style="font-size: 16px;">A user has successfully paid for a new listing. It is currently pending in your database and requires your approval to go live.</p>
                            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin-top: 20px;">
                                <p style="margin: 5px 0;"><strong>Vehicle:</strong> ${truckTitle}</p>
                                <p style="margin: 5px 0;"><strong>Price:</strong> $${truckData.price ? truckData.price.toLocaleString() : 'N/A'}</p>
                                <p style="margin: 5px 0;"><strong>Seller Email:</strong> ${customerEmail || 'N/A'}</p>
                            </div>
                        </div>
                    `,
                });
            }
        }

        // EVENT 2: SUBSCRIPTION CANCELED!
        if (event.type === 'customer.subscription.deleted') {
            const subscription = event.data.object;
            const subscriptionId = subscription.id;

            // Update database and fetch info for the email
            const { data: truck, error } = await supabase
                .from('trucks')
                .update({ is_sold: true })
                .eq('stripe_subscription_id', subscriptionId)
                .select('seller_email, make, model, year')
                .single();

            if (!error && truck && truck.seller_email) {
                const truckTitle = `${truck.year || ''} ${truck.make || ''} ${truck.model || ''}`.trim() || 'Truck';

                try {
                    // Send "Subscription Canceled" Email to Customer
                    await resend.emails.send({
                        from: 'support@trucklion.com',
                        to: truck.seller_email,
                        subject: 'TruckLion Subscription Canceled',
                        html: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 8px; overflow: hidden; background-color: #27272a;">
        <div style="background-color: #eff6ff; padding: 25px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #111827;">Truck<span style="color: #f87171;">Lion</span></h1>
        </div>
        <div style="padding: 30px; color: #e5e7eb;">
            <h2 style="color: #ffffff; margin-top: 0; font-size: 22px;">Subscription Canceled</h2>
            <p style="font-size: 16px; line-height: 1.5; color: #e5e7eb;">This email is to confirm that your subscription for the <strong>${truckTitle}</strong> listing has been successfully canceled.</p>
            <p style="font-size: 16px; line-height: 1.5; color: #e5e7eb;">Your truck has been marked as Sold/Archived and will no longer be visible to buyers. <strong>You will not be billed again for this listing.</strong></p>
        </div>
        <div style="background-color: #1f2937; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af;">
            &copy; ${new Date().getFullYear()} TruckLion. All rights reserved.
        </div>
    </div>
                        `,
                    });
                } catch (emailError) {
                    console.error("Failed to send cancellation email:", emailError);
                }
            }
        }

        // EVENT 3: PAYMENT FAILED!
        if (event.type === 'invoice.payment_failed') {
            const invoice = event.data.object;
            const subscriptionId = invoice.subscription;
            const customerEmail = invoice.customer_email;

            if (subscriptionId) {
                // Instantly hide the Truck from the live site
                const { data: truckData, error: archiveError } = await supabase
                    .from('trucks')
                    .update({ 
                        is_archived: true, 
                        is_approved: false 
                    })
                    .eq('stripe_subscription_id', subscriptionId)
                    .select('make, model, year')
                    .single();
                
                if (archiveError) {
                    console.error("Error archiving Truck on payment failure:", archiveError);
                }

                // Send "Payment Failed" Alert to Customer
                if (customerEmail && !archiveError) {
                    const truckTitle = `${truckData.year || ''} ${truckData.make || ''} ${truckData.model || ''}`.trim() || 'Truck';

                    try {
                        await resend.emails.send({
                            from: 'support@trucklion.com',
                            to: customerEmail,
                            subject: 'Action Required: TruckLion Payment Failed',
                            html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 8px; overflow: hidden; background-color: #27272a;">
            <div style="background-color: #fee2e2; padding: 25px; text-align: center;">
                <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #111827;">Truck<span style="color: #f87171;">Lion</span></h1>
            </div>
            <div style="padding: 30px; color: #e5e7eb;">
                <h2 style="color: #ffffff; margin-top: 0; font-size: 22px;">Payment Failed</h2>
                <p style="font-size: 16px; line-height: 1.5; color: #e5e7eb;">We were unable to process the latest payment for your <strong>${truckTitle}</strong> listing.</p>
                <p style="font-size: 16px; line-height: 1.5; color: #e5e7eb;">To prevent further issues, your listing has been temporarily paused and archived. To get your truck back in front of buyers, please log into your Seller Dashboard and click the <strong>Repost</strong> button to update your payment method.</p>
            </div>
            <div style="background-color: #1f2937; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af;">
                &copy; ${new Date().getFullYear()} TruckLion. All rights reserved.
            </div>
        </div>
                            `,
                        });
                    } catch (emailError) {
                        console.error("Failed to send payment failure email:", emailError);
                    }
                }
            }
        }

        return NextResponse.json({ received: true }, { status: 200 });

    } catch (error) {
        console.error('Database Error in Webhook:', error);
        return new NextResponse('Database Error', { status: 500 });
    }
}