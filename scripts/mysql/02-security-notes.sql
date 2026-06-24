-- TWIN — restringir usuário twin apenas a bancos twin_* (opcional, mais seguro)
-- Use depois do 01-create-landlord.sql se quiser revogar CREATE global amplo.
--
-- Em servidores dedicados ao TWIN, manter CREATE ON *.* é aceitável.
-- Em MySQL compartilhado, prefira um usuário só para TWIN.

-- REVOKE CREATE ON *.* FROM 'twin'@'%';
-- GRANT CREATE ON `twin_tenant\_%`.* TO 'twin'@'%';  -- MySQL 8 não suporta CREATE em wildcard assim
-- Solução: manter GRANT CREATE ON *.* apenas para o usuário twin em servidor exclusivo.
