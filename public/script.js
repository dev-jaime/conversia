// script.js - frontend logic (compat version para firebase-compat)

// === CONFIG: substitua pelo seu config do Firebase ===
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

// inicia Firebase (compat libs carregadas no HTML)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// util: gerar código complexo (usuário e senha temporária)
function gerarCodigo(len = 12) {
  const alfa = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const symbols = '!@#$%&*_-+=';
  let out = '';
  for (let i = 0; i < len; i++) {
    // mistura letras e números, e insere simbolos aleatórios
    if (i % 4 === 0) out += symbols[Math.floor(Math.random() * symbols.length)];
    out += alfa[Math.floor(Math.random() * alfa.length)];
  }
  return out;
}

// DOM helpers
const modalRegister = document.getElementById('modal-register');
const modalLogin = document.getElementById('modal-login');
const btnOpenRegister = document.getElementById('btn-open-register');
const btnOpenLogin = document.getElementById('btn-open-login');

function openModal(modal){ modal.setAttribute('aria-hidden','false'); }
function closeModal(modal){ modal.setAttribute('aria-hidden','true'); }

document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', e => {
  const m = e.target.closest('.modal'); if (m) closeModal(m);
}));

btnOpenRegister.addEventListener('click', () => openModal(modalRegister));
btnOpenLogin.addEventListener('click', () => openModal(modalLogin));

// Formulário registro
const formRegister = document.getElementById('form-register');
formRegister.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = new FormData(formRegister);
  const nome = f.get('nome').trim();
  const documento = f.get('documento').trim();
  const descricao = f.get('descricao').trim();
  const email = f.get('email').trim();

  // gera usuário e senha temporária
  const userCode = gerarCodigo(12);
  const tempPass = gerarCodigo(12);

  try {
    // cria usuário no Firebase Auth com senha temporária
    const userRecord = await auth.createUserWithEmailAndPassword(email, tempPass);

    // salva dados cadastrais no Firestore
    await db.collection('users').doc(userRecord.user.uid).set({
      nome,
      documento,
      descricao,
      email,
      userCode,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'pending'
    });

    // chama cloud function para envio de e-mail (opcional)
    const sendEmail = firebase.functions ? firebase.functions().httpsCallable('sendSignupEmail') : null;
    if (sendEmail) {
      await sendEmail({ email, nome, userCode, tempPass });
    } else {
      console.warn('Cloud Functions não disponível no cliente. Configure o envio de e-mails.');
    }

    alert('Cadastro efetuado. Verifique seu e-mail com usuário e senha temporária.');
    closeModal(modalRegister);
  } catch (err) {
    console.error(err);
    alert('Erro no cadastro: ' + (err.message || err));
  }
});

// Form login
const formLogin = document.getElementById('form-login');
formLogin.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = new FormData(formLogin);
  const email = f.get('email').trim();
  const password = f.get('password');

  try {
    const r = await auth.signInWithEmailAndPassword(email, password);
    loadPrivateArea(r.user);
    closeModal(modalLogin);
  } catch (err) {
    console.error(err);
    alert('Erro no login: ' + (err.message || err));
  }
});

// Função para popular área privada
async function loadPrivateArea(user) {
  const uid = user.uid;
  const doc = await db.collection('users').doc(uid).get();
  if (!doc.exists) return alert('Dados de usuário não encontrados.');
  const data = doc.data();
  document.getElementById('u-nome').textContent = data.nome;
  document.getElementById('u-doc').textContent = data.documento;
  document.getElementById('u-user').textContent = data.userCode;
  document.getElementById('private-area').hidden = false;
  document.querySelector('main').hidden = true;
}

// Logout
document.getElementById('btn-logout').addEventListener('click', async () => {
  await auth.signOut();
  location.reload();
});

// Mantém sessão
auth.onAuthStateChanged(user => {
  if (user) loadPrivateArea(user);
});

// Validação de senha nova (mínimo 8 caracteres)
function validarSenha(novaSenha) {
  if (!novaSenha || novaSenha.length < 8) return false;
  // regras adicionais podem ser adicionadas aqui (símbolos, números, maiúsculas)
  return true;
}
