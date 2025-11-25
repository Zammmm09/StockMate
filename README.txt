# StockMate — Inventory, Warehouse & AI Assistant

StockMate is a full‑stack inventory and warehouse management system built using Node.js, Express, MongoDB, and React (Vite).  
It now includes an AI-powered chatbot to assist users with inventory queries and navigation.

## Features
- Authentication (Login, Register, Forgot Password)
- Inventory Management (Add/Edit/Delete, SKU generation)
- Warehouse Module
- AI Chatbot integrated into frontend
- Dashboard overview
- User profile management

## Tech Stack
Frontend: React (Vite), React Router, Context API, Axios  
Backend: Node.js, Express, MongoDB, JWT, Multer  
AI: AI chatbot connected via backend API

## Project Structure
StockMate/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   └── server.js
└── frontend/
    ├── src/
    ├── components/
    ├── pages/
    ├── context/
    └── App.jsx

## Installation
1. Clone the repository  
2. Backend:
   - npm install
   - Create .env file
   - npm start
3. Frontend:
   - npm install
   - npm run dev

## AI Chatbot Endpoint
POST /api/ai/chat

## Author
Zaeem Ansari
