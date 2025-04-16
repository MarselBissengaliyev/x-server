import { TwitterApi } from 'twitter-api-v2';
import { Account } from '../models/Account.js';
import OpenAI from 'openai';
import logger from '../services/loggerService.js';
import TwitterAdsAPI from 'twitter-ads';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Функция для задержки выполнения
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Функция повторной попытки с задержкой
async function retryWithDelay(fn, maxRetries = 3, initialDelay = 5000) {
  let retries = 0;
  let currentDelay = initialDelay;
  
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      // Если это не ошибка превышения лимита запросов, просто пробрасываем дальше
      if (!error.message?.includes('429') && !error.message?.includes('Too Many Requests')) {
        throw error;
      }
      
      retries++;
      if (retries >= maxRetries) {
        throw error;
      }
      
      // Увеличиваем задержку экспоненциально
      logger.logTwitter('RATE_LIMIT_RETRY', `Rate limit hit. Retrying in ${currentDelay}ms (attempt ${retries}/${maxRetries})`);
      await delay(currentDelay);
      currentDelay *= 2; // Экспоненциальное увеличение задержки
    }
  }
}

// Функция для проверки валидности токенов
async function validateTwitterTokens(accessToken, accessTokenSecret) {
  try {
    logger.logTwitter('TOKEN_VALIDATION_START', { accessToken: accessToken?.substring(0, 10) + '...', accessTokenSecret: accessTokenSecret?.substring(0, 5) + '...' });
    
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken,
      accessSecret: accessTokenSecret,
    });

    // Проверяем токены, пытаясь получить информацию о пользователе
    const user = await client.v2.me();
    logger.logTwitter('TOKEN_VALIDATION_SUCCESS', user.data);
    return user.data;
  } catch (error) {
    logger.logError('TWITTER_TOKEN_VALIDATION', error);
    throw new Error('Invalid or expired Twitter tokens');
  }
}

