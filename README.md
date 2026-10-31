# BookNest – Online Book Store (Module 05)

A beginner-friendly internship project demonstrating JWT authentication, protected dashboard routes, user profiles, logout, and user-owned book management.

## Technology
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js and Express.js
- Authentication: JSON Web Token (JWT)
- Password security: bcryptjs
- Storage: local JSON files (`data/users.json`, `data/books.json`)

## Requirements
Install Node.js (LTS). Check installation:
```bash
node -v
npm -v
```

## Run the project
1. Download and extract this project.
2. Open the extracted folder in VS Code.
3. Open Terminal in VS Code.
4. Install packages:
```bash
npm install
```
5. Create a file named `.env` in the main project folder. Copy the contents of `.env.example` and replace the secret with a long random value:
```env
PORT=5000
JWT_SECRET=use_a_long_random_secret_string_here_123456
JWT_EXPIRES_IN=1d
```
6. Start the server:
```bash
npm start
```
7. Open this address in your browser:
http://localhost:5000

## How to test
1. Create a new account with a name, email and password (minimum 8 characters).
2. You will be taken to your private dashboard.
3. Add a book with its title, author, category and price.
4. Edit or delete your own book.
5. Update your profile name.
6. Click Logout.
7. Register or log in with another account. Its dashboard should show only that account's books.

## API endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register user |
| POST | `/api/auth/login` | Public | Login user and receive JWT |
| GET | `/api/auth/me` | Protected | Get current user |
| PUT | `/api/auth/profile` | Protected | Update profile name |
| GET | `/api/books` | Public | View public book catalogue |
| GET | `/api/my-books` | Protected | View only logged-in user's books |
| POST | `/api/books` | Protected | Add a book |
| PUT | `/api/books/:id` | Protected | Edit own book |
| DELETE | `/api/books/:id` | Protected | Delete own book |
| GET | `/api/health` | Public | Check API status |

For protected API requests, send this header:
`Authorization: Bearer YOUR_JWT_TOKEN`

## Module 05 objectives covered
- [x] JWT-based user authentication.
- [x] Protected dashboard API.
- [x] Dashboard shows only the logged-in user's books.
- [x] User profile update.
- [x] Logout functionality.
- [x] GitHub-ready source code and README.

## Important notes
- This is an educational/demo project. JSON file storage is suitable for a small local internship demonstration, not a production store with many users. For deployment, use a database such as MongoDB or PostgreSQL and persistent storage.
- Never upload `.env`, real passwords, or private secrets to GitHub. Upload `.env.example` only.
- The demo frontend keeps the JWT in browser localStorage for simplicity. A production application should use appropriately configured secure, HttpOnly cookies and add CSRF protections.
- If you deploy to a hosting provider, confirm that its filesystem is persistent; otherwise JSON data may be reset when the app restarts.
