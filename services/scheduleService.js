import cron from 'node-cron';
import { Account } from '../models/Account.js';
import { TwitterApi } from 'twitter-api-v2';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Функция для генерации поста
async function generatePost(account, prompt) {
  try {
    const textCompletion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a social media content creator. Generate engaging and creative posts for Twitter."
        },
        {
          role: "user",
          content: prompt || "Generate an engaging Twitter post"
        }
      ],
      max_tokens: 280
    });

    return textCompletion.choices[0].message.content;
  } catch (error) {
    console.error('Error generating post:', error);
    throw error;
  }
}

// Функция для публикации поста
async function publishPost(account, text) {
  try {
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: account.accessToken,
      accessSecret: account.accessTokenSecret,
    });

    const tweet = await client.v2.tweet(text);
    return tweet;
  } catch (error) {
    console.error('Error publishing post:', error);
    throw error;
  }
}

// Функция для планирования постов на неделю
export async function scheduleWeeklyPosts(account) {
  try {
    const { settings } = account;
    const { schedule, prompts } = settings;
    
    if (schedule === 'not_scheduled') {
      return;
    }

    // Очищаем текущее расписание
    account.schedule = {
      posts: [],
      nextPostIndex: 0
    };

    // Генерируем посты на неделю
    const posts = [];
    const promptsList = prompts.split('\n').filter(p => p.trim());

    for (let i = 0; i < 7; i++) {
      const prompt = promptsList[i % promptsList.length] || 'Generate an engaging Twitter post';
      const text = await generatePost(account, prompt);
      posts.push({
        text,
        scheduledTime: new Date(Date.now() + (i * 24 * 60 * 60 * 1000))
      });
    }

    // Сохраняем расписание
    account.schedule.posts = posts;
    await account.save();

    console.log(`Scheduled ${posts.length} posts for account ${account.username}`);
  } catch (error) {
    console.error('Error scheduling posts:', error);
    throw error;
  }
}

// Функция для запуска планировщика
export function startScheduler() {
  // Запускаем проверку каждый час
  cron.schedule('0 * * * *', async () => {
    try {
      const accounts = await Account.findAll({
        where: {
          'settings.autoposting': true,
          'settings.schedule': ['hourly', 'daily']
        }
      });

      for (const account of accounts) {
        const { schedule, settings } = account;
        const now = new Date();

        // Проверяем, нужно ли опубликовать следующий пост
        if (schedule.posts.length > 0 && schedule.nextPostIndex < schedule.posts.length) {
          const nextPost = schedule.posts[schedule.nextPostIndex];
          
          if (nextPost.scheduledTime <= now) {
            try {
              await publishPost(account, nextPost.text);
              
              // Обновляем индекс следующего поста
              account.schedule.nextPostIndex++;
              await account.save();

              console.log(`Published scheduled post for account ${account.username}`);
            } catch (error) {
              console.error(`Error publishing post for account ${account.username}:`, error);
            }
          }
        }

        // Если все посты опубликованы, генерируем новые
        if (schedule.nextPostIndex >= schedule.posts.length) {
          await scheduleWeeklyPosts(account);
        }
      }
    } catch (error) {
      console.error('Error in scheduler:', error);
    }
  });
} 