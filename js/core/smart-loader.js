(function () {
    function loadPageModule() {
        const page = document.body.dataset.page || "index";
        const script = document.createElement("script");
        script.src = `js/pages/${page}.js`;
        script.type = "module";
        document.body.appendChild(script);
    }

    function initComponents() {
        document.querySelectorAll("[data-component]").forEach(el => {
            const name = el.getAttribute("data-component");
            fetch(`./components/${name}.html`)
                .then(r => r.text())
                .then(html => el.innerHTML = html);
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        initComponents();
        loadPageModule();
    });
})();
