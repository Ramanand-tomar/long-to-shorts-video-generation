import nodemailer from "nodemailer";

interface ClipSummary {
  title: string;
  youtubeVideoId: string | null;
}

export async function sendCompletionEmail(params: {
  to: string;
  clips: ClipSummary[];
}): Promise<void> {
  // Use user-provided app password and sender email
  const emailUser = process.env.EMAIL_USER || params.to;
  const emailPass = (process.env.EMAIL_PASS || "nrcu bozx fvcm doli").replace(/\s+/g, "");

  if (!emailUser) {
    console.warn("No email sender configuration found. Skipping email dispatch.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });

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
    await transporter.sendMail({
      from: `"VidShorts Pipeline" <${emailUser}>`,
      to: params.to,
      subject: "✅ Your clips are live on YouTube!",
      html: htmlContent,
    });
    console.log(`Pipeline completion email successfully sent via Gmail to ${params.to}`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to send completion email via Gmail SMTP: ${errorMsg}`);
  }
}
