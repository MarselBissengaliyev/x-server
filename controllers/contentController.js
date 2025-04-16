import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const generateContent = async (req, res) => {
  try {
    const { type, prompt } = req.body;
    console.log('Generating content:', { type, prompt });

    let result;
    switch (type) {
      case 'text':
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
        result = { text: textCompletion.choices[0].message.content };
        break;

      case 'image':
        const imageResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: prompt || "Create an engaging image for a social media post",
          n: 1,
          size: "1024x1024"
        });
        result = { imageUrl: imageResponse.data[0].url };
        break;

      default:
        return res.status(400).json({ error: 'Invalid content type' });
    }

    console.log('Generated content:', result);
    res.json(result);
  } catch (error) {
    console.error('Error generating content:', error);
    res.status(500).json({ 
      error: 'Failed to generate content',
      details: error.message
    });
  }
}; 