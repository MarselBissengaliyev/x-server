import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error('The OPENAI_API_KEY environment variable is missing or empty.');
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export const generateFromOpenAI = async (prompt, type = 'text') => {
  try {
    if (type === 'image') {
      const response = await openai.images.generate({
        prompt: `${prompt}`,
        n: 1,
        size: '512x512',
      });
      return response.data[0].url; // Return the image URL
    } else {
      // Add Twitter post format instructions to the prompt
      const twitterPrompt = `Generate a single Twitter-style post (max 280 characters) in response to: ${prompt}. Provide ONLY the post text, no additional commentary.`;
      
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo', // Use a valid model
        messages: [{ role: 'user', content: twitterPrompt }],
        temperature: 0.7,
        max_tokens: 70, // Approximately 280 characters (average 4 chars per token)
      });
      
      // Get the generated text
      let generatedText = response.choices[0].message.content;
      
      // Ensure it doesn't exceed 280 characters
      if (generatedText.length > 280) {
        generatedText = generatedText.substring(0, 280);
      }
      
      return generatedText;
    }
  } catch (error) {
    console.error('Error in OpenAI service:', error); // Log detailed error

    // Handle specific OpenAI API errors
    if (error.code === 'billing_hard_limit_reached') {
      throw new Error('Billing limit reached. Please check your OpenAI account.');
    }
    if (error.code === 'model_not_found') {
      throw new Error('The specified model does not exist or access is restricted. Please verify your API key and model.');
    }
    if (error.code === 'insufficient_quota') {
      throw new Error('You have exceeded your current quota. Please check your OpenAI plan and billing details.');
    }

    // Generic error fallback
    throw new Error('Failed to generate content from OpenAI');
  }
};
