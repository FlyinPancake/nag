use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use sqlx::SqlitePool;
use teloxide::dispatching::UpdateFilterExt;
use teloxide::dptree;
use teloxide::payloads::{
    AnswerCallbackQuerySetters, EditMessageReplyMarkupSetters, SendMessageSetters,
};
use teloxide::prelude::{
    Bot, CallbackQuery, ChatId, Dispatcher, Request, Requester, ResponseResult, Update,
};
use teloxide::types::{InlineKeyboardButton, InlineKeyboardMarkup, Message};
use uuid::Uuid;

use crate::db::CompletionRepository;
use crate::db::models::NotificationChannel;
use crate::db::notifications::PendingNotification;

use super::NotificationChannelSender;

#[derive(Debug, Clone)]
pub struct TelegramChannel {
    bot: Bot,
    chat_id: i64,
}

impl TelegramChannel {
    pub fn new(bot_token: String, chat_id: String) -> Result<Self, String> {
        let parsed_chat_id = chat_id.parse::<i64>().map_err(|_| {
            format!("Invalid TELEGRAM_CHAT_ID '{chat_id}': expected numeric chat id")
        })?;

        Ok(Self {
            bot: Bot::new(bot_token),
            chat_id: parsed_chat_id,
        })
    }

    pub async fn run_callback_handler(self: Arc<Self>, pool: SqlitePool) {
        let bot = self.bot.clone();
        let handler = Update::filter_callback_query().endpoint(handle_callback_query);

        Dispatcher::builder(bot, handler)
            .dependencies(dptree::deps![Arc::new(pool)])
            .build()
            .dispatch()
            .await;
    }

    async fn send_message_with_inline_done(
        &self,
        notification: &PendingNotification,
    ) -> Result<(), String> {
        let callback_data = format!("done:{}", notification.chore_id);
        let keyboard = InlineKeyboardMarkup::new(vec![vec![InlineKeyboardButton::callback(
            "Mark done",
            callback_data,
        )]]);

        let _message: Message = self
            .bot
            .send_message(
                ChatId(self.chat_id),
                format!("{}\n{}", notification.title, notification.body),
            )
            .reply_markup(keyboard)
            .send()
            .await
            .map_err(|e| format!("Telegram send failed: {e}"))?;

        Ok(())
    }
}

async fn handle_callback_query(
    bot: Bot,
    query: CallbackQuery,
    pool: Arc<SqlitePool>,
) -> ResponseResult<()> {
    let Some(data) = query.data.clone() else {
        bot.answer_callback_query(query.id)
            .text("No action attached")
            .send()
            .await?;
        return Ok(());
    };

    let Some(chore_id_str) = data.strip_prefix("done:") else {
        bot.answer_callback_query(query.id)
            .text("Unsupported action")
            .send()
            .await?;
        return Ok(());
    };

    let chore_id = match Uuid::parse_str(chore_id_str) {
        Ok(id) => id,
        Err(_) => {
            bot.answer_callback_query(query.id)
                .text("Invalid chore id")
                .send()
                .await?;
            return Ok(());
        }
    };

    let completion_result = async {
        let exists = CompletionRepository::chore_exists(&pool, chore_id)
            .await
            .map_err(|e| e.to_string())?;
        if !exists {
            return Err("Chore not found".to_string());
        }

        CompletionRepository::create(&pool, chore_id, None, Some("Completed via Telegram"))
            .await
            .map_err(|e| e.to_string())?;
        Ok::<(), String>(())
    }
    .await;

    match completion_result {
        Ok(()) => {
            bot.answer_callback_query(query.id)
                .text("Marked done")
                .send()
                .await?;

            if let Some(message) = query.message {
                let _ = bot
                    .edit_message_reply_markup(message.chat().id, message.id())
                    .reply_markup(InlineKeyboardMarkup::default())
                    .send()
                    .await;
            }
        }
        Err(error) => {
            bot.answer_callback_query(query.id)
                .text("Failed to mark done")
                .send()
                .await?;
            tracing::error!(error = %error, chore_id = %chore_id, "Failed to complete chore from Telegram callback");
        }
    }

    Ok(())
}

impl NotificationChannelSender for TelegramChannel {
    fn channel(&self) -> NotificationChannel {
        NotificationChannel::Telegram
    }

    fn send<'a>(
        &'a self,
        notification: &'a PendingNotification,
    ) -> Pin<Box<dyn Future<Output = Result<(), String>> + Send + 'a>> {
        Box::pin(async move { self.send_message_with_inline_done(notification).await })
    }
}
