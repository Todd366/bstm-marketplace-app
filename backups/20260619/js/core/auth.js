export function getToken() {
  return localStorage.getItem("bstm_token");
}

export function setToken(token) {
  localStorage.setItem("bstm_token", token);
}

export function isLoggedIn() {
  return !!getToken();
}

export function logout() {
  localStorage.removeItem("bstm_token");
  localStorage.removeItem("bstm_user");
}
