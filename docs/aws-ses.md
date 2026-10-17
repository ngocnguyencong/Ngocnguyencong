# Amazon SES email for web, mobile and desktop

Set up Amazon SES email for web, mobile and desktop with AWS SDK credentials or IAM SMTP, verify your sender, and avoid unnecessary Mail Manager endpoint fees.

## 1. Verify a sender in your AWS region

Open Amazon SES in US East (N. Virginia), us-east-1. Choose Configuration → Identities → Create identity, select your domain or email address, and finish the DNS or email verification. Use that same region and verified address in the settings below.

New SES accounts start in a sandbox: verify the recipient too, or use the SES mailbox simulator. Request production access from Account dashboard before sending to ordinary customer addresses. [Open Amazon SES](https://us-east-1.console.aws.amazon.com/ses/home?region=us-east-1)

## 2. For SMTP, choose IAM SMTP credentials

In SES, open SMTP settings → Create SMTP credentials. Choose IAM SMTP credentials instead of the Recommended Mail Manager option. The IAM card says: Manual credential management. No traffic policies or rule sets. Click Create IAM credentials, name the sending user, and download the SMTP credentials before closing the page.

[Create IAM credentials](https://us-east-1.console.aws.amazon.com/iam/home?SESRegion=us-east-1#/users/smtp/create) · [Manage existing](https://us-east-1.console.aws.amazon.com/iam/home#/users)

These links use us-east-1, where classic IAM SMTP is available. For another supported region, create credentials for that region and use its SMTP endpoint. The downloaded SMTP password is different from an AWS secret access key; use it only with the SMTP settings in step 5. [AWS SMTP credential instructions](https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html)

## 3. Avoid unnecessary Mail Manager charges

IAM SMTP and the SES SDK send directly through SES without Mail Manager traffic policies or rule sets. Avoid creating an optional open or mTLS Mail Manager ingress endpoint: AWS lists it at $50 per month per endpoint under à la carte pricing. Current authenticated endpoints are complimentary, so the Recommended option does not always add $50. Normal SES sending charges and your chosen pricing plan still apply. [Check current AWS pricing](https://aws.amazon.com/ses/pricing/)

## 4. Send through the AWS SDK

Choose this mode to send through the SES API over HTTPS. In IAM, give the backend role or a dedicated sending user ses:SendEmail permission on your verified SES identity. For a user, open Security credentials → Create access key and save the access key ID and original secret access key. An SMTP password cannot sign SDK requests.

Put the example below in apps/web/.env.local for development or your backend host’s secret settings for production. Replace the sender and placeholder values. With an IAM role or configured local AWS profile, leave both access-key fields and AWS_SESSION_TOKEN blank; the SDK uses its default credential chain. If you provide explicit keys, provide both.

For temporary explicit credentials, also set AWS_SESSION_TOKEN to the matching session token and refresh all three values when they expire. Role-based credentials refresh through the SDK. [AWS SDK credential chain](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html)

```dotenv
EMAIL_PROVIDER=ses
EMAIL_FROM=Your App <hello@yourdomain.com>
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<IAM-access-key-id>
AWS_SECRET_ACCESS_KEY=<original-IAM-secret-access-key>
# Temporary explicit credentials only:
AWS_SESSION_TOKEN=
```

## 5. Or send with classic IAM SMTP

Use the SMTP username and SMTP password from step 2 with this alternative configuration. Port 587 uses STARTTLS; SMTP_SECURE=false selects that connection mode. Use the endpoint for the same region as the credentials and verified sender.

These are the buyer kit’s settings, shared by all three platforms. Choose one email mode at a time; EMAIL_PROVIDER=smtp uses SMTP credentials, while EMAIL_PROVIDER=ses uses SDK API credentials.

```dotenv
EMAIL_PROVIDER=smtp
EMAIL_FROM=Your App <hello@yourdomain.com>
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<downloaded-SMTP-username>
SMTP_PASSWORD=<downloaded-SMTP-password>
```

## 6. Configure once for web, mobile and desktop

Restart the backend after changing settings. With a migrated database, request one email sign-in code at /auth using a permitted recipient, then check the inbox and spam folder. The mobile sign-in flow calls the same backend; desktop loads the web app. Neither client needs AWS keys or an SMTP password.

Keep credentials on the backend only: never put them in NEXT_PUBLIC_ or EXPO_PUBLIC_ settings or the desktop bundle. If delivery fails, check sender verification, sandbox recipient restrictions, region, IAM permission and credential type. A queued response means SES accepted the message, not that it reached the inbox. [SES provider guide](/docs/providers/ses)
