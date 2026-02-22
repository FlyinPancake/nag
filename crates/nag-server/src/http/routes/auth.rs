use axum::{
    extract::Query,
    extract::State,
    response::{IntoResponse, Json, Redirect, Response},
};
use openidconnect::{
    AuthorizationCode, CsrfToken, EmptyAdditionalClaims, Nonce, OAuth2TokenResponse,
    PkceCodeChallenge, PkceCodeVerifier, Scope, TokenResponse, core::CoreGenderClaim, reqwest,
};
use serde::{Deserialize, Serialize};
use tower_sessions::Session;

use crate::db::UserRepository;
use crate::http::models::AppError;
use crate::services::OidcService;

use super::super::AppState;

/// Session keys
const SESSION_KEY_USER_ID: &str = "user_id";
const SESSION_KEY_ID_TOKEN: &str = "oidc_id_token";
const SESSION_KEY_CSRF: &str = "oidc_csrf";
const SESSION_KEY_NONCE: &str = "oidc_nonce";
const SESSION_KEY_PKCE_VERIFIER: &str = "oidc_pkce_verifier";

/// Query params returned by the OIDC provider on callback
#[derive(Debug, Deserialize)]
pub struct CallbackQuery {
    pub code: String,
    pub state: String,
}

/// Response for /auth/me
#[derive(Debug, Serialize)]
pub struct AuthMeResponse {
    pub user_id: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub picture: Option<String>,
}

/// Get the OIDC service from state, returning 500 if auth is not configured.
///
/// This is safe because auth routes are only registered when OIDC is enabled,
/// so this should never fail in practice.
fn oidc(state: &AppState) -> Result<&OidcService, AppError> {
    state
        .oidc
        .as_deref()
        .ok_or_else(|| AppError::Internal(color_eyre::eyre::eyre!("OIDC not configured")))
}

/// GET /auth/login — Redirect user to the OIDC provider's authorization endpoint
pub async fn login(State(state): State<AppState>, session: Session) -> Result<Response, AppError> {
    let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

    let oidc = oidc(&state)?;
    let (auth_url, csrf_token, nonce) = oidc
        .authorize_url(CsrfToken::new_random, Nonce::new_random)
        .add_scope(Scope::new("email".to_string()))
        .add_scope(Scope::new("profile".to_string()))
        .set_pkce_challenge(pkce_challenge)
        .url();

    let csrf_str: String = csrf_token.secret().to_string();
    let nonce_str: String = nonce.secret().to_string();
    let pkce_str: String = pkce_verifier.secret().to_string();

    // Store OIDC state in session for validation on callback
    session
        .insert(SESSION_KEY_CSRF, csrf_str)
        .await
        .map_err(|e: tower_sessions::session::Error| AppError::Internal(e.into()))?;
    session
        .insert(SESSION_KEY_NONCE, nonce_str)
        .await
        .map_err(|e: tower_sessions::session::Error| AppError::Internal(e.into()))?;
    session
        .insert(SESSION_KEY_PKCE_VERIFIER, pkce_str)
        .await
        .map_err(|e: tower_sessions::session::Error| AppError::Internal(e.into()))?;

    Ok(Redirect::temporary(auth_url.as_str()).into_response())
}

