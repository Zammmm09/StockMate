
# 📦 StockMate – Inventory & Warehouse Management System

StockMate is a complete **inventory, warehouse, and shop management system** built using:

✅ Node.js + Express (Backend)
✅ MongoDB (Database)
✅ Flutter (Frontend / Mobile App)
✅ JWT Authentication
✅ Role-based access (Admin / User)

It allows businesses to efficiently manage:

* Products & SKU tracking
* Warehouses & shops
* Stock transfers
* Inventory updates
* User accounts & login
* Reporting & dashboard

---

## 🚀 Features

### 🔐 Authentication

* User login & signup
* JWT-based authentication
* Protected API routes
* Role-based access control

### 📦 Inventory Management

* Add / Update / Delete products
* SKU support
* Stock tracking
* Assign inventory to warehouses & shops

### 🏬 Warehouse & Shop

* Manage multiple warehouses
* Manage shops
* Transfer stock between locations

### 📊 Dashboard

* View inventory summary
* Stock status
* Low stock warnings *(if implemented)*

---

## 🛠️ Tech Stack

| Layer    | Technology       |
| -------- | ---------------- |
| Frontend | Flutter          |
| Backend  | Node.js, Express |
| Database | MongoDB          |
| Auth     | JWT              |
| Storage  | Mongoose         |

---

## 📁 Project Structure

```
StockMate/
│
├── backend/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── server.js
│   └── package.json
│
└── frontend/ (Flutter App)
```

---

## ⚙️ Backend Setup

### ✅ 1. Install Dependencies

```
cd backend
npm install
```

### ✅ 2. Create `.env` file

```
MONGO_URI=your_mongo_connection
JWT_SECRET=your_secret_key
PORT=5000
```

### ✅ 3. Start Server

```
npm start
```

Backend runs on:

```
http://localhost:5000
```

---

## 📱 Frontend Setup (Flutter)

```
cd frontend
flutter pub get
flutter run
```

---

## 🔗 API Endpoints (Sample)

### Auth

| Method | Endpoint           | Description   |
| ------ | ------------------ | ------------- |
| POST   | /api/auth/register | Register user |
| POST   | /api/auth/login    | Login         |

### Inventory

| Method | Endpoint           |
| ------ | ------------------ |
| GET    | /api/inventory     |
| POST   | /api/inventory     |
| PUT    | /api/inventory/:id |
| DELETE | /api/inventory/:id |

---

## ✅ Requirements

* Node.js
* Flutter SDK
* MongoDB
* npm

---

## 🤝 Contribution

Pull requests are welcome!

---

## 📜 License

This project is licensed under the **MIT License**.

---

If you want, I can:

✅ add screenshots
✅ add badges (build, license, tech stack)
✅ format for GitHub styling
✅ include installation GIF

Just tell me 🙂
