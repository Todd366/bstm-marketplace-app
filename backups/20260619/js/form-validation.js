const FormValidator = {
    validateEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    validatePhone: (phone) => /^\+?267\d{8}$/.test(phone),
    validateOmang: (omang) => /^\d{9}$/.test(omang),
    validatePassword: (password) => password.length >= 8,
    showError: (input, message) => {
        const error = document.createElement('p');
        error.className = 'text-red-500 text-sm mt-1';
        error.textContent = message;
        input.parentNode.appendChild(error);
    }
};
window.FormValidator = FormValidator;
