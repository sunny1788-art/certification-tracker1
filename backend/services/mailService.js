let nodemailer = null;

try {
  // Optional dependency: if installed and configured, OTP emails are delivered.
  nodemailer = require("nodemailer");
} catch (error) {
  nodemailer = null;
}

function hasMailConfig() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.MAIL_FROM
  );
}

async function sendOtpEmail({ to, name, otp }) {
  const subject = "Skill Certification Tracking Portal Password Reset OTP";
  const text = `Hello ${name || "user"}, your OTP for password reset is ${otp}. It will expire in 10 minutes.`;

  if (nodemailer && hasMailConfig()) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      text,
      html: `
        <div style="font-family:Segoe UI,Tahoma,sans-serif;padding:24px;background:#f4fbff;color:#112433">
          <h2 style="margin-top:0;">Skill Certification Tracking Portal</h2>
          <p>Hello ${name || "user"},</p>
          <p>Your OTP for password reset is:</p>
          <div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:14px 18px;background:#ffffff;border-radius:14px;display:inline-block;">
            ${otp}
          </div>
          <p style="margin-top:16px;">This OTP expires in 10 minutes.</p>
        </div>
      `
    });

    return { delivered: true, mode: "smtp" };
  }

  console.log(`[OTP PREVIEW] ${to}: ${otp}`);
  return { delivered: false, mode: "console" };
}

async function sendSignupVerificationEmail({ to, name, otp }) {
  const subject = "Skill Certification Tracking Portal Signup Verification OTP";
  const text = `Hello ${name || "user"}, your email verification OTP is ${otp}. It will expire in 10 minutes.`;

  if (nodemailer && hasMailConfig()) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      text,
      html: `
        <div style="font-family:Segoe UI,Tahoma,sans-serif;padding:24px;background:#f4fbff;color:#112433">
          <h2 style="margin-top:0;">Skill Certification Tracking Portal</h2>
          <p>Hello ${name || "user"},</p>
          <p>Your signup email verification OTP is:</p>
          <div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:14px 18px;background:#ffffff;border-radius:14px;display:inline-block;">
            ${otp}
          </div>
          <p style="margin-top:16px;">This OTP expires in 10 minutes.</p>
        </div>
      `
    });

    return { delivered: true, mode: "smtp" };
  }

  console.log(`[SIGNUP EMAIL OTP PREVIEW] ${to}: ${otp}`);
  return { delivered: false, mode: "console" };
}

async function sendPhoneOtp({ phone, otp }) {
  console.log(`[PHONE OTP PREVIEW] ${phone}: ${otp}`);
  return { delivered: false, mode: "console" };
}

module.exports = {
  sendOtpEmail,
  sendSignupVerificationEmail,
  sendPhoneOtp,
  hasMailConfig
};
