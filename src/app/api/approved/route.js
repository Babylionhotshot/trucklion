import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
    try {
        // Supabase sends the updated row data here
        const body = await req.json();
        const truck = body.record;
        const oldTruck = body.old_record;

        // Only send the email if it just changed from unapproved to approved
        if (truck.is_approved === true && oldTruck.is_approved === false) {
            if (truck.seller_email) {
                await resend.emails.send({
                    from: 'TruckLion <trucklion@trucklion.com>',
                    to: truck.seller_email,
                    subject: 'Your Truck is Live on TruckLion!',
                    html: `
                        <h2>Great news!</h2>
                        <p>Your ${truck.year ? truck.year + ' ' : ''}${truck.make} ${truck.model} has been reviewed, approved, and is now live on the platform.</p>
                        <p>Buyers can now view your listing and contact you directly.</p>
                        <br/>
                        <p>Thank you,</p>
                        <p>The TruckLion Team</p>
                    `
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Approval Email Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}