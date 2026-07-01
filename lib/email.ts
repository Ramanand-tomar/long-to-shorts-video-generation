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
  const emailUser = process.env.EMAIL_USER || "nandutomar0000@gmail.com";
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

export async function sendFailureEmail(params: {
  to: string;
  videoTitle: string;
  error: string;
  pipelineRunId: string;
}): Promise<void> {
  // Use user-provided app password and sender email
  const emailUser = process.env.EMAIL_USER || "nandutomar0000@gmail.com";
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

  const htmlContent = `
    <div style="background-color: #fafafa; padding: 24px; font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; border-radius: 8px; border: 1px solid #e5e7eb;">
      <h2 style="color: #dc2626; margin-top: 0; font-family: sans-serif;">❌ Video Pipeline Failed</h2>
      <p style="font-size: 15px; line-height: 1.5; font-family: sans-serif;">An error occurred while running the automated daily video pipeline for your video: <strong>${params.videoTitle}</strong>.</p>
      
      <h3 style="border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-top: 24px; color: #374151; font-family: sans-serif;">Error Details</h3>
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; border-radius: 4px; margin-top: 12px; font-size: 14px; font-family: monospace; color: #991b1b; white-space: pre-wrap;">
        ${params.error}
      </div>
      
      <p style="font-size: 14px; margin-top: 24px; font-family: sans-serif;">
        Pipeline Run ID: <code>${params.pipelineRunId}</code>
      </p>
      
      <p style="font-size: 12px; color: #9ca3af; margin-top: 32px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 16px; font-family: sans-serif;">
        Automated Daily Video Pipeline • powered by Inngest & Remotion
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"VidShorts Pipeline" <${emailUser}>`,
      to: params.to,
      subject: `❌ Video Pipeline Failed: ${params.videoTitle}`,
      html: htmlContent,
    });
    console.log(`Pipeline failure email successfully sent via Gmail to ${params.to}`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to send failure email via Gmail SMTP: ${errorMsg}`);
  }
}

