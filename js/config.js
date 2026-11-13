// --- CHAVES DAS APIS (Suporta window.ENV / localStorage com fallback padrão) ---
const GEMINI_API_KEY = (window.ENV && window.ENV.GEMINI_API_KEY) || localStorage.getItem('CDSS_GEMINI_API_KEY') || 'AQ.Ab8RN6I_ayhj3dZiRKJOetr1_bgvPgfuPagkz6--JrISuTDQnQ'; 
const GROQ_API_KEY = (window.ENV && window.ENV.GROQ_API_KEY) || localStorage.getItem('CDSS_GROQ_API_KEY') || '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';
const SUPABASE_URL = (window.ENV && window.ENV.SUPABASE_URL) || 'https://kxdpgmpgmnogmtqvsask.supabase.co';
const SUPABASE_KEY = (window.ENV && window.ENV.SUPABASE_KEY) || 'sb_publishable_IPgFjiWNCGpdFjVIdaX_Rg_PHNHM6R9';

window.clienteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 1. LOGOUT SEGURO E GLOBAL
// ==========================================
// Criamos uma função global que obriga o navegador a esperar a sessão ser apagada ANTES de mudar de ecrã
window.fazerLogout = async function() {
    console.log("A encerrar sessão no Supabase e a limpar cache...");
    await window.clienteSupabase.auth.signOut(); 
    window.location.href = 'login.html'; 
};

