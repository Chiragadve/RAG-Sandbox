import { google } from 'googleapis';

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/auth/callback'; // Must match Google Console

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.warn("Missing Gmail Client ID or Secret in environment variables.");
}

export const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

export function getAuthUrl() {
    const scopes = [
        'https://www.googleapis.com/auth/gmail.readonly'
    ];

    return oauth2Client.generateAuthUrl({
        access_type: 'offline', // Crucial for receiving a refresh token
        scope: scopes,
        prompt: 'consent' // Forces refresh token generation on re-auth
    });
}

export async function getTokens(code: string) {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
}

export function setCredentials(tokens: any) {
    oauth2Client.setCredentials(tokens);
}
