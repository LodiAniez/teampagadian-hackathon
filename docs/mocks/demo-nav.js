// Raket Demo — auto-injects the "Demo flow" menu into every screen.
// Each HTML file ships the bar shell; this script fills the dropdown.

const RAKET_SCREENS = [
  { n: "01", href: "login.html", title: "Login (phone + OTP)" },
  { n: "02", href: "dashboard.html", title: "Dashboard" },
  { n: "03", href: "invoice-create.html", title: "Create invoice" },
  { n: "04", href: "invoice-sent.html", title: "Invoice sent" },
  { n: "05", href: "email.html", title: "Client email" },
  { n: "06", href: "pay.html", title: "Client pay page" },
  { n: "07", href: "stripe-checkout.html", title: "Stripe checkout" },
  { n: "08", href: "settlement-animation.html", title: "Settlement (wow)" },
  { n: "09", href: "dashboard.html?paid=1", title: "Dashboard (paid)" },
  { n: "10", href: "ai-chat.html", title: "Ask your books (AI)" },
  { n: "11", href: "bir-tax.html", title: "BIR ITR" },
];

(function () {
  const menu = document.getElementById("demoMenu");
  if (!menu) return;

  menu.innerHTML = `
    <a href="index.html"><span class="step-num">·</span> Cover / hub</a>
    ${RAKET_SCREENS.map((s) => `<a href="${s.href}"><span class="step-num">${s.n}</span> ${s.title}</a>`).join("")}
  `;

  const current = location.pathname.split("/").pop() || "index.html";
  const currentWithQuery = current + location.search;
  menu.querySelectorAll("a").forEach((a) => {
    const ahref = a.getAttribute("href");
    if (ahref === currentWithQuery || ahref.split("?")[0] === current) {
      a.classList.add("current");
    }
  });

  window.toggleDemoMenu = function (e) {
    if (e) e.stopPropagation();
    const m = document.getElementById("demoMenu");
    const btn = document.getElementById("demoBtn");
    const isOpen = m.classList.toggle("open");
    if (btn) btn.setAttribute("aria-expanded", String(isOpen));
  };

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".demo-bar")) menu.classList.remove("open");
  });
})();
