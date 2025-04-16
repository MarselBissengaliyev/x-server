import express from 'express';
import { generateContent } from '../controllers/contentController.js';

const router = express.Router();

router.post('/generate', generateContent);

export default router; 