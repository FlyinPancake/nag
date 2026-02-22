//! OIDC service — wraps a discovered OpenID Connect client.
//!
//! The concrete `CoreClient<EndpointSet, ...>` typestate type is kept private;
//! only the opaque [`OidcService`] is exported.

use openidconnect::core::{
    CoreAuthenticationFlow, CoreClient, CoreIdTokenVerifier, CoreJsonWebKey,
    CoreJweContentEncryptionAlgorithm, CoreResponseType,
};
use openidconnect::url::Url;
use openidconnect::{
    AccessToken, AuthorizationCode, AuthorizationRequest, ClientId, ClientSecret, CodeTokenRequest,
    ConfigurationError, CsrfToken, EndSessionUrl, EndpointMaybeSet, EndpointNotSet, EndpointSet,
    IssuerUrl, Nonce, ProviderMetadataWithLogout, RedirectUrl, SubjectIdentifier, UserInfoRequest,
    reqwest,
};

/// Private type alias for the concrete client type returned by
/// `CoreClient::from_provider_metadata().set_redirect_uri()`.
///
/// This is intentionally *not* exported — callers interact via [`OidcService`].
type DiscoveredClient = CoreClient<
    EndpointSet,      // HasAuthUrl
    EndpointNotSet,   // HasDeviceAuthUrl
    EndpointNotSet,   // HasIntrospectionUrl
    EndpointNotSet,   // HasRevocationUrl
    EndpointMaybeSet, // HasTokenUrl
    EndpointMaybeSet, // HasUserInfoUrl
>;

/// OIDC service wrapping a discovered and configured OpenID Connect client.
///
/// Constructed via [`OidcService::discover`], which performs provider metadata
/// discovery and configures the redirect URI — mirroring the pattern used in
/// the official `openidconnect` examples.
pub struct OidcService {
    client: DiscoveredClient,
    /// OIDC provider's `end_session_endpoint` (for RP-Initiated Logout).
    /// `None` if the provider does not advertise one.
    pub end_session_endpoint: Option<Url>,
}

impl OidcService {
    /// Discover the OIDC provider and build a configured client.
    pub async fn discover(
        issuer_url: &str,
        client_id: &str,
        client_secret: &str,
        redirect_url: &str,
    ) -> color_eyre::Result<Self> {
        let http_client = reqwest::ClientBuilder::new()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .expect("Failed to build reqwest client");

        let issuer = IssuerUrl::new(issuer_url.to_owned())?;

        tracing::info!(issuer = %issuer_url, "Discovering OIDC provider metadata");

        // Use ProviderMetadataWithLogout to also parse the end_session_endpoint.
        let provider_metadata: ProviderMetadataWithLogout =
            ProviderMetadataWithLogout::discover_async(issuer, &http_client).await?;

        let end_session_endpoint: Option<Url> = provider_metadata
            .additional_metadata()
            .end_session_endpoint
            .as_ref()
            .map(|url: &EndSessionUrl| url.url().clone());

        if let Some(ref url) = end_session_endpoint {
            tracing::info!(endpoint = %url, "OIDC end_session_endpoint discovered");
        } else {
            tracing::warn!("OIDC provider does not advertise an end_session_endpoint");
        }

        let client = CoreClient::from_provider_metadata(
            provider_metadata,
            ClientId::new(client_id.to_owned()),
            Some(ClientSecret::new(client_secret.to_owned())),
        )
        .set_redirect_uri(RedirectUrl::new(redirect_url.to_owned())?);

        tracing::info!("OIDC client configured successfully");

        Ok(Self {
            client,
            end_session_endpoint,
        })
    }

    /// Begin an authorization code flow.
    ///
    /// Returns an [`AuthorizationRequest`] that the caller can further
    /// customise (e.g. add scopes, set PKCE challenge) before calling `.url()`.
    pub fn authorize_url<'a>(
        &'a self,
        state_fn: impl FnOnce() -> CsrfToken + 'static,
        nonce_fn: impl FnOnce() -> Nonce + 'static,
    ) -> AuthorizationRequest<
        'a,
        openidconnect::core::CoreAuthDisplay,
        openidconnect::core::CoreAuthPrompt,
        CoreResponseType,
    > {
        self.client.authorize_url(
            CoreAuthenticationFlow::AuthorizationCode,
            state_fn,
            nonce_fn,
        )
    }

    /// Exchange an authorization code for tokens.
    ///
    /// Returns a [`CodeTokenRequest`] that the caller can further customise
    /// (e.g. set PKCE verifier) before calling `.request_async()`.
    pub fn exchange_code(
        &self,
        code: AuthorizationCode,
    ) -> Result<
        CodeTokenRequest<
            '_,
            openidconnect::StandardErrorResponse<openidconnect::core::CoreErrorResponseType>,
            openidconnect::core::CoreTokenResponse,
        >,
        ConfigurationError,
    > {
        self.client.exchange_code(code)
    }

    /// Return an ID token verifier bound to this client's configuration.
    pub fn id_token_verifier(&self) -> CoreIdTokenVerifier<'_> {
        self.client.id_token_verifier()
    }

    /// Request user info from the provider's UserInfo endpoint.
    ///
    /// Returns `Err` if the provider did not advertise a UserInfo URL.
    pub fn user_info(
        &self,
        access_token: AccessToken,
        expected_subject: Option<&SubjectIdentifier>,
    ) -> Result<
        UserInfoRequest<'_, CoreJweContentEncryptionAlgorithm, CoreJsonWebKey>,
        ConfigurationError,
    > {
        self.client
            .user_info(access_token, expected_subject.cloned())
    }
}
