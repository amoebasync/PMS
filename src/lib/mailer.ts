import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendScanNotification = async (emails: string[], qrCode: any, flyerName: string, location: string | null, device: string) => {
  const mailOptions = {
    from: process.env.MAIL_FROM || '"PMS Pro" <noreply@example.com>',
    to: emails.join(', '), // 複数アドレスへ一斉送信
    subject: `【速報】チラシ「${flyerName}」のQRコードがスキャンされました！`,
    text: `
チラシのQRコードがスキャンされました。
リアルタイムの反響をお知らせします！

■ スキャン情報
・対象チラシ: ${flyerName}
・QRメモ: ${qrCode.memo || 'なし'}
・スキャン日時: ${new Date().toLocaleString('ja-JP')}
・推定エリア: ${location || '不明'}
・使用端末: ${device}

引き続き、PMS Proプラットフォームにて詳細な反響分析をご確認いただけます。
    `,
  };

  await transporter.sendMail(mailOptions);
};