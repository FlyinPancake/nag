use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::db::models::Tag;

/// Valid tag color keys (earthy palette)
pub const VALID_TAG_COLORS: &[&str] = &[
    "terracotta",
    "sage",
    "ocean",
    "amber",
    "plum",
    "clay",
    "moss",
    "slate",
    "mauve",
    "sand",
];

/// Check if a color key is valid
pub fn is_valid_tag_color(color: &str) -> bool {
    VALID_TAG_COLORS.contains(&color)
}

// ============================================================================
// Request DTOs
// ============================================================================

/// Request body for creating a new tag
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateTagRequest {
    /// Name of the tag
    pub name: String,
    /// Optional color key from the palette (e.g. "sage", "terracotta")
    pub color: Option<String>,
}

/// Request body for updating a tag
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateTagRequest {
    /// New name (optional)
    pub name: Option<String>,
    /// New color key (optional, use null to clear)
    #[serde(default, deserialize_with = "deserialize_optional_color")]
    pub color: Option<Option<String>>,
}

/// Custom deserializer that distinguishes between:
/// - Field absent → None
/// - Field present with null → Some(None)
/// - Field present with value → Some(Some(value))
fn deserialize_optional_color<'de, D>(deserializer: D) -> Result<Option<Option<String>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value: Option<String> = Option::deserialize(deserializer)?;
    Ok(Some(value))
}

// ============================================================================
// Response DTOs
// ============================================================================

/// Response for a single tag
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct TagResponse {
    pub id: Uuid,
    pub name: String,
    /// Color key from the palette (null means auto-assign based on name hash)
    pub color: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<Tag> for TagResponse {
    fn from(tag: Tag) -> Self {
        Self {
            id: tag.id,
            name: tag.name,
            color: tag.color,
            created_at: tag.created_at,
        }
    }
}
