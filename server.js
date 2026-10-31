require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 24) {
  console.error("Set JWT_SECRET in your .env file (at least 24 characters).");
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const BOOKS_FILE = path.join(DATA_DIR, "books.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
for (const file of [USERS_FILE, BOOKS_FILE]) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, "[]", "utf8");
}

function readData(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return []; }
}
function writeData(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}
function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}
function createToken(user) {
  return jwt.sign({ userId: user.id }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d"
  });
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." }
});

function authenticateToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Please log in first." });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = readData(USERS_FILE).find(item => item.id === payload.userId);
    if (!user) return res.status(401).json({ message: "Account not found. Please log in again." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Your session is invalid or expired. Please log in again." });
  }
}

app.post("/api/auth/register", authLimiter, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (name.length < 2) return res.status(400).json({ message: "Name must contain at least 2 characters." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address." });
    if (password.length < 8) return res.status(400).json({ message: "Password must contain at least 8 characters." });

    const users = readData(USERS_FILE);
    if (users.some(user => user.email === email)) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const user = {
      id: crypto.randomUUID(),
      name,
      email,
      password: await bcrypt.hash(password, 12),
      createdAt: new Date().toISOString()
    };
    users.push(user);
    writeData(USERS_FILE, users);

    res.status(201).json({
      message: "Registration successful.",
      token: createToken(user),
      user: safeUser(user)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during registration." });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = readData(USERS_FILE).find(item => item.email === email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Incorrect email or password." });
    }

    res.json({ message: "Login successful.", token: createToken(user), user: safeUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during login." });
  }
});

app.get("/api/auth/me", authenticateToken, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

app.put("/api/auth/profile", authenticateToken, (req, res) => {
  const name = String(req.body.name || "").trim();
  if (name.length < 2) return res.status(400).json({ message: "Name must contain at least 2 characters." });

  const users = readData(USERS_FILE);
  const index = users.findIndex(user => user.id === req.user.id);
  users[index].name = name;
  writeData(USERS_FILE, users);
  res.json({ message: "Profile updated successfully.", user: safeUser(users[index]) });
});

// Public bookstore catalogue
app.get("/api/books", (req, res) => {
  const books = readData(BOOKS_FILE).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ books });
});

// Private dashboard: return only books owned by the logged-in user
app.get("/api/my-books", authenticateToken, (req, res) => {
  const books = readData(BOOKS_FILE)
    .filter(book => book.ownerId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ books });
});

app.post("/api/books", authenticateToken, (req, res) => {
  const title = String(req.body.title || "").trim();
  const author = String(req.body.author || "").trim();
  const category = String(req.body.category || "General").trim();
  const price = Number(req.body.price);

  if (!title || !author) return res.status(400).json({ message: "Book title and author are required." });
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ message: "Enter a valid price." });

  const book = {
    id: crypto.randomUUID(),
    ownerId: req.user.id,
    title,
    author,
    category,
    price,
    description: String(req.body.description || "").trim(),
    createdAt: new Date().toISOString()
  };
  const books = readData(BOOKS_FILE);
  books.push(book);
  writeData(BOOKS_FILE, books);
  res.status(201).json({ message: "Book added successfully.", book });
});

app.put("/api/books/:id", authenticateToken, (req, res) => {
  const books = readData(BOOKS_FILE);
  const index = books.findIndex(book => book.id === req.params.id && book.ownerId === req.user.id);
  if (index === -1) return res.status(404).json({ message: "Book not found in your account." });

  const title = String(req.body.title || "").trim();
  const author = String(req.body.author || "").trim();
  const price = Number(req.body.price);
  if (!title || !author || !Number.isFinite(price) || price < 0) {
    return res.status(400).json({ message: "Enter a valid title, author and price." });
  }

  books[index] = {
    ...books[index],
    title,
    author,
    price,
    category: String(req.body.category || "General").trim(),
    description: String(req.body.description || "").trim(),
    updatedAt: new Date().toISOString()
  };
  writeData(BOOKS_FILE, books);
  res.json({ message: "Book updated successfully.", book: books[index] });
});

app.delete("/api/books/:id", authenticateToken, (req, res) => {
  const books = readData(BOOKS_FILE);
  const book = books.find(item => item.id === req.params.id && item.ownerId === req.user.id);
  if (!book) return res.status(404).json({ message: "Book not found in your account." });

  writeData(BOOKS_FILE, books.filter(item => item.id !== req.params.id));
  res.json({ message: "Book deleted successfully." });
});

app.get("/api/health", (req, res) => res.json({ status: "OK", app: "Online Book Store API" }));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Online Book Store running at http://localhost:${PORT}`));
