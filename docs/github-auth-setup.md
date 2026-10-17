# GitHub sign-in and account linking

supastack uses the existing authentication provider for GitHub login and account linking. This is identity-only OAuth; repository access is intentionally outside this template's identity flow.

## Create OAuth apps

Create separate GitHub OAuth Apps for local development and production:

1. Open GitHub **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Local app:
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
3. Production app:
   - Homepage URL: your production `APP_URL`
   - Authorization callback URL: `{APP_URL}/api/auth/callback/github`
4. Copy each app's client ID and generate a client secret.

Using separate apps avoids changing the one callback URL supported by each GitHub OAuth App.

## Configure the environment

Set these values in the matching local or production environment:

```dotenv
AUTH_GITHUB_ENABLED=true
GITHUB_CLIENT_ID=<GitHub OAuth App client ID>
GITHUB_CLIENT_SECRET=<GitHub OAuth App client secret>
```

Restart the web process after changing environment values. Until all three values are present, the GitHub option remains visible but disabled and the dashboard explains that setup is incomplete.

Never commit the client secret. Keep it in the local ignored env file and the production secret manager.
