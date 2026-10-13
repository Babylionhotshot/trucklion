import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize the official Resend SDK using the secure backend key
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
    try {
        // NEW: Extract changedFields from the incoming request payload
        const { category, price, customerEmail, changedFields } = await req.json();

        // Convert the array of changes into a clean HTML bulleted list
        const changesHTML = (changedFields && changedFields.length > 0) 
            ? `<ul style="background-color: #f3f4f6; padding: 15px 15px 15px 35px; border-radius: 6px; margin-top: 10px; color: #111827;">
                ${changedFields.map(change => `<li style="margin-bottom: 5px;"><strong>${change}</strong></li>`).join('')}
               </ul>`
            : `<p style="color: #6b7280; font-style: italic; background-color: #f3f4f6; padding: 15px; border-radius: 6px;">No specific fields were changed.</p>`;

        // 1. Send Alert Email to ADMIN
        await resend.emails.send({
            from: 'TruckLion <notifications@Trucklion.com>',
            to: 'Trucklion@Trucklion.com',
            subject: '🚨 Truck Edit Awaiting Approval',
            html: `<div style="font-family: sans-serif; padding: 20px; max-width: 600px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #dc2626; margin-top: 0;">Action Required: Approve Edit</h2>
                    <p style="font-size: 16px; color: #374151;">A user has edited their Truck listing. It is currently hidden and pending your approval.</p>
                    
                    <h3 style="margin-top: 25px; margin-bottom: 5px; color: #111827;">What Changed:</h3>
                    ${changesHTML}

                    <h3 style="margin-top: 25px; margin-bottom: 5px; color: #111827;">Listing Details:</h3>
                    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 15px; border-radius: 6px; color: #374151;">
                        <p style="margin: 5px 0;"><strong>Category:</strong> ${category}</p>
                        <p style="margin: 5px 0;"><strong>Current Price:</strong> $${price}</p>
                        <p style="margin: 5px 0;"><strong>User Email:</strong> ${customerEmail || 'Unknown'}</p>
                    </div>
                   </div>`
        });

        // 2. Send Confirmation Email to CUSTOMER
        if (customerEmail) {
            await resend.emails.send({
                from: 'TruckLion <support@Trucklion.com>',
                to: customerEmail,
                subject: 'TruckLion - Edit Received & Under Review',
                html: `<div style="font-family: sans-serif; padding: 20px;">
                        <h2 style="color: #dc2626;">Edit Submitted Successfully</h2>
                        <p>We have received the changes to your Truck listing!</p>
                        <p>Our team is currently reviewing your edits. Your listing will temporarily be hidden from the public directory until it is approved.</p>
                        <p>We will notify you as soon as it goes live again.</p>
                        <br/>
                        <p>Thank you for using TruckLion!</p>
                       </div>`
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Edit Alert API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}