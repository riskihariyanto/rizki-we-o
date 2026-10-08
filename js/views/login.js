import { login, authMessage } from "../auth.js";

const TEMPLATE = `
  <section class="stack auth-page">
    <div class="auth-brand">
      <img src="./icons/logo-full-512.png" alt="WO Vendor Portal" class="auth-logo">
      <span class="auth-kicker">Vendor Portal</span>
    </div>

    <form class="card stack auth-form" novalidate>
      <label class="field">
        <span>Email</span>
        <input type="email" name="email" autocomplete="email" inputmode="email" placeholder="nama@email.com" required>
      </label>
      <label class="field">
        <span>Kata sandi</span>
        <input type="password" name="password" autocomplete="current-password" placeholder="Masukkan kata sandi" required>
      </label>
      <p class="error" data-error role="alert"></p>
      <button class="btn auth-submit" type="submit">Masuk</button>
    </form>

    <p class="center muted auth-footer">Belum punya akun vendor? <a href="#/daftar">Daftar di sini</a></p>
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