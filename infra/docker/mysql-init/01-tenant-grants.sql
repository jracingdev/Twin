-- Executado na primeira inicialização do container MySQL (Docker)
-- Garante que o usuário twin possa criar bancos twin_tenant_*

GRANT ALL PRIVILEGES ON `twin_tenant\_%`.* TO 'twin'@'%';
GRANT CREATE, DROP ON *.* TO 'twin'@'%';
FLUSH PRIVILEGES;
