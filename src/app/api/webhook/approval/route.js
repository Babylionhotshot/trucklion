import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        // Simple security check so only Supabase can trigger this
        const url = new URL(req.url);
        const secret = url.searchParams.get('secret');
        
        if (secret !== 'trailerlion_secure_123') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await req.json();

        // Check if this is a database UPDATE event
        if (payload.type === 'UPDATE') {
            const oldRecord = payload.old_record;
            const newRecord = payload.record;

            // The exact trigger: It was NOT approved before, but it IS approved now
            if (!oldRecord.is_approved && newRecord.is_approved) {
                const sellerEmail = newRecord.seller_email;
                const category = newRecord.category || 'Trailer';

                if (sellerEmail) {
                    // Send the "You are Live" email to the customer
                    await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
                        },
                        body: JSON.stringify({
                            from: 'TrailerLion <notifications@trailerlion.com>',
                            to: sellerEmail,
                            subject: 'Your Trailer is Live on TrailerLion!',
                            html: `
                            <div style="font-family: sans-serif; padding: 20px;">
                                <h2 style="color: #16a34a;">Great News!</h2>
                                <p>Your <strong>${category}</strong> trailer has been reviewed and approved by our team.</p>
                                <p>It is now officially live on the public directory for buyers to see!</p>
                                <a href="https://trailerlion.com" style="display: inline-block; background-color: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">View Your Listing</a>
                            </div>
                            `
                        })
                    });
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Webhook error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}