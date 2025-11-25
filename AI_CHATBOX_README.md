# AI Chatbox Setup Guide

## Overview
An AI-powered chatbox has been added to your StockMate application. It appears as a floating button in the bottom-right corner when users are logged in.

## Features
- 💬 Real-time chat interface
- 🤖 AI-powered responses
- 📱 Responsive design
- 🎨 Modern UI with animations
- 🔒 Only visible to logged-in users

## Quick Start (Demo Mode)

The chatbox works out of the box with basic responses. No additional setup required!

## Advanced Setup (OpenAI Integration)

To enable full AI capabilities using OpenAI:

### 1. Get an OpenAI API Key
- Visit https://platform.openai.com/api-keys
- Create an account or sign in
- Generate a new API key

### 2. Configure Backend
Add to your `backend/.env` file:
```env
OPENAI_API_KEY=your-api-key-here
```

### 3. Restart the Backend
```bash
cd backend
npm start
```

## Alternative AI Services

You can easily switch to other AI providers by modifying `backend/routes/chatRoutes.js`:

### Google Gemini
```javascript
// Install: npm install @google/generative-ai
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });
const result = await model.generateContent(message);
const reply = result.response.text();
```

### Anthropic Claude
```javascript
// Install: npm install @anthropic-ai/sdk
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const message = await anthropic.messages.create({
  model: "claude-3-sonnet-20240229",
  max_tokens: 1024,
  messages: [{ role: "user", content: message }]
});
const reply = message.content[0].text;
```

### Cohere
```javascript
// Install: npm install cohere-ai
import { CohereClient } from "cohere-ai";

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });
const response = await cohere.chat({ message: message });
const reply = response.text;
```

## Customization

### Change Chatbox Position
Edit `frontend/src/components/AIChatbox.jsx`:
```jsx
// Bottom-left instead of bottom-right
className="fixed bottom-6 left-6 ..."
```

### Modify Initial Message
```jsx
const [messages, setMessages] = useState([
  {
    role: 'assistant',
    content: 'Your custom welcome message here!'
  }
]);
```

### Adjust Size
```jsx
// Make chatbox larger
className="... w-96 h-[600px] ..."  // Change these values
```

### Change Colors
```jsx
// Header color
className="bg-blue-600 ..."  // Change to bg-purple-600, bg-green-600, etc.
```

## Files Modified/Created

### Frontend:
- ✅ `frontend/src/components/AIChatbox.jsx` - Main chatbox component
- ✅ `frontend/src/App.jsx` - Added chatbox to app

### Backend:
- ✅ `backend/routes/chatRoutes.js` - Chat API endpoint
- ✅ `backend/server.js` - Registered chat route

## Testing

1. Start your backend server:
```bash
cd backend
npm start
```

2. Start your frontend:
```bash
cd frontend
npm run dev
```

3. Log in to your application
4. Look for the chat button in the bottom-right corner
5. Click it and start chatting!

## Troubleshooting

**Chatbox doesn't appear:**
- Make sure you're logged in
- Check browser console for errors

**API errors:**
- Verify your API key is correct in `.env`
- Check you have API credits available
- Ensure backend server is running

**Network errors:**
- Confirm backend is running on port 5000
- Check CORS settings if using different ports

## Support

For issues or questions, refer to:
- OpenAI API docs: https://platform.openai.com/docs
- React documentation: https://react.dev
- StockMate repository issues

---
Enjoy your new AI chatbox! 🚀
