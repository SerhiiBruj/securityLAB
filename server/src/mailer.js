const nodemailer = require('nodemailer');
const cfg = require('./config');

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  : null;

async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    // Режим розробки: SMTP не налаштовано, лист видно в консолі сервера
    console.log(`\n=== ЛИСТ для ${to} ===\nТема: ${subject}\n${text}\n=====================\n`);
    return;
  }
  await transporter.sendMail({ from: cfg.mailFrom, to, subject, text, html });
}

module.exports = { sendMail };
