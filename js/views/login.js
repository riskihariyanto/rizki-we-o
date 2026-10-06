import { login, authMessage } from "../auth.js";

const TEMPLATE = `
  <section class="stack">
    <header>
      <h1>WO Vendor Portal</h1>
      <p class="muted">Masuk untuk mengelola jadwal dan pembayaran.</p>
    </header>
    <form class="card stack" novalidate>
      <label class="field">
        <span>Email</span>
        <input type="email" name="email" autocomplete="email" inputmode="email" required>
      </label>
      <label class="field">
        <span>Kata sandi</span>
        <input type="password" name="password" autocomplete="current-password" required>
      </label>
      <p class="error" data-error></p>
      <button class="btn" type="submit">Masuk</button>
    </form>
    <p class="center muted">Belum punya akun vendor? <a href="#/daftar">Daftar di sini</a></p>
  </section>
`;

export function render(root) {
  root.innerHTML = TEMPLATE;

  const form = root.querySelector("form");
  const errorBox = root.querySelector("[data-error]");
  const submit = form.querySelector("button");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.textContent = "";

    const email = form.email.value;
    const password = form.password.value;

    if (!email || !password) {
      errorBox.textContent = "Email dan kata sandi wajib diisi.";
      return;
    }

    submit.disabled = true;
    submit.textContent = "Memproses...";

    try {
      await login(email, password);
    } catch (err) {
      errorBox.textContent = authMessage(err);
      submit.disabled = false;
      submit.textContent = "Masuk";
    }
  });
}
