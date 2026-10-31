const API = "";
let currentUser = null;
let catalogue = [];
const $ = id => document.getElementById(id);
const token = () => localStorage.getItem("booknest_token");

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const response = await fetch(`${API}/api${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}
function notify(message) {
  const toast = $("toast"); toast.textContent = message; toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}
function setMessage(id, message, success = false) {
  const el = $(id); el.textContent = message; el.className = `message${success ? " success" : ""}`;
}
function showPage(page) {
  document.querySelectorAll(".page").forEach(el => el.classList.add("hidden"));
  $(`${page}Page`).classList.remove("hidden");
  if (page === "catalog") loadCatalog();
  if (page === "dashboard") {
    if (!token()) return showPage("login");
    loadDashboard();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function updateNavigation() {
  $("dashboardLink").classList.toggle("hidden", !currentUser);
  $("navActions").innerHTML = currentUser
    ? `<span class="muted" style="align-self:center;font-size:13px">Hi, ${escapeHtml(currentUser.name)}</span><button class="btn btn-primary" onclick="showPage('dashboard')">My dashboard</button>`
    : `<button class="btn btn-light" onclick="showPage('login')">Login</button><button class="btn btn-primary" onclick="showPage('register')">Create account</button>`;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function bookCard(book, owned = false) {
  return `<article class="book-card">
    <div class="book-cover">📖</div><span class="book-category">${escapeHtml(book.category)}</span>
    <h3>${escapeHtml(book.title)}</h3><p>By ${escapeHtml(book.author)}</p>
    ${book.description ? `<p>${escapeHtml(book.description)}</p>` : ""}
    <div class="book-bottom"><span class="price">₹${Number(book.price).toFixed(2)}</span><span class="muted" style="font-size:11px">${new Date(book.createdAt).toLocaleDateString()}</span></div>
    ${owned ? `<div class="card-actions"><button class="btn btn-light" onclick="editBook('${book.id}')">Edit</button><button class="btn btn-outline" onclick="deleteBook('${book.id}')">Delete</button></div>` : ""}
  </article>`;
}
async function loadCatalog() {
  try {
    const data = await api("/books"); catalogue = data.books; renderCatalog();
  } catch (error) { $("catalogGrid").innerHTML = `<p>${escapeHtml(error.message)}</p>`; }
}
function renderCatalog() {
  const query = ($("searchBooks")?.value || "").toLowerCase();
  const filtered = catalogue.filter(book => [book.title, book.author, book.category].join(" ").toLowerCase().includes(query));
  $("catalogGrid").innerHTML = filtered.length ? filtered.map(book => bookCard(book)).join("") : "<p>No books found. Try another search.</p>";
}

$("registerForm").addEventListener("submit", async event => {
  event.preventDefault();
  setMessage("registerMessage", "");
  try {
    const data = await api("/auth/register", { method:"POST", body:JSON.stringify({
      name:$("registerName").value, email:$("registerEmail").value, password:$("registerPassword").value
    })});
    localStorage.setItem("booknest_token", data.token); currentUser = data.user; updateNavigation();
    $("registerForm").reset(); notify("Account created successfully!"); showPage("dashboard");
  } catch (error) { setMessage("registerMessage", error.message); }
});
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault(); setMessage("loginMessage", "");
  try {
    const data = await api("/auth/login", { method:"POST", body:JSON.stringify({
      email:$("loginEmail").value, password:$("loginPassword").value
    })});
    localStorage.setItem("booknest_token", data.token); currentUser = data.user; updateNavigation();
    $("loginForm").reset(); notify("Login successful!"); showPage("dashboard");
  } catch (error) { setMessage("loginMessage", error.message); }
});
async function loadDashboard() {
  try {
    const [me, result] = await Promise.all([api("/auth/me"), api("/my-books")]);
    currentUser = me.user; updateNavigation();
    $("welcomeName").textContent = currentUser.name;
    $("profileName").value = currentUser.name; $("profileEmail").value = currentUser.email;
    $("bookCount").textContent = result.books.length;
    $("myBooksGrid").innerHTML = result.books.length
      ? result.books.map(book => bookCard(book, true)).join("")
      : `<div class="panel"><p class="muted">You have not added any books yet. Use the form above to add your first book.</p></div>`;
  } catch (error) {
    if (error.message.toLowerCase().includes("session") || error.message.toLowerCase().includes("log in") || error.message.toLowerCase().includes("invalid")) logout(false);
    else notify(error.message);
  }
}
$("bookForm").addEventListener("submit", async event => {
  event.preventDefault();
  const id = $("bookId").value;
  const body = {
    title:$("bookTitle").value, author:$("bookAuthor").value,
    category:$("bookCategory").value, price:$("bookPrice").value,
    description:$("bookDescription").value
  };
  try {
    await api(id ? `/books/${id}` : "/books", { method:id ? "PUT" : "POST", body:JSON.stringify(body) });
    resetBookForm(); setMessage("bookMessage", id ? "Book updated successfully." : "Book added successfully.", true);
    await loadDashboard(); notify("Your bookshelf has been updated.");
  } catch (error) { setMessage("bookMessage", error.message); }
});
async function editBook(id) {
  try {
    const { books } = await api("/my-books");
    const book = books.find(item => item.id === id);
    if (!book) return notify("Book not found.");
    $("bookId").value = book.id; $("bookTitle").value = book.title; $("bookAuthor").value = book.author;
    $("bookCategory").value = book.category; $("bookPrice").value = book.price; $("bookDescription").value = book.description || "";
    $("bookFormTitle").textContent = "Edit book"; $("saveBookButton").textContent = "Save changes";
    $("cancelEdit").classList.remove("hidden"); $("bookTitle").focus(); window.scrollTo({top:0,behavior:"smooth"});
  } catch (error) { notify(error.message); }
}
async function deleteBook(id) {
  if (!confirm("Are you sure you want to delete this book?")) return;
  try { await api(`/books/${id}`, { method:"DELETE" }); await loadDashboard(); notify("Book deleted."); }
  catch (error) { notify(error.message); }
}
function resetBookForm() {
  $("bookForm").reset(); $("bookId").value = ""; $("bookFormTitle").textContent = "Add a book";
  $("saveBookButton").textContent = "Add book"; $("cancelEdit").classList.add("hidden");
}
$("profileForm").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    const data = await api("/auth/profile", { method:"PUT", body:JSON.stringify({name:$("profileName").value}) });
    currentUser = data.user; $("welcomeName").textContent = currentUser.name; updateNavigation();
    setMessage("profileMessage", "Profile updated successfully.", true);
  } catch (error) { setMessage("profileMessage", error.message); }
});
function logout(showNotice = true) {
  localStorage.removeItem("booknest_token"); currentUser = null; updateNavigation();
  if (showNotice) notify("You have logged out.");
  showPage("home");
}
async function init() {
  if (token()) {
    try { const data = await api("/auth/me"); currentUser = data.user; }
    catch { localStorage.removeItem("booknest_token"); }
  }
  updateNavigation(); showPage("home");
}
init();
