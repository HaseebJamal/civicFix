import { Resend } from "resend";
export const runtime = "nodejs";
const resend = new Resend(process.env.RESEND_API_KEY);
export const sendEmail = async ({ to, subject, html, text }) => {
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });
  if (error) {
    console.error("Resend email error:", error);
    throw new Error("Failed to send email");
  }
  return data;
};
