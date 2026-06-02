const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const db = require("./db");

const app = express();

// 1. CONFIGURAÇÕES DE SESSÃO E PARSER
app.use(session({
    secret: 'chave-secreta-academia-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, 
        maxAge: 3600000 // 1 hora
    } 
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

/* --- MIDDLEWARES DE SEGURANÇA --- */
function verificarLogin(req, res, next) {
    if (!req.session.userEmail) return res.status(401).send("Faça login primeiro.");
    next();
}

function verificarAdmin(req, res, next) {
    // Log de debug para o terminal
    console.log("Tentativa de acesso Admin por:", req.session.userEmail);
    if (req.session.userEmail === "admin@admin.com") {
        return next();
    }
    res.status(403).send("Acesso Negado: Apenas o Administrador pode fazer isso.");
}

/* --- ROTAS DE AUTENTICAÇÃO --- */

app.get("/", (req, res) => res.redirect("/login.html"));

app.post("/cadastrar", async (req, res) => {
    const { nome, email, senha } = req.body;
    try {
        const senhaCripto = await bcrypt.hash(senha, 10);
        db.run(`INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)`, 
        [nome, email, senhaCripto], (err) => {
            if (err) {
                if (err.message.includes("UNIQUE")) return res.send("Erro: E-mail já cadastrado.");
                return res.status(500).send("Erro ao cadastrar.");
            }
            res.redirect("/login.html");
        });
    } catch (e) {
        res.status(500).send("Erro no servidor.");
    }
});

app.post("/login", (req, res) => {
    const { email, senha } = req.body;

    // LOGIN DO ADMINISTRADOR
    if (email === "admin@admin.com" && senha === "123") {
        req.session.userEmail = "admin@admin.com";
        req.session.userName = "Admin";
        return req.session.save((err) => {
            if (err) return res.status(500).send("Erro na sessão.");
            res.redirect("/dashboard.html");
        });
    }

    // LOGIN DO ALUNO
    db.get("SELECT * FROM usuarios WHERE email = ?", [email], async (err, user) => {
        if (err) return res.status(500).send("Erro no banco.");
        if (user && await bcrypt.compare(senha, user.senha)) {
            req.session.userEmail = user.email;
            req.session.userName = user.nome;
            req.session.save(() => res.redirect("/participante.html"));
        } else {
            res.send("E-mail ou senha incorretos.");
        }
    });
});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/login.html");
});

/* --- ROTAS DO ALUNO --- */

app.get("/eventos", (req, res) => {
    db.all("SELECT * FROM eventos", [], (err, rows) => res.json(rows || []));
});

app.post("/inscrever/:id", verificarLogin, (req, res) => {
    const idEvento = req.params.id;
    const email = req.session.userEmail;
    
    db.run(`INSERT INTO inscricoes (id_evento, email_participante, status) VALUES (?, ?, 'pendente')`, 
    [idEvento, email], (err) => {
        if (err) {
            if (err.message.includes("UNIQUE")) return res.status(400).send("Você já está inscrito!");
            return res.status(500).send("Erro ao se inscrever.");
        }
        res.send("Inscrição confirmada! Aguarde a aprovação do administrador.");
    });
});

app.get("/meus-eventos", verificarLogin, (req, res) => {
    const email = req.session.userEmail;
    const sql = `SELECT eventos.nome as nome_evento, inscricoes.status 
                 FROM inscricoes 
                 JOIN eventos ON inscricoes.id_evento = eventos.id 
                 WHERE inscricoes.email_participante = ?`;
    db.all(sql, [email], (err, rows) => res.json(rows || []));
});

/* --- ROTAS DO ADMINISTRADOR (DASHBOARD) --- */

app.post("/criar-evento", verificarAdmin, (req, res) => {
    const { nome, descricao, valor } = req.body;
    db.run(`INSERT INTO eventos (nome, descricao, valor) VALUES (?, ?, ?)`, 
    [nome, descricao, valor], (err) => {
        if (err) return res.status(500).send("Erro ao criar evento.");
        res.redirect("/dashboard.html");
    });
});

app.post("/admin/deletar-evento/:id", verificarAdmin, (req, res) => {
    const idEvento = req.params.id;
    // Remove as inscrições do evento primeiro, depois o evento
    db.run(`DELETE FROM inscricoes WHERE id_evento = ?`, [idEvento], (err) => {
        if (err) return res.status(500).send("Erro ao remover inscrições do evento.");
        db.run(`DELETE FROM eventos WHERE id = ?`, [idEvento], (err2) => {
            if (err2) return res.status(500).send("Erro ao deletar evento.");
            res.send("OK");
        });
    });
});

// LISTA DE TODOS OS INSCRITOS PARA O ADMIN
app.get("/admin/inscritos", verificarAdmin, (req, res) => {
    const sql = `SELECT 
                    inscricoes.id, 
                    eventos.nome as evento_nome, 
                    inscricoes.email_participante, 
                    inscricoes.status 
                 FROM inscricoes 
                 JOIN eventos ON inscricoes.id_evento = eventos.id
                 ORDER BY inscricoes.id DESC`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Erro no SQL do Admin:", err.message);
            return res.status(500).json([]);
        }
        res.json(rows || []);
    });
});

app.post("/admin/aprovar-pagamento/:id", verificarAdmin, (req, res) => {
    const idInscricao = req.params.id;
    db.run(`UPDATE inscricoes SET status = 'pago' WHERE id = ?`, [idInscricao], (err) => {
        if (err) return res.status(500).send("Erro ao aprovar.");
        res.send("OK");
    });
});

app.post("/admin/cancelar-inscricao/:id", verificarAdmin, (req, res) => {
    const idInscricao = req.params.id;
    db.run(`DELETE FROM inscricoes WHERE id = ?`, [idInscricao], (err) => {
        if (err) return res.status(500).send("Erro ao deletar.");
        res.send("OK");
    });
});

/* --- START DO SERVIDOR --- */
const PORT = 3000;
app.listen(PORT, () => {
    console.log("==========================================");
    console.log(`🚀 Servidor rodando: http://localhost:${PORT}`);
    console.log("==========================================");
});