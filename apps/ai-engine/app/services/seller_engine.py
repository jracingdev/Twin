"""Modo Vendedor — motopeças, autopeças, ERP."""

from typing import Any

DEFAULT_PLAYBOOKS = [
    {
        "intent": "objection_price",
        "template": "Entendo a questão do preço. Essa peça tem garantia de {garantia} e entrega em {prazo}. Posso montar um kit com desconto progressivo?",
        "variables": ["garantia", "prazo"],
    },
    {
        "intent": "closing",
        "template": "Fechado então! Confirmo: {peca}, quantidade {qtd}, total R$ {valor}. Envio o PIX ou prefere faturado no ERP?",
        "variables": ["peca", "qtd", "valor"],
    },
    {
        "intent": "upsell",
        "template": "Aproveitando: temos o {peca_relacionada} com ótimo giro. Quer incluir no pedido com 10% no combo?",
        "variables": ["peca_relacionada"],
    },
    {
        "intent": "reactivation",
        "template": "Fala! Faz um tempo que não nos falamos. Chegou reposição de {categoria} que você costuma pedir. Quer que eu separe?",
        "variables": ["categoria"],
    },
]


class SellerEngine:
    def extract_playbooks(self, messages: list[dict], vertical: str = "autopecas") -> list[dict]:
        playbooks = []
        for msg in messages:
            body = (msg.get("body") or "").lower()
            if any(k in body for k in ("fechado", "pix", "orçamento", "faturado")):
                playbooks.append({
                    "intent": "closing",
                    "vertical": vertical,
                    "template": msg.get("body", "")[:500],
                    "variables": [],
                })
            elif any(k in body for k in ("caro", "preço", "desconto")):
                playbooks.append({
                    "intent": "objection_price",
                    "vertical": vertical,
                    "template": msg.get("body", "")[:500],
                    "variables": [],
                })
        if not playbooks:
            return [{**p, "vertical": vertical} for p in DEFAULT_PLAYBOOKS]
        return playbooks[:20]

    def apply_template(self, template: str, variables: dict[str, str]) -> str:
        out = template
        for k, v in variables.items():
            out = out.replace("{" + k + "}", v)
        return out

    def detect_opportunity(self, text: str) -> dict[str, Any] | None:
        low = text.lower()
        if any(w in low for w in (
            "orçamento", "orcamento", "preço", "preco", "peça", "peca",
            "estoque", "prazo", "quanto custa", "valor", "disponível", "disponivel",
            "quero comprar", "fechamos", "pedido",
        )):
            return {"type": "sale_intent", "confidence": 0.8}
        if any(w in low for w in (
            "não tenho", "nao tenho", "caro", "depois", "desconto",
            "mais barato", "concorrente", "vou pensar",
        )):
            return {"type": "objection", "confidence": 0.7}
        if any(w in low for w in ("obrigado", "valeu", "fechado", "pode enviar", "manda o pix")):
            return {"type": "closing", "confidence": 0.75}
        return None

    def metrics(self, accepted: int, rejected: int) -> dict[str, float]:
        total = accepted + rejected or 1
        return {
            "acceptance_rate": round(accepted / total, 4),
            "suggestions_total": total,
        }
