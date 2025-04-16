import { generateFromOpenAI } from '../services/openaiService.js'

export const generateContent = async (req, res) => {
  const { type, prompt } = req.body;
  try {
    const result = await generateFromOpenAI(prompt, type);
    res.json({ result });
  } catch (err) {
    console.error('Error in generateContent controller:', err.message); // Log detailed error
    res.status(500).json({ error: err.message }); // Send detailed error to the client
  }
};
