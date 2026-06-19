import { initMenu } from "./core/menu.js";
import { getToken } from "./core/auth.js";

function bootstrap() {
  initMenu();

  const token = getToken();
  if (!token) {
    console.log("User not logged in");
  }
}

document.addEventListener("DOMContentLoaded", bootstrap);
