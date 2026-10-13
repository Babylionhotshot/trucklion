import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend with your API Key
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
    try {
        const { email, message } = await request.json();

        if (!email || !message) {
            return NextResponse.json({ error: 'Missing email or message' }, { status: 400 });
        }

        // Send the email using Resend
        const data = await resend.emails.send({
            from: 'Truck Lion <contact@trucklion.com>', 
            to: ['trucklion@trucklion.com'], 
            reply_to: email, // Allows you to hit "Reply" in your inbox directly to the user
            subject: `New Contact Request from: ${email}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #dc2626;">New Message from Truck Lion</h2>
                    <p><strong>Sender Email:</strong> ${email}</p>
                    <hr style="border: 1px solid #eee; margin: 20px 0;" />
                    <p><strong>Message:</strong></p>
                    <p style="background: #f9f9f9; padding: 15px; border-radius: 5px; white-space: pre-wrap;">${message}</p>
                </div>
            `,
        });

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("Resend Error:", error);
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
}