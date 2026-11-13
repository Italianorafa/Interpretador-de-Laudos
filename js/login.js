document.addEventListener("DOMContentLoaded", async () => {
    // Se já estiver logado, redireciona direto para a consulta
    const { data: { session } } = await clienteSupabase.auth.getSession();
    if (session) {
        window.location.href = 'consulta.html';
        return;
    }

    let isLoginMode = true;
    const btnEntrar = document.getElementById('btnEntrar');
    const toggleAuthMode = document.getElementById('toggleAuthMode');
    const authCrm = document.getElementById('authCrm');
    const loginTitle = document.getElementById('loginTitle');
    const authLoading = document.getElementById('authLoading');
    const inputEmail = document.getElementById('authEmail');
    const inputSenha = document.getElementById('authSenha');

    function aplicarModoLogin() {
        isLoginMode = true;
        loginTitle.innerText = "⚕️ CDSS";
        btnEntrar.innerText = "Acessar Sistema";
        authCrm.classList.add('hidden');
        toggleAuthMode.innerHTML = 'Não tem conta? <strong>Registe-se aqui</strong>';
    }

    toggleAuthMode.addEventListener('click', () => {
        if (!isLoginMode) {
            aplicarModoLogin();
        } else {
            isLoginMode = false;
            loginTitle.innerText = "Criar Conta Médica";
            btnEntrar.innerText = "Registar e Acessar";
            authCrm.classList.remove('hidden');
            toggleAuthMode.innerHTML = 'Já tem conta? <strong>Faça Login</strong>';
        }
    });

    // Preenchimento rápido com 1 clique nas contas de demonstração
    document.querySelectorAll('.demo-account-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            aplicarModoLogin();
            if (inputEmail) inputEmail.value = btn.getAttribute('data-email') || '';
            if (inputSenha) inputSenha.value = btn.getAttribute('data-senha') || '';
            if (btnEntrar) btnEntrar.focus();
        });
    });

    btnEntrar.addEventListener('click', async () => {
        const email = inputEmail ? inputEmail.value.trim() : '';
        const password = inputSenha ? inputSenha.value.trim() : '';
        const crm = authCrm.value.trim();

        if (!email || !password) {
            alert('Preencha o e-mail e a palavra-passe.');
            return;
        }
        if (!isLoginMode && !crm) {
            alert('O CRM é obrigatório para criar a conta.');
            return;
        }

        authLoading.classList.remove('hidden');
        btnEntrar.disabled = true;

        try {
            if (!isLoginMode) {
                const { error: signUpError } = await clienteSupabase.auth.signUp({
                    email, password, options: { data: { crm: crm } }
                });
                if (signUpError) throw signUpError;
            }

            const { error: signInError } = await clienteSupabase.auth.signInWithPassword({
                email, password
            });
            if (signInError) throw signInError;

            // Login feito com sucesso, redireciona para a página principal
            window.location.href = 'consulta.html';

        } catch (error) {
            console.error(error);
            alert("Falha na autenticação: Verifique as credenciais.");
        } finally {
            authLoading.classList.add('hidden');
            btnEntrar.disabled = false;
        }
    });
});
