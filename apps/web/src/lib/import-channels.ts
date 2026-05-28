export type ImportChannelId =
  | "whatsapp"
  | "telegram"
  | "instagram"
  | "facebook"
  | "messenger";

export type ImportChannel = {
  id: ImportChannelId;
  label: string;
  accept: string;
  fileTypes: string;
  exportUrl: string;
  exportSteps: string[];
};

export const IMPORT_CHANNELS: ImportChannel[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    accept: ".txt,.zip",
    fileTypes: ".txt (chat exportado) ou .zip",
    exportUrl: "https://faq.whatsapp.com/general/chats/how-to-export-your-chat-history",
    exportSteps: [
      "Abra a conversa ou grupo no WhatsApp.",
      "Toque em Mais opções → Exportar conversa.",
      "Escolha Com mídia ou Sem mídia e salve o .txt.",
      "Envie o arquivo aqui (ou compacte vários chats em .zip).",
    ],
  },
  {
    id: "telegram",
    label: "Telegram",
    accept: ".json,.zip",
    fileTypes: "result.json (Telegram Desktop) ou .zip",
    exportUrl: "https://telegram.org/blog/export-and-iphone-import",
    exportSteps: [
      "No Telegram Desktop: Configurações → Avançado → Exportar dados do Telegram.",
      "Selecione apenas Mensagens de texto e o período desejado.",
      "Após o download, use o result.json da pasta de exportação.",
    ],
  },
  {
    id: "instagram",
    label: "Instagram",
    accept: ".json,.zip",
    fileTypes: "JSON de mensagens (export Meta) ou .zip completo",
    exportUrl: "https://accountscenter.instagram.com/info_and_permissions/dyi/",
    exportSteps: [
      "Centro de Contas Meta → Suas informações e permissões → Transferir informações.",
      "Escolha Instagram → Mensagens (formato JSON) e solicite o download.",
      "Descompacte o ZIP e envie o arquivo ou o .zip inteiro.",
    ],
  },
  {
    id: "facebook",
    label: "Facebook",
    accept: ".json,.zip",
    fileTypes: "JSON da pasta messages/inbox ou .zip da exportação",
    exportUrl: "https://www.facebook.com/dyi",
    exportSteps: [
      "Acesse Transferir uma cópia das suas informações no Facebook.",
      "Selecione Mensagens, formato JSON e crie o arquivo.",
      "Envie message_*.json ou o ZIP da exportação.",
    ],
  },
  {
    id: "messenger",
    label: "Messenger",
    accept: ".json,.zip",
    fileTypes: "JSON messages/inbox (export Meta) ou .zip",
    exportUrl: "https://www.facebook.com/dyi",
    exportSteps: [
      "No mesmo fluxo de download de dados da Meta, inclua Messenger.",
      "Escolha JSON; os ficheiros ficam em messages/inbox/.",
      "Envie um thread JSON ou o pacote .zip completo.",
    ],
  },
];

export function getChannel(id: string): ImportChannel | undefined {
  return IMPORT_CHANNELS.find((c) => c.id === id);
}
