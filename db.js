const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
    // Tabela de Usuários
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        email TEXT UNIQUE,
        senha TEXT
    )`);

    // Tabela de Eventos
    db.run(`CREATE TABLE IF NOT EXISTS eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        descricao TEXT,
        valor REAL
    )`);

    // Tabela de Inscrições - ESSENCIAL PARA O DASHBOARD
    db.run(`CREATE TABLE IF NOT EXISTS inscricoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_evento INTEGER,
        email_participante TEXT,
        status TEXT DEFAULT 'pendente',
        UNIQUE(id_evento, email_participante),
        FOREIGN KEY (id_evento) REFERENCES eventos(id)
    )`);

    console.log("✅ Banco de dados pronto e tabelas verificadas.");
});

module.exports = db;