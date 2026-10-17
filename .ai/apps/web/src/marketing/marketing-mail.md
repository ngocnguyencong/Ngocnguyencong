# marketing-mail.ts

Server-only operator contact/newsletter sender. Keep outreach separate from workspace transactional delivery. Never log provider secrets or message bodies.

## AWS SES credentials

SESv2Client receives explicit credentials only when a complete key pair exists, including the optional session token. Otherwise the SDK resolves role/profile credentials. Offline transport tests cover this independent sender without routing outreach through transactional delivery.
