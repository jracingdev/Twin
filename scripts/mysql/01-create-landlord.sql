-- TWIN Platform — passo 1: banco landlord (central)
-- Execute como root no MySQL 8.0+ do seu servidor.
--
-- Substitua antes de rodar:
--   @twin_password  → senha forte do usuário da aplicação

CREATE DATABASE IF NOT EXISTS twin_landlord
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Usuário dedicado (ajuste o host: '%' = qualquer IP; '10.0.%' = rede interna)
CREATE USER IF NOT EXISTS 'twin'@'%' IDENTIFIED BY '@twin_password';

GRANT ALL PRIVILEGES ON twin_landlord.* TO 'twin'@'%';

-- Bancos de tenant: prefixo twin_tenant_{uuid}
GRANT ALL PRIVILEGES ON `twin_tenant\_%`.* TO 'twin'@'%';

-- Necessário para php artisan tenants:provision criar novos bancos
GRANT CREATE, DROP ON *.* TO 'twin'@'%';

FLUSH PRIVILEGES;

SELECT 'twin_landlord criado. Próximo: configure apps/api/.env e rode scripts/mysql/bootstrap' AS status;