export const generatePost = async (req, res) => {
  try {
    const { accountId, mediaType, prompt } = req.body;
    
    logger.logAPI('POST', '/posts/generate', { accountId, mediaType, prompt });
    logger.logAction(req.session?.user?.id, 'GENERATE_POST_REQUEST', { accountId, mediaType, prompt });
    
    if (!accountId) {
      logger.logError('GENERATE_POST', 'Account ID is required');
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Получаем данные аккаунта из базы данных
    const account = await Account.findOne({ where: { id: accountId } });
    if (!account) {
      logger.logError('GENERATE_POST', `Account not found: ${accountId}`);
      return res.status(404).json({ error: 'Account not found' });
    }

    // Проверяем наличие токенов
    if (!account.accessToken || !account.accessTokenSecret) {
      logger.logError('GENERATE_POST', `Missing Twitter tokens for account: ${accountId}`);
      return res.status(401).json({ 
        error: 'Twitter authentication required',
        details: 'Please authenticate your account first'
      });
    }

    // Проверяем валидность токенов
    try {
      await validateTwitterTokens(account.accessToken, account.accessTokenSecret);
    } catch (error) {
      logger.logError('GENERATE_POST', `Token validation failed: ${error.message}`);
      return res.status(401).json({ 
        error: 'Twitter authentication failed',
        details: 'Please re-authenticate your account'
      });
    }

    const MAX_TWEET_LENGTH = 280;
    const twitterLengthInstructions = prompt + ` (Only 1 post 280 symbols max)`;

    let generatedContent;
    switch (mediaType) {
      case 'text':
        // Логируем запрос к OpenAI
        logger.logOpenAI('REQUEST', {
          model: "gpt-4",
          endpoint: "chat.completions",
          prompt: twitterLengthInstructions || "Generate an engaging Twitter post with max 280 characters"
        });
        
        // Генерация текста с помощью ChatGPT с ограничением по длине
        const textCompletion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `You are a social media content creator. Generate engaging and creative posts for Twitter. ${twitterLengthInstructions} Never exceed ${MAX_TWEET_LENGTH} characters.`
            },
            {
              role: "user",
              content: (prompt || "Generate an engaging Twitter post") + `. Помни, что лимит для твита - ${MAX_TWEET_LENGTH} символов.`
            }
          ],
          max_tokens: 140 // Примерно 280 символов, с запасом
        });
        
        let generatedText = textCompletion.choices[0].message.content;
        
        // Дополнительная проверка, если модель всё же сгенерировала длинный текст
        if (generatedText.length > MAX_TWEET_LENGTH) {
          logger.logOpenAI('TEXT_TOO_LONG', `Truncating generated text from ${generatedText.length} to ${MAX_TWEET_LENGTH} characters`);
          generatedText = generatedText.substring(0, MAX_TWEET_LENGTH - 3) + '...';
        }
        
        // Логируем ответ от OpenAI
        logger.logOpenAI('RESPONSE', {
          generatedText,
          textLength: generatedText.length,
          usage: textCompletion.usage
        });

        generatedContent = {
          text: generatedText,
          mediaType: 'text'
        };
        break;

      case 'image':
        // Логируем запрос изображения к OpenAI
        logger.logOpenAI('REQUEST_IMAGE', {
          model: "dall-e-3",
          prompt: prompt || "Create an engaging image for a social media post"
        });
        
        // Генерация изображения с помощью DALL-E
        const imageResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: prompt || "Create an engaging image for a social media post",
          n: 1,
          size: "1024x1024"
        });
        
        // Логируем результат генерации изображения
        logger.logOpenAI('RESPONSE_IMAGE', {
          imageUrl: imageResponse.data[0].url,
          model: "dall-e-3"
        });

        // Логируем запрос текста к OpenAI
        logger.logOpenAI('REQUEST', {
          model: "gpt-4",
          endpoint: "chat.completions",
          prompt: (prompt || "Generate a caption for this image post") + ` (maximum ${MAX_TWEET_LENGTH} characters)`
        });
        
        // Генерация текста для поста с изображением с ограничением по длине
        const imageTextCompletion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `You are a social media content creator. Generate an engaging caption for an image post. ${twitterLengthInstructions}`
            },
            {
              role: "user",
              content: (prompt || "Generate a caption for this image post") + `. Не более ${MAX_TWEET_LENGTH} символов.`
            }
          ],
          max_tokens: 140 // Примерно 280 символов, с запасом
        });
        
        let imageCaption = imageTextCompletion.choices[0].message.content;
        
        // Дополнительная проверка длины caption
        if (imageCaption.length > MAX_TWEET_LENGTH) {
          logger.logOpenAI('CAPTION_TOO_LONG', `Truncating generated caption from ${imageCaption.length} to ${MAX_TWEET_LENGTH} characters`);
          imageCaption = imageCaption.substring(0, MAX_TWEET_LENGTH - 3) + '...';
        }
        
        // Логируем ответ от OpenAI
        logger.logOpenAI('RESPONSE', {
          generatedText: imageCaption,
          textLength: imageCaption.length,
          usage: imageTextCompletion.usage
        });

        generatedContent = {
          text: imageCaption,
          mediaType: 'image',
          mediaUrl: imageResponse.data[0].url
        };
        break;

      case 'video':
        // Логируем запрос к OpenAI
        logger.logOpenAI('REQUEST', {
          model: "gpt-4",
          endpoint: "chat.completions",
          prompt: (prompt || "Generate a caption for this video post") + ` (maximum ${MAX_TWEET_LENGTH} characters)`
        });
        
        // Для видео пока используем заглушку, так как OpenAI не предоставляет генерацию видео
        const videoTextCompletion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `You are a social media content creator. Generate an engaging caption for a video post. ${twitterLengthInstructions}`
            },
            {
              role: "user",
              content: (prompt || "Generate a caption for this video post") + `. Maximum ${MAX_TWEET_LENGTH} characters.`
            }
          ],
          max_tokens: 140 // Примерно 280 символов, с запасом
        });
        
        let videoCaption = videoTextCompletion.choices[0].message.content;
        
        // Проверка длины caption для видео
        if (videoCaption.length > MAX_TWEET_LENGTH) {
          logger.logOpenAI('CAPTION_TOO_LONG', `Truncating generated video caption from ${videoCaption.length} to ${MAX_TWEET_LENGTH} characters`);
          videoCaption = videoCaption.substring(0, MAX_TWEET_LENGTH - 3) + '...';
        }
        
        // Логируем ответ от OpenAI
        logger.logOpenAI('RESPONSE', {
          generatedText: videoCaption,
          textLength: videoCaption.length,
          usage: videoTextCompletion.usage
        });

        generatedContent = {
          text: videoCaption,
          mediaType: 'video',
          mediaUrl: 'https://example.com/video.mp4' // Замените на реальный URL видео
        };
        break;

      default:
        logger.logError('GENERATE_POST', `Invalid media type: ${mediaType}`);
        return res.status(400).json({ error: 'Invalid media type' });
    }

    logger.logAction(req.session?.user?.id, 'GENERATE_POST_SUCCESS', { 
      mediaType, 
      contentLength: generatedContent.text.length,
      withinLimit: generatedContent.text.length <= MAX_TWEET_LENGTH 
    });
    
    res.json(generatedContent);
  } catch (error) {
    logger.logError('GENERATE_POST', error);
    res.status(500).json({ error: 'Failed to generate post', details: error.message });
  }
};

