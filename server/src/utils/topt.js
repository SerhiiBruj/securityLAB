
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

async function generateTotp(email) {
  const secret = authenticator.generateSecret();

  const otpauth = authenticator.keyuri(
    email,
    'Auth Lab',
    secret
  );

  const qrCode = await QRCode.toDataURL(otpauth);

  return { secret, qrCode };
}

function verifyTotp(secret, token) {
  if (typeof token !== 'string' || !/^\d{6}$/.test(token)) {
    return false;
  }

  return authenticator.verify({
    token,
    secret,
  });
}

module.exports = { generateTotp, verifyTotp };
