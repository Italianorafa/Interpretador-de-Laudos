// --- CHAVES DAS APIS ---
const GEMINI_API_KEY = 'AQ.Ab8RN6IR9bPiTut75pKxxKwUXhSCwy6gmLd6OajariK2pjc1kw'; 
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key=${GEMINI_API_KEY}`;

const SUPABASE_URL = 'https://kxdpgmpgmnogmtqvsask.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IPgFjiWNCGpdFjVIdaX_Rg_PHNHM6R9';

// Inicia o cliente Supabase globalmente
const clienteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Função global para verificar se o médico está logado (proteção de rotas)
async function verificarAutenticacao() {
    const { data: { session }, error } = await clienteSupabase.auth.getSession();
    
    if (error || !session) {
        window.location.href = 'login.html'; // Expulsa para o login se não estiver logado
        return null;
    }
    
    // Configura o cabeçalho com os dados do médico nas páginas protegidas
    const crm = session.user.user_metadata.crm || 'CRM-INDEFINIDO';
    const crmElement = document.getElementById('medicoLogadoCrm');
    const nameElement = document.getElementById('medicoLogadoName');
    
    if (crmElement && nameElement) {
        crmElement.innerText = crm;
        nameElement.innerText = "Dr(a). " + crm.split('-')[0];
    }
    
    return { session, crm };
}

// Função global de Logout
async function fazerLogout() {
    await clienteSupabase.auth.signOut();
    window.location.href = 'login.html';
}

// Atribui o evento ao botão de Sair (se ele existir na página)
document.addEventListener("DOMContentLoaded", () => {
    const btnSair = document.getElementById('btnSair');
    if (btnSair) {
        btnSair.addEventListener('click', fazerLogout);
    }
});