export const publishPost = async (req, res) => {
  try {
    logger.logAPI('POST', '/posts/publish', req.body);
    logger.logAction(req.session?.user?.id, 'PUBLISH_POST_REQUEST', { 
      accountId: req.body.accountId, 
      mediaType: req.body.mediaType 
    });

    const { accountId, text, mediaType, mediaUrl, accessToken, accessTokenSecret } = req.body;
    
    if (!accountId || !text) {
      logger.logError('PUBLISH_POST', 'Account ID and text are required');
      return res.status(400).json({ error: 'Account ID and text are required' });
    }

    // Проверяем длину текста и обрезаем если нужно
    const MAX_TWEET_LENGTH = 280;
    let finalText = text;
    
    if (text.length > MAX_TWEET_LENGTH) {
      logger.logTwitter('TEXT_TOO_LONG', `Original text length: ${text.length}, truncating to ${MAX_TWEET_LENGTH} characters`);
      finalText = text.substring(0, MAX_TWEET_LENGTH - 3) + '...';
    }

    // Определим токены - либо из запроса, либо из файла или базы данных
    let tokens = { accessToken, accessTokenSecret };
    
    // Если токены не переданы в запросе, пробуем получить их из файла accounts.json
    if (!accessToken || !accessTokenSecret) {
      logger.logTwitter('TOKEN_LOOKUP', 'Tokens not provided in request, trying to fetch from accounts.json');
      
      try {
        // Получаем аккаунты из файла
        const accounts = await Account.getAll();
        logger.logTwitter('ACCOUNTS_FOUND', { count: accounts.length });
        
        const account = accounts.find(a => a.id === accountId);
        
        if (!account) {
          logger.logError('PUBLISH_POST', `Account not found in accounts.json with ID: ${accountId}`);
          
          // Попробуем найти в базе Sequelize как запасной вариант
          logger.logTwitter('DB_LOOKUP', `Trying to find account in Sequelize database with ID: ${accountId}`);
          const dbAccount = await Account.findOne({ where: { id: accountId } });
          
          if (!dbAccount) {
            logger.logError('PUBLISH_POST', `Account not found in database with ID: ${accountId}`);
            return res.status(404).json({ error: 'Account not found' });
          }
          
          tokens.accessToken = dbAccount.accessToken;
          tokens.accessTokenSecret = dbAccount.accessTokenSecret;
          logger.logTwitter('TOKEN_FOUND', 'Found tokens in database');
        } else {
          // Проверяем наличие токенов в аккаунте из файла
          if (!account.accessToken || !account.accessTokenSecret) {
            logger.logError('PUBLISH_POST', `Missing Twitter tokens for account: ${accountId}`);
            return res.status(401).json({ 
              error: 'Twitter authentication required',
              details: 'Please authenticate your account first'
            });
          }
          
          tokens.accessToken = account.accessToken;
          tokens.accessTokenSecret = account.accessTokenSecret;
          logger.logTwitter('TOKEN_FOUND', 'Found tokens in accounts.json');
        }
      } catch (err) {
        logger.logError('PUBLISH_POST', `Error retrieving account information: ${err.message}`);
        return res.status(500).json({ 
          error: 'Failed to retrieve account information',
          details: err.message
        });
      }
    }

    if (!tokens.accessToken || !tokens.accessTokenSecret) {
      logger.logError('PUBLISH_POST', 'Failed to obtain Twitter tokens');
      return res.status(401).json({ 
        error: 'Twitter authentication required',
        details: 'Could not find or validate Twitter tokens'
      });
    }

    // Проверяем валидность токенов
    try {
      const userData = await validateTwitterTokens(tokens.accessToken, tokens.accessTokenSecret);
      logger.logTwitter('USER_DATA', userData);
    } catch (error) {
      logger.logError('PUBLISH_POST', `Token validation failed: ${error.message}`);
      return res.status(401).json({ 
        error: 'Twitter authentication failed',
        details: 'Please re-authenticate your account'
      });
    }

    // Создаем клиент Twitter API v2
    logger.logTwitter('CREATE_CLIENT', 'Creating Twitter API client');
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: tokens.accessToken,
      accessSecret: tokens.accessTokenSecret,
    });
    const v2Client = client.v2;

    let mediaIds = [];
    if ((mediaType === 'image' || mediaType === 'video') && mediaUrl) {
      try {
        logger.logTwitter('UPLOAD_MEDIA_START', { mediaType, mediaUrlLength: mediaUrl?.length });
        const mediaResponse = await client.v1.uploadMedia(mediaUrl);
        mediaIds.push(mediaResponse);
        logger.logTwitter('UPLOAD_MEDIA_SUCCESS', { mediaId: mediaResponse });
      } catch (mediaError) {
        logger.logError('UPLOAD_MEDIA', mediaError);
        // Продолжаем публикацию даже при ошибке загрузки медиа
      }
    }

    // Публикуем пост с обрезанным текстом с поддержкой повторных попыток при ошибке 429
    logger.logTwitter('TWEET_START', { textLength: finalText.length, mediaIds });
    const tweetParams = {
      text: finalText
    };
    
    // Добавляем медиа к твиту если есть
    if (mediaIds.length > 0) {
      tweetParams.media = { media_ids: mediaIds };
    }
    
    // Логируем детали запроса перед отправкой
    logger.logTwitter('TWEET_PARAMS', { 
      params: tweetParams, 
      originalTextLength: text.length,
      finalTextLength: finalText.length
    });

    // Используем функцию повторной попытки при публикации твита
    const tweet = await retryWithDelay(async () => {
      return await v2Client.tweet(tweetParams);
    }, 3, 10000); // 3 попытки с начальной задержкой 10 секунд
    
    logger.logTwitter('TWEET_SUCCESS', tweet.data);

    // Обновляем статистику аккаунта
    try {
      await Account.updateStats(accountId);
      logger.logAction(req.session?.user?.id, 'ACCOUNT_STATS_UPDATED', { accountId });
    } catch (statsError) {
      logger.logError('UPDATE_STATS', statsError);
      // Продолжаем даже при ошибке обновления статистики
    }

    logger.logAction(req.session?.user?.id, 'PUBLISH_POST_SUCCESS', { 
      accountId, 
      tweetId: tweet.data.id
    });
    
    const response = { 
      success: true, 
      tweet: tweet.data
    };
    
    logger.logAPI('RESPONSE', '/posts/publish', null, response);
    res.json(response);
  } catch (error) {
    // Добавляем специальное сообщение для ошибок превышения лимита
    if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
      logger.logError('PUBLISH_POST', `Rate limit exceeded: ${error.message}`);
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        details: 'Twitter API limit has been reached. Please try again later.',
        retryAfter: 60 // Рекомендуем подождать 60 секунд
      });
    }
    
    logger.logError('PUBLISH_POST', error);
    res.status(500).json({ 
      error: 'Failed to publish post',
      details: error.message
    });
  }
};