// ==========================================
// 2. AUTENTICAÇÃO E CONTROLO DE ACESSO (RBAC)
// ==========================================
window.verificarAutenticacao = async function() {
    const { data: { session }, error } = await window.clienteSupabase.auth.getSession();
    
    if (error || !session) {
        window.location.href = 'login.html';
        return null;
    }
    
    const crm = session.user.user_metadata.crm || 'CRM-INDEFINIDO';
    const nivelAcesso = session.user.user_metadata.acesso_level || 'Total'; 
    const nome = session.user.user_metadata.nome_completo || crm;
    
    const paginaAtual = window.location.pathname.toLowerCase();
    const btnConfig = document.querySelector('.settings-icon');

    // Regras da Recepção (Agendamento)
    if (nivelAcesso === 'Agendamento') {
        if (paginaAtual.includes('consulta.html') || paginaAtual.includes('pacientes.html') || paginaAtual.includes('configuracoes.html')) {
            window.location.href = 'recepcao.html';
            return null;
        }
        document.querySelectorAll('.header-nav a:not([href*="recepcao.html"])').forEach(el => el.style.display = 'none');
        if (btnConfig) btnConfig.style.display = 'none';
    } 
    // Regras da Gestão (Administrativo)
    else if (nivelAcesso === 'Administrativo') {
        if (paginaAtual.includes('consulta.html') || paginaAtual.includes('pacientes.html')) {
            window.location.href = 'recepcao.html';
            return null;
        }
        document.querySelectorAll('.header-nav a').forEach(el => {
            if (el.getAttribute('href').includes('consulta.html') || el.getAttribute('href').includes('pacientes.html')) {
                el.style.display = 'none';
            }
        });
        const nav = document.querySelector('.header-nav');
        if (nav && !document.querySelector('.header-nav a[href*="recepcao.html"]')) {
            nav.innerHTML = `<a href="recepcao.html" class="nav-item">Painel da Recepção</a>` + nav.innerHTML;
        }
    } 
    // Regras de Apenas Visualização (Leitura)
    else if (nivelAcesso === 'Leitura') {
        if (paginaAtual.includes('consulta.html') || paginaAtual.includes('configuracoes.html') || paginaAtual.includes('recepcao.html')) {
            window.location.href = 'pacientes.html';
            return null;
        }
        document.querySelectorAll('.header-nav a').forEach(el => {
            const href = el.getAttribute('href') || '';
            if (href.includes('consulta.html') || href.includes('recepcao.html')) {
                el.style.display = 'none';
            }
        });
        if (btnConfig) btnConfig.style.display = 'none';
        const btnNovaConsulta = document.querySelector('a[href="consulta.html"].btn-success');
        if (btnNovaConsulta) btnNovaConsulta.style.display = 'none';
    }
    // Regras Médicas (Total)
    else {
        if (!paginaAtual.includes('recepcao.html')) {
            document.querySelectorAll('.header-nav a[href*="recepcao.html"]').forEach(el => el.style.display = 'none');
        }
    }

    // Marca automaticamente a aba ativa na barra de navegação
    document.querySelectorAll('.header-nav .nav-item').forEach(link => {
        const href = (link.getAttribute('href') || '').toLowerCase();
        if (href && paginaAtual.includes(href)) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Configura o cabeçalho visualmente
    const crmElement = document.getElementById('medicoLogadoCrm');
    const nameElement = document.getElementById('medicoLogadoName');
    if (crmElement && nameElement) {
        crmElement.innerText = crm;
        const prefixo = (nivelAcesso === 'Total') ? 'Dr(a). ' : '';
        nameElement.innerText = prefixo + nome.split(' ')[0];
    }

    // Preenche os campos do Modal de Perfil com os dados atuais do usuário logado
    const metadata = session.user.user_metadata || {};
    const inputEmailPerfil = document.getElementById('perfilEmail');
    const inputNomePerfil = document.getElementById('perfilNome');
    const inputNascimentoPerfil = document.getElementById('perfilNascimento');
    const inputCpfPerfil = document.getElementById('perfilCpf');
    const inputCrmPessoalPerfil = document.getElementById('perfilCrmPessoal');

    if (inputEmailPerfil) inputEmailPerfil.value = session.user.email || '';
    if (inputNomePerfil) inputNomePerfil.value = metadata.nome_completo || '';
    if (inputNascimentoPerfil) inputNascimentoPerfil.value = metadata.data_nascimento || '';
    if (inputCpfPerfil) inputCpfPerfil.value = metadata.cpf || '';
    if (inputCrmPessoalPerfil) inputCrmPessoalPerfil.value = metadata.crm_pessoal || '';
    
    return { session, crm, nivelAcesso };
};

// ==========================================
// 3. EVENTOS DE TELA (BOTÕES DE SAIR E PERFIL)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    
    // Interceta todos os botões de logout do sistema e força-os a usar a via segura
    const botoesSair = document.querySelectorAll('#btnSair, #botaoLogout, .btn-logout');
    botoesSair.forEach(btn => {
        btn.removeAttribute('onclick'); // Remove o salto rápido do HTML
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            window.fazerLogout();
        });
    });

    // Lógica do Modal de Perfil
    const btnPerfil = document.getElementById('btnPerfil');
    const modalPerfil = document.getElementById('modalPerfil');
    const btnFecharPerfil = document.getElementById('btnFecharPerfil');

    if (btnPerfil && modalPerfil) btnPerfil.addEventListener('click', () => modalPerfil.style.display = 'flex');
    if (btnFecharPerfil && modalPerfil) btnFecharPerfil.addEventListener('click', () => modalPerfil.style.display = 'none');
    if (modalPerfil) {
        modalPerfil.addEventListener('click', (e) => {
            if (e.target === modalPerfil) modalPerfil.style.display = 'none';
        });
    }

    // Lógica para Salvar as edições do Perfil Pessoal
    const btnSalvarPerfil = document.getElementById('btnSalvarPerfil');
    if (btnSalvarPerfil) {
        btnSalvarPerfil.addEventListener('click', async () => {
            // Busca pelos IDs corretos definidos no HTML do Modal
            const inputNomePerfil = document.getElementById('perfilNome');
            const inputNascimentoPerfil = document.getElementById('perfilNascimento');
            const inputCpfPerfil = document.getElementById('perfilCpf');
            const inputCrmPessoalPerfil = document.getElementById('perfilCrmPessoal');

            const novoNome = inputNomePerfil ? inputNomePerfil.value.trim() : '';
            if (!novoNome) return alert("O Nome Completo é obrigatório.");

            const textoOriginal = btnSalvarPerfil.innerText;
            btnSalvarPerfil.innerText = "Salvando...";
            btnSalvarPerfil.disabled = true;

            try {
                const { error } = await window.clienteSupabase.auth.updateUser({
                    data: {
                        nome_completo: novoNome,
                        data_nascimento: inputNascimentoPerfil ? inputNascimentoPerfil.value : '',
                        cpf: inputCpfPerfil ? inputCpfPerfil.value.trim() : '',
                        crm_pessoal: inputCrmPessoalPerfil ? inputCrmPessoalPerfil.value.trim() : ''
                    }
                });

                if (error) throw error;

                alert("Dados pessoais atualizados com sucesso!");
                if (modalPerfil) modalPerfil.style.display = 'none';
                window.location.reload();

            } catch (error) {
                console.error(error);
                alert("Erro ao salvar os dados: " + error.message);
            } finally {
                btnSalvarPerfil.innerText = textoOriginal;
                btnSalvarPerfil.disabled = false;
            }
        });
    }
});
