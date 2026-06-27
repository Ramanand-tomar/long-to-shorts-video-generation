import { Resend } from "resend";

interface ClipSummary {
  title: string;
  youtubeVideoId: string | null;
}

export async function sendCompletionEmail(params: {
  to: string;
  clips: ClipSummary[];
}): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey || resendApiKey.includes("placeholder") || resendApiKey.startsWith("your_")) {
    console.warn("RESEND_API_KEY is not configured. Skipping email dispatch.");
    return;
  }

  const resend = new Resend(resendApiKey);
  const notificationEmail = process.env.NOTIFICATION_EMAIL || params.to;

  const listItemsHtml = params.clips
    .map((c) => {
      const url = c.youtubeVideoId
        ? `https://www.youtube.com/watch?v=${c.youtubeVideoId}`
        : null;
      return `
        <li style="margin-bottom: 12px; font-family: sans-serif; font-size: 14px;">
          <strong>${c.title}</strong><br/>
          ${
            url
              ? `<a href="${url}" style="color: #7c3aed; text-decoration: none;" target="_blank">View on YouTube</a>`
              : `<span style="color: #dc2626;">Failed to publish</span>`
          }
        </li>
      `;
    })
    .join("");

  const htmlContent = `
    <div style="background-color: #fafafa; padding: 24px; font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; border-radius: 8px; border: 1px solid #e5e7eb;">
      <h2 style="color: #7c3aed; margin-top: 0;">🎉 Video Pipeline Complete!</h2>
      <p style="font-size: 15px; line-height: 1.5;">All video clips from your Google Drive upload have been successfully processed, styled, rendered, and uploaded to YouTube!</p>
      
      <h3 style="border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-top: 24px;">Published Shorts</h3>
      <ul style="padding-left: 20px; margin-top: 12px;">
        ${listItemsHtml}
      </ul>
      
      <div style="background-color: #f3f4f6; border-left: 4px solid #10b981; padding: 12px; border-radius: 4px; margin-top: 24px; font-size: 13px;">
        <strong>S3 Storage Cleaned Up:</strong> Rendered video files have been deleted from AWS S3 to optimize storage usage and keep costs at $0.00.
      </div>
      
      <p style="font-size: 12px; color: #9ca3af; margin-top: 32px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 16px;">
        Automated Daily Video Pipeline • powered by Inngest & Remotion
      </p>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: "VidShorts Pipeline <onboarding@resend.dev>",
      to: notificationEmail,
      subject: "✅ Your clips are live on YouTube!",
      html: htmlContent,
    });

    if (error) {
      throw new Error(error.message);
    }

    console.log(`Pipeline completion email successfully sent to ${notificationEmail}. Email ID: ${data?.id}`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to send completion email via Resend client: ${errorMsg}`);
  }
}
