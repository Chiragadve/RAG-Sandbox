import { google } from 'googleapis';
import { oauth2Client } from './google_auth';

export async function listEmails(accessToken: string, refreshToken?: string, maxResults = 10) {
    // Set credentials for this request instance
    const auth = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET
    );

    auth.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken
    });

    const gmail = google.gmail({ version: 'v1', auth });

    try {
        const res = await gmail.users.messages.list({
            userId: 'me',
            maxResults: maxResults,
        });

        const messages = res.data.messages || [];
        return messages;
    } catch (error) {
        console.error("Error listing emails:", error);
        throw error;
    }
}

export async function getEmailContent(messageId: string, accessToken: string, refreshToken?: string) {
    const auth = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET
    );

    auth.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken
    });

    const gmail = google.gmail({ version: 'v1', auth });

    try {
        const res = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full',
        });

        const snippet = res.data.snippet;
        const subjectHeader = res.data.payload?.headers?.find(h => h.name === 'Subject');
        const fromHeader = res.data.payload?.headers?.find(h => h.name === 'From');
        const dateHeader = res.data.payload?.headers?.find(h => h.name === 'Date');

        // Simple text extraction (real email parsing is complex, this is a basic version)
        // Preference: Body -> Snippet
        let body = snippet || "";

        // Attempt to decode body data if available
        const parts = res.data.payload?.parts;
        if (parts) {
            // Try to find text/plain
            const textPart = parts.find(p => p.mimeType === 'text/plain');
            if (textPart && textPart.body && textPart.body.data) {
                body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
            }
        }

        return {
            id: messageId,
            subject: subjectHeader ? subjectHeader.value : '(No Subject)',
            from: fromHeader ? fromHeader.value : 'Unknown',
            date: dateHeader ? dateHeader.value : new Date().toISOString(),
            body: body,
            fullText: `Subject: ${subjectHeader?.value}\nFrom: ${fromHeader?.value}\nDate: ${dateHeader?.value}\n\n${body}`
        };
    } catch (error) {
        console.error(`Error getting email ${messageId}:`, error);
        throw error;
    }
}