/// GET /auth/callback — Handle the OIDC callback, exchange code for tokens, create session
pub async fn callback(
    State(state): State<AppState>,
    session: Session,
    Query(query): Query<CallbackQuery>,
) -> Result<Response, AppError> {
    let oidc = oidc(&state)?;

    // Retrieve and validate CSRF state
    let stored_csrf: String = session
        .get(SESSION_KEY_CSRF)
        .await
        .map_err(|e: tower_sessions::session::Error| AppError::Internal(e.into()))?
        .ok_or_else(|| AppError::BadRequest("Missing OIDC session state".to_string()))?;

    if query.state != stored_csrf {
        return Err(AppError::BadRequest("CSRF state mismatch".to_string()));
    }

    // Retrieve nonce and PKCE verifier
    let stored_nonce: String = session
        .get(SESSION_KEY_NONCE)
        .await
        .map_err(|e: tower_sessions::session::Error| AppError::Internal(e.into()))?
        .ok_or_else(|| AppError::BadRequest("Missing OIDC nonce".to_string()))?;

    let stored_pkce_verifier: String = session
        .get(SESSION_KEY_PKCE_VERIFIER)
        .await
        .map_err(|e: tower_sessions::session::Error| AppError::Internal(e.into()))?
        .ok_or_else(|| AppError::BadRequest("Missing PKCE verifier".to_string()))?;

    // Clean up OIDC flow state from session
    session.remove::<String>(SESSION_KEY_CSRF).await.ok();
    session.remove::<String>(SESSION_KEY_NONCE).await.ok();
    session
        .remove::<String>(SESSION_KEY_PKCE_VERIFIER)
        .await
        .ok();

    // Exchange the authorization code for tokens
    let http_client = reqwest::ClientBuilder::new()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| AppError::Internal(e.into()))?;

    let token_response = oidc
        .exchange_code(AuthorizationCode::new(query.code))
        .map_err(|e| AppError::Internal(color_eyre::eyre::eyre!("OIDC config error: {}", e)))?
        .set_pkce_verifier(PkceCodeVerifier::new(stored_pkce_verifier))
        .request_async(&http_client)
        .await
        .map_err(|e| AppError::Internal(color_eyre::eyre::eyre!("Token exchange failed: {}", e)))?;

    // Extract and verify the ID token
    let id_token = token_response
        .id_token()
        .ok_or_else(|| AppError::Internal(color_eyre::eyre::eyre!("No ID token in response")))?;

    let id_token_verifier = oidc.id_token_verifier();
    let nonce = Nonce::new(stored_nonce);
    let claims = id_token.claims(&id_token_verifier, &nonce).map_err(|e| {
        AppError::Internal(color_eyre::eyre::eyre!("ID token validation failed: {}", e))
    })?;

    // Extract basic info from ID token claims
    let subject = claims.subject().as_str().to_string();
    let issuer = claims.issuer().as_str().to_string();

    // Try to get profile claims from the UserInfo endpoint (ID tokens often don't include them).
    // Macro to extract email, name, and picture from any claims source that has
    // the standard accessor methods (IdTokenClaims and UserInfoClaims both do).
    macro_rules! extract_profile_claims {
        ($src:expr) => {{
            let email = $src.email().map(|e| e.as_str().to_string());
            let name = $src
                .name()
                .and_then(|localized| localized.get(None))
                .map(|n| n.as_str().to_string());
            let picture = $src
                .picture()
                .and_then(|localized| localized.get(None))
                .map(|p| p.as_str().to_string());
            (email, name, picture)
        }};
    }

    let (email, name, picture) = match oidc.user_info(token_response.access_token().clone(), None) {
        Ok(user_info_request) => {
            match user_info_request
                .request_async::<EmptyAdditionalClaims, _, CoreGenderClaim>(&http_client)
                .await
            {
                Ok(user_info) => extract_profile_claims!(user_info),
                Err(e) => {
                    tracing::warn!("Failed to fetch UserInfo: {}", e);
                    extract_profile_claims!(claims)
                }
            }
        }
        Err(_) => {
            // UserInfo endpoint not configured — use ID token claims
            extract_profile_claims!(claims)
        }
    };

    // Upsert user in database
    let user = UserRepository::upsert(
        &state.pool,
        &issuer,
        &subject,
        email.as_deref(),
        name.as_deref(),
        picture.as_deref(),
    )
    .await
    .map_err(|e| AppError::Internal(e.into()))?;

    tracing::info!(
        user_id = %user.id,
        email = ?user.email,
        "User authenticated via OIDC"
    );

    // Store user ID in session — this is the authenticated session marker
    session
        .insert(SESSION_KEY_USER_ID, user.id.to_string())
        .await
        .map_err(|e: tower_sessions::session::Error| AppError::Internal(e.into()))?;

    // Store the raw ID token for use during logout (RP-Initiated Logout id_token_hint)
    session
        .insert(SESSION_KEY_ID_TOKEN, id_token.to_string())
        .await
        .map_err(|e: tower_sessions::session::Error| AppError::Internal(e.into()))?;

    // Redirect to the app
    Ok(Redirect::temporary("/").into_response())
}

/// GET /auth/logout — Clear backend session and redirect to OIDC provider's end_session_endpoint
pub async fn logout(State(state): State<AppState>, session: Session) -> Result<Response, AppError> {
    let oidc = oidc(&state)?;

    // Read the ID token before flushing (needed for id_token_hint)
    let id_token: Option<String> = session.get(SESSION_KEY_ID_TOKEN).await.ok().flatten();

    // Clear the backend session
    session
        .flush()
        .await
        .map_err(|e: tower_sessions::session::Error| AppError::Internal(e.into()))?;

    // Redirect to the OIDC provider's end_session_endpoint to clear the provider session too.
    // If the provider doesn't have one, just redirect to the app root.
    if let Some(end_session_url) = &oidc.end_session_endpoint {
        let mut url = end_session_url.clone();
        if let Some(token) = id_token {
            url.query_pairs_mut().append_pair("id_token_hint", &token);
        }
        Ok(Redirect::temporary(url.as_str()).into_response())
    } else {
        Ok(Redirect::temporary("/").into_response())
    }
}

/// GET /auth/me — Return current user info or 401
pub async fn me(
    State(state): State<AppState>,
    session: Session,
) -> Result<Json<AuthMeResponse>, AppError> {
    let user_id_str: String = session
        .get(SESSION_KEY_USER_ID)
        .await
        .map_err(|e: tower_sessions::session::Error| AppError::Internal(e.into()))?
        .ok_or_else(|| AppError::Unauthorized("Not authenticated".to_string()))?;

    let user_id: uuid::Uuid = user_id_str
        .parse()
        .map_err(|_| AppError::Internal(color_eyre::eyre::eyre!("Invalid user ID in session")))?;

    let user = UserRepository::find_by_id(&state.pool, user_id)
        .await
        .map_err(|e| AppError::Internal(e.into()))?
        .ok_or_else(|| AppError::Unauthorized("User not found".to_string()))?;

    Ok(Json(AuthMeResponse {
        user_id: user.id.to_string(),
        email: user.email,
        name: user.name,
        picture: user.picture,
    }))
}

/// Check if a session is authenticated by looking for a user_id.
/// Returns the user_id if authenticated, or an AppError::Unauthorized.
pub async fn require_auth(session: &Session) -> Result<uuid::Uuid, AppError> {
    let user_id_str: String = session
        .get(SESSION_KEY_USER_ID)
        .await
        .map_err(|e: tower_sessions::session::Error| AppError::Internal(e.into()))?
        .ok_or_else(|| AppError::Unauthorized("Not authenticated".to_string()))?;

    user_id_str
        .parse()
        .map_err(|_| AppError::Internal(color_eyre::eyre::eyre!("Invalid user ID in session")))
}
