import * as dotenv from 'dotenv';
dotenv.config();
import { google } from 'googleapis';

async function main() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground',
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_ADMIN_REFRESH_TOKEN });
  const admin = google.admin({ version: 'directory_v1', auth: oauth2Client });

  const groupEmail = process.env.GOOGLE_PLAY_TESTER_GROUP_EMAIL as string;
  console.log('Group:', groupEmail);

  const res = await admin.members.list({
    groupKey: groupEmail,
    maxResults: 200,
  });
  const members = (res.data.members || []).map(m => ({
    email: m.email,
    status: m.status,
    role: m.role,
    type: m.type,
  }));
  console.log('Members count:', members.length);
  console.log(JSON.stringify(members, null, 2));
}

main().catch(e => {
  console.error('Error:', e.message);
  if (e.errors) console.error('Details:', JSON.stringify(e.errors, null, 2));
});
