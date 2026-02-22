/**
 * Minimal OIDC Identity Provider for local development.
 *
 * Provides pre-configured test users and a client so that the nag app
 * can be developed with OIDC auth without any external services.
 *
 * Issuer: http://localhost:9000
 *
 * Test users (type the login ID in the login field, password is not checked):
 *   test-user-1  — full profile (email, name, picture)
 *   test-user-2  — full profile (different avatar)
 *   test-user-3  — minimal (sub only, no email/name/picture)
 */

import Provider from "oidc-provider";

const PORT = process.env.OIDC_PORT || 9000;
const ISSUER = `http://localhost:${PORT}`;

// Pre-configured test users
const USERS = {
  "test-user-1": {
    sub: "test-user-1",
    email: "test@example.com",
    email_verified: true,
    name: "Test User",
    given_name: "Test",
    family_name: "User",
    picture: "https://api.dicebear.com/9.x/thumbs/svg?seed=test-user-1",
  },
  "test-user-2": {
    sub: "test-user-2",
    email: "jane@example.com",
    email_verified: true,
    name: "Jane Doe",
    given_name: "Jane",
    family_name: "Doe",
    picture: "https://api.dicebear.com/9.x/thumbs/svg?seed=test-user-2",
  },
  "test-user-3": {
    sub: "test-user-3",
    // Minimal user: only the required `sub` claim. No email, name, or picture.
  },
};

// Account model required by oidc-provider
class Account {
  static async findByLogin(login) {
    const user = Object.values(USERS).find((u) => u.email === login);
    if (!user) return undefined;
    return new Account(user.sub);
  }

  static async findAccount(_ctx, id) {
    const user = USERS[id];
    if (!user) return undefined;
    return new Account(id);
  }

  constructor(id) {
    this.accountId = id;
  }

  async claims(_use, _scope) {
    const user = USERS[this.accountId];
    // Only return claims that are actually set on the user.
    // For minimal users (test-user-3), this returns just { sub }.
    const result = { sub: user.sub };
    if (user.email !== undefined) result.email = user.email;
    if (user.email_verified !== undefined)
      result.email_verified = user.email_verified;
    if (user.name !== undefined) result.name = user.name;
    if (user.given_name !== undefined) result.given_name = user.given_name;
    if (user.family_name !== undefined) result.family_name = user.family_name;
    if (user.picture !== undefined) result.picture = user.picture;
    return result;
  }
}

const configuration = {
  clients: [
    {
      client_id: "nag-dev",
      client_secret: "nag-dev-secret",
      grant_types: ["authorization_code", "refresh_token"],
      redirect_uris: ["http://localhost:3000/auth/callback"],
      post_logout_redirect_uris: ["http://localhost:3000"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_post",
    },
  ],

  // Use in-memory adapter (default) — fine for dev
  findAccount: Account.findAccount,

  // Enable required features
  features: {
    devInteractions: { enabled: true }, // Built-in login UI for dev
  },

  // Claims configuration
  claims: {
    openid: ["sub"],
    email: ["email", "email_verified"],
    profile: ["name", "given_name", "family_name", "picture"],
  },

  // Cookie signing keys
  cookies: {
    keys: ["nag-dev-cookie-secret"],
  },

  // PKCE is required
  pkce: {
    required: () => true,
  },

  // Token TTLs
  ttl: {
    AccessToken: 3600, // 1 hour
    AuthorizationCode: 600, // 10 minutes
    IdToken: 3600, // 1 hour
    RefreshToken: 86400, // 1 day
    Session: 86400, // 1 day
  },

  // Allow HTTP for local dev (oidc-provider requires HTTPS by default)
  // This must be done via proxy trust or environment
};

const provider = new Provider(ISSUER, configuration);

// Allow HTTP in development
provider.proxy = true;

provider.listen(PORT, () => {
  console.log(`OIDC Provider listening on ${ISSUER}`);
  console.log(`Discovery: ${ISSUER}/.well-known/openid-configuration`);
  console.log("");
  console.log(
    "Test users (type the login ID in the login field, password is not checked):",
  );
  console.log(
    "  test-user-1  — full profile (test@example.com, Test User, avatar)",
  );
  console.log(
    "  test-user-2  — full profile (jane@example.com, Jane Doe, avatar)",
  );
  console.log("  test-user-3  — minimal (sub only, no email/name/picture)");
  console.log("");
  console.log("Client:");
  console.log("  client_id:     nag-dev");
  console.log("  client_secret: nag-dev-secret");
});