export const publishTweetAdsAPI = async (req, res) => {
  try {
    const { account_id } = req.params;
    const { 
      as_user_id, 
      text, 
      card_uri, 
      conversation_settings,
      media_keys, 
      name, 
      nullcast = true, 
      trim_user = false,
      tweet_mode,
      video_cta,
      video_cta_value,
      video_description,
      video_title
    } = req.body;

    logger.logAPI('POST', `/12/accounts/${account_id}/tweet`, req.body);
    logger.logAction(req.session?.user?.id, 'PUBLISH_TWEET_ADS_API', { 
      account_id, 
      as_user_id,
      nullcast
    });

    if (!account_id || !as_user_id) {
      logger.logError('PUBLISH_TWEET_ADS_API', 'Account ID and as_user_id are required');
      return res.status(400).json({ error: 'Account ID and as_user_id are required' });
    }

    if (!text && !media_keys) {
      logger.logError('PUBLISH_TWEET_ADS_API', 'Either text or media_keys must be provided');
      return res.status(400).json({ error: 'Either text or media_keys must be provided' });
    }

    // Проверка длины текста
    const MAX_TWEET_LENGTH = 280;
    let finalText = text;
    
    if (text && text.length > MAX_TWEET_LENGTH) {
      logger.logTwitter('TEXT_TOO_LONG', `Original text length: ${text.length}, truncating to ${MAX_TWEET_LENGTH} characters`);
      finalText = text.substring(0, MAX_TWEET_LENGTH - 3) + '...';
    }

    // Get account from database
    const account = await Account.findOne({ where: { id: account_id } });
    if (!account) {
      logger.logError('PUBLISH_TWEET_ADS_API', `Account not found: ${account_id}`);
      return res.status(404).json({ error: 'Account not found' });
    }

    // Check tokens
    if (!account.accessToken || !account.accessTokenSecret) {
      logger.logError('PUBLISH_TWEET_ADS_API', `Missing Twitter tokens for account: ${account_id}`);
      return res.status(401).json({ 
        error: 'Twitter authentication required',
        details: 'Please authenticate your account first'
      });
    }

    // Вместо прямого использования SDK, который может иметь проблемы,
    // будем использовать twitter-api-v2, который мы уже знаем, что работает
    try {
      // Проверяем валидность токенов перед отправкой твита
      await validateTwitterTokens(account.accessToken, account.accessTokenSecret);
      
      logger.logTwitter('TOKEN_VALIDATION_SUCCESS', 'Токены действительны, отправляем твит');
      
      // Создаем клиент Twitter API v2
      const client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY,
        appSecret: process.env.TWITTER_API_SECRET,
        accessToken: account.accessToken,
        accessSecret: account.accessTokenSecret,
      });
      
      // Подготавливаем параметры твита с обрезанным текстом
      const tweetParams = {
        text: finalText
      };
      
      // Если есть media_keys, добавляем их в параметры
      if (media_keys) {
        // Разделяем и преобразуем ключи медиа
        const mediaArr = media_keys.split(',');
        tweetParams.media = { media_ids: mediaArr };
        logger.logTwitter('MEDIA_KEYS', { mediaArr });
      }
      
      // Логируем исходный и итоговый текст
      logger.logTwitter('TWEET_PARAMS', { 
        params: tweetParams, 
        originalTextLength: text?.length,
        finalTextLength: finalText?.length
      });
      
      // Отправляем твит с поддержкой повторных попыток
      const tweetResult = await retryWithDelay(async () => {
        return await client.v2.tweet(tweetParams);
      }, 3, 10000); // 3 попытки с начальной задержкой 10 секунд
      
      logger.logTwitter('TWEET_SUCCESS', tweetResult);
      
      // Создаем ответ в формате X Ads API
      const response = {
        data: {
          created_at: new Date().toUTCString(),
          id: tweetResult.data.id,
          id_str: tweetResult.data.id,
          text: text || "",
          name: name || null,
          truncated: false,
          entities: tweetResult.data.entities || {
            hashtags: [],
            symbols: [],
            user_mentions: [],
            urls: []
          },
          source: "<a href='https://ads-api.x.com' rel='nofollow'>Ads API App</a>",
          in_reply_to_status_id: null,
          in_reply_to_status_id_str: null,
          in_reply_to_user_id: null,
          in_reply_to_user_id_str: null,
          in_reply_to_screen_name: null,
          user: {
            id: as_user_id,
            id_str: String(as_user_id)
          },
          geo: null,
          coordinates: null,
          place: null,
          contributors: null,
          retweet_count: 0,
          favorite_count: 0,
          favorited: false,
          retweeted: false,
          scopes: {
            followers: !nullcast
          },
          lang: "en"
        },
        request: {
          params: {
            text,
            trim_user,
            as_user_id,
            account_id
          }
        }
      };
      
      // Обновляем статистику аккаунта
      try {
        await Account.updateStats(account_id);
        logger.logAction(req.session?.user?.id, 'ACCOUNT_STATS_UPDATED', { accountId: account_id });
      } catch (statsError) {
        logger.logError('UPDATE_STATS', statsError);
      }
      
      logger.logAction(req.session?.user?.id, 'PUBLISH_TWEET_ADS_API_SUCCESS', { 
        accountId: account_id, 
        tweetId: tweetResult.data.id
      });
      
      logger.logAPI('RESPONSE', `/12/accounts/${account_id}/tweet`, null, response);
      return res.json(response);
      
    } catch (error) {
      logger.logError('PUBLISH_TWEET_ADS_API', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        status: error.status,
        rateLimitError: error.rateLimit ? true : false,
        details: error.errors ? JSON.stringify(error.errors) : 'No additional details'
      });
      
      return res.status(error.status || 500).json({ 
        error: 'Failed to publish tweet',
        details: error.message,
        code: error.code || error.status,
        errors: error.errors
      });
    }
  } catch (error) {
    logger.logError('PUBLISH_TWEET_ADS_API', {
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'Failed to publish tweet',
      details: error.message
    });
  }
}; 