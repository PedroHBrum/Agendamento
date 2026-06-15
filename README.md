# ✂️ Sistema de Agendamento Online — Salão de Beleza

Sistema completo com agendamento, painel admin, CRM, relatórios e notificações WhatsApp.

---

## 🚀 Deploy no Vercel (passo a passo)

### 1. Supabase — banco de dados
1. Acesse **supabase.com** → crie conta → **New project**
2. Escolha região: **South America (São Paulo)**
3. Vá em **SQL Editor** → **New query**
4. Cole TODO o SQL de dentro de `src/lib/supabase.js` → clique **Run**
5. Vá em **Settings** → **API** → copie:
   - **Project URL**
   - **anon / public key**

### 2. GitHub — repositório
1. Acesse **github.com** → crie conta → **New repository**
2. Nome: `salon-booking` → **Public** → **Create**
3. Faça upload de todos os arquivos desta pasta

### 3. Vercel — deploy
1. Acesse **vercel.com** → login com GitHub
2. **Add New → Project** → selecione `salon-booking`
3. Em **Environment Variables**, adicione:
   ```
   REACT_APP_SUPABASE_URL      = (URL do Supabase)
   REACT_APP_SUPABASE_ANON_KEY = (anon key do Supabase)
   REACT_APP_SALON_NAME        = Nome do Seu Salão
   GENERATE_SOURCEMAP          = false
   ```
4. Clique **Deploy** — pronto! ✅

> ⚠️ A variável `GENERATE_SOURCEMAP=false` é obrigatória para evitar erro de memória no build.

---

## 🔐 Painel admin

- Acesse pelo ícone 🔒 Admin na barra inferior
- Senha padrão: **salon2024**
- **Troque a senha imediatamente** pelo painel: aba Config → Segurança

---

## 🛠 Personalização pelo painel admin

Tudo é configurável sem mexer no código:

| O que configurar | Onde no admin |
|---|---|
| Nome, telefone, endereço | Config → Informações do salão |
| Serviços e preços | Aba Serviços |
| Profissionais e vínculos | Aba Equipe |
| Horário de funcionamento | Config → Horário |
| Notificação WhatsApp | Config → WhatsApp |
| Lembrete automático | Config → Lembrete |
| Comissões | Config → Comissões |
| Senha do admin | Config → Segurança |

---

## 📦 Estrutura do projeto

```
salon-app/
├── public/index.html
├── src/
│   ├── lib/supabase.js          ← config + SQL completo do banco
│   ├── hooks/useAuth.js         ← autenticação WhatsApp OTP
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── BookingPage.jsx      ← agendamento 4 passos
│   │   ├── MyAppointmentsPage.jsx
│   │   ├── AdminPage.jsx        ← painel completo
│   │   └── ProfilePage.jsx
│   ├── App.jsx
│   ├── index.css
│   └── index.js
├── vercel.json                  ← configuração do Vercel
├── .env.example                 ← modelo das variáveis
└── package.json
```

---

## ❓ Erros comuns

| Erro | Solução |
|---|---|
| Build falha com "digital envelope routines" | Adicione `GENERATE_SOURCEMAP=false` nas variáveis do Vercel |
| Tela branca após deploy | Verifique as variáveis REACT_APP_SUPABASE_URL e REACT_APP_SUPABASE_ANON_KEY |
| "Invalid API key" no console | A anon key do Supabase está errada ou faltando |
| SQL do Supabase deu erro | Use `CREATE TABLE IF NOT EXISTS` — já está assim no código |
| OTP não chega no WhatsApp | Normal sem Evolution API — veja o código no console (F12) |